import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Monitor, Camera, Router as RouterIcon, Moon, Sun, ListTodo } from 'lucide-react';
import toast from 'react-hot-toast';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => localStorage.getItem('klarke_theme') === 'dark');

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

  return (
    <nav className="top-nav">
      <div className="nav-brand" onClick={() => navigate('/control')} style={{cursor: 'pointer'}}>
        <img src="/logo.png" alt="Klarke Logo" className="nav-logo" />
      </div>
      
      {/* Navegação removida do topo para evitar redundância com a Home */}

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
  );
}

export default Navbar;
