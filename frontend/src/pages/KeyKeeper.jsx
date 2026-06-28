import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, Plus, Search, ShieldCheck, Lock, Eye, EyeOff, Copy, Trash2, Edit, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

function KeyKeeper() {
  const [credentials, setCredentials] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [showPassMap, setShowPassMap] = useState({});
  const [copiedField, setCopiedField] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [credToDelete, setCredToDelete] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    category: 'Sistemas',
    notes: ''
  });

  const fetchCredentials = async () => {
    try {
      const response = await axios.get('/api/credentials', getAuthConfig());
      setCredentials(response.data);
    } catch (e) {
      toast.error('Erro ao carregar cofre');
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCred) {
        await axios.put(`/api/credentials/${editingCred.id}`, formData, getAuthConfig());
        toast.success('Credencial atualizada');
      } else {
        await axios.post('/api/credentials', formData, getAuthConfig());
        toast.success('Salvo no cofre!');
      }
      closeModal();
      fetchCredentials();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const deleteCred = (id) => {
    setCredToDelete(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!credToDelete) return;
    try {
      await axios.delete(`/api/credentials/${credToDelete}`, getAuthConfig());
      toast.success('Removido');
      fetchCredentials();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const openModal = (cred = null) => {
    if (cred) {
      setEditingCred(cred);
      setFormData(cred);
    } else {
      setEditingCred(null);
      setFormData({ title: '', username: '', password: '', category: 'Sistemas', notes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCred(null);
  };

  const toggleShow = (id) => {
    setShowPassMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filtered = credentials.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Key size={24} />
          </div>
          <div>
            <h1>Key Keeper</h1>
            <p>Cofre de senhas críticas e acessos seguros.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Nova Senha</span>
        </button>
      </div>

      <div className="search-wrapper" style={{marginBottom: '24px'}}>
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar credencial..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="machines-grid">
        {currentItems.length === 0 ? (
          <div className="empty-state">
            <Lock size={64} className="empty-icon" />
            <h2>Cofre Vazio</h2>
            <p>Clique em "+ NOVA SENHA" para começar.</p>
          </div>
        ) : (
          <>
            {currentItems.map(cred => (
              <div key={cred.id} className="machine-card" style={{cursor: 'default'}}>
                <div className="machine-header">
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <ShieldCheck size={20} color="var(--color-accent)" />
                    <div>
                      <span className="machine-title" style={{fontSize: '1.1rem'}}>{cred.title}</span>
                      <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block'}}>
                        {cred.category} • {new Date(cred.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="copy-btn" onClick={() => openModal(cred)} title="Editar"><Edit size={16} /></button>
                    <button className="delete-btn" onClick={() => deleteCred(cred.id)} title="Excluir"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  <div className="detail-item">
                    <span className="detail-label">Usuário</span>
                    <div className="detail-value" style={{display: 'flex', justifyContent: 'space-between', width: '100%'}}>
                      <span>{cred.username}</span>
                      <button 
                        className="copy-btn" 
                        onClick={() => copyToClipboard(cred.username, `user-${cred.id}`)}
                      >
                        {copiedField === `user-${cred.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Senha</span>
                    <div className="detail-value" style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                      <span style={{fontFamily: showPassMap[cred.id] ? 'monospace' : 'password', fontSize: showPassMap[cred.id] ? '1rem' : '1.2rem', letterSpacing: showPassMap[cred.id] ? '0' : '2px'}}>
                        {showPassMap[cred.id] ? cred.password : '••••••••'}
                      </span>
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button className="copy-btn" onClick={() => toggleShow(cred.id)}>
                          {showPassMap[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button 
                          className="copy-btn" 
                          onClick={() => copyToClipboard(cred.password, `pass-${cred.id}`)}
                        >
                          {copiedField === `pass-${cred.id}` ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {cred.notes && (
                    <div style={{marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.02)', borderRadius: '6px', fontSize: '0.8rem', color: '#64748b'}}>
                      <strong>Notas:</strong> {cred.notes}
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
              <h2>{editingCred ? 'Editar Credencial' : 'Nova Credencial'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome / Serviço</label>
                <input 
                  type="text" required className="form-input" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Root Mikrotik ou Painel Vivo"
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group">
                  <label className="form-label">Usuário</label>
                  <input 
                    type="text" required className="form-input" 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    placeholder="admin"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Senha</label>
                  <input 
                    type="text" required className="form-input" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="senha123"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select 
                  className="form-input"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="Sistemas">Sistemas / Servidores</option>
                  <option value="Rede">Equipamentos de Rede</option>
                  <option value="Cameras">Câmeras / NVRs</option>
                  <option value="Email">Email / Comunicação</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notas Adicionais</label>
                <textarea 
                  className="form-input" rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Ex: Só acessa via VPN ou trocar a cada 90 dias"
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                {editingCred ? 'ATUALIZAR' : 'SALVAR NO COFRE'}
              </button>
            </form>
          </div>
        </div>
      )}
      {showConfirm && (
        <ConfirmModal 
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={confirmDelete}
          title="Excluir Credencial"
          message="Esta ação é permanente. Deseja remover esta senha do cofre?"
        />
      )}
    </div>
  );
}

export default KeyKeeper;
