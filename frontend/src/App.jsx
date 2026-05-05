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
import TechnicalDocs from './pages/TechnicalDocs';
import Voip from './pages/Voip';
import Inventory from './pages/Inventory';
import KeyKeeper from './pages/KeyKeeper';

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
            <Route path="technical-docs" element={<TechnicalDocs />} />
            <Route path="voip" element={<Voip />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="key-keeper" element={<KeyKeeper />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
