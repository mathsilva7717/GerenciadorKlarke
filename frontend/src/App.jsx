import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import NetworkDevices from './pages/NetworkDevices';
import ActionPlan from './pages/ActionPlan';
import Home from './pages/Home';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';

function App() {
  return (
    <Router>
      <div className="dashboard-layout">
        <Toaster position="top-right" />
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route path="/control" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="machines" element={<Dashboard />} />
            <Route path="cameras" element={<Cameras />} />
            <Route path="network" element={<NetworkDevices />} />
            <Route path="action-plan" element={<ActionPlan />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="users" element={<Users />} />
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
