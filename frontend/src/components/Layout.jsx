import React, { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import axios from 'axios';

function Layout() {
  const previousTaskCount = useRef(null);

  useEffect(() => {
    // Pedir permissão para notificações apenas se for suportado
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkTasks = async () => {
      const token = localStorage.getItem('klarke_token');
      if (!token) return;
      try {
        const res = await axios.get('/api/tasks', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const currentTasksCount = res.data.length;
        
        // Se a contagem anterior for menor, significa que uma nova tarefa foi adicionada
        if (previousTaskCount.current !== null && currentTasksCount > previousTaskCount.current) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Klarke Control: Nova Tarefa!', {
              body: 'Você recebeu um novo item no Plano de Ação.',
              icon: '/logo.png'
            });
          }
        }
        previousTaskCount.current = currentTasksCount;
      } catch (error) {
        // fail silently for poll
      }
    };

    checkTasks();
    const interval = setInterval(checkTasks, 15000); // Check every 15s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-layout">
      <div className="bg-visuals">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      <Navbar />
      <div className="app-container">
        <Outlet />
      </div>
      <footer className="discreet-footer">
        <div className="footer-content">
          <span>Klarke Solutions © 2026 - Todos os direitos reservados</span>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
