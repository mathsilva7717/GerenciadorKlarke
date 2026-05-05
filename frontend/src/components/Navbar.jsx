import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, Monitor, Camera, Router as RouterIcon, Moon, Sun, 
  ListTodo, ArrowLeft, Home, History, BookOpen, 
  ChevronDown, Phone, Package, Key, ShieldCheck 
} from 'lucide-react';
import toast from 'react-hot-toast';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('klarke_theme') === 'dark');
  const [activeMenu, setActiveMenu] = useState(null);

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

  const navGroups = [
    {
      label: 'Infra',
      icon: <RouterIcon size={18} />,
      items: [
        { icon: <Camera size={16} />, label: 'Câmeras', path: '/control/cameras' },
        { icon: <RouterIcon size={16} />, label: 'Rede', path: '/control/network' },
        { icon: <Phone size={16} />, label: 'VOIP', path: '/control/voip' },
      ]
    },
    {
      label: 'Ativos',
      icon: <Monitor size={18} />,
      items: [
        { icon: <Monitor size={16} />, label: 'Máquinas', path: '/control/machines' },
        { icon: <Package size={16} />, label: 'Estoque', path: '/control/inventory' },
        { icon: <Key size={16} />, label: 'Senhas', path: '/control/key-keeper' },
      ]
    },
    {
      label: 'Operação',
      icon: <ListTodo size={18} />,
      items: [
        { icon: <ListTodo size={16} />, label: 'Tarefas', path: '/control/action-plan' },
        { icon: <BookOpen size={16} />, label: 'Vault', path: '/control/technical-docs' },
        { icon: <History size={16} />, label: 'Audit Logs', path: '/control/audit-logs' },
      ]
    }
  ];

  // Mobile nav items (top 5 essential)
  const mobileItems = [
    { icon: <Home size={20} />, label: 'Home', path: '/control' },
    { icon: <Monitor size={20} />, label: 'Ativos', path: '/control/machines' },
    { icon: <Camera size={20} />, label: 'Câmeras', path: '/control/cameras' },
    { icon: <ListTodo size={20} />, label: 'Tarefas', path: '/control/action-plan' },
    { icon: <Package size={20} />, label: 'Estoque', path: '/control/inventory' },
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
              <span>GESTÃO INDUSTRIAL</span>
            </div>
          </div>
        </div>
        
        <div className="nav-links hide-mobile">
          <NavLink to="/control" className={({isActive}) => isActive ? 'nav-link active' : 'nav-link'} end>
            <Home size={18} />
            <span>Início</span>
          </NavLink>

          {navGroups.map((group, idx) => (
            <div 
              key={idx} 
              className="nav-dropdown-container"
              onMouseEnter={() => setActiveMenu(idx)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <div className={`nav-link ${activeMenu === idx ? 'active' : ''}`}>
                {group.icon}
                <span>{group.label}</span>
                <ChevronDown size={14} style={{marginLeft: '4px', opacity: 0.5}} />
              </div>
              
              {activeMenu === idx && (
                <div className="nav-dropdown-menu">
                  {group.items.map(item => (
                    <NavLink 
                      key={item.path} 
                      to={item.path} 
                      className="dropdown-item"
                      onClick={() => setActiveMenu(null)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
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
        {mobileItems.map(item => (
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
