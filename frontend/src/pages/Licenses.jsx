import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { KeyRound, Plus, Search, Trash2, Edit, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

const LICENSE_TYPES = ['Assinatura', 'Perpétua', 'OEM', 'Volume'];

const diasParaVencer = (expiresAt) => {
  if (!expiresAt) return null;
  const d = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  return Number.isNaN(d) ? null : d;
};

function Licenses() {
  const [licenses, setLicenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: '', vendor: '', version: '', license_type: 'Assinatura', license_key: '',
    seats: '', expires_at: '', used_on: '', company: '', notes: ''
  });

  const fetchLicenses = async () => {
    try {
      const response = await axios.get('/api/licenses', getAuthConfig());
      setLicenses(response.data);
    } catch (e) {
      toast.error('Erro ao carregar licenças');
    }
  };

  useEffect(() => { fetchLicenses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`/api/licenses/${editing.id}`, formData, getAuthConfig());
        toast.success('Atualizado');
      } else {
        await axios.post('/api/licenses', formData, getAuthConfig());
        toast.success('Cadastrado');
      }
      closeModal();
      fetchLicenses();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const askDelete = (id) => { setToDelete(id); setShowConfirm(true); };
  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/licenses/${toDelete}`, getAuthConfig());
      toast.success('Removido');
      fetchLicenses();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const openModal = (lic = null) => {
    if (lic) {
      setEditing(lic);
      setFormData({ ...lic, expires_at: lic.expires_at ? lic.expires_at.slice(0, 10) : '' });
    } else {
      setEditing(null);
      setFormData({ name: '', vendor: '', version: '', license_type: 'Assinatura', license_key: '', seats: '', expires_at: '', used_on: '', company: '', notes: '' });
    }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const filtered = licenses.filter(l =>
    (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.vendor || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.company || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <header style={{marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
        <h1 style={{fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '8px'}}>Licenças & Apps</h1>
        <p style={{color: 'var(--color-text-muted)', margin: 0}}>Controle de licenças de software, validades e onde cada uma é usada.</p>
      </header>

      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nome, fabricante ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <KeyRound className="empty-icon" size={64} />
          <h2>Nenhuma licença cadastrada</h2>
          <p>Clique no botão + para adicionar a primeira licença.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {filtered.map(lic => {
            const dias = diasParaVencer(lic.expires_at);
            const vencendo = dias !== null && dias <= 30;
            return (
              <div key={lic.id} className="machine-card" onClick={() => openModal(lic)}>
                <div className="machine-header">
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <div title={vencendo ? 'Vencendo' : 'Em dia'} style={{width: '12px', height: '12px', borderRadius: '50%', background: vencendo ? '#ef4444' : '#10b981'}} />
                    <div>
                      <span className="machine-title" style={{display: 'block'}}>{lic.name}</span>
                      <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                        {lic.vendor || 'Fabricante não informado'} {lic.version ? `• v${lic.version}` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="card-actions-wrapper">
                    <div className="actions-group management">
                      <button className="action-chip edit" title="Editar" onClick={(e) => { e.stopPropagation(); openModal(lic); }}>
                        <Edit size={14} />
                      </button>
                      <button className="action-chip delete" title="Excluir" onClick={(e) => { e.stopPropagation(); askDelete(lic.id); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="machine-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Tipo</span>
                    <span className="detail-value">{lic.license_type || '—'}{lic.seats ? ` • ${lic.seats} assentos` : ''}</span>
                  </div>
                  {lic.used_on && (
                    <div className="detail-item">
                      <span className="detail-label">Usada em</span>
                      <span className="detail-value">{lic.used_on}</span>
                    </div>
                  )}
                  {lic.company && (
                    <div className="detail-item">
                      <span className="detail-label">Empresa</span>
                      <span className="detail-value">{lic.company}</span>
                    </div>
                  )}
                  {lic.expires_at && (
                    <div className="detail-item">
                      <span className="detail-label">Validade</span>
                      <span className="detail-value" style={{color: vencendo ? '#ef4444' : 'inherit'}}>
                        {new Date(lic.expires_at).toLocaleDateString('pt-BR')}
                        {vencendo && (
                          <span title={dias <= 0 ? 'Vencida' : `${dias} dias`}>
                            <AlertTriangle size={14} color="#ef4444" style={{marginLeft: '4px', verticalAlign: 'middle'}} />
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="fab" onClick={() => openModal()} title="Nova Licença">
        <Plus size={24} />
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Licença' : 'Nova Licença'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome do Software</label>
                <input required type="text" className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Microsoft 365, AutoCAD..."
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Fabricante</label>
                  <input type="text" className="form-input"
                    value={formData.vendor}
                    onChange={e => setFormData({...formData, vendor: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Versão</label>
                  <input type="text" className="form-input"
                    value={formData.version}
                    onChange={e => setFormData({...formData, version: e.target.value})}
                  />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={formData.license_type} onChange={e => setFormData({...formData, license_type: e.target.value})}>
                    {LICENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Assentos</label>
                  <input type="number" min="0" className="form-input"
                    value={formData.seats}
                    onChange={e => setFormData({...formData, seats: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Chave de Licença</label>
                <input type="text" className="form-input"
                  value={formData.license_key}
                  onChange={e => setFormData({...formData, license_key: e.target.value})}
                  placeholder="XXXXX-XXXXX-XXXXX"
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Validade</label>
                  <input type="date" className="form-input"
                    value={formData.expires_at}
                    onChange={e => setFormData({...formData, expires_at: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Empresa (cliente)</label>
                  <input type="text" className="form-input"
                    value={formData.company}
                    onChange={e => setFormData({...formData, company: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Usada em (máquina/local)</label>
                <input type="text" className="form-input"
                  value={formData.used_on}
                  onChange={e => setFormData({...formData, used_on: e.target.value})}
                  placeholder="Ex: PC Recepção, Servidor Principal..."
                />
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
                  <Trash2 size={18} style={{marginRight: '8px'}} /> EXCLUIR LICENÇA
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
          title="Excluir Licença"
          message="Esta ação é permanente. Deseja remover esta licença?"
        />
      )}
    </>
  );
}

export default Licenses;
