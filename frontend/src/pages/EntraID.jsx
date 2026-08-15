import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserSquare2, Plus, Search, ShieldCheck, ShieldOff, Trash2, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

const OBJECT_TYPES = ['Usuário', 'Grupo', 'Dispositivo', 'App Registration'];
const STATUSES = ['Ativo', 'Inativo', 'Suspenso'];

function EntraID() {
  const [objects, setObjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '', object_type: 'Usuário', upn: '', license: '',
    mfa: false, status: 'Ativo', department: '', company: '', notes: ''
  });

  const fetchObjects = async () => {
    try {
      const response = await axios.get('/api/entra', getAuthConfig());
      setObjects(response.data);
    } catch (e) {
      toast.error('Erro ao carregar Entra ID');
    }
  };

  useEffect(() => { fetchObjects(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`/api/entra/${editing.id}`, formData, getAuthConfig());
        toast.success('Atualizado');
      } else {
        await axios.post('/api/entra', formData, getAuthConfig());
        toast.success('Cadastrado');
      }
      closeModal();
      fetchObjects();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const askDelete = (id) => { setToDelete(id); setShowConfirm(true); };
  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/entra/${toDelete}`, getAuthConfig());
      toast.success('Removido');
      fetchObjects();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const openModal = (obj = null) => {
    if (obj) {
      setEditing(obj);
      setFormData({ ...obj, mfa: !!obj.mfa });
    } else {
      setEditing(null);
      setFormData({ display_name: '', object_type: 'Usuário', upn: '', license: '', mfa: false, status: 'Ativo', department: '', company: '', notes: '' });
    }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const filtered = objects.filter(o =>
    (o.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.upn || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.company || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <header style={{marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
        <h1 style={{fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '8px'}}>Entra ID</h1>
        <p style={{color: 'var(--color-text-muted)', margin: 0}}>Cadastro manual de usuários, grupos e dispositivos do Microsoft Entra ID.</p>
      </header>

      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nome, UPN ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <UserSquare2 className="empty-icon" size={64} />
          <h2>Nada cadastrado ainda</h2>
          <p>Clique no botão + para adicionar o primeiro objeto.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {filtered.map(obj => (
            <div key={obj.id} className="machine-card" onClick={() => openModal(obj)}>
              <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  {obj.status === 'Ativo' ? <ShieldCheck size={20} color="#10b981" /> : <ShieldOff size={20} color="#ef4444" />}
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{obj.display_name}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {obj.object_type} {obj.company ? `• ${obj.company}` : ''}
                    </span>
                  </div>
                </div>
                <div className="card-actions-wrapper">
                  <div className="actions-group management">
                    <button className="action-chip edit" title="Editar" onClick={(e) => { e.stopPropagation(); openModal(obj); }}>
                      <Edit size={14} />
                    </button>
                    <button className="action-chip delete" title="Excluir" onClick={(e) => { e.stopPropagation(); askDelete(obj.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="machine-details-grid">
                {obj.upn && (
                  <div className="detail-item">
                    <span className="detail-label">UPN</span>
                    <span className="detail-value">{obj.upn}</span>
                  </div>
                )}
                {obj.department && (
                  <div className="detail-item">
                    <span className="detail-label">Departamento</span>
                    <span className="detail-value">{obj.department}</span>
                  </div>
                )}
                {obj.license && (
                  <div className="detail-item">
                    <span className="detail-label">Licença</span>
                    <span className="detail-value">{obj.license}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className="detail-value">
                    {obj.status}{!!obj.mfa ? ' • MFA ativo' : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => openModal()} title="Novo Objeto">
        <Plus size={24} />
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Objeto' : 'Novo Objeto Entra ID'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome de Exibição</label>
                <input required type="text" className="form-input"
                  value={formData.display_name}
                  onChange={e => setFormData({...formData, display_name: e.target.value})}
                  placeholder="Ex: João Silva ou Grupo TI"
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={formData.object_type} onChange={e => setFormData({...formData, object_type: e.target.value})}>
                    {OBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">UPN / E-mail</label>
                <input type="text" className="form-input"
                  value={formData.upn}
                  onChange={e => setFormData({...formData, upn: e.target.value})}
                  placeholder="joao.silva@empresa.com"
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Licença</label>
                  <input type="text" className="form-input"
                    value={formData.license}
                    onChange={e => setFormData({...formData, license: e.target.value})}
                    placeholder="Ex: Microsoft 365 Business"
                  />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Departamento</label>
                  <input type="text" className="form-input"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Empresa (cliente)</label>
                <input type="text" className="form-input"
                  value={formData.company}
                  onChange={e => setFormData({...formData, company: e.target.value})}
                  placeholder="Ex: CEO Odontológico"
                />
              </div>
              <div className="form-group">
                <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
                  <input type="checkbox" checked={formData.mfa} onChange={e => setFormData({...formData, mfa: e.target.checked})} />
                  <span className="form-label" style={{margin: 0}}>MFA ativado</span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                ></textarea>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: editing ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '20px'}}>
                <button type="submit" className="btn btn-primary" style={{marginTop: 0}}>
                  {editing ? 'SALVAR' : 'CADASTRAR'}
                </button>
                {editing && (
                  <button type="button" className="btn" style={{backgroundColor: '#64748b', color: 'white', marginTop: 0}} onClick={closeModal}>
                    FECHAR
                  </button>
                )}
              </div>
              {editing && (
                <button type="button" className="btn btn-danger" style={{marginTop: '10px'}} onClick={() => { closeModal(); askDelete(editing.id); }}>
                  <Trash2 size={18} style={{marginRight: '8px'}} /> EXCLUIR OBJETO
                </button>
              )}
            </form>
          </div>
        </div>
      )}
      {showConfirm && (
        <ConfirmModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={confirmDelete}
          title="Excluir Objeto"
          message="Esta ação é permanente. Deseja remover este registro do Entra ID?"
        />
      )}
    </>
  );
}

export default EntraID;
