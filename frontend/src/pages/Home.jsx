import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Monitor, Camera, Router as RouterIcon, ListTodo, ChevronRight, Activity, ShieldCheck, Cpu, Database } from 'lucide-react';

function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    machines: 0,
    cameras: 0,
    network: 0,
    tasks: 0,
    users: 0
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [m, c, n, t, u] = await Promise.all([
          axios.get('/api/machines', getAuthConfig()),
          axios.get('/api/cameras', getAuthConfig()),
          axios.get('/api/network-devices', getAuthConfig()),
          axios.get('/api/tasks', getAuthConfig()),
          axios.get('/api/users', getAuthConfig())
        ]);
        setStats({
          machines: m.data.length,
          cameras: c.data.length,
          network: n.data.length,
          tasks: t.data.filter(x => !x.is_completed).length,
          users: u.data.length
        });
      } catch (e) {
        console.error("Stats error", e);
      }
    };
    fetchStats();
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
      title: 'Gestão de Usuários',
      desc: 'Controle de acessos e permissões do painel.',
      icon: <ShieldCheck size={28} />,
      path: '/control/users',
      color: '#1e293b', // Slate 800
      count: stats.users,
      label: 'Usuários'
    }
  ];

  return (
    <div className="home-container">
      <div className="home-hero-sober">
        <div className="hero-content">
          <h1>Monitoramento Klarke Solutions</h1>
          <p>Gestão centralizada de infraestrutura crítica.</p>
        </div>
        
        <div className="quick-stats-row-sober">
          <div className="stat-box-industrial">
            <span className="stat-label">Status</span>
            <div className="stat-value-row">
              <div className="indicator-static-green"></div>
              <span className="stat-value">ONLINE</span>
            </div>
          </div>

          <div className="stat-box-industrial" onClick={downloadBackup}>
            <span className="stat-label">Database</span>
            <span className="stat-value">BACKUP OK</span>
          </div>
        </div>
      </div>

      <div className="selection-grid-industrial">
        {modules.map((module, index) => (
          <div 
            key={index} 
            className="card-industrial" 
            onClick={() => navigate(module.path)}
            style={{ '--accent-border': module.color }}
          >
            <div className="card-industrial-header">
              <div className="industrial-icon" style={{ color: module.color }}>
                {module.icon}
              </div>
              <div className="industrial-badge">
                {module.count}
              </div>
            </div>
            <div className="industrial-body">
              <h3>{module.title}</h3>
              <p>{module.desc}</p>
            </div>
            <div className="industrial-footer">
              <span>GERENCIAR</span>
              <ChevronRight size={14} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
