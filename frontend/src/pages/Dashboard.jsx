import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, Copy, Monitor, MapPin, Check, Download, Clipboard, Trash2, QrCode, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = '/api/machines';

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    mac: '',
    ip: '',
    location: '',
    rustdesk_id: '',
    anydesk_id: '',
    password: '',
    serial_number: ''
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    return {
      headers: { Authorization: `Bearer ${token}` }
    };
  };

  useEffect(() => {
    const token = localStorage.getItem('klarke_token');
    if (!token) {
      navigate('/'); 
      return;
    }
    fetchMachines();

    // Polling para monitoramento ao vivo (30 segundos)
    const interval = setInterval(fetchMachines, 30000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      html5QrCode = new window.Html5Qrcode("reader");
      const qrCodeSuccessCallback = (decodedText) => {
        setIsScannerOpen(false);
        html5QrCode.stop();
        
        // Busca automática e abertura do modal
        const match = machines.find(m => 
          m.serial_number === decodedText || 
          m.id.toString() === decodedText ||
          m.name === decodedText
        );

        if (match) {
          openModal(match);
          toast.success(`Equipamento Identificado: ${match.name}`);
        } else {
          setSearchTerm(decodedText);
          toast.error("Equipamento não encontrado, filtrando lista...");
        }
      };
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop();
      }
    };
  }, [isScannerOpen, machines]);

  const fetchMachines = async () => {
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setMachines(response.data);
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('klarke_token');
        navigate('/');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'mac') {
      formattedValue = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
      const parts = formattedValue.match(/.{1,2}/g);
      if (parts) formattedValue = parts.slice(0, 6).join(':');
    }

    if (name === 'ip') {
      formattedValue = value.replace(/[^0-9.]/g, '');
    }

    if (name === 'anydesk_id' || name === 'rustdesk_id') {
      formattedValue = value.replace(/[^0-9]/g, '');
    }

    setFormData({ ...formData, [name]: formattedValue });
  };

  const openModal = (machine = null) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData(machine);
    } else {
      setEditingMachine(null);
      setFormData({ name: '', mac: '', ip: '', location: '', rustdesk_id: '', anydesk_id: '', password: '', serial_number: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMachine(null);
  };

  const saveMachine = async (e) => {
    e.preventDefault();
    try {
      const user = localStorage.getItem('klarke_user') || 'Desconhecido';
      if (editingMachine) {
        await axios.put(`${API_URL}/${editingMachine.id}`, formData, getAuthConfig());
        toast.success('Máquina atualizada!');
      } else {
        await axios.post(API_URL, { ...formData, created_by: user }, getAuthConfig());
        toast.success('Máquina cadastrada!');
      }
      fetchMachines();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar máquina:', error);
      toast.error('Erro ao conectar com o servidor.');
    }
  };

  const deleteMachine = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir esta máquina?')) {
      try {
        await axios.delete(`${API_URL}/${id}`, getAuthConfig());
        toast.success('Máquina excluída!');
        fetchMachines();
        closeModal();
      } catch (error) {
        toast.error('Erro ao excluir máquina.');
      }
    }
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullData = (machine) => {
    const text = `Nome: ${machine.name}\nSérie: ${machine.serial_number || '-'}\nIP: ${machine.ip}\nMAC: ${machine.mac}\nLocal: ${machine.location}\nAnyDesk: ${machine.anydesk_id}\nRustDesk: ${machine.rustdesk_id}\nSenha: ${machine.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Dados completos copiados!');
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'IP', 'MAC', 'Local', 'AnyDesk', 'RustDesk', 'Senha', 'Série', 'Criado em'];
    const rows = machines.map(m => [
      m.id, m.name, m.ip, m.mac, m.location, m.anydesk_id, m.rustdesk_id, m.password, m.serial_number, m.created_at
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'klarke_maquinas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

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

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen + 'Z'); // Add Z for UTC
    const now = new Date();
    const diffInMinutes = (now - lastSeenDate) / (1000 * 60);
    return diffInMinutes < 5; // 5 minutos de tolerância
  };

  const onlineCount = machines.filter(m => isOnline(m.last_seen)).length;
  const offlineCount = machines.length - onlineCount;

  const filteredMachines = machines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.ip && m.ip.includes(searchTerm)) ||
    (m.serial_number && m.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div className="quick-stats-row-sober" style={{marginBottom: '24px'}}>
        <div className="stat-box-industrial" style={{borderColor: '#10b981'}}>
          <span className="stat-label">Equipamentos Online</span>
          <div className="stat-value-row">
            <div className="indicator-static-green" style={{boxShadow: '0 0 10px #10b981'}}></div>
            <span className="stat-value">{onlineCount}</span>
          </div>
        </div>
        <div className="stat-box-industrial" style={{borderColor: '#ef4444'}}>
          <span className="stat-label">Equipamentos Offline</span>
          <div className="stat-value-row">
            <div className="indicator-static-green" style={{background: '#ef4444', boxShadow: '0 0 10px #ef4444'}}></div>
            <span className="stat-value">{offlineCount}</span>
          </div>
        </div>
        <div className="stat-box-industrial" style={{borderColor: 'var(--color-accent)'}}>
          <span className="stat-label">Taxa de Operação</span>
          <div className="stat-value-row">
             <span className="stat-value">{machines.length > 0 ? Math.round((onlineCount / machines.length) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por nome, IP ou série..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="action-buttons-group">
          <button 
            className="btn-action-square" 
            style={{background: 'var(--color-accent)'}}
            onClick={() => setIsScannerOpen(true)}
            title="Escanear QR Code"
          >
            <QrCode size={20} color="white" />
          </button>
          <button 
            className="btn-action-square" 
            style={{background: '#334155'}} 
            onClick={downloadAgent} 
            title="Baixar Klarke Agent"
          >
            <Activity size={20} />
          </button>
          <button 
            className="btn-action-square" 
            onClick={exportToCSV} 
            title="Exportar CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {isScannerOpen && (
        <div className="modal-overlay" style={{zIndex: 3000}}>
          <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center'}}>
             <div className="modal-header">
                <h2 className="modal-title">Escanear QR Code</h2>
                <button className="close-btn" onClick={() => setIsScannerOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              <div id="reader" style={{width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden'}}></div>
              <p style={{marginTop: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>
                Aponte a câmera para o QR Code da etiqueta.
              </p>
          </div>
        </div>
      )}

        {machines.length === 0 ? (
          <div className="empty-state">
            <Monitor className="empty-icon" size={64} />
            <h2>Nenhuma máquina encontrada</h2>
            <p>Adicione sua primeira máquina para começar o gerenciamento.</p>
          </div>
        ) : (
          <div className="machines-grid">
            {filteredMachines.map(machine => (
              <div key={machine.id} className="machine-card" onClick={() => openModal(machine)}>
                <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div 
                    title={isOnline(machine.last_seen) ? 'Online' : 'Offline'}
                    style={{
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: isOnline(machine.last_seen) ? '#10b981' : '#ef4444'
                    }} 
                  />
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{machine.name || 'Máquina sem nome'}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {machine.created_at ? new Date(machine.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                </div>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <span className="machine-location">
                    <MapPin size={12} style={{display: 'inline', marginRight: 4}} />
                    {machine.location || 'Sem local'}
                  </span>
                  <button className="copy-btn" title="Copiar Tudo" onClick={(e) => { e.stopPropagation(); copyFullData(machine); }}>
                    <Clipboard size={16} />
                  </button>
                  <button className="delete-btn" title="Excluir" onClick={(e) => { e.stopPropagation(); deleteMachine(machine.id); }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
                
                <div className="machine-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">IP Address</span>
                    <span className="detail-value">
                      {machine.ip || '-'}
                      {machine.ip && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.ip, `ip-${machine.id}`); }}>
                          {copiedField === `ip-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">AnyDesk</span>
                    <span className="detail-value">
                      {machine.anydesk_id || '-'}
                      {machine.anydesk_id && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.anydesk_id, `ad-${machine.id}`); }}>
                          {copiedField === `ad-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">RustDesk</span>
                    <span className="detail-value">
                      {machine.rustdesk_id || '-'}
                      {machine.rustdesk_id && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.rustdesk_id, `rd-${machine.id}`); }}>
                          {copiedField === `rd-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Nº Série</span>
                    <span className="detail-value">
                      {machine.serial_number || '-'}
                      {machine.serial_number && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.serial_number, `sn-${machine.id}`); }}>
                          {copiedField === `sn-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="fab" onClick={() => openModal()}>
          <Plus size={24} />
        </button>

        {isModalOpen && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{editingMachine ? 'Editar Máquina' : 'Nova Máquina'}</h2>
                <button className="close-btn" onClick={closeModal}>
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={saveMachine}>
                {editingMachine && (
                  <div style={{marginBottom: '20px', padding: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', borderRadius: '4px'}}>
                    <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px'}}>AUDITORIA DE CADASTRO</div>
                    <div style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)'}}>
                      POR: {editingMachine.created_by || 'Sistema'}
                    </div>
                    <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>
                      EM: {new Date(editingMachine.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
                {editingMachine && formData.serial_number && (
                  <div className="qr-container">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formData.serial_number)}`} 
                      alt="QR Code do Equipamento"
                    />
                    <p className="qr-label">QR Code de Identificação</p>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nome da Máquina</label>
                  <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: PC Recepção" />
                </div>

                <div className="form-group">
                  <label className="form-label">Número de Série</label>
                  <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: SN12345678" />
                </div>
                
                <div className="machine-details-grid-form">
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">IP</label>
                    <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.0.x" />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">MAC Address</label>
                    <input type="text" className="form-input" name="mac" value={formData.mac} onChange={handleInputChange} placeholder="00:00:00:00:00:00" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Localização / Setor</label>
                  <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: Matriz - RH" />
                </div>

                <div className="machine-details-grid-form">
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">AnyDesk ID</label>
                    <input type="text" className="form-input" name="anydesk_id" value={formData.anydesk_id} onChange={handleInputChange} placeholder="123 456 789" />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">RustDesk ID</label>
                    <input type="text" className="form-input" name="rustdesk_id" value={formData.rustdesk_id} onChange={handleInputChange} placeholder="123 456 789" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Senha de Acesso Remoto</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="Senha" />
                </div>

                <button type="submit" className="btn btn-primary btn-block">
                  {editingMachine ? 'Salvar Alterações' : 'Adicionar Máquina'}
                </button>
                
                {editingMachine && (
                  <button type="button" className="btn btn-danger btn-block" onClick={() => deleteMachine(editingMachine.id)}>
                    Excluir Máquina
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
    </>
  );
}

export default Dashboard;
