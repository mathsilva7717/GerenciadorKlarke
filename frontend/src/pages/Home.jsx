import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Monitor, Camera, Router as RouterIcon, ListTodo, ChevronRight, Activity, ShieldCheck, Database, RotateCw, BookOpen, Phone, Package, Key, MessageSquare, Wrench, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';

// Considera online se last_seen foi há menos de 5 minutos
const isOnline = (lastSeen) => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
};

// Converte o tamanho cru do `df -h` (ex: "112G", "1.5T", "500M") para algo legível ("112 GB")
const formatDiskSize = (v) => {
  if (!v || v === '0') return '—';
  const m = String(v).trim().match(/^([\d.]+)\s*([KMGTP])?i?B?$/i);
  if (!m) return v;
  const units = { K: 'KB', M: 'MB', G: 'GB', T: 'TB', P: 'PB' };
  return `${m[1]} ${m[2] ? units[m[2].toUpperCase()] : 'B'}`;
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 GB';
  return (bytes / (1024 ** 3)).toFixed(1) + ' GB';
};

// Saudação em inglês conforme o horário do dia
const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
};

// Primeiro nome do usuário logado (localStorage), capitalizado
const getFirstName = () => {
  try {
    const u = JSON.parse(localStorage.getItem('klarke_user'));
    const raw = (u?.username || '').trim();
    if (!raw) return 'Operador';
    const first = raw.split(/[\s._@-]+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return 'Operador';
  }
};

function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    machines: 0, machinesOnline: 0,
    cameras: 0, camerasOnline: 0,
    network: 0, networkOnline: 0,
    tasks: 0,
    users: 0,
    docs: 0,
    logsTotal: 0,
    ticketsPending: 0,
    ticketsActive: 0,
    ticketsResolved: 0
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ disk: { percent: '0%', avail: '0' }, latency: 0, sites: [], sitesOnline: 0, sitesTotal: 0 });
  const [newSiteLabel, setNewSiteLabel] = useState('');
  const [newSiteIp, setNewSiteIp] = useState('');
  const [isSitesModalOpen, setIsSitesModalOpen] = useState(false);

  const fetchStats = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [m, c, n, t, u, logs, creds, inv, voip, docs, ticketsRes, sys] = await Promise.all([
        axios.get('/api/machines', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/cameras', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/network-devices', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/tasks', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/users', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/audit-logs', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/credentials', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/inventory', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/voip', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/technical-docs', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/tickets', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/system-status', getAuthConfig()).catch(() => ({ data: { disk: { percent: '0%', avail: '0' }, latency: 0, sites: [], sitesOnline: 0, sitesTotal: 0 } }))
      ]);
      
      const allTickets = ticketsRes.data || [];
      const pendingTickets = allTickets.filter(x => x.status === 'Pendente');
      const activeTickets = allTickets.filter(x => x.status === 'Em Atendimento');
      const resolvedTickets = allTickets.filter(x => x.status === 'Resolvido');
      setRecentTickets(allTickets.slice(0, 5));

      setSystemStatus(sys.data);
      setStats({
        machines: m.data?.length || 0,
        machinesOnline: (m.data || []).filter(x => isOnline(x.last_seen)).length,
        cameras: c.data?.length || 0,
        camerasOnline: (c.data || []).filter(x => isOnline(x.last_seen)).length,
        network: n.data?.length || 0,
        networkOnline: (n.data || []).filter(x => isOnline(x.last_seen)).length,
        tasks: (t.data || []).filter(x => Number(x.is_completed) === 0).length,
        users: u.data?.length || 0,
        logsTotal: logs.data?.length || 0,
        credentials: creds.data?.length || 0,
        inventory: inv.data?.length || 0,
        voip: voip.data?.length || 0,
        docs: docs.data?.length || 0,
        ticketsPending: pendingTickets.length,
        ticketsActive: activeTickets.length,
        ticketsResolved: resolvedTickets.length
      });
      if (manual) toast.success('Dados atualizados!');
    } catch (e) {
      console.error("Stats error", e);
      if (manual) toast.error('Erro ao atualizar dados');
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const downloadBackup = async () => {
    try {
      const response = await axios.get('/api/backup', {
        ...getAuthConfig(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'klarke_backup.sqlite');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Backup baixado com sucesso!');
    } catch (e) {
      toast.error('Erro ao baixar backup');
    }
  };

  const downloadRepair = () => {
    // Rota pública que devolve o app portable (.zip) com Content-Disposition: attachment
    const link = document.createElement('a');
    link.href = '/api/monitoring/repair-download';
    link.setAttribute('download', 'Klarke Repair.zip');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Iniciando download do Klarke Repair...');
  };

  const handleAddSite = async (e) => {
    e.preventDefault();
    if (!newSiteLabel.trim() || !newSiteIp.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    try {
      await axios.post('/api/monitoring/sites', {
        label: newSiteLabel,
        ip: newSiteIp
      }, getAuthConfig());
      toast.success('IP público adicionado com sucesso!');
      setNewSiteLabel('');
      setNewSiteIp('');
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar IP público');
    }
  };

  const handleDeleteSite = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este IP público?')) return;
    try {
      await axios.delete(`/api/monitoring/sites/${id}`, getAuthConfig());
      toast.success('IP público removido!');
      fetchStats();
    } catch (err) {
      toast.error('Erro ao remover IP público');
    }
  };

  // Saúde global baseada exclusivamente no ping de IPs públicos (locais gerenciados)
  const sitesOnline = systemStatus.sitesOnline || 0;
  const sitesTotal = systemStatus.sitesTotal || 0;
  const healthPct = Math.round((sitesOnline / (sitesTotal || 1)) * 100);

  return (
    <div className="home-container">
      {/* HEADER: GLOBAL HEALTH */}
        <div className="home-hero-sober">
          <div className="hero-content">
            <h1>COMMAND CENTER</h1>
            <p>Monitoramento de redes e gestão de ativos.</p>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: '18px'}}>
            <div className="hero-greeting">
              <span className="greeting-time">{getGreeting()},</span>
              <span className="greeting-name">{getFirstName()}</span>
            </div>
            <button
              className={`refresh-btn-circular ${isRefreshing ? 'spinning' : ''}`}
              onClick={() => fetchStats(true)}
              title="Atualizar Painel"
              disabled={isRefreshing}
            >
              <RotateCw size={18} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '32px' }}>
          {/* Card 1: Saúde Global (medida pelo ping dos locais públicos) */}
          <div className="stat-box-industrial" style={{ flex: '1 1 260px', minHeight: '180px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '20px', padding: '24px', position: 'relative' }}>
            {/* Botão discreto para gerenciar os IPs públicos monitorados */}
            <button
              onClick={() => setIsSitesModalOpen(true)}
              style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Gerenciar IPs públicos (ping)"
            >
              <Plus size={16} />
            </button>

            <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={healthPct === 100 ? '#10b981' : (healthPct === 0 ? '#ef4444' : '#f59e0b')}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - sitesOnline / (sitesTotal || 1))}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-text)' }}>
                  {healthPct}%
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="stat-label" style={{ letterSpacing: '1px', whiteSpace: 'nowrap' }}>SAÚDE GLOBAL</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                <strong>{sitesOnline}</strong> de <strong>{sitesTotal}</strong> locais online.
              </span>
              <span style={{ fontSize: '0.7rem', color: healthPct === 100 ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', marginTop: '6px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: healthPct === 100 ? '#10b981' : '#f59e0b', display: 'inline-block' }}></span>
                {sitesTotal === 0 ? 'Nenhum local monitorado' : (healthPct === 100 ? 'Locais operando normalmente' : 'Instabilidade em algum local')}
              </span>
            </div>
          </div>

          {/* Card 2: Armazenamento do Servidor */}
          <div className="stat-box-industrial" style={{ flex: '1 1 260px', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span className="stat-label" style={{ whiteSpace: 'nowrap' }}>DISCO DO SERVIDOR</span>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: parseInt(systemStatus?.disk?.percent) > 90 ? '#ef4444' : 'var(--color-text)', whiteSpace: 'nowrap' }}>
                {systemStatus?.disk?.percent || '0%'}
              </span>
            </div>
            
            {/* Progress Bar Container */}
            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <div style={{ 
                width: systemStatus?.disk?.percent || '0%', 
                height: '100%', 
                background: parseInt(systemStatus?.disk?.percent) > 90 ? 'linear-gradient(90deg, #ef4444, #f43f5e)' : 'linear-gradient(90deg, #38bdf8, #3b82f6)',
                transition: 'width 0.5s ease-out'
              }}></div>
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-border)', padding: '7px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: parseInt(systemStatus?.disk?.percent) > 90 ? '#ef4444' : '#3b82f6', flexShrink: 0 }}></span>
                  Em uso
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-text)' }}>{systemStatus?.disk?.percent || '0%'}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-border)', padding: '7px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
                  Livre
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-text)' }}>{formatDiskSize(systemStatus?.disk?.avail)}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={downloadBackup}
                style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.75rem', cursor: 'pointer', padding: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Database size={12} />
                BAIXAR BACKUP
              </button>
            </div>
          </div>

          {/* Card 2.5: Memória do Servidor (VPS) */}
          <div className="stat-box-industrial" style={{ flex: '1 1 260px', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span className="stat-label" style={{ whiteSpace: 'nowrap' }}>MEMÓRIA DA VPS</span>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: parseInt(systemStatus?.memory?.percent) > 90 ? '#ef4444' : 'var(--color-text)', whiteSpace: 'nowrap' }}>
                {systemStatus?.memory?.percent || '0%'}
              </span>
            </div>
            
            <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <div style={{ 
                width: systemStatus?.memory?.percent || '0%', 
                height: '100%', 
                background: parseInt(systemStatus?.memory?.percent) > 90 ? 'linear-gradient(90deg, #ef4444, #f43f5e)' : 'linear-gradient(90deg, #a855f7, #d946ef)',
                transition: 'width 0.5s ease-out'
              }}></div>
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-border)', padding: '7px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: parseInt(systemStatus?.memory?.percent) > 90 ? '#ef4444' : '#a855f7', flexShrink: 0 }}></span>
                  Usada
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-text)' }}>{formatBytes(systemStatus?.memory?.used)}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', background: 'rgba(0,0,0,0.04)', border: '1px solid var(--color-border)', padding: '7px 10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', fontWeight: '700', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }}></span>
                  Livre
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-text)' }}>{formatBytes(systemStatus?.memory?.free)}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
               <Activity size={12} color="var(--color-text-muted)" />
               <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>UPTIME: {systemStatus?.uptime?.days || 0}d {systemStatus?.uptime?.hours % 24 || 0}h</span>
            </div>
          </div>

          {/* Card 3: Suporte Flow */}
          <div className="stat-box-industrial" onClick={() => navigate('/control/tickets')} style={{ flex: '1 1 260px', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', padding: '24px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span className="stat-label" style={{ whiteSpace: 'nowrap' }}>SUPORTE FLOW</span>
              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: stats.ticketsPending > 0 ? '#ef4444' : '#10b981', whiteSpace: 'nowrap' }}>
                {stats.ticketsPending + stats.ticketsActive} ABERTOS
              </span>
            </div>

            {/* Stacked Progress Bar */}
            {(() => {
              const total = stats.ticketsPending + stats.ticketsActive + stats.ticketsResolved || 1;
              const pctPending = (stats.ticketsPending / total) * 100;
              const pctActive = (stats.ticketsActive / total) * 100;
              const pctResolved = (stats.ticketsResolved / total) * 100;

              return (
                <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', overflow: 'hidden', display: 'flex', border: '1px solid var(--color-border)' }}>
                  {stats.ticketsPending > 0 && <div style={{ width: `${pctPending}%`, height: '100%', backgroundColor: '#ef4444', transition: 'width 0.5s ease-out' }} title="Pendente"></div>}
                  {stats.ticketsActive > 0 && <div style={{ width: `${pctActive}%`, height: '100%', backgroundColor: 'var(--color-accent)', transition: 'width 0.5s ease-out' }} title="Em Atendimento"></div>}
                  {stats.ticketsResolved > 0 && <div style={{ width: `${pctResolved}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease-out' }} title="Resolvido"></div>}
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginTop: '4px' }}>
              <div style={{ background: 'rgba(0,0,0,0.05)', padding: '6px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 'bold' }}>PENDENTES</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ef4444' }}>{stats.ticketsPending}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.05)', padding: '6px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-accent)', fontWeight: 'bold' }}>EM CURSO</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-accent)' }}>{stats.ticketsActive}</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.05)', padding: '6px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>RESOLVIDOS</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#10b981' }}>{stats.ticketsResolved}</div>
              </div>
            </div>
          </div>

          {/* Card 4: Rede e Auditoria */}
          <div className="stat-box-industrial" style={{ flex: '1 1 260px', minHeight: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span className="stat-label" style={{ whiteSpace: 'nowrap' }}>REDE E AUDITORIA</span>
              <span style={{ fontSize: '1rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <span style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                  <span style={{ width: '3px', height: '4px', backgroundColor: '#10b981' }}></span>
                  <span style={{ width: '3px', height: '7px', backgroundColor: '#10b981' }}></span>
                  <span style={{ width: '3px', height: '10px', backgroundColor: '#10b981' }}></span>
                  <span style={{ width: '3px', height: '14px', backgroundColor: '#10b981' }}></span>
                </span>
                {systemStatus?.latency || 0}ms
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'stretch', gap: '20px', width: '100%', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.05)', padding: '12px 16px', border: '1px solid var(--color-border)' }}>
                <Activity size={18} color="#10b981" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Histórico Geral</span>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--color-text)' }}>
                    {stats.logsTotal} eventos gravados
                  </span>
                </div>
              </div>

              <div style={{ flex: '1 1 320px', display: 'flex', alignItems: 'center', borderLeft: '1px solid var(--color-border)', paddingLeft: '20px', minWidth: 0 }}>
                <svg viewBox="0 0 320 64" preserveAspectRatio="none" style={{ width: '100%', height: '64px', overflow: 'visible' }} aria-hidden="true">
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,44 L24,40 L48,46 L72,30 L96,36 L120,18 L144,30 L168,38 L192,22 L216,32 L240,26 L264,40 L288,20 L312,30 L320,28 V64 H0 Z" fill="url(#netGrad)" />
                  <polyline points="0,44 24,40 48,46 72,30 96,36 120,18 144,30 168,38 192,22 216,32 240,26 264,40 288,20 312,30 320,28" fill="none" stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx="320" cy="28" r="3.5" fill="#10b981">
                    <animate attributeName="opacity" values="1;0.15;1" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="r" values="3.5;5;3.5" dur="1.6s" repeatCount="indefinite" />
                  </circle>
                </svg>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Status da Rede</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: '700', color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                  Estável
                </span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: '700', color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.28)', padding: '3px 10px', borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                <span className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                Online
              </span>
            </div>
          </div>
        </div>

      {/* MODULES GRID */}
      <div className="selection-grid-industrial">
        <div className="card-industrial" onClick={() => navigate('/control/machines')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><Monitor size={22} /></div>
            <div className="industrial-badge">{stats.machines}</div>
          </div>
          <div className="industrial-body">
            <h3>Máquinas e Acessos</h3>
            <p>Gerenciamento de PCs e acessos remotos.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div style={{width: '6px', height: '6px', borderRadius: '50%', background: '#10b981'}}></div>
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>{stats.machinesOnline} Online agora</span>
            </div>
          </div>
          <div className="industrial-footer"><span>gerenciar</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/cameras')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><Camera size={22} /></div>
            <div className="industrial-badge">{stats.cameras}</div>
          </div>
          <div className="industrial-body">
            <h3>Sistema de Câmeras</h3>
            <p>Visualização de snapshots e IPs de CFTV.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div style={{width: '6px', height: '6px', borderRadius: '50%', background: '#10b981'}}></div>
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>{stats.camerasOnline} Com imagem ativa</span>
            </div>
          </div>
          <div className="industrial-footer"><span>ver câmeras</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/network')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><RouterIcon size={22} /></div>
            <div className="industrial-badge">{stats.network}</div>
          </div>
          <div className="industrial-body">
            <h3>Rede e Links</h3>
            <p>Status de modems, switches e operadoras.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div style={{width: '6px', height: '6px', borderRadius: '50%', background: '#10b981'}}></div>
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>{stats.networkOnline} estáveis</span>
            </div>
          </div>
          <div className="industrial-footer"><span>infraestrutura de ti</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/action-plan')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><ListTodo size={22} /></div>
            <div className="industrial-badge">{stats.tasks}</div>
          </div>
          <div className="industrial-body">
            <h3>Plano de Ação</h3>
            <p>Checklist de tarefas e pendências técnicas.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Activity size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Tarefas críticas pendentes</span>
            </div>
          </div>
          <div className="industrial-footer"><span>tarefas</span><ChevronRight size={14} /></div>
        </div>


        <div className="card-industrial" onClick={() => navigate('/control/audit-logs')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><ShieldCheck size={22} /></div>
            <div className="industrial-badge">{stats.logsTotal}</div>
          </div>
          <div className="industrial-body">
            <h3>Histórico e Logs</h3>
            <p>Auditoria completa de acessos e alterações.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Activity size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Atividade em tempo real</span>
            </div>
          </div>
          <div className="industrial-footer"><span>auditoria</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/technical-docs')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><BookOpen size={22} /></div>
            <div className="industrial-badge">{stats.docs || 0}</div>
          </div>
          <div className="industrial-body">
            <h3>Tech Vault</h3>
            <p>Repositório central de manuais e procedimentos.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Database size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Central de documentação</span>
            </div>
          </div>
          <div className="industrial-footer"><span>ver acervo</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/voip')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><Phone size={22} /></div>
            <div className="industrial-badge">{stats.voip || 0}</div>
          </div>
          <div className="industrial-body">
            <h3>VOIP & Telefonia</h3>
            <p>Gestão de ramais e contas SIP.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Activity size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Comunicação ativa</span>
            </div>
          </div>
          <div className="industrial-footer"><span>CONFIGURAR</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/inventory')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><Package size={22} /></div>
            <div className="industrial-badge">{stats.inventory || 0}</div>
          </div>
          <div className="industrial-body">
            <h3>Inventory</h3>
            <p>Controle de ativos e estoque técnico.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Database size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Itens em estoque</span>
            </div>
          </div>
          <div className="industrial-footer"><span>ESTOQUE</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/key-keeper')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><Key size={22} /></div>
            <div className="industrial-badge">{stats.credentials || 0}</div>
          </div>
          <div className="industrial-body">
            <h3>Key Keeper</h3>
            <p>Cofre de senhas e acessos root.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <ShieldCheck size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Criptografia ativa</span>
            </div>
          </div>
          <div className="industrial-footer"><span>ACESSAR COFRE</span><ChevronRight size={14} /></div>
        </div>
      </div>

      {/* SEÇÃO DE CHAMADOS RECENTES */}
      <div style={{ marginTop: '32px', padding: '24px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '0px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <MessageSquare size={20} color="var(--color-accent)" />
              Chamados Recentes (Klarke Flow)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '2px', margin: 0 }}>
              Últimas solicitações abertas pelos usuários no Klarke Flow.
            </p>
          </div>
          <button 
            className="btn" 
            onClick={() => navigate('/control/tickets')}
            style={{ width: 'auto', marginTop: 0, padding: '8px 16px', fontSize: '0.85rem', background: 'var(--color-accent)', color: 'white' }}
          >
            Ver Todos
          </button>
        </div>

        {recentTickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--color-text-muted)' }}>
            <ShieldCheck size={40} style={{ opacity: 0.3, marginBottom: '8px' }} />
            <p style={{ fontSize: '0.9rem', margin: 0 }}>Nenhum chamado aberto no momento. Tudo limpo!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentTickets.map(ticket => (
              <div 
                key={ticket.id} 
                onClick={() => navigate('/control/tickets')}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  background: 'var(--color-secondary)', 
                  border: '1px solid var(--color-border)', 
                  borderLeft: `4px solid ${
                    ticket.priority === 'Alta' ? '#ef4444' : ticket.priority === 'Média' ? '#f59e0b' : '#10b981'
                  }`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'rgba(0,0,0,0.1)', padding: '2px 6px', minWidth: '45px', textAlign: 'center' }}>
                    #{ticket.id}
                  </span>
                  
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 0 }}>
                      {ticket.title}
                    </h4>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                      <span><strong>Solicitante:</strong> {ticket.requester}</span>
                      <span><strong>Categoria:</strong> {ticket.category}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '16px' }}>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 'bold', 
                    padding: '3px 8px', 
                    borderRadius: '0px',
                    textTransform: 'uppercase',
                    backgroundColor: ticket.status === 'Resolvido' ? 'rgba(16,185,129,0.15)' : ticket.status === 'Em Atendimento' ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)',
                    color: ticket.status === 'Resolvido' ? '#10b981' : ticket.status === 'Em Atendimento' ? 'var(--color-accent)' : '#f59e0b',
                    border: '1px solid currentColor'
                  }}>
                    {ticket.status}
                  </span>

                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  
                  <ChevronRight size={16} color="var(--color-text-muted)" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QUICK ACTIONS BAR */}
      <div style={{marginTop: '32px', padding: '24px', background: '#1e293b', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', color: 'white'}}>
        <div>
          <h4 style={{margin: 0, fontSize: '1.1rem', fontWeight: '700'}}>Suporte Técnico em Campo</h4>
          <p style={{margin: '4px 0 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)'}}>Baixe as ferramentas necessárias para configurar os PCs dos clientes.</p>
        </div>
        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>

          <button
            onClick={downloadRepair}
            title="Baixar o Klarke Repair (utilitário portable de diagnóstico e otimização)"
            style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', width: 'auto', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem', color: 'white', border: '1px solid rgba(16,185,129,0.5)', borderRadius: '4px', background: 'linear-gradient(135deg, #10b981, #059669)'}}
          >
            <Wrench size={18} />
            BAIXAR KLARKE REPAIR
          </button>

          <button className="btn btn-primary" onClick={() => navigate('/control/users')} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', width: 'auto'}}>
            <ShieldCheck size={18} />
            GERENCIAR ACESSOS
          </button>
        </div>
      </div>

      {/* MODAL DE GERENCIAMENTO DE IPS PÚBLICOS */}
      {isSitesModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSitesModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Gerenciar IPs Públicos (Ping)</h2>
              <button className="close-btn" onClick={() => setIsSitesModalOpen(false)}>
                <Plus size={24} style={{ transform: 'rotate(45deg)', display: 'inline-block' }} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              
              {/* Formulário de Adicionar IP */}
              <form onSubmit={handleAddSite} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.03)', padding: '16px', border: '1px solid var(--color-border)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', margin: 0, color: 'var(--color-text)' }}>Cadastrar Novo IP para Ping</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Nome do local (ex: Filial Centro)" 
                    value={newSiteLabel} 
                    onChange={e => setNewSiteLabel(e.target.value)}
                    className="form-input"
                    required
                  />
                  <input 
                    type="text" 
                    placeholder="IP Público ou Host (ex: 8.8.8.8)" 
                    value={newSiteIp} 
                    onChange={e => setNewSiteIp(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', width: '100%', padding: '10px' }}>
                  SALVAR IP
                </button>
              </form>

              {/* Listagem de IPs */}
              <div>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-text)' }}>IPs Cadastrados</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '200px' }}>
                  {(systemStatus.sites || []).length === 0 ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Nenhum IP público configurado.</span>
                  ) : (systemStatus.sites || []).map((s) => (
                    <div key={s.ip} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', padding: '10px 14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span className={s.online ? "indicator-pulse-green" : "indicator-pulse-red"} style={{ flexShrink: 0 }}></span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{s.ip}</span>
                        </span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', color: s.online ? '#10b981' : '#ef4444' }}>
                          {s.online ? `${s.latency}ms` : 'OFF'}
                        </span>
                        <button 
                          onClick={() => handleDeleteSite(s.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Remover IP"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
