import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import axios from 'axios';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import NetworkDevices from './pages/NetworkDevices';
import ActionPlan from './pages/ActionPlan';
import Home from './pages/Home';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import Voip from './pages/Voip';
import Inventory from './pages/Inventory';
import KeyKeeper from './pages/KeyKeeper';
import MailPage from './pages/Mail';
import ResetPassword from './pages/ResetPassword';
import NetworkMap from './pages/NetworkMap';
import Tickets from './pages/Tickets';
import Documents from './pages/Documents';
import EntraId from './pages/EntraId';
import Licenses from './pages/Licenses';
import Links from './pages/Links';
import VPSMonitor from './pages/VPSMonitor';
import Images from './pages/Images';

// Interceptor global para injetar headers em todas as requisições
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('klarke_token');
    const userData = localStorage.getItem('klarke_user');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (userData) {
      try {
        const user = JSON.parse(userData);
        config.headers['X-User'] = user.username || userData;
      } catch (e) {
        config.headers['X-User'] = userData;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor global para tratar expiração de token (401/403)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      toast.error('Sessão inválida ou expirada. Faça login novamente.', { id: 'auth-error' });
      localStorage.removeItem('klarke_token');
      localStorage.removeItem('klarke_user');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    }
    return Promise.reject(error);
  }
);

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('klarke_token');
  if (!token) return <Navigate to="/" replace />;

  const userData = localStorage.getItem('klarke_user');
  let user = {};
  try {
    user = JSON.parse(userData || '{}');
    if (typeof user === 'string') user = { username: user };
  } catch (e) {
    user = { username: userData };
  }

  if (user.mustChangePassword && window.location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  return children;
}

// Bloqueia rotas restritas a admin (ex: gerenciamento de usuários) para o papel "funcionario".
function AdminRoute({ children }) {
  const userData = localStorage.getItem('klarke_user');
  let user = {};
  try {
    user = JSON.parse(userData || '{}');
  } catch (e) {
    user = {};
  }
  if (user.role === 'funcionario') return <Navigate to="/control" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <div className="dashboard-layout">
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ProtectedRoute><ResetPassword /></ProtectedRoute>} />
          
          <Route path="/control" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Home />} />
            <Route path="machines" element={<Dashboard />} />
            <Route path="cameras" element={<Cameras />} />
            <Route path="network" element={<NetworkDevices />} />
            <Route path="action-plan" element={<ActionPlan />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
            <Route path="documents" element={<Documents />} />
            <Route path="entra-id" element={<EntraId />} />
            <Route path="licenses" element={<Licenses />} />
            <Route path="links" element={<Links />} />
            <Route path="images" element={<Images />} />
            <Route path="vps-monitor" element={<AdminRoute><VPSMonitor /></AdminRoute>} />
            <Route path="voip" element={<Voip />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="key-keeper" element={<KeyKeeper />} />
            <Route path="mail" element={<MailPage />} />
            <Route path="network-map" element={<NetworkMap />} />
            <Route path="tickets" element={<Tickets />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer className="discreet-footer">
          <div className="footer-content">
            <span>Klarke Solutions © 2026 - Todos os direitos reservados</span>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
