import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Monitor, Camera, Router as RouterIcon, Moon, Sun, ListTodo, ArrowLeft, Home, Users, Activity, History, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('klarke_theme') === 'dark');

  const isHome = location.pathname === '/control' || location.pathname === '/control/';

  useEffect(() => {
    if (isDark) {
      document.body.classList.add('dark');
      localStorage.setItem('klarke_theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('klarke_theme', 'light');
    }
  }, [isDark]);

  const handleLogout = () => {
    localStorage.removeItem('klarke_token');
    toast.success('Desconectado com sucesso');
    navigate('/');
  };

  const navItems = [
    { icon: <Home size={20} />, label: 'Início', path: '/control' },
    { icon: <Monitor size={20} />, label: 'Máquinas', path: '/control/machines' },
    { icon: <Camera size={20} />, label: 'Câmeras', path: '/control/cameras' },
    { icon: <RouterIcon size={20} />, label: 'Rede', path: '/control/network' },
    { icon: <ListTodo size={20} />, label: 'Tarefas', path: '/control/action-plan' },
    { icon: <BookOpen size={20} />, label: 'Vault', path: '/control/technical-docs' },
    { icon: <History size={20} />, label: 'Logs', path: '/control/audit-logs' },
  ];

  return (
    <>
      <nav className="top-nav">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          {!isHome && (
            <button 
              className="logout-btn" 
              onClick={() => navigate(-1)} 
              style={{padding: '8px', background: 'rgba(255,255,255,0.1)'}}
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="nav-brand" onClick={() => navigate('/control')} style={{cursor: 'pointer'}}>
            <img src="/logo.png" alt="Klarke Logo" className="nav-logo" />
            <div className="nav-brand-text hide-mobile">
              <h1>Klarke Control</h1>
              <span>Gestão de Infraestrutura</span>
            </div>
          </div>
        </div>
        
        <div className="nav-links hide-mobile">
          {navItems.map(item => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'}
              end={item.path === '/control'}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <button className="logout-btn" onClick={() => setIsDark(!isDark)} style={{padding: '8px'}}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            <span className="hide-mobile">Sair</span>
          </button>
        </div>
      </nav>

      {/* Bottom Nav for Mobile */}
      <div className="bottom-nav show-mobile">
        {navItems.map(item => (
          <NavLink 
            key={item.path} 
            to={item.path} 
            className={({isActive}) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}
            end={item.path === '/control'}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </>
  );
}

export default Navbar;
