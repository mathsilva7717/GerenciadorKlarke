import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Monitor, Camera, Router as RouterIcon, ListTodo, ChevronRight, Activity, ShieldCheck, Cpu, Database, RotateCw, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    machines: 0, machinesOnline: 0,
    cameras: 0, camerasOnline: 0,
    network: 0, networkOnline: 0,
    tasks: 0,
    users: 0,
    logsToday: 0
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen + 'Z');
    const now = new Date();
    return (now - lastSeenDate) / (1000 * 60) < 5;
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
  const fetchStats = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const [m, c, n, t, u, logs] = await Promise.all([
        axios.get('/api/machines', getAuthConfig()),
        axios.get('/api/cameras', getAuthConfig()),
        axios.get('/api/network-devices', getAuthConfig()),
        axios.get('/api/tasks', getAuthConfig()),
        axios.get('/api/users', getAuthConfig()),
        axios.get('/api/audit-logs', getAuthConfig())
      ]);
      setStats({
        machines: m.data?.length || 0,
        machinesOnline: (m.data || []).filter(x => isOnline(x.last_seen)).length,
        cameras: c.data?.length || 0,
        camerasOnline: (c.data || []).filter(x => isOnline(x.last_seen)).length,
        network: n.data?.length || 0,
        networkOnline: (n.data || []).filter(x => isOnline(x.last_seen)).length,
        tasks: (t.data || []).filter(x => !x.is_completed).length,
        users: u.data?.length || 0,
        logsToday: (logs.data || []).filter(x => new Date(x.created_at).toDateString() === new Date().toDateString()).length
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

  const modules = [
    {
      title: 'Máquinas e Acessos',
      desc: 'Gestão de computadores, MACs e acessos remotos.',
      icon: <Monitor size={28} />,
      path: '/control/machines',
      color: '#475569', // Slate 600
      count: stats.machines,
      label: 'Dispositivos'
    },
    {
      title: 'Sistema de Câmeras',
      desc: 'IPs de NVRs, DVRs e credenciais de CFTV.',
      icon: <Camera size={28} />,
      path: '/control/cameras',
      color: '#64748b', // Slate 500
      count: stats.cameras,
      label: 'Câmeras'
    },
    {
      title: 'Infraestrutura de Rede',
      desc: 'Controle de modems, switches e operadoras.',
      icon: <RouterIcon size={28} />,
      path: '/control/network',
      color: '#475569', // Slate 600
      count: stats.network,
      label: 'Equipamentos'
    },
    {
      title: 'Plano de Ação',
      desc: 'Checklist de tarefas e pendências técnicas.',
      icon: <ListTodo size={28} />,
      path: '/control/action-plan',
      color: '#334155', // Slate 700
      count: stats.tasks,
      label: 'Pendentes'
    },
    {
      icon: <ShieldCheck size={28} />,
      path: '/control/users',
      color: '#1e293b', // Slate 800
      count: stats.users,
      label: 'Usuários'
    },
    {
      title: 'Tech Vault',
      desc: 'Manuais, procedimentos e documentação de rede.',
      icon: <BookOpen size={28} />,
      path: '/control/technical-docs',
      color: '#0f172a', // Slate 950
      count: 0,
      label: 'Arquivos'
    }
  ];

  const downloadAgent = async () => {
    try {
      const response = await axios.get('/api/monitoring/agent-download', {
        ...getAuthConfig(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'klarke-agent.js');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Agente baixado com sucesso!');
    } catch (e) {
      toast.error('Erro ao baixar agente');
    }
  };

  return (
    <div className="home-container">
      {/* HEADER: GLOBAL HEALTH */}
      <div className="home-hero-sober">
        <div className="hero-content">
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <h1>SISTEMA KLARKE</h1>
            <button 
              className={`refresh-btn-circular ${isRefreshing ? 'spinning' : ''}`}
              onClick={() => fetchStats(true)}
              title="Atualizar Painel"
              disabled={isRefreshing}
            >
              <RotateCw size={18} />
            </button>
          </div>
          <p>Monitoramento de links, câmeras e acessos remotos.</p>
        </div>
        
        <div className="quick-stats-row-sober">
          <div className="stat-box-industrial" style={{ minWidth: '200px' }}>
            <span className="stat-label">SAÚDE GLOBAL</span>
            <div className="stat-value-row">
              <div className="indicator-static-green" style={{ 
                background: (stats.machinesOnline + stats.camerasOnline + stats.networkOnline) > 0 ? '#10b981' : '#ef4444'
              }}></div>
              <span className="stat-value">
                {Math.round(((stats.machinesOnline + stats.camerasOnline + stats.networkOnline) / (stats.machines + stats.cameras + stats.network || 1)) * 100)}%
              </span>
            </div>
            <span style={{fontSize: '0.65rem', opacity: 0.6, marginTop: '4px'}}>
              {stats.machinesOnline + stats.camerasOnline + stats.networkOnline} de {stats.machines + stats.cameras + stats.network} dispositivos ativos
            </span>
          </div>

          <div className="stat-box-industrial" style={{borderColor: 'var(--color-accent)'}}>
            <span className="stat-label">ÚLTIMO BACKUP</span>
            <div className="stat-value-row">
              <Database size={16} color="var(--color-accent)" />
              <span className="stat-value" style={{fontSize: '0.9rem', marginLeft: '8px'}}>STATUS: OK</span>
            </div>
            <button 
              onClick={downloadBackup}
              style={{background: 'none', border: 'none', color: 'var(--color-accent)', fontSize: '0.6rem', cursor: 'pointer', padding: 0, marginTop: '4px', fontWeight: 'bold'}}
            >
              BAIXAR CÓPIA AGORA
            </button>
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
          <div className="industrial-footer"><span>GERENCIAR</span><ChevronRight size={14} /></div>
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
          <div className="industrial-footer"><span>VER CÂMERAS</span><ChevronRight size={14} /></div>
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
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>{stats.networkOnline} Estáveis</span>
            </div>
          </div>
          <div className="industrial-footer"><span>INFRAESTRUTURA</span><ChevronRight size={14} /></div>
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
          <div className="industrial-footer"><span>TAREFAS</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/audit-logs')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><ShieldCheck size={22} /></div>
            <div className="industrial-badge">{stats.logsToday}</div>
          </div>
          <div className="industrial-body">
            <h3>Histórico e Logs</h3>
            <p>Auditoria completa de acessos e alterações.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Activity size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Atividade em tempo real</span>
            </div>
          </div>
          <div className="industrial-footer"><span>AUDITORIA</span><ChevronRight size={14} /></div>
        </div>

        <div className="card-industrial" onClick={() => navigate('/control/technical-docs')}>
          <div className="card-industrial-header">
            <div className="industrial-icon"><BookOpen size={22} /></div>
            <div className="industrial-badge">0</div>
          </div>
          <div className="industrial-body">
            <h3>Tech Vault</h3>
            <p>Repositório central de manuais e procedimentos.</p>
            <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Database size={12} color="#64748b" />
              <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>Central de documentação</span>
            </div>
          </div>
          <div className="industrial-footer"><span>VER ACERVO</span><ChevronRight size={14} /></div>
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div style={{marginTop: '32px', padding: '24px', background: '#1e293b', borderRadius: '4px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', color: 'white'}}>
        <div>
          <h4 style={{margin: 0, fontSize: '1.1rem', fontWeight: '800'}}>Suporte Técnico em Campo</h4>
          <p style={{margin: '4px 0 0 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)'}}>Baixe as ferramentas necessárias para configurar os PCs dos clientes.</p>
        </div>
        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
          <button className="btn btn-primary" onClick={downloadAgent} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', background: '#334155', border: '1px solid rgba(255,255,255,0.1)', width: 'auto'}}>
            <Activity size={18} />
            BAIXAR KLARKE AGENT (JS)
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/control/users')} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', width: 'auto'}}>
            <ShieldCheck size={18} />
            GERENCIAR ACESSOS
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
