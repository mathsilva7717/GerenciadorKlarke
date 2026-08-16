/**
 * Monitoramento da VPS + alertas no Telegram.
 *
 * Coleta (getVpsStats): CPU/load, memória, swap, disco (+ inodes), uptime,
 *   conexões por domínio (por porta), apps do PM2, processos que mais consomem,
 *   validade dos certificados SSL e usuários logados (Klarke, local).
 * Usuários logados por app (getLoggedInByApp, assíncrono): consulta cada app
 *   na porta local via /api/monitor/active-users (token compartilhado).
 * Alertas (tick a cada 60s):
 *   - Relatório coordenado nas horas de ALERT_HOURS.
 *   - Limite de DISCO / MEMÓRIA / SWAP / CPU (com cooldown).
 *   - App do PM2 que sai do ar (transição) e recuperação.
 *   - Certificado SSL perto de vencer.
 *   - Reinício da VPS.
 *
 * Configuração (lida do .env carregado pelo processo — hoje é o .env na raiz
 * do projeto, /var/www/klarke/.env, pois é onde o PM2 aponta o cwd):
 *   TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID   bot e grupo (grupo = id NEGATIVO)
 *   ALERT_HOURS (padrão 9,12,19,22) · ALERT_UTC_OFFSET (padrão -3)
 *   ALERT_DISK_LIMIT / ALERT_MEM_LIMIT / ALERT_SWAP_LIMIT (padrão 90)
 *   ALERT_LOAD_LIMIT (load/núcleo, padrão 3) · ALERT_SSL_DAYS (padrão 14)
 *   MONITOR_SHARED_TOKEN            token compartilhado com gestao/ecommerce/armazem
 *   MONITOR_APPS                    "gestao=3010,ecommerce=3012,armazem=3005"
 *   KLARKE_PORT (padrão 3001)
 */
const os = require('os');
const { execSync } = require('child_process');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const ALERT_HOURS = (process.env.ALERT_HOURS || '9,12,19,22')
  .split(',').map(h => parseInt(h.trim(), 10)).filter(h => !Number.isNaN(h));
const UTC_OFFSET = parseInt(process.env.ALERT_UTC_OFFSET ?? '-3', 10);
const DISK_LIMIT = parseInt(process.env.ALERT_DISK_LIMIT ?? '90', 10);
const MEM_LIMIT = parseInt(process.env.ALERT_MEM_LIMIT ?? '90', 10);
const SWAP_LIMIT = parseInt(process.env.ALERT_SWAP_LIMIT ?? '90', 10);
const LOAD_LIMIT = parseFloat(process.env.ALERT_LOAD_LIMIT ?? '3');
const SSL_ALERT_DAYS = parseInt(process.env.ALERT_SSL_DAYS ?? '14', 10);
// Nome diferente de MONITORING_TOKEN de propósito: esse já é usado pelo
// heartbeat/snapshot das máquinas (Klarke Repair em campo) e não deve ser trocado.
const MON_TOKEN = process.env.MONITOR_SHARED_TOKEN || '';
const KLARKE_PORT = parseInt(process.env.KLARKE_PORT ?? '3001', 10);
const THRESHOLD_COOLDOWN_MS = 6 * 60 * 60 * 1000;

// "gestao=3010,ecommerce=3012,armazem=3005" -> [{label, port}]
function parseApps(str) {
  return String(str || '').split(',').map(s => s.trim()).filter(Boolean).map(pair => {
    const [label, port] = pair.split('=');
    return { label: (label || '').trim(), port: parseInt(port, 10) };
  }).filter(a => a.label && !Number.isNaN(a.port));
}
const MONITOR_APPS = parseApps(process.env.MONITOR_APPS || 'gestao=3010,ecommerce=3012,armazem=3005');

