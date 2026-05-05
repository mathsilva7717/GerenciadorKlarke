import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, FileText, Download, ExternalLink, Search, Plus, X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function TechnicalDocs() {
  const [docs, setDocs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsRefreshing] = useState(false);
  const [formData, setFormData] = useState({ title: '', type: 'Nota', content: '' });
  const [selectedFile, setSelectedFile] = useState(null);

  const getAuthConfig = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('klarke_token')}` }
  });

  const fetchDocs = async () => {
    try {
      const response = await axios.get('/api/technical-docs', getAuthConfig());
      setDocs(response.data);
    } catch (e) {
      toast.error('Erro ao buscar documentos');
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsRefreshing(true);
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('type', formData.type);
    data.append('content', formData.content);
    if (selectedFile) data.append('file', selectedFile);

    try {
      await axios.post('/api/technical-docs', data, {
        headers: { 
          ...getAuthConfig().headers,
          'Content-Type': 'multipart/form-data' 
        }
      });
      toast.success('Adicionado ao acervo!');
      setIsModalOpen(false);
      setFormData({ title: '', type: 'Nota', content: '' });
      setSelectedFile(null);
      fetchDocs();
    } catch (err) {
      toast.error('Erro ao enviar');
    } finally {
      setIsRefreshing(false);
    }
  };

  const deleteDoc = async (id) => {
    if (window.confirm('Excluir este item do acervo?')) {
      try {
        await axios.delete(`/api/technical-docs/${id}`, getAuthConfig());
        toast.success('Removido');
        fetchDocs();
      } catch (e) {
        toast.error('Erro ao excluir');
      }
    }
  };

  const filtered = docs.filter(d => 
    (d.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (d.content?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="users-container">
      <div className="page-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div className="industrial-icon" style={{background: 'var(--color-primary)', color: 'white', padding: '10px', borderRadius: '8px'}}>
            <BookOpen size={24} />
          </div>
          <div>
            <h1>Tech Vault</h1>
            <p>Documentação, fotos de campo e anotações seguras.</p>
          </div>
        </div>
        <button className="btn btn-primary" style={{width: 'auto'}} onClick={() => setIsModalOpen(true)}>
          <Plus size={20} /> <span className="hide-mobile">NOVO ITEM</span>
        </button>
      </div>

      <div className="search-wrapper" style={{marginBottom: '24px'}}>
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar no acervo..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="machines-grid">
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
                  <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block'}}>
                    {new Date(doc.created_at).toLocaleString()} • {doc.type}
                  </span>
                </div>
              </div>
              <div style={{display: 'flex', gap: '8px'}}>
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

            {doc.file_path && (doc.file_path.endsWith('.jpg') || doc.file_path.endsWith('.png') || doc.file_path.endsWith('.jpeg')) && (
              <div style={{marginTop: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee'}}>
                <img 
                  src={`/uploads/docs/${doc.file_path}`} 
                  alt={doc.title} 
                  style={{width: '100%', maxHeight: '300px', objectFit: 'cover'}} 
                />
              </div>
            )}

            {doc.content && (
              <div style={{
                marginTop: '12px', 
                padding: '12px', 
                background: '#f8fafc', 
                borderRadius: '6px', 
                fontSize: '0.9rem', 
                color: '#334155',
                whiteSpace: 'pre-wrap',
                borderLeft: '4px solid var(--color-accent)'
              }}>
                {doc.content}
              </div>
            )}

            {doc.file_path && !doc.file_path.match(/\.(jpg|jpeg|png)$/i) && (
              <div style={{marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '0.8rem'}}>
                <Download size={14} />
                <span>Arquivo: {doc.file_path} ({doc.file_size})</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <div className="modal-header">
              <h2>Novo Item no Vault</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
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
              <div className="machine-details-grid-form">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select 
                    className="form-input"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="Nota">Nota / Texto</option>
                    <option value="Foto">Foto de Campo</option>
                    <option value="Manual">Manual PDF</option>
                    <option value="Recibo">Recibo / Custo</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Anotações / Descrição</label>
                <textarea 
                  className="form-input" 
                  rows="4"
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Escreva aqui detalhes, custos ou observações..."
                ></textarea>
              </div>
              <div className="form-group">
                <label className="form-label">Anexar Arquivo (Foto ou PDF)</label>
                <div style={{
                  border: '2px dashed #cbd5e1',
                  padding: '20px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  background: selectedFile ? '#f0fdf4' : '#f8fafc',
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  <input 
                    type="file" 
                    onChange={handleFileChange}
                    style={{position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer'}}
                  />
                  <Upload size={24} color={selectedFile ? '#10b981' : '#64748b'} style={{marginBottom: '8px'}} />
                  <p style={{margin: 0, fontSize: '0.85rem', color: selectedFile ? '#10b981' : '#64748b'}}>
                    {selectedFile ? `Selecionado: ${selectedFile.name}` : 'Clique ou arraste para subir'}
                  </p>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-block" disabled={isUploading}>
                {isUploading ? 'ENVIANDO...' : 'SALVAR NO VAULT'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicalDocs;
