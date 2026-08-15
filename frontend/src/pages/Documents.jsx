import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  FileText, Plus, Search, Edit, Trash2, X, Download, UploadCloud,
  File, FileImage, FileArchive, BookOpen, ScrollText, Receipt, ClipboardList, Boxes
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const CATEGORIES = [
  { value: 'Manuais', color: '#3b82f6', icon: BookOpen },
  { value: 'Contratos', color: '#10b981', icon: ScrollText },
  { value: 'Notas Fiscais', color: '#f59e0b', icon: Receipt },
  { value: 'Procedimentos', color: '#8b5cf6', icon: ClipboardList },
  { value: 'Outros', color: '#64748b', icon: Boxes },
];
const catInfo = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[4];

const fileIcon = (mime = '') => {
  if (/image\//.test(mime)) return FileImage;
  if (/zip|rar|7z|compress/.test(mime)) return FileArchive;
  if (/pdf|word|text|sheet|excel|document/.test(mime)) return FileText;
  return File;
};
const fmtSize = (b) => {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};
const MAX_MB = 35;

const emptyForm = { title: '', category: 'Manuais', company: '', description: '' };

function Documents() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [fileObj, setFileObj] = useState(null); // { fileData, fileName }
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });

  const fetchItems = async () => {
    try { const res = await axios.get('/api/documents', getAuthConfig()); setItems(res.data); }
    catch { toast.error('Erro ao carregar documentos'); }
  };
  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    const open = isModalOpen || confirmDialog.open;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));
  const openModal = (it = null) => {
    setFileObj(null);
    if (it) { setEditing(it); setFormData({ ...emptyForm, ...it }); }
    else { setEditing(null); setFormData(emptyForm); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); setFileObj(null); };

  const onFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > MAX_MB * 1048576) { toast.error(`Arquivo muito grande (máx. ${MAX_MB}MB)`); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => setFileObj({ fileData: reader.result, fileName: f.name });
    reader.onerror = () => toast.error('Falha ao ler o arquivo');
    reader.readAsDataURL(f);
    if (!formData.title) set('title', f.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await axios.put(`/api/documents/${editing.id}`, formData, getAuthConfig());
        toast.success('Documento atualizado');
      } else {
        const payload = { ...formData, ...(fileObj || {}) };
        await axios.post('/api/documents', payload, getAuthConfig());
        toast.success('Documento salvo!');
      }
      closeModal(); fetchItems();
    } catch { toast.error('Erro ao salvar'); }
    setSaving(false);
  };
  const confirmDelete = async () => {
    try { await axios.delete(`/api/documents/${confirmDialog.id}`, getAuthConfig()); toast.success('Removido'); fetchItems(); }
    catch { toast.error('Erro ao excluir'); }
    setConfirmDialog({ open: false, id: null });
  };
  const download = (it) => {
    if (!it.file_path) { toast.error('Sem arquivo anexado'); return; }
    const a = document.createElement('a');
    a.href = `/uploads/${it.file_path}`;
    a.download = it.file_name || 'documento';
    a.target = '_blank';
    document.body.appendChild(a); a.click(); a.remove();
  };

  const q = searchTerm.toLowerCase();
  const filtered = items.filter(it =>
    (!catFilter || it.category === catFilter) &&
    ((it.title || '').toLowerCase().includes(q) ||
     (it.description || '').toLowerCase().includes(q) ||
     (it.file_name || '').toLowerCase().includes(q))
  );
  const countByCat = (v) => items.filter(it => it.category === v).length;

  return (
    <div className="users-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="inv-hd-ico"><FileText size={20} /></div>
          <div>
            <h1>Documentos</h1>
            <p>Acervo de arquivos — manuais, contratos, notas e procedimentos.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Novo Documento</span>
        </button>
      </div>

      <div className="kk-chips">
        <button className={`kk-chip ${catFilter === '' ? 'active' : ''}`} onClick={() => setCatFilter('')}>
          <FileText size={14} /> Todos <span className="kk-chip-c">{items.length}</span>
        </button>
        {CATEGORIES.map(c => {
          const Ico = c.icon;
          return (
            <button key={c.value} className={`kk-chip ${catFilter === c.value ? 'active' : ''}`} onClick={() => setCatFilter(c.value)} style={catFilter === c.value ? { borderColor: c.color, color: c.color } : undefined}>
              <Ico size={14} /> {c.value} <span className="kk-chip-c">{countByCat(c.value)}</span>
            </button>
          );
        })}
      </div>

      <div className="search-wrapper" style={{ marginBottom: '20px', maxWidth: '460px' }}>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input type="text" className="search-input" placeholder="Buscar título, arquivo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={64} className="empty-icon" />
          <h2>Nenhum documento</h2>
          <p>Clique em “Novo Documento” para anexar o primeiro arquivo.</p>
        </div>
      ) : (
        <div className="kk-grid">
          {filtered.map(it => {
            const ci = catInfo(it.category);
            const Ico = ci.icon;
            const FIco = fileIcon(it.mime);
            const badge = companyBadge(it.company, '');
            return (
              <div key={it.id} className="kk-card" style={{ borderTopColor: ci.color }}>
                <div className="kk-top">
                  <span className="kk-cat" style={{ color: ci.color }}><Ico size={13} /> {it.category}</span>
                  <div className="kk-acts">
                    {it.file_path && <button className="mq-icon-btn" title="Baixar" onClick={() => download(it)}><Download size={14} /></button>}
                    <button className="mq-icon-btn" title="Editar" onClick={() => openModal(it)}><Edit size={14} /></button>
                    <button className="mq-icon-btn danger" title="Excluir" onClick={() => setConfirmDialog({ open: true, id: it.id })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="kk-title-row">
                  <span className="kk-title" title={it.title}>{it.title}</span>
                  {badge && <img className="kk-badge" src={badge.src} alt="" title={badge.label} />}
                </div>
                {it.file_path ? (
                  <button className="kk-field" onClick={() => download(it)} title="Baixar arquivo">
                    <span className="kk-field-k"><FIco size={12} style={{ verticalAlign: '-2px' }} /> Arquivo</span>
                    <span className="kk-field-v">{it.file_name}{it.size ? ` · ${fmtSize(it.size)}` : ''}</span>
                    <Download size={14} className="kk-field-ic" />
                  </button>
                ) : (
                  <div className="kk-notes" style={{ marginTop: 4 }}>Sem arquivo anexado</div>
                )}
                {it.description && <div className="kk-notes">{it.description}</div>}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar documento' : 'Novo documento'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              {!editing && (
                <div className="form-group">
                  <label className="form-label">Arquivo</label>
                  <label className="doc-drop" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', border: '1.5px dashed var(--color-border, #334155)', borderRadius: 10, cursor: 'pointer' }}>
                    <UploadCloud size={22} style={{ opacity: 0.7 }} />
                    <span style={{ fontSize: 13 }}>{fileObj ? fileObj.fileName : `Escolher arquivo (máx. ${MAX_MB}MB)`}</span>
                    <input type="file" onChange={onFile} style={{ display: 'none' }} />
                  </label>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Título</label>
                <input required className="form-input" value={formData.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Manual do NVR Intelbras" />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Categoria</label>
                  <select className="form-input" value={formData.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Empresa (opcional)</label>
                  <select className="form-input" value={formData.company || ''} onChange={e => set('company', e.target.value)}>
                    <option value="">—</option>
                    {COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea className="form-input" rows="2" value={formData.description} onChange={e => set('description', e.target.value)} placeholder="Ex: procedimento de reset de fábrica"></textarea>
              </div>
              {editing && <p className="kk-notes" style={{ marginTop: 0 }}>O arquivo não é alterado na edição — apenas os dados. Pra trocar o arquivo, crie um novo documento.</p>}
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={saving}>
                {saving ? 'SALVANDO…' : (editing ? 'SALVAR' : 'SALVAR DOCUMENTO')}
              </button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ open: false, id: null })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Excluir documento</h3>
            <p className="confirm-modal-text">Esta ação remove o registro e o arquivo. Continuar?</p>
            <div className="confirm-modal-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmDialog({ open: false, id: null })}>CANCELAR</button>
              <button className="btn-confirm-danger" onClick={confirmDelete}>CONFIRMAR EXCLUSÃO</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

export default Documents;
