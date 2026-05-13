import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BookOpen, FileText, Download, ExternalLink, Search, 
  Plus, X, Upload, Image as ImageIcon, Trash2, 
  Folder, FolderPlus, ChevronRight, MoreVertical, Edit 
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

function TechnicalDocs() {
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isUploading, setIsRefreshing] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [formData, setFormData] = useState({ title: '', type: 'Nota', content: '', amount: '', folder_id: null });
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', onConfirm: null });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    const user = localStorage.getItem('klarke_user') || 'Sistema';
    return { headers: { Authorization: `Bearer ${token}`, 'X-User': user } };
  };

  const fetchDocs = async () => {
    try {
      const response = await axios.get('/api/technical-docs', getAuthConfig());
      setDocs(response.data);
    } catch (e) {
      toast.error('Erro ao buscar documentos');
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await axios.get('/api/vault-folders', getAuthConfig());
      setFolders(response.data);
    } catch (e) {
      toast.error('Erro ao buscar pastas');
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchFolders();
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const createFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await axios.post('/api/vault-folders', { name: newFolderName }, getAuthConfig());
      toast.success('Pasta criada!');
      setNewFolderName('');
      setIsFolderModalOpen(false);
      fetchFolders();
    } catch (e) {
      toast.error('Erro ao criar pasta');
    }
  };

  const deleteFolder = (id) => {
    setConfirmConfig({
      title: 'Excluir Pasta',
      message: 'Tem certeza? Todos os arquivos desta pasta serão movidos para a raiz.',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/vault-folders/${id}`, getAuthConfig());
          toast.success('Pasta removida');
          if (currentFolder?.id === id) setCurrentFolder(null);
          fetchFolders();
          fetchDocs();
        } catch (e) {
          toast.error('Erro ao excluir');
        }
      }
    });
    setShowConfirm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRefreshing(true);
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('type', formData.type);
    data.append('content', formData.content);
    data.append('amount', formData.amount);
    data.append('folder_id', currentFolder ? currentFolder.id : (formData.folder_id || ''));
    if (selectedFile) data.append('file', selectedFile);

    try {
      if (editingDoc) {
        await axios.put(`/api/technical-docs/${editingDoc.id}`, {
          ...formData,
          folder_id: formData.folder_id
        }, getAuthConfig());
        toast.success('Atualizado!');
      } else {
        await axios.post('/api/technical-docs', data, {
          headers: { 
            ...getAuthConfig().headers,
            'Content-Type': 'multipart/form-data' 
          }
        });
        toast.success('Adicionado ao acervo!');
      }
      setIsModalOpen(false);
      setEditingDoc(null);
      setFormData({ title: '', type: 'Nota', content: '', amount: '', folder_id: null });
      setSelectedFile(null);
      fetchDocs();
    } catch (err) {
      toast.error('Erro ao salvar');
    } finally {
      setIsRefreshing(false);
    }
  };

  const openModal = (doc = null) => {
    if (doc) {
      setEditingDoc(doc);
      setFormData({ 
        title: doc.title, 
        type: doc.type, 
        content: doc.content || '', 
        amount: doc.amount || '',
        folder_id: doc.folder_id
      });
    } else {
      setEditingDoc(null);
      setFormData({ title: '', type: 'Nota', content: '', amount: '', folder_id: currentFolder?.id || null });
      setSelectedFile(null);
    }
    setIsModalOpen(true);
  };

  const deleteDoc = (id) => {
    setConfirmConfig({
      title: 'Excluir Item do Acervo',
      message: 'Esta ação removerá o documento ou arquivo permanentemente. Confirmar?',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/technical-docs/${id}`, getAuthConfig());
          toast.success('Removido');
          fetchDocs();
        } catch (e) {
          toast.error('Erro ao excluir');
        }
      }
    });
    setShowConfirm(true);
  };

  const filtered = docs.filter(d => {
    const matchesSearch = (d.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (d.content?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesFolder = currentFolder ? d.folder_id === currentFolder.id : !d.folder_id;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="users-container">
      <div className="page-header" style={{marginBottom: '32px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div className="industrial-icon" style={{background: 'var(--color-primary)', color: 'white', padding: '8px', borderRadius: '6px'}}>
            <BookOpen size={20} />
          </div>
          <header className="page-header" style={{marginBottom: '32px'}}>
        <h1 style={{marginBottom: '8px'}}>Acervo Técnico & Procedimentos</h1>
        <p>Documentação centralizada para consulta rápida em campo.</p>
      </header>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <button className="add-btn" onClick={() => setIsFolderModalOpen(true)} style={{background: 'var(--color-accent)', color: 'white'}}>
            <FolderPlus size={16} /> <span className="hide-mobile">PASTA</span>
          </button>
          <button className="add-btn" onClick={() => openModal()} style={{background: 'var(--color-primary)', color: 'white'}}>
            <Plus size={16} /> <span className="hide-mobile">NOVO ITEM</span>
          </button>
        </div>
      </div>

      <div className="vault-grid">
        {/* SIDEBAR DE PASTAS */}
        <div className="folders-sidebar">
          <div 
            className={`folder-item ${!currentFolder ? 'active' : ''}`}
            onClick={() => setCurrentFolder(null)}
          >
            <Folder size={18} />
            <span>Raiz do Acervo</span>
          </div>
          <div className="sidebar-label">
            Pastas
          </div>
          {folders.map(folder => (
            <div 
              key={folder.id} 
              className={`folder-item ${currentFolder?.id === folder.id ? 'active' : ''}`}
              onClick={() => setCurrentFolder(folder)}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', flex: 1}}>
                <Folder size={18} fill={currentFolder?.id === folder.id ? 'var(--color-accent)' : 'transparent'} />
                <span>{folder.name}</span>
              </div>
              <button className="folder-delete-small" onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>

        <div className="vault-content">
          <div className="search-container" style={{marginBottom: '24px'}}>
            <Search className="search-icon" size={20} color="#94a3b8" />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Buscar no acervo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', width: '100%', padding: '12px 12px 12px 40px', outline: 'none' }}
            />
          </div>

          {/* Breadcrumb / Mobile Selector */}
          <div style={{marginBottom: '20px'}}>
            <div className="vault-breadcrumb">
              <span onClick={() => setCurrentFolder(null)} style={{fontWeight: !currentFolder ? 'bold' : 'normal'}}>Raiz do Acervo</span>
              {currentFolder && (
                <>
                  <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
                  <span style={{fontWeight: 'bold', color: 'white'}}>{currentFolder.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="machines-grid">
            {filtered.length === 0 && (
              <div style={{textAlign: 'center', padding: '40px', background: 'var(--color-surface)', borderRadius: '12px', border: '2px dashed var(--color-border)'}}>
                <BookOpen size={40} style={{opacity: 0.2, marginBottom: '12px'}} />
                <p style={{margin: 0, opacity: 0.5}}>Nenhum item encontrado nesta pasta.</p>
              </div>
            )}
            {filtered.map(doc => (
              <div key={doc.id} className="machine-card" style={{cursor: 'default'}}>
                <div className="machine-header">
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                    {doc.file_path && (doc.file_path.endsWith('.jpg') || doc.file_path.endsWith('.png') || doc.file_path.endsWith('.jpeg')) ? (
                      <ImageIcon size={20} color="var(--color-accent)" />
                    ) : (
                      <FileText size={20} color="var(--color-accent)" />
                    )}
                    <div>
                      <span className="machine-title" style={{fontSize: '1.1rem'}}>{doc.title}</span>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>
                          {new Date(doc.created_at).toLocaleDateString()} • {doc.type}
                        </span>
                        {doc.amount && (
                          <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981', background: '#f0fdf4', padding: '2px 6px', borderRadius: '4px'}}>
                            R$ {parseFloat(doc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="copy-btn" onClick={() => openModal(doc)} title="Editar"><Edit size={16} /></button>
                    {doc.file_path && (
                      <a 
                        href={`/uploads/docs/${doc.file_path}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="copy-btn"
                        title="Abrir Arquivo"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                    <button className="delete-btn" onClick={() => deleteDoc(doc.id)}><Trash2 size={16} /></button>
                  </div>
                </div>

                {doc.content && (
                  <div style={{
                    marginTop: '12px', 
                    padding: '12px', 
                    background: 'var(--color-primary-light)', 
                    borderRadius: '6px', 
                    fontSize: '0.9rem', 
                    color: 'var(--color-text)',
                    whiteSpace: 'pre-wrap',
                    borderLeft: '4px solid var(--color-accent)'
                  }}>
                    {doc.content}
                  </div>
                )}
                
                {doc.file_path && (doc.file_path.endsWith('.jpg') || doc.file_path.endsWith('.png') || doc.file_path.endsWith('.jpeg')) && (
                  <div style={{marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee'}}>
                    <img 
                      src={`/uploads/docs/${doc.file_path}`} 
                      alt={doc.title} 
                      style={{width: '100%', maxHeight: '200px', objectFit: 'cover'}} 
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL NOVA PASTA */}
      {isFolderModalOpen && (
        <div className="modal-overlay" onClick={() => setIsFolderModalOpen(false)}>
          <div className="modal-content" style={{maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Criar Nova Pasta</h2>
              <button className="close-btn" onClick={() => setIsFolderModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={createFolder}>
              <div className="form-group">
                <label className="form-label">Nome da Pasta</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: Documentos Loja 01"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">CRIAR PASTA</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO ITEM */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsModalOpen(false); setEditingDoc(null); }}>
          <div className="modal-content" style={{maxWidth: '500px'}} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDoc ? 'Editar Item' : 'Novo Item no Vault'}</h2>
              <button className="close-btn" onClick={() => { setIsModalOpen(false); setEditingDoc(null); }}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Ex: Foto Rack Loja X ou Recibo Uber"
                />
              </div>
              
              {!editingDoc && (
                <div className="form-group">
                  <label className="form-label">Pasta de Destino</label>
                  <select 
                    className="form-input"
                    value={formData.folder_id || ''}
                    onChange={(e) => setFormData({...formData, folder_id: e.target.value || null})}
                  >
                    <option value="">Raiz do Acervo</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="machine-details-grid-form">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select 
                    className="form-input"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="Nota">Nota / Texto</option>
                    <option value="Investimento">Investimento</option>
                    <option value="Orçamento">Orçamento</option>
                    <option value="Recibo">Recibo / Custo</option>
                    <option value="Foto">Foto de Campo</option>
                    <option value="Manual">Manual PDF</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Valor (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="form-input"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Anotações</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                ></textarea>
              </div>
              {!editingDoc && (
                <div className="form-group">
                  <label className="form-label">Anexar Arquivo</label>
                  <div style={{
                    border: '2px dashed #cbd5e1',
                    padding: '20px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    background: selectedFile ? '#f0fdf4' : '#f8fafc',
                    cursor: 'pointer',
                    position: 'relative'
                  }}>
                    <input type="file" onChange={handleFileChange} style={{position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer'}} />
                    <Upload size={24} color={selectedFile ? '#10b981' : '#64748b'} style={{marginBottom: '8px'}} />
                    <p style={{margin: 0, fontSize: '0.85rem', color: selectedFile ? '#10b981' : '#64748b'}}>
                      {selectedFile ? selectedFile.name : 'Clique para subir'}
                    </p>
                  </div>
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-block" disabled={isUploading}>
                {isUploading ? 'SALVANDO...' : (editingDoc ? 'ATUALIZAR' : 'SALVAR NO VAULT')}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .vault-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 32px;
          align-items: start;
          max-width: 1400px;
          margin: 0 auto;
        }

        .folders-sidebar {
          background: var(--color-surface);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--color-border);
          box-shadow: var(--box-shadow);
          height: fit-content;
          position: sticky;
          top: 20px;
        }

        .folder-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: #475569;
          font-weight: 600;
          font-size: 0.85rem;
          margin-bottom: 4px;
          border: 1px solid transparent;
        }

        .folder-item:hover {
          background: #f8fafc;
          color: var(--color-primary);
          border-color: #e2e8f0;
        }

        .folder-item.active {
          background: #0f172a;
          color: white;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
        }

        .folder-item.active svg {
          color: var(--color-accent);
        }

        .sidebar-label {
          font-size: 0.65rem;
          font-weight: 900;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 24px 0 12px 16px;
        }

        .folder-delete-small {
          background: transparent;
          border: none;
          color: inherit;
          opacity: 0.3;
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          transition: opacity 0.2s;
        }

        .folder-item:hover .folder-delete-small {
          opacity: 0.7;
        }

        .folder-delete-small:hover {
          opacity: 1 !important;
          color: #ef4444;
        }

        .vault-content {
          min-width: 0;
        }

        .search-container {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 4px 16px;
          display: flex;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          transition: all 0.2s;
        }

        .search-container:focus-within {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1);
        }

        .vault-breadcrumb {
          background: var(--color-primary-light);
          padding: 8px 16px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.9);
          white-space: nowrap;
        }

        .vault-breadcrumb span {
          color: rgba(255, 255, 255, 0.7);
          transition: color 0.2s;
        }

        .vault-breadcrumb span:hover {
          color: #fff;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .vault-grid {
            grid-template-columns: 1fr;
          }
          .folders-sidebar {
            display: none;
          }
        }
      `}</style>
      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />
    </div>
  );
}

export default TechnicalDocs;
