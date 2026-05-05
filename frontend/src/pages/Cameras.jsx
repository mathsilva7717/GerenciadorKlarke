import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, Copy, Camera, MapPin, Check, Download, Clipboard, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = '/api/cameras';

function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', ip: '', port: '', username: '', password: '', location: '', serial_number: ''
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
    fetchCameras();
  }, [navigate]);

  const fetchCameras = async () => {
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setCameras(response.data);
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

    if (name === 'port') {
      formattedValue = value.replace(/[^0-9]/g, '');
    }

    setFormData({ ...formData, [name]: formattedValue });
  };

  const openModal = (camera = null) => {
    if (camera) {
      setEditingCamera(camera);
      setFormData(camera);
    } else {
      setEditingCamera(null);
      setFormData({ name: '', ip: '', port: '', username: '', password: '', location: '', serial_number: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCamera(null);
  };

  const saveCamera = async (e) => {
    e.preventDefault();
    try {
      if (editingCamera) {
        await axios.put(`${API_URL}/${editingCamera.id}`, formData, getAuthConfig());
        toast.success('Câmera atualizada!');
      } else {
        await axios.post(API_URL, formData, getAuthConfig());
        toast.success('Câmera cadastrada!');
      }
      fetchCameras();
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar câmera.');
    }
  };

  const deleteCamera = async (id) => {
    if (window.confirm('Excluir câmera?')) {
      await axios.delete(`${API_URL}/${id}`, getAuthConfig());
      toast.success('Câmera excluída!');
      fetchCameras();
      closeModal();
    }
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullData = (camera) => {
    const text = `Nome: ${camera.name}\nSérie: ${camera.serial_number || '-'}\nIP: ${camera.ip}\nPorta: ${camera.port}\nLocal: ${camera.location}\nUsuário: ${camera.username}\nSenha: ${camera.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Dados completos copiados!');
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'IP', 'Porta', 'Local', 'Usuário', 'Senha', 'Criado em'];
    const rows = cameras.map(c => [
      c.id, c.name, c.ip, c.port, c.location, c.username, c.password, c.created_at
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'klarke_cameras.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const filtered = cameras.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.ip?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.location?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar câmera..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" style={{marginTop: 0, padding: '16px', width: 'auto'}} onClick={exportToCSV} title="Exportar CSV">
          <Download size={20} />
        </button>
      </div>

      {cameras.length === 0 ? (
        <div className="empty-state">
          <Camera className="empty-icon" size={64} />
          <h2>Nenhuma câmera cadastrada</h2>
          <p>Adicione as credenciais de acesso às suas câmeras/NVR.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {filtered.map(camera => (
            <div key={camera.id} className="machine-card" onClick={() => openModal(camera)}>
              <div className="machine-header">
                <div>
                  <span className="machine-title" style={{display: 'block'}}>{camera.name || 'Câmera'}</span>
                  <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                    {camera.created_at ? new Date(camera.created_at).toLocaleString() : ''}
                  </span>
                </div>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <span className="machine-location">
                    <MapPin size={12} style={{display: 'inline', marginRight: 4}} />
                    {camera.location || 'Sem local'}
                  </span>
                  <button className="copy-btn" title="Copiar Tudo" onClick={(e) => { e.stopPropagation(); copyFullData(camera); }}>
                    <Clipboard size={16} />
                  </button>
                  <button className="delete-btn" title="Excluir" onClick={(e) => { e.stopPropagation(); deleteCamera(camera.id); }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="machine-details-grid">
                <div className="detail-item">
                  <span className="detail-label">IP Address</span>
                  <span className="detail-value">
                    {camera.ip || '-'}
                    {camera.ip && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.ip, `ip-${camera.id}`); }}>
                        {copiedField === `ip-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Porta</span>
                  <span className="detail-value">{camera.port || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Usuário</span>
                  <span className="detail-value">
                    {camera.username || '-'}
                    {camera.username && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.username, `usr-${camera.id}`); }}>
                        {copiedField === `usr-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Senha</span>
                  <span className="detail-value">
                    ********
                    {camera.password && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.password, `pw-${camera.id}`); }}>
                        {copiedField === `pw-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nº Série</span>
                  <span className="detail-value">
                    {camera.serial_number || '-'}
                    {camera.serial_number && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.serial_number, `sn-${camera.id}`); }}>
                        {copiedField === `sn-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
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
              <h2 className="modal-title">{editingCamera ? 'Editar Câmera' : 'Nova Câmera'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            
            <form onSubmit={saveCamera}>
              <div className="form-group">
                <label className="form-label">Nome / Identificação</label>
                <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: Câmera Recepção ou NVR Central" />
              </div>

              <div className="form-group">
                <label className="form-label">Número de Série</label>
                <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: SN98765432" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">IP ou DDNS</label>
                  <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.x.x ou ddns.net" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Porta</label>
                  <input type="text" className="form-input" name="port" value={formData.port} onChange={handleInputChange} placeholder="Ex: 8080, 37777" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Localização</label>
                <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: Teto Corredor, CPD" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Usuário (Login)</label>
                  <input type="text" className="form-input" name="username" value={formData.username} onChange={handleInputChange} placeholder="admin" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Senha</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="senha forte" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block">
                {editingCamera ? 'Salvar Alterações' : 'Adicionar Câmera'}
              </button>
              
              {editingCamera && (
                <button type="button" className="btn btn-danger btn-block" onClick={() => deleteCamera(editingCamera.id)}>
                  Excluir Câmera
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default Cameras;
