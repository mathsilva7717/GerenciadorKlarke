import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Plus, Search, Upload, ExternalLink, Trash2, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

const CATEGORIES = ['Contrato', 'Nota Fiscal', 'Manual', 'Procedimento', 'Outros'];

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

function Documents() {
  const [docs, setDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [formData, setFormData] = useState({ title: '', category: 'Outros', company: '', description: '' });

  const fetchDocs = async () => {
    try {
      const response = await axios.get('/api/documents', getAuthConfig());
      setDocs(response.data);
    } catch (e) {
      toast.error('Erro ao carregar documentos');
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editing) {
        await axios.put(`/api/documents/${editing.id}`, formData, getAuthConfig());
        toast.success('Atualizado');
      } else {
        let payload = { ...formData };
        if (selectedFile) {
          payload.fileData = await fileToDataUrl(selectedFile);
          payload.fileName = selectedFile.name;
        }
        await axios.post('/api/documents', payload, getAuthConfig());
        toast.success('Documento adicionado');
      }
      closeModal();
      fetchDocs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const askDelete = (id) => { setToDelete(id); setShowConfirm(true); };
  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await axios.delete(`/api/documents/${toDelete}`, getAuthConfig());
      toast.success('Removido');
      fetchDocs();
    } catch (e) {
      toast.error('Erro ao excluir');
    }
  };

  const openModal = (doc = null) => {
    if (doc) {
      setEditing(doc);
      setFormData({ title: doc.title, category: doc.category || 'Outros', company: doc.company || '', description: doc.description || '' });
    } else {
      setEditing(null);
      setFormData({ title: '', category: 'Outros', company: '', description: '' });
      setSelectedFile(null);
    }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); setSelectedFile(null); };

  const filtered = docs.filter(d =>
    (d.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <header style={{marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)'}}>
        <h1 style={{fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '8px'}}>Documentos</h1>
        <p style={{color: 'var(--color-text-muted)', margin: 0}}>Contratos, notas fiscais, manuais e procedimentos centralizados.</p>
      </header>

      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por título, empresa ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileText className="empty-icon" size={64} />
          <h2>Nenhum documento ainda</h2>
          <p>Clique no botão + para adicionar o primeiro documento.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {filtered.map(doc => (
            <div key={doc.id} className="machine-card" onClick={() => openModal(doc)}>
              <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <FileText size={18} color="var(--color-accent)" />
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{doc.title}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {doc.category} {doc.company ? `• ${doc.company}` : ''} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
                <div className="card-actions-wrapper">
                  {doc.file_path && (
                    <div className="actions-group utility">
                      <a href={`/uploads/${doc.file_path}`} target="_blank" rel="noreferrer" className="action-chip" title="Abrir arquivo" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={14} /> <span>ABRIR</span>
                      </a>
                    </div>
                  )}
                  <div className="actions-separator"></div>
                  <div className="actions-group management">
                    <button className="action-chip edit" title="Editar" onClick={(e) => { e.stopPropagation(); openModal(doc); }}>
                      <Edit size={14} />
                    </button>
                    <button className="action-chip delete" title="Excluir" onClick={(e) => { e.stopPropagation(); askDelete(doc.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {(doc.description || doc.file_name) && (
                <div className="machine-details-grid">
                  {doc.description && (
                    <div className="detail-item" style={{gridColumn: '1 / -1'}}>
                      <span className="detail-label">Descrição</span>
                      <span className="detail-value">{doc.description}</span>
                    </div>
                  )}
                  {doc.file_name && (
                    <div className="detail-item" style={{gridColumn: '1 / -1'}}>
                      <span className="detail-label">Arquivo</span>
                      <span className="detail-value">{doc.file_name} {doc.size ? `(${formatSize(doc.size)})` : ''}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => openModal()} title="Novo Documento">
        <Plus size={24} />
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Documento' : 'Novo Documento'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input required type="text" className="form-input"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Contrato de Locação Loja 01"
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
              {!editing && (
                <div className="form-group">
                  <label className="form-label">Anexar Arquivo</label>
                  <div style={{
                    border: '2px dashed var(--color-border)',
                    padding: '20px',
                    borderRadius: 'var(--border-radius)',
                    textAlign: 'center',
                    background: selectedFile ? 'rgba(16,185,129,0.06)' : 'var(--color-secondary)',
                    cursor: 'pointer',
                    position: 'relative'
                  }}>
                    <input type="file" onChange={e => setSelectedFile(e.target.files[0])} style={{position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer'}} />
                    <Upload size={24} color={selectedFile ? '#10b981' : 'var(--color-text-muted)'} style={{marginBottom: '8px'}} />
                    <p style={{margin: 0, fontSize: '0.85rem', color: selectedFile ? '#10b981' : 'var(--color-text-muted)'}}>
                      {selectedFile ? selectedFile.name : 'Clique para subir (opcional)'}
                    </p>
                  </div>
                </div>
              )}
              <div style={{display: 'grid', gridTemplateColumns: editing ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '20px'}}>
                <button type="submit" className="btn btn-primary" style={{marginTop: 0}} disabled={isSaving}>
                  {isSaving ? 'SALVANDO...' : (editing ? 'SALVAR' : 'ADICIONAR')}
                </button>
                {editing && (
                  <button type="button" className="btn" style={{backgroundColor: '#64748b', color: 'white', marginTop: 0}} onClick={closeModal}>
                    FECHAR
                  </button>
                )}
              </div>
              {editing && (
                <button type="button" className="btn btn-danger" style={{marginTop: '10px'}} onClick={() => { closeModal(); askDelete(editing.id); }}>
                  <Trash2 size={18} style={{marginRight: '8px'}} /> EXCLUIR DOCUMENTO
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
          title="Excluir Documento"
          message="Esta ação removerá o documento (e o arquivo anexado, se houver) permanentemente."
        />
      )}
    </>
  );
}

export default Documents;
