import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, Copy, Router as RouterIcon, MapPin, Check, Download, Clipboard, Trash2, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = '/api/network-devices';

function NetworkDevices() {
  const [devices, setDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', type: 'Modem', ip: '', username: '', password: '', location: '', isp: '', serial_number: ''
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  useEffect(() => {
    const token = localStorage.getItem('klarke_token');
    if (!token) {
      navigate('/');
      return;
    }
    fetchDevices();
  }, [navigate]);

  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      html5QrCode = new window.Html5Qrcode("reader-network");
      const qrCodeSuccessCallback = (decodedText) => {
        setIsScannerOpen(false);
        html5QrCode.stop();

        // Busca automática e abertura do modal
        const match = devices.find(d => 
          d.serial_number === decodedText || 
          d.id.toString() === decodedText ||
          d.name === decodedText
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
  }, [isScannerOpen, devices]);

  const fetchDevices = async () => {
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setDevices(response.data);
    } catch (error) {
      if (error.response?.status === 401) navigate('/');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'ip') {
      formattedValue = value.replace(/[^0-9.]/g, '');
    }

    setFormData({ ...formData, [name]: formattedValue });
  };

  const openModal = (device = null) => {
    if (device) {
      setEditingDevice(device);
      setFormData(device);
    } else {
      setEditingDevice(null);
      setFormData({ name: '', type: 'Modem', ip: '', username: '', password: '', location: '', isp: '', serial_number: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDevice(null);
  };

  const saveDevice = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await axios.put(`${API_URL}/${editingDevice.id}`, formData, getAuthConfig());
        toast.success('Equipamento atualizado!');
      } else {
        await axios.post(API_URL, formData, getAuthConfig());
        toast.success('Equipamento cadastrado!');
      }
      fetchDevices();
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar equipamento.');
    }
  };

  const deleteDevice = async (id) => {
    if (window.confirm('Excluir equipamento?')) {
      await axios.delete(`${API_URL}/${id}`, getAuthConfig());
      toast.success('Equipamento excluída!');
      fetchDevices();
      closeModal();
    }
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullData = (device) => {
    const text = `Nome: ${device.name}\nTipo: ${device.type}\nSérie: ${device.serial_number || '-'}\nIP: ${device.ip}\nLocal: ${device.location}\nOperadora: ${device.isp}\nUsuário: ${device.username}\nSenha: ${device.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Dados completos copiados!');
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'Tipo', 'IP', 'Local', 'Operadora', 'Usuário', 'Senha', 'Série', 'Criado em'];
    const rows = devices.map(d => [
      d.id, d.name, d.type, d.ip, d.location, d.isp, d.username, d.password, d.serial_number, d.created_at
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'klarke_rede.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen + 'Z');
    const now = new Date();
    const diffInMinutes = (now - lastSeenDate) / (1000 * 60);
    return diffInMinutes < 5;
  };

  const filtered = devices.filter(d => 
    (d.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.ip?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.location?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.isp?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.serial_number?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <>
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
          <button 
            className="logout-btn" 
            style={{padding: '8px', marginLeft: '8px', background: 'var(--color-accent)'}}
            onClick={() => setIsScannerOpen(true)}
            title="Escanear QR Code"
          >
            <QrCode size={20} color="white" />
          </button>
        </div>
        <button className="btn btn-primary" style={{marginTop: 0, padding: '16px', width: 'auto'}} onClick={exportToCSV} title="Exportar CSV">
          <Download size={20} />
        </button>
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
              <div id="reader-network" style={{width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden'}}></div>
              <p style={{marginTop: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>
                Aponte a câmera para o QR Code da etiqueta.
              </p>
          </div>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="empty-state">
          <RouterIcon className="empty-icon" size={64} />
          <h2>Nenhum equipamento cadastrado</h2>
          <p>Adicione modems, switches e roteadores da rede.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {filtered.map(device => (
            <div key={device.id} className="machine-card" onClick={() => openModal(device)}>
              <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div 
                    title={isOnline(device.last_seen) ? 'Online' : 'Offline'}
                    style={{
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: isOnline(device.last_seen) ? '#10b981' : '#ef4444'
                    }} 
                  />
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{device.name || 'Equipamento'}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {device.created_at ? new Date(device.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                </div>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <span className="machine-location">
                    <MapPin size={12} style={{display: 'inline', marginRight: 4}} />
                    {device.location || 'Sem local'}
                  </span>
                  <button className="copy-btn" title="Copiar Tudo" onClick={(e) => { e.stopPropagation(); copyFullData(device); }}>
                    <Clipboard size={16} />
                  </button>
                  <button className="delete-btn" title="Excluir" onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="machine-details-grid">
                <div className="detail-item">
                  <span className="detail-label">IP Address</span>
                  <span className="detail-value">
                    {device.ip || '-'}
                    {device.ip && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(device.ip, `ip-${device.id}`); }}>
                        {copiedField === `ip-${device.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Tipo</span>
                  <span className="detail-value" style={{textTransform: 'capitalize'}}>{device.type || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Operadora / Link</span>
                  <span className="detail-value">{device.isp || '-'}</span>
                </div>
                <div className="detail-item" style={{display: 'none'}}></div>
                <div className="detail-item">
                  <span className="detail-label">Usuário</span>
                  <span className="detail-value">
                    {device.username || '-'}
                    {device.username && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(device.username, `usr-${device.id}`); }}>
                        {copiedField === `usr-${device.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Senha</span>
                  <span className="detail-value">
                    ********
                    {device.password && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(device.password, `pw-${device.id}`); }}>
                        {copiedField === `pw-${device.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nº Série</span>
                  <span className="detail-value">
                    {device.serial_number || '-'}
                    {device.serial_number && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(device.serial_number, `sn-${device.id}`); }}>
                        {copiedField === `sn-${device.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
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
              <h2 className="modal-title">{editingDevice ? 'Editar Equipamento' : 'Novo Equipamento'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            
            <form onSubmit={saveDevice}>
              {editingDevice && formData.serial_number && (
                <div className="qr-container">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formData.serial_number)}`} 
                    alt="QR Code do Equipamento"
                  />
                  <p className="qr-label">QR Code de Identificação</p>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nome / Identificação</label>
                <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: Roteador Principal" />
              </div>

              <div className="form-group">
                <label className="form-label">Número de Série</label>
                <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: SN-ROUTER-01" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Tipo de Equipamento</label>
                  <select className="form-input" name="type" value={formData.type} onChange={handleInputChange}>
                    <option value="Modem">Modem</option>
                    <option value="Roteador">Roteador</option>
                    <option value="Switch">Switch</option>
                    <option value="Firewall">Firewall</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">IP de Acesso</label>
                  <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.x.x" />
                </div>
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Localização</label>
                  <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: Rack TI" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Operadora / Link</label>
                  <input type="text" className="form-input" name="isp" value={formData.isp} onChange={handleInputChange} placeholder="Ex: Vivo, Claro" />
                </div>
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Usuário</label>
                  <input type="text" className="form-input" name="username" value={formData.username} onChange={handleInputChange} placeholder="admin" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Senha</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="senha" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block">
                {editingDevice ? 'Salvar Alterações' : 'Adicionar Equipamento'}
              </button>
              
              {editingDevice && (
                <button type="button" className="btn btn-danger btn-block" onClick={() => deleteDevice(editingDevice.id)}>
                  Excluir Equipamento
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default NetworkDevices;
