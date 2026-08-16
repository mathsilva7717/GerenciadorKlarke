/**
 * Atualização rápida do Klarke Control na VPS (sem mexer em nginx/certbot).
 *
 * Uso:  node deploy/atualizar-vps.js
 * Senha da VPS: variável de ambiente KLARKE_VPS_PASS, ou pergunta no terminal.
 *
 * O que faz:
 *   1. Builda o frontend localmente (frontend/dist).
 *   2. Envia backend/, frontend/dist, package.json, package-lock.json e start-server.js
 *      para /var/www/klarke.
 *   3. Roda npm install (backend) e reinicia o PM2 (klarke-app).
 *
 * NUNCA sobe: node_modules, database.sqlite, backend/.env e backend/uploads
 * (dados/segredos/uploads de produção ficam intactos).
 */
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { NodeSSH } = require(path.join(__dirname, '..', 'node_modules', 'node-ssh'));

const HOST = '191.252.223.63';
const DESTINO = '/var/www/klarke';
const PM2_NAME = 'klarke-app';
const PORTA = 3001;
const LOCAL = path.join(__dirname, '..');

// Caminhos que jamais devem ser sobrescritos na produção
const PROTEGIDOS = ['database.sqlite', 'database.sqlite-journal', '.env'];

function perguntarSenha() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Senha da VPS (root): ', (s) => { rl.close(); resolve(s.trim()); });
  });
}

async function run(ssh, cmd) {
  const r = await ssh.execCommand(cmd);
  if (r.code !== 0) throw new Error(`Comando falhou: ${cmd}\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

(async () => {
  const senha = process.env.KLARKE_VPS_PASS || await perguntarSenha();

  // 1) Build do frontend localmente
  console.log('Buildando o frontend (vite)...');
  execSync('npm run build', { cwd: path.join(LOCAL, 'frontend'), stdio: 'inherit' });

  const ssh = new NodeSSH();
  console.log(`\nConectando em root@${HOST}...`);
  await ssh.connect({ host: HOST, username: 'root', password: senha, readyTimeout: 20000 });

  console.log('Preparando diretórios...');
  await run(ssh, `mkdir -p ${DESTINO}/backend ${DESTINO}/frontend/dist`);

  // 2) Arquivos da raiz
  console.log('Enviando arquivos da raiz...');
  for (const f of ['package.json', 'package-lock.json', 'start-server.js']) {
    await ssh.putFile(path.join(LOCAL, f), `${DESTINO}/${f}`);
  }

  // 3) Backend (preserva DB, .env e uploads da produção)
  console.log('Enviando backend...');
  await ssh.putDirectory(path.join(LOCAL, 'backend'), `${DESTINO}/backend`, {
    recursive: true,
    concurrency: 4,
    validate: (itemPath) => {
      const base = path.basename(itemPath);
      const rel = path.relative(path.join(LOCAL, 'backend'), itemPath).replace(/\\/g, '/');
      if (base === 'node_modules' || rel.startsWith('node_modules/')) return false;
      if (base === 'uploads' || rel.startsWith('uploads/')) return false;
      if (PROTEGIDOS.includes(base)) return false;
      if (base.endsWith('.sqlite') || base.endsWith('.sqlite-journal')) return false;
      return true;
    },
  });

  // 4) Frontend buildado
  console.log('Enviando frontend/dist...');
  await ssh.putDirectory(path.join(LOCAL, 'frontend', 'dist'), `${DESTINO}/frontend/dist`, {
    recursive: true,
    concurrency: 4,
  });

  console.log('Instalando dependências (backend)...');
  await run(ssh, `cd ${DESTINO} && npm install --omit=dev --no-audit --no-fund 2>&1 | tail -1`);

  console.log('Reiniciando no PM2...');
  await run(ssh, `cd ${DESTINO} && (pm2 describe ${PM2_NAME} >/dev/null 2>&1 && pm2 restart ${PM2_NAME} --update-env || pm2 start start-server.js --name ${PM2_NAME}) && pm2 save`);

  const status = await run(ssh, `sleep 1 && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${PORTA}/`);
  console.log(`App respondendo na VPS: HTTP ${status}`);
  ssh.dispose();
  console.log('\nATUALIZADO! https://dashboard.klarke.com.br');
})().catch((e) => { console.error('\nFALHA:', e.message); process.exit(1); });
