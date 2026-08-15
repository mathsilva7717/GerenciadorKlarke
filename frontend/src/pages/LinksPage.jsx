import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link2, Plus, Search, ExternalLink, Trash2, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

const CATEGORIES = ['Painel', 'Documentação', 'Portal', 'Ferramenta', 'Outros'];

function LinksPage() {
  const [links, setLinks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [formData, setFormData] = useState({ title: '', url: '', category: 'Outros', description: '', company: '' });

  const fetchLinks = async () => {
    try {
      const response = await axios.get('/api/links', getAuthConfig());
      setLinks(response.data);
    } catch (e) {
      toast.error('Erro ao carregar links');
    }
  };

  useEffect(() => { fetchLinks(); }, []);

  const normalizeUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, url: normalizeUrl(formData.url.trim()) };
      if (editing) {
        await axios.put(`/api/links/${editing.id}`, payload, getAuthConfig());
        toast.success('Atualizado');
      } else {
        await axios.post('/api/links', payload, getAuthConfig());
        toast.success('Link adicionado');
      }
      closeModal();
      fetchLinks();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const askDelete = (id) => { setToDelete(id); setShowConfirm(true); };
  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/links/${toDelete}`, getAuthConfig());
      toast.success('Removido');
      fetchLinks();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const openModal = (link = null) => {
    if (link) {
      setEditing(link);
      setFormData(link);
    } else {
      setEditing(null);
      setFormData({ title: '', url: '', category: 'Outros', description: '', company: '' });
    }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const filtered = links.filter(l =>
    (l.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.url || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.company || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <header style={{marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
        <h1 style={{fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '8px'}}>Links</h1>
        <p style={{color: 'var(--color-text-muted)', margin: 0}}>Atalhos rápidos para painéis, portais e ferramentas usadas no dia a dia.</p>
      </header>

      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nome, URL ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Link2 className="empty-icon" size={64} />
          <h2>Nenhum link cadastrado</h2>
          <p>Clique no botão + para adicionar o primeiro link.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {filtered.map(link => (
            <div key={link.id} className="machine-card" onClick={() => openModal(link)}>
              <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <Link2 size={18} color="var(--color-accent)" />
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{link.title}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {link.category} {link.company ? `• ${link.company}` : ''}
                    </span>
                  </div>
                </div>
                <div className="card-actions-wrapper">
                  <div className="actions-group utility">
                    <a href={link.url} target="_blank" rel="noreferrer" className="action-chip" title="Abrir link" onClick={e => e.stopPropagation()}>
                      <ExternalLink size={14} /> <span>ABRIR</span>
                    </a>
                  </div>
                  <div className="actions-separator"></div>
                  <div className="actions-group management">
                    <button className="action-chip edit" title="Editar" onClick={(e) => { e.stopPropagation(); openModal(link); }}>
                      <Edit size={14} />
                    </button>
                    <button className="action-chip delete" title="Excluir" onClick={(e) => { e.stopPropagation(); askDelete(link.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="machine-details-grid">
                <div className="detail-item" style={{gridColumn: '1 / -1'}}>
                  <span className="detail-label">URL</span>
                  <span className="detail-value" style={{wordBreak: 'break-all'}}>{link.url}</span>
                </div>
                {link.description && (
                  <div className="detail-item" style={{gridColumn: '1 / -1'}}>
                    <span className="detail-label">Descrição</span>
                    <span className="detail-value">{link.description}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => openModal()} title="Novo Link">
        <Plus size={24} />
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Link' : 'Novo Link'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input required type="text" className="form-input"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Painel Mikrotik Loja 01"
                />
              </div>
              <div className="form-group">
                <label className="form-label">URL</label>
                <input required type="text" className="form-input"
                  value={formData.url}
                  onChange={e => setFormData({...formData, url: e.target.value})}
                  placeholder="painel.exemplo.com.br"
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Categoria</label>
                  <select className="form-input" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
                <label className="form-label">Descrição</label>
                <textarea className="form-input" rows="2"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: editing ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '20px'}}>
                <button type="submit" className="btn btn-primary" style={{marginTop: 0}}>
                  {editing ? 'SALVAR' : 'ADICIONAR'}
                </button>
                {editing && (
                  <button type="button" className="btn" style={{backgroundColor: '#64748b', color: 'white', marginTop: 0}} onClick={closeModal}>
                    FECHAR
                  </button>
                )}
              </div>
              {editing && (
                <button type="button" className="btn btn-danger" style={{marginTop: '10px'}} onClick={() => { closeModal(); askDelete(editing.id); }}>
                  <Trash2 size={18} style={{marginRight: '8px'}} /> EXCLUIR LINK
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
          title="Excluir Link"
          message="Esta ação é permanente. Deseja remover este link?"
        />
      )}
    </>
  );
}

export default LinksPage;
