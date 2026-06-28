import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Phone, Plus, Search, Activity, Trash2, Edit, X, Copy, ExternalLink, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';

function Voip() {
  const [extensions, setExtensions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExt, setEditingExt] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [formData, setFormData] = useState({
    extension: '',
    name: '',
    password: '',
    ip_address: '',
    pabx_ip: '',
    status: 'Ativo',
    notes: ''
  });
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'ip_address') {
      formattedValue = value.replace(/[^0-9.]/g, ''); // Apenas números e pontos
      formattedValue = formattedValue.replace(/\.\./g, '.'); // Evita pontos duplos
    }

    setFormData({ ...formData, [name]: formattedValue });
  };

  const fetchExtensions = async () => {
    try {
      const response = await axios.get('/api/voip', getAuthConfig());
      setExtensions(response.data);
    } catch (e) {
      toast.error('Erro ao buscar ramais');
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExt) {
        await axios.put(`/api/voip/${editingExt.id}`, formData, getAuthConfig());
        toast.success('Ramal atualizado');
      } else {
        await axios.post('/api/voip', formData, getAuthConfig());
        toast.success('Ramal cadastrado!');
      }
      closeModal();
      fetchExtensions();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const deleteExt = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Remover Ramal',
      message: 'Esta ação excluirá permanentemente o ramal. Confirmar?',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/voip/${id}`, getAuthConfig());
          toast.success('Removido');
          fetchExtensions();
        } catch (e) {
          toast.error('Erro ao excluir');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openModal = (ext = null) => {
    if (ext) {
      setEditingExt(ext);
      setFormData(ext);
    } else {
      setEditingExt(null);
      setFormData({ extension: '', name: '', password: '', ip_address: '', pabx_ip: '', status: 'Ativo', notes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExt(null);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filtered = extensions.filter(e => 
    e.extension.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.ip_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="users-container">
      <div className="page-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div className="industrial-icon" style={{background: 'var(--color-primary)', color: 'white', padding: '10px', borderRadius: '8px'}}>
            <Phone size={24} />
          </div>
          <div>
            <h1>VOIP & Telefonia</h1>
            <p>Gerenciamento de ramais, ATAs e contas SIP.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Novo Ramal</span>
        </button>
      </div>

      <div className="search-wrapper" style={{marginBottom: '24px'}}>
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar ramal ou IP..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="machines-grid">
        {currentItems.length === 0 ? (
          <div className="empty-state">
            <Activity size={64} className="empty-icon" />
            <h2>Nenhum Ramal</h2>
            <p>Clique em "+ NOVO RAMAL" para começar a mapear sua telefonia.</p>
          </div>
        ) : (
          <>
            {currentItems.map(ext => (
              <div key={ext.id} className="machine-card" style={{cursor: 'default'}}>
                <div className="machine-header">
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%', 
                      background: ext.status === 'Ativo' ? '#ecfdf5' : '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Phone size={16} color={ext.status === 'Ativo' ? '#10b981' : '#ef4444'} />
                    </div>
                    <div>
                      <span className="machine-title" style={{fontSize: '1.2rem', fontWeight: '900'}}>{ext.extension}</span>
                      <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block'}}>
                        {ext.name} • {ext.status}
                      </span>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="copy-btn" onClick={() => openModal(ext)} title="Editar"><Edit size={16} /></button>
                    <button className="delete-btn" onClick={() => deleteExt(ext.id)} title="Excluir"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  <div className="detail-item">
                    <span className="detail-label">Senha SIP</span>
                    <div className="detail-value" style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                      <span style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{ext.password || '---'}</span>
                      <button className="copy-btn" onClick={() => copyToClipboard(ext.password, `pass-${ext.id}`)}>
                        {copiedField === `pass-${ext.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PABX (IP/DNS)</span>
                    <div className="detail-value" style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                      <span style={{fontWeight: 'bold'}}>{ext.pabx_ip || '---'}</span>
                      <button className="copy-btn" onClick={() => copyToClipboard(ext.pabx_ip, `pabx-${ext.id}`)}>
                        {copiedField === `pabx-${ext.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">IP do Dispositivo</span>
                    <div className="detail-value" style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                      <span>{ext.ip_address || '---'}</span>
                      <div style={{display: 'flex', gap: '8px'}}>
                        {ext.ip_address && (
                          <a href={`http://${ext.ip_address}`} target="_blank" rel="noreferrer" className="copy-btn">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button className="copy-btn" onClick={() => copyToClipboard(ext.ip_address, `ip-${ext.id}`)}>
                          {copiedField === `ip-${ext.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {ext.notes && (
                    <div style={{marginTop: '6px', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', fontSize: '0.8rem', color: '#64748b'}}>
                      <strong>Notas:</strong> {ext.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {totalPages > 1 && (
              <div className="pagination-industrial">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => paginate(currentPage - 1)}
                  className="page-btn"
                >
                  Anterior
                </button>
                <div className="page-info">
                  Página <span>{currentPage}</span> de {totalPages}
                </div>
                <button 
                  disabled={currentPage === totalPages}
                  onClick={() => paginate(currentPage + 1)}
                  className="page-btn"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{maxWidth: '450px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingExt ? 'Editar Ramal' : 'Novo Ramal SIP'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="machine-details-grid-form">
                <div className="form-group">
                  <label className="form-label">Número do Ramal</label>
                  <input 
                    type="text" required className="form-input" 
                    value={formData.extension} 
                    onChange={e => setFormData({...formData, extension: e.target.value})}
                    placeholder="Ex: 1001"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome do Usuário</label>
                  <input 
                    type="text" required className="form-input" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Recepção"
                  />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group">
                  <label className="form-label">Senha SIP</label>
                  <input 
                    type="text" required className="form-input" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select 
                    className="form-input"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Manutenção">Manutenção</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Endereço do PABX / Servidor (IP ou DNS)</label>
                <input
                  type="text" className="form-input"
                  name="pabx_ip"
                  value={formData.pabx_ip}
                  onChange={e => setFormData({ ...formData, pabx_ip: e.target.value })}
                  placeholder="Ex: 192.168.1.10 ou pabx.empresa.com.br"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Endereço IP do Aparelho (Opcional)</label>
                <input 
                  type="text" className="form-input" 
                  name="ip_address"
                  value={formData.ip_address} 
                  onChange={handleInputChange}
                  placeholder="Ex: 192.168.1.50"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notas / Localização do ATA</label>
                <textarea 
                  className="form-input" rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Ex: No rack da recepção, ATA Grandstream"
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                {editingExt ? 'ATUALIZAR' : 'SALVAR RAMAL'}
              </button>
            </form>
          </div>
        </div>
      )}
      {confirmDialog.open && (
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">{confirmDialog.title}</h3>
            <p className="confirm-modal-text">{confirmDialog.message}</p>
            <div className="confirm-modal-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
                CANCELAR
              </button>
              <button className="btn-confirm-danger" onClick={confirmDialog.onConfirm}>
                CONFIRMAR EXCLUSÃO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Voip;
