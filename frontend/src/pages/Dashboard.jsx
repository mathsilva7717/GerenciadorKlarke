import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, Copy, Monitor, MapPin, Check, Download, Clipboard, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = '/api/machines';

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      navigate('/'); // Redireciona para login se não tiver token
      return;
    }
    fetchMachines();
  }, [navigate]);

  const fetchMachines = async () => {
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setMachines(response.data);
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
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
      if (editingMachine) {
        await axios.put(`${API_URL}/${editingMachine.id}`, formData, getAuthConfig());
        toast.success('Máquina atualizada!');
      } else {
        await axios.post(API_URL, formData, getAuthConfig());
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
    const headers = ['ID', 'Nome', 'IP', 'MAC', 'Local', 'AnyDesk', 'RustDesk', 'Senha', 'Criado em'];
    const rows = machines.map(m => [
      m.id, m.name, m.ip, m.mac, m.location, m.anydesk_id, m.rustdesk_id, m.password, m.created_at
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

  const filteredMachines = machines.filter(m => 
    (m.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (m.ip?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (m.location?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por nome, IP ou local..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" style={{marginTop: 0, padding: '16px', width: 'auto'}} onClick={exportToCSV} title="Exportar CSV">
          <Download size={20} />
        </button>
      </div>

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
                <div>
                  <span className="machine-title" style={{display: 'block'}}>{machine.name || 'Máquina sem nome'}</span>
                  <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                    {machine.created_at ? new Date(machine.created_at).toLocaleString() : ''}
                  </span>
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