const isConfigured = () => Boolean(TOKEN && CHAT_ID);
const isLinux = () => os.platform() === 'linux';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function esc(s) {
  return String(s).replace(/([_*`\[\]])/g, '\\$1');
}

// --- Provedor local de "usuários logados" do Klarke Control -------------------
let activeUsersProvider = null;
function setActiveUsersProvider(fn) { activeUsersProvider = typeof fn === 'function' ? fn : null; }

// --- Coletores individuais (tolerantes a falha) -------------------------------
function getSwap() {
  if (!isLinux()) return { total: '0.00', used: '0.00', percent: '0.00' };
  const out = sh("free -b | awk '/^Swap:/ {print $2, $3}'");
  const [totalB, usedB] = out.split(' ').map(Number);
  if (!totalB || Number.isNaN(totalB)) return { total: '0.00', used: '0.00', percent: '0.00' };
  return {
    total: (totalB / 1024 ** 3).toFixed(2),
    used: (usedB / 1024 ** 3).toFixed(2),
    percent: ((usedB / totalB) * 100).toFixed(2),
  };
}

function getInodesPercent() {
  return isLinux() ? (sh("df -i / | awk 'NR==2 {print $5}'") || '0%') : '0%';
}

function connCount(port) {
  if (!isLinux()) return 0;
  const n = sh(`ss -Htn state established '( dport = :${port} or sport = :${port} )' 2>/dev/null | wc -l`);
  return parseInt(n, 10) || 0;
}

// Conexões estabelecidas por domínio (via porta do backend de cada um).
function getConnByDomain() {
  const alvos = [{ label: 'klarke', port: KLARKE_PORT }, ...MONITOR_APPS];
  return alvos.map(a => ({ label: a.label, count: connCount(a.port) }));
}

function getPm2Apps() {
  const raw = sh('pm2 jlist 2>/dev/null');
  if (!raw) return [];
  try {
    return JSON.parse(raw).map(p => ({
      name: p.name,
      status: p.pm2_env ? p.pm2_env.status : 'desconhecido',
      restarts: p.pm2_env ? (p.pm2_env.restart_time || 0) : 0,
      cpu: p.monit ? p.monit.cpu : 0,
      memMB: p.monit ? Math.round((p.monit.memory || 0) / 1024 / 1024) : 0,
    }));
  } catch {
    return [];
  }
}

function getTopProcs(by = 'cpu', n = 3) {
  if (!isLinux()) return [];
  const col = by === 'mem' ? '%mem' : '%cpu';
  const out = sh(`ps -eo comm,${col} --sort=-${col} 2>/dev/null | sed 1d | head -n ${n}`);
  if (!out) return [];
  return out.split('\n').map(l => {
    const parts = l.trim().split(/\s+/);
    const val = parts.pop();
    return { name: parts.join(' '), val };
  }).filter(p => p.name);
}

// Validade dos certificados Let's Encrypt: [{domain, daysLeft}].
function getSsl() {
  if (!isLinux()) return [];
  const out = sh(
    'for d in /etc/letsencrypt/live/*/; do n=$(basename "$d"); f="$d/cert.pem"; ' +
    '[ -f "$f" ] && echo "$n|$(date -d "$(openssl x509 -enddate -noout -in "$f" | cut -d= -f2)" +%s)"; done'
  );
  if (!out) return [];
  const agora = Date.now() / 1000;
  return out.split('\n').map(l => {
    const [domain, epoch] = l.split('|');
    const e = parseInt(epoch, 10);
    if (!domain || Number.isNaN(e)) return null;
    return { domain, daysLeft: Math.floor((e - agora) / 86400) };
  }).filter(Boolean);
}

// Retrato completo (síncrono) da VPS.
function getVpsStats() {
  const totalMemGB = (os.totalmem() / 1024 ** 3).toFixed(2);
  const freeMemGB = (os.freemem() / 1024 ** 3).toFixed(2);
  const usedMemGB = (totalMemGB - freeMemGB).toFixed(2);
  const memPercent = ((usedMemGB / totalMemGB) * 100).toFixed(2);

  const cpus = os.cpus();
  const loadAvg = os.loadavg().map(l => l.toFixed(2));
  const uptimeHoras = (os.uptime() / 3600).toFixed(2);

  let diskTotal = '0', diskUsed = '0', diskPercent = '0%';
  if (isLinux()) {
    const [total, used, pct] = sh("df -h / | awk 'NR==2 {print $2, $3, $5}'").split(' ');
    diskTotal = total || '0'; diskUsed = used || '0'; diskPercent = pct || '0%';
  }

  let activeUsers = null;
  if (activeUsersProvider) { try { activeUsers = activeUsersProvider(); } catch { activeUsers = null; } }

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: uptimeHoras,
    memory: { total: totalMemGB, used: usedMemGB, free: freeMemGB, percent: memPercent },
    swap: getSwap(),
    cpu: { model: cpus.length > 0 ? cpus[0].model : 'Desconhecido', cores: cpus.length, load: loadAvg },
    disk: { total: diskTotal, used: diskUsed, percent: diskPercent, inodesPercent: getInodesPercent() },
    connByDomain: getConnByDomain(),
    pm2: getPm2Apps(),
    topCpu: getTopProcs('cpu'),
    topMem: getTopProcs('mem'),
    ssl: getSsl(),
    activeUsers,
  };
}

// Usuários logados por app (assíncrono; consulta cada porta local).
async function fetchCount(port) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const r = await fetch(`http://127.0.0.1:${port}/api/monitor/active-users`, {
      headers: { 'x-monitor-token': MON_TOKEN },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const d = await r.json();
    return typeof d.count === 'number' ? d.count : null;
  } catch {
    return null;
  }
}

async function getLoggedInByApp() {
  const klarke = activeUsersProvider ? (() => { try { return activeUsersProvider(); } catch { return null; } })() : null;
  const resultado = [{ label: 'klarke', count: klarke }];
  const outros = await Promise.all(MONITOR_APPS.map(async a => ({ label: a.label, count: await fetchCount(a.port) })));
  return resultado.concat(outros);
}

// --- Telegram -----------------------------------------------------------------
async function sendTelegram(text) {
  if (!isConfigured()) {
    return { ok: false, error: 'Telegram não configurado (defina TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no .env).' };
  }
  try {
    const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
    const data = await resp.json();
    if (!data.ok) return { ok: false, error: data.description || 'Erro ao enviar para o Telegram' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function formatReport(stats, titulo = 'Relatório VPS Klarke', loggedIn = null) {
  const diskWarn = parseInt(stats.disk.percent) >= DISK_LIMIT ? ' ⚠️' : '';
  const memWarn = parseFloat(stats.memory.percent) >= MEM_LIMIT ? ' ⚠️' : '';
  const swapWarn = parseFloat(stats.swap.percent) >= SWAP_LIMIT ? ' ⚠️' : '';
  const upH = Math.floor(stats.uptime);
  const upStr = upH >= 24 ? `${Math.floor(upH / 24)}d ${upH % 24}h` : `${upH}h`;

  const L = [
    `🖥️ *${titulo}*`,
    `\`${esc(stats.hostname)}\` · ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
    '',
    `⏱️ *Uptime:* ${upStr}`,
    `⚙️ *CPU:* ${stats.cpu.cores} núcleos · load ${stats.cpu.load.join(' / ')}`,
    `🧠 *RAM:*${memWarn} ${stats.memory.used} / ${stats.memory.total} GB (${stats.memory.percent}%)`,
  ];
  if (parseFloat(stats.swap.total) > 0) {
    L.push(`💤 *Swap:*${swapWarn} ${stats.swap.used} / ${stats.swap.total} GB (${stats.swap.percent}%)`);
  }
  L.push(`💽 *Disco:*${diskWarn} ${stats.disk.used} / ${stats.disk.total} (${stats.disk.percent}) · inodes ${stats.disk.inodesPercent}`);

  // Usuários logados por app
  const li = loggedIn || (stats.activeUsers !== null ? [{ label: 'klarke', count: stats.activeUsers }] : []);
  if (li.length) {
    const total = li.reduce((s, x) => s + (typeof x.count === 'number' ? x.count : 0), 0);
    L.push('', `👥 *Usuários logados (últimos 10 min):* ${total}`);
    for (const x of li) L.push(`   • ${esc(x.label)}: ${x.count === null ? '—' : x.count}`);
  }

  // Conexões por domínio
  if (stats.connByDomain && stats.connByDomain.length) {
    L.push('', `🌐 *Conexões por domínio:*`);
    for (const c of stats.connByDomain) L.push(`   • ${esc(c.label)}: ${c.count}`);
  }

  // Apps do PM2
  if (stats.pm2.length) {
    const online = stats.pm2.filter(a => a.status === 'online').length;
    L.push('', `📦 *Apps (PM2):* ${online}/${stats.pm2.length} online`);
    for (const a of stats.pm2) {
      const ic = a.status === 'online' ? '🟢' : '🔴';
      L.push(`   ${ic} ${esc(a.name)} — ${a.status} · ${a.cpu}% · ${a.memMB}MB · ${a.restarts}r`);
    }
  }

  // SSL — só destaca o que estiver perto de vencer
  if (stats.ssl && stats.ssl.length) {
    const perto = stats.ssl.filter(s => s.daysLeft <= 30).sort((a, b) => a.daysLeft - b.daysLeft);
    if (perto.length) {
      L.push('', `🔒 *SSL a vencer:*`);
      for (const s of perto) L.push(`   ${s.daysLeft <= SSL_ALERT_DAYS ? '⚠️' : '•'} ${esc(s.domain)}: ${s.daysLeft}d`);
    } else {
      L.push('', `🔒 *SSL:* todos > 30 dias`);
    }
  }
  return L.join('\n');
}

async function sendReport(titulo) {
  const stats = getVpsStats();
  const loggedIn = await getLoggedInByApp();
  return sendTelegram(formatReport(stats, titulo, loggedIn));
}

function tzNow() { return new Date(Date.now() + UTC_OFFSET * 3600 * 1000); }

let lastReportKey = null;
const lastThresholdAlert = {};
const pm2LastStatus = {};
let lastBootEpoch = null;

async function tick() {
  if (!isConfigured()) return;
  const now = tzNow();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  const stats = getVpsStats();

  // 0) Reinício da VPS
  const bootEpoch = Math.floor(Date.now() / 1000 - os.uptime());
  if (lastBootEpoch !== null && Math.abs(bootEpoch - lastBootEpoch) > 120) {
    await sendTelegram(`🔄 *VPS reiniciada* — \`${esc(stats.hostname)}\`\nNo ar há ${Math.floor(os.uptime() / 60)} min.`);
  }
  lastBootEpoch = bootEpoch;

  // 1) Relatório coordenado
  if (ALERT_HOURS.includes(hour) && minute < 5) {
    const key = `${dayKey}-${hour}`;
    if (lastReportKey !== key) {
      lastReportKey = key;
      const loggedIn = await getLoggedInByApp();
      const r = await sendTelegram(formatReport(stats, 'Relatório VPS Klarke', loggedIn));
      if (!r.ok) console.warn('Falha ao enviar relatório agendado:', r.error);
      else console.log(`[vps-alerts] relatório ${hour}h enviado.`);
    }
  }

  // 2) Limites (disco / memória / swap / cpu)
  const load1 = parseFloat(stats.cpu.load[0]);
  const loadPorNucleo = stats.cpu.cores ? load1 / stats.cpu.cores : load1;
  const topCpuStr = stats.topCpu.map(p => `${p.name} ${p.val}%`).join(', ') || '—';
  const topMemStr = stats.topMem.map(p => `${p.name} ${p.val}%`).join(', ') || '—';
  const checks = [
    { key: 'disk', value: parseInt(stats.disk.percent), limit: DISK_LIMIT, label: 'DISCO',
      msg: `Uso em *${stats.disk.percent}* (limite ${DISK_LIMIT}%).\n${stats.disk.used}/${stats.disk.total}` },
    { key: 'mem', value: parseFloat(stats.memory.percent), limit: MEM_LIMIT, label: 'MEMÓRIA',
      msg: `Uso em *${stats.memory.percent}%* (limite ${MEM_LIMIT}%).\n${stats.memory.used}/${stats.memory.total} GB\nTop: ${esc(topMemStr)}` },
    { key: 'swap', value: parseFloat(stats.swap.percent), limit: SWAP_LIMIT, label: 'SWAP',
      msg: `Uso em *${stats.swap.percent}%* (limite ${SWAP_LIMIT}%).\n${stats.swap.used}/${stats.swap.total} GB` },
    { key: 'cpu', value: loadPorNucleo, limit: LOAD_LIMIT, label: 'CPU',
      msg: `Load *${stats.cpu.load[0]}* em ${stats.cpu.cores} núcleos (*${loadPorNucleo.toFixed(2)}*/núcleo, limite ${LOAD_LIMIT}).\nTop: ${esc(topCpuStr)}` },
  ];
  for (const c of checks) {
    if (!Number.isNaN(c.value) && c.value >= c.limit) {
      const last = lastThresholdAlert[c.key] || 0;
      if (Date.now() - last >= THRESHOLD_COOLDOWN_MS) {
        lastThresholdAlert[c.key] = Date.now();
        const r = await sendTelegram(`🚨 *ALERTA — ${c.label} da VPS*\n${c.msg}\n\`${esc(stats.hostname)}\``);
        if (r.ok) console.log(`[vps-alerts] alerta de ${c.label} enviado.`);
      }
    }
  }

  // 3) Apps do PM2 (queda / recuperação)
  for (const app of stats.pm2) {
    const anterior = pm2LastStatus[app.name];
    if (anterior && anterior !== app.status) {
      if (app.status !== 'online') {
        await sendTelegram(`🔴 *APP FORA DO AR* — \`${esc(app.name)}\`\nStatus: *${app.status}* (${app.restarts} restarts)\n\`${esc(stats.hostname)}\``);
      } else {
        await sendTelegram(`🟢 *APP RECUPERADO* — \`${esc(app.name)}\` voltou a ficar *online*.`);
      }
    }
    pm2LastStatus[app.name] = app.status;
  }

  // 4) SSL perto de vencer (cooldown por domínio)
  for (const s of stats.ssl) {
    if (s.daysLeft <= SSL_ALERT_DAYS) {
      const k = `ssl:${s.domain}`;
      if (Date.now() - (lastThresholdAlert[k] || 0) >= THRESHOLD_COOLDOWN_MS) {
        lastThresholdAlert[k] = Date.now();
        await sendTelegram(`🔒 *SSL vencendo* — \`${esc(s.domain)}\`\nVence em *${s.daysLeft} dias*.`);
      }
    }
  }
}

function startVpsAlerts() {
  if (!isConfigured()) {
    console.warn('AVISO: alertas da VPS desativados (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID não definidos no .env).');
    return;
  }
  console.log(`[vps-alerts] ativo — relatórios às ${ALERT_HOURS.map(h => h + 'h').join(', ')} (UTC${UTC_OFFSET >= 0 ? '+' : ''}${UTC_OFFSET}); limites disco ${DISK_LIMIT}%/mem ${MEM_LIMIT}%/swap ${SWAP_LIMIT}%/cpu ${LOAD_LIMIT}; SSL<=${SSL_ALERT_DAYS}d; apps ${MONITOR_APPS.map(a => a.label).join(', ')}.`);
  tick().catch(e => console.warn('[vps-alerts] erro no primeiro tick:', e.message));
  setInterval(() => tick().catch(e => console.warn('[vps-alerts] erro no tick:', e.message)), 60 * 1000);
}

module.exports = {
  getVpsStats,
  getLoggedInByApp,
  sendTelegram,
  sendReport,
  formatReport,
  startVpsAlerts,
  setActiveUsersProvider,
  telegramConfigured: isConfigured,
  escTelegram: esc,
  alertConfig: { hours: ALERT_HOURS, utcOffset: UTC_OFFSET, diskLimit: DISK_LIMIT, memLimit: MEM_LIMIT, swapLimit: SWAP_LIMIT, loadLimit: LOAD_LIMIT, sslDays: SSL_ALERT_DAYS },
};
