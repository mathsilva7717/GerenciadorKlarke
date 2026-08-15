import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  Server, Cpu, HardDrive, Clock, Activity, Send, RefreshCw, Bell,
  CheckCircle2, AlertTriangle, Box, Users, Globe, Lock, MemoryStick
} from 'lucide-react';
import { getAuthConfig } from '../utils/auth';

const HORA_FMT = (h) => String(h).padStart(2, '0') + 'h';
const REFRESH_MS = 10000; // tela ao vivo: atualiza a cada 10s

function VPSMonitor() {
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [loggedIn, setLoggedIn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const first = useRef(true);

  const fetchStats = async () => {
    try {
      const [s, c, li] = await Promise.all([
        axios.get('/api/vps-stats', getAuthConfig()),
        axios.get('/api/vps-stats/config', getAuthConfig()).catch(() => ({ data: null })),
        axios.get('/api/vps-stats/logged-in', getAuthConfig()).catch(() => ({ data: null })),
      ]);
      setStats(s.data);
      if (c.data) setConfig(c.data);
      if (li.data) setLoggedIn(li.data);
      setUpdatedAt(new Date());
    } catch (error) {
      if (first.current) toast.error('Erro ao carregar dados da VPS');
      console.error(error);
    } finally {
      setLoading(false);
      first.current = false;
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const sendNow = async () => {
    try {
      setSending(true);
      await axios.post('/api/vps-stats/telegram', {}, getAuthConfig());
      toast.success('Relatório enviado para o Telegram!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao enviar relatório');
    } finally {
      setSending(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <RefreshCw size={40} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const memPct = parseFloat(stats?.memory?.percent) || 0;
  const swapPct = parseFloat(stats?.swap?.percent) || 0;
  const swapTotal = parseFloat(stats?.swap?.total) || 0;
  const diskPct = parseInt(stats?.disk?.percent) || 0;
  const load1 = parseFloat((stats?.cpu?.load || [])[0]) || 0;
  const cores = stats?.cpu?.cores || 1;
  const cpuPct = Math.min(100, Math.round((load1 / cores) * 100));
  const upH = Math.floor(parseFloat(stats?.uptime) || 0);
  const upStr = upH >= 24 ? `${Math.floor(upH / 24)}d ${upH % 24}h` : `${upH}h`;

  const barColor = (pct) => (pct >= 90 ? '#ef4444' : pct >= 75 ? '#f59e0b' : 'var(--color-accent)');

  const kpi = (icon, color, label, value, pct, sub) => (
    <div className="kpi">
      <div className="kpi-top"><span className="kpi-label">{label}</span><span style={{ color }}>{icon}</span></div>
      <span className="kpi-val" style={{ color: pct != null && pct >= 90 ? '#ef4444' : 'var(--color-text)' }}>{value}</span>
      {pct != null ? (
        <>
          <div className="kpi-bar"><div className="kpi-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: barColor(pct) }} /></div>
          <span className="kpi-sub">{sub}</span>
        </>
      ) : <span className="kpi-sub">{sub}</span>}
    </div>
  );

  const apps = stats?.pm2 || [];
  const online = apps.filter(a => a.status === 'online').length;
  const conns = stats?.connByDomain || [];
  const ssl = (stats?.ssl || []).slice().sort((a, b) => a.daysLeft - b.daysLeft);
  const li = loggedIn || (stats?.activeUsers != null ? [{ label: 'klarke', count: stats.activeUsers }] : []);
  const totalLogged = li.reduce((s, x) => s + (typeof x.count === 'number' ? x.count : 0), 0);

  const sslColor = (d) => (d <= 14 ? '#ef4444' : d <= 30 ? '#f59e0b' : '#10b981');

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
      <div className="mq-topbar">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Server size={26} /> Monitor da VPS</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="vps-live"><span className="vps-live-dot" /> ao vivo</span>
            <span>{stats?.hostname} · {stats?.platform} · {cores} núcleos</span>
            {updatedAt && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>· atualizado {updatedAt.toLocaleTimeString('pt-BR')}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-refresh-sober" onClick={fetchStats} title="Atualizar agora"><RefreshCw size={20} /></button>
          <button className="btn btn-primary" style={{ width: 'auto', marginTop: 0, padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={sendNow} disabled={sending}>
            {sending ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
            Enviar relatório
          </button>
        </div>
      </div>

      {/* KPIs de recursos */}
      <div className="home-kpis">
        {kpi(<Cpu size={16} />, '#3b82f6', 'CPU (load/núcleo)', `${cpuPct}%`, cpuPct, `load ${(stats?.cpu?.load || []).join(' / ')}`)}
        {kpi(<Activity size={16} />, '#a855f7', 'Memória RAM', `${memPct}%`, memPct, `${stats?.memory?.used} / ${stats?.memory?.total} GB`)}
        {swapTotal > 0
          ? kpi(<MemoryStick size={16} />, '#ec4899', 'Swap', `${swapPct}%`, swapPct, `${stats?.swap?.used} / ${stats?.swap?.total} GB`)
          : kpi(<Clock size={16} />, '#10b981', 'Uptime', upStr, null, `no ar há ${Math.floor(upH / 24)} dias`)}
        {kpi(<HardDrive size={16} />, '#f59e0b', 'Disco (root)', stats?.disk?.percent || '0%', diskPct, `${stats?.disk?.used} / ${stats?.disk?.total} · inodes ${stats?.disk?.inodesPercent}`)}
      </div>

      {/* Apps (PM2) */}
      <div className="vps-panel">
        <h3><Box size={20} color="var(--color-accent)" /> Apps (PM2) <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 700, color: online === apps.length ? '#10b981' : '#f59e0b' }}>{online}/{apps.length} online</span></h3>
        {apps.length ? (
          <div className="vps-apps-grid">
            {apps.map(a => {
              const ok = a.status === 'online';
              return (
                <div className="vps-app" key={a.name}>
                  <div className="vps-app-top">
                    <span className="vps-dot" style={{ background: ok ? '#10b981' : '#ef4444', boxShadow: ok ? '0 0 8px #10b981' : '0 0 8px #ef4444' }} />
                    <span className="vps-app-name">{a.name}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: ok ? '#10b981' : '#ef4444' }}>{a.status}</span>
                  </div>
                  <div className="vps-app-meta">
                    <span>{a.cpu}% cpu</span>
                    <span>{a.memMB} MB</span>
                    <span>{a.restarts} restarts</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Sem dados do PM2.</p>}
      </div>

      {/* Usuários logados + Conexões por domínio */}
      <div className="vps-two-col">
        <div className="vps-panel" style={{ marginTop: 0 }}>
          <h3><Users size={20} color="var(--color-accent)" /> Usuários logados <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 800 }}>{totalLogged}</span></h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '-8px', marginBottom: '10px' }}>ativos nos últimos 10 min, por app</p>
          {li.length ? li.map(x => (
            <div className="vps-row" key={x.label}>
              <span className="vps-row-label"><span className="vps-dot" style={{ background: (x.count > 0) ? '#10b981' : 'var(--color-text-muted)' }} />{x.label}</span>
              <span className="vps-row-val">{x.count === null ? '—' : x.count}</span>
            </div>
          )) : <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Sem dados.</p>}
        </div>

        <div className="vps-panel" style={{ marginTop: 0 }}>
          <h3><Globe size={20} color="var(--color-accent)" /> Conexões por domínio</h3>
          {conns.length ? conns.map(c => (
            <div className="vps-row" key={c.label}>
              <span className="vps-row-label">{c.label}</span>
              <span className="vps-row-val">{c.count}</span>
            </div>
          )) : <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Sem dados.</p>}
        </div>
      </div>

      {/* Certificados SSL */}
      <div className="vps-panel">
        <h3><Lock size={20} color="var(--color-accent)" /> Certificados SSL</h3>
        {ssl.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {ssl.map(s => (
              <div className="vps-row" key={s.domain} style={{ borderBottom: 'none', border: '1px solid var(--color-border)', padding: '10px 12px' }}>
                <span className="vps-row-label" style={{ textTransform: 'none' }}>{s.domain}</span>
                <span className="vps-badge" style={{ color: sslColor(s.daysLeft) }}>{s.daysLeft}d</span>
              </div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Sem certificados detectados.</p>}
      </div>

      {/* Alertas no Telegram */}
      <div className="vps-panel">
        <h3><Bell size={20} color="var(--color-accent)" /> Alertas no Telegram
          {config && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', border: '1px solid currentColor', color: config.telegramConfigured ? '#10b981' : '#ef4444' }}>
              {config.telegramConfigured ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {config.telegramConfigured ? 'Configurado' : 'Não configurado'}
            </span>
          )}
        </h3>

        {config ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="vps-info-box">
              <span className="vps-info-label">Relatórios coordenados</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {(config.hours || []).map(h => (
                  <span key={h} style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'monospace', background: 'rgba(59,130,246,0.14)', color: 'var(--color-accent)', padding: '4px 10px' }}>{HORA_FMT(h)}</span>
                ))}
              </div>
              <span className="vps-info-sub">todos os dias (horário de Brasília)</span>
            </div>
            <div className="vps-info-box">
              <span className="vps-info-label">Alerta imediato de limite</span>
              <div style={{ marginTop: '8px', fontSize: '0.85rem', lineHeight: 1.7 }}>
                <div>💽 Disco &gt; <strong>{config.diskLimit}%</strong> · 🧠 RAM &gt; <strong>{config.memLimit}%</strong></div>
                <div>💤 Swap &gt; <strong>{config.swapLimit}%</strong> · ⚙️ CPU &gt; <strong>{config.loadLimit}</strong>/núcleo</div>
                <div>🔒 SSL a vencer em <strong>{config.sslDays}</strong> dias</div>
              </div>
              <span className="vps-info-sub">no máximo 1 alerta a cada 6h por métrica</span>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Não foi possível carregar a configuração dos alertas.</p>
        )}

        {config && !config.telegramConfigured && (
          <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.82rem', color: '#ef4444' }}>
            Defina <code>TELEGRAM_BOT_TOKEN</code> e <code>TELEGRAM_CHAT_ID</code> no <code>.env</code> da VPS e reinicie o serviço.
          </div>
        )}
      </div>
    </div>
  );
}

export default VPSMonitor;
