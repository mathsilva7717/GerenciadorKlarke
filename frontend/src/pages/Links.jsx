import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Link2, Plus, Search, ExternalLink, Edit, Trash2, X, Globe,
  LayoutDashboard, Wrench, Building2, Boxes
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const CATEGORIES = [
  { value: 'Painéis', short: 'Painéis', color: '#3b82f6', icon: LayoutDashboard },
  { value: 'Provedores', short: 'Provedores', color: '#10b981', icon: Globe },
  { value: 'Ferramentas', short: 'Ferramentas', color: '#8b5cf6', icon: Wrench },
  { value: 'Portais', short: 'Portais', color: '#f59e0b', icon: Building2 },
  { value: 'Outros', short: 'Outros', color: '#64748b', icon: Boxes },
];
const catInfo = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[4];
const normalizeUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `https://${u}`));
const hostOf = (u) => { try { return new URL(normalizeUrl(u)).hostname.replace(/^www\./, ''); } catch { return u || ''; } };

const emptyForm = { title: '', url: '', category: 'Painéis', description: '', company: '' };

function Links() {
  const [links, setLinks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });

  const fetchLinks = async () => {
    try { const res = await axios.get('/api/links', getAuthConfig()); setLinks(res.data); }
    catch { toast.error('Erro ao carregar links'); }
  };
  useEffect(() => { fetchLinks(); }, []);
  useEffect(() => {
    const open = isModalOpen || confirmDialog.open;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));
  const openModal = (l = null) => {
    if (l) { setEditing(l); setFormData({ ...emptyForm, ...l }); }
    else { setEditing(null); setFormData(emptyForm); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await axios.put(`/api/links/${editing.id}`, formData, getAuthConfig()); toast.success('Link atualizado'); }
      else { await axios.post('/api/links', formData, getAuthConfig()); toast.success('Link salvo!'); }
      closeModal(); fetchLinks();
    } catch { toast.error('Erro ao salvar'); }
  };
  const confirmDelete = async () => {
    try { await axios.delete(`/api/links/${confirmDialog.id}`, getAuthConfig()); toast.success('Removido'); fetchLinks(); }
    catch { toast.error('Erro ao excluir'); }
    setConfirmDialog({ open: false, id: null });
  };
  const openUrl = (u) => { const url = normalizeUrl(u); if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

  const q = searchTerm.toLowerCase();
  const filtered = links.filter(l =>
    (!catFilter || l.category === catFilter) &&
    ((l.title || '').toLowerCase().includes(q) ||
     (l.url || '').toLowerCase().includes(q) ||
     (l.description || '').toLowerCase().includes(q))
  );
  const countByCat = (v) => links.filter(l => l.category === v).length;

  return (
    <div className="users-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="inv-hd-ico"><Link2 size={20} /></div>
          <div>
            <h1>Links</h1>
            <p>Atalhos e favoritos — painéis, provedores e portais.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Novo Link</span>
        </button>
      </div>

      <div className="kk-chips">
        <button className={`kk-chip ${catFilter === '' ? 'active' : ''}`} onClick={() => setCatFilter('')}>
          <Globe size={14} /> Todos <span className="kk-chip-c">{links.length}</span>
        </button>
        {CATEGORIES.map(c => {
          const Ico = c.icon;
          return (
            <button key={c.value} className={`kk-chip ${catFilter === c.value ? 'active' : ''}`} onClick={() => setCatFilter(c.value)} style={catFilter === c.value ? { borderColor: c.color, color: c.color } : undefined}>
              <Ico size={14} /> {c.short} <span className="kk-chip-c">{countByCat(c.value)}</span>
            </button>
          );
        })}
      </div>

      <div className="search-wrapper" style={{ marginBottom: '20px', maxWidth: '460px' }}>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input type="text" className="search-input" placeholder="Buscar título, URL..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Link2 size={64} className="empty-icon" />
          <h2>Nenhum link</h2>
          <p>Clique em “Novo Link” para adicionar o primeiro atalho.</p>
        </div>
      ) : (
        <div className="kk-grid">
          {filtered.map(l => {
            const ci = catInfo(l.category);
            const Ico = ci.icon;
            const badge = companyBadge(l.company, '');
            return (
              <div key={l.id} className="kk-card" style={{ borderTopColor: ci.color }}>
                <div className="kk-top">
                  <span className="kk-cat" style={{ color: ci.color }}><Ico size={13} /> {ci.short}</span>
                  <div className="kk-acts">
                    {l.url && <button className="mq-icon-btn" title="Abrir link" onClick={() => openUrl(l.url)}><ExternalLink size={14} /></button>}
                    <button className="mq-icon-btn" title="Editar" onClick={() => openModal(l)}><Edit size={14} /></button>
                    <button className="mq-icon-btn danger" title="Excluir" onClick={() => setConfirmDialog({ open: true, id: l.id })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="kk-title-row">
                  <span className="kk-title" title={l.title}>{l.title}</span>
                  {badge && <img className="kk-badge" src={badge.src} alt="" title={badge.label} />}
                </div>
                {l.url && (
                  <button className="kk-field" onClick={() => openUrl(l.url)} title="Abrir link">
                    <span className="kk-field-k">URL</span>
                    <span className="kk-field-v" style={{ color: ci.color }}>{hostOf(l.url)}</span>
                    <ExternalLink size={14} className="kk-field-ic" />
                  </button>
                )}
                {l.description && <div className="kk-notes">{l.description}</div>}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar link' : 'Novo link'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input required className="form-input" value={formData.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Painel Vivo Empresas" />
              </div>
              <div className="form-group">
                <label className="form-label">URL</label>
                <input className="form-input" value={formData.url} onChange={e => set('url', e.target.value)} placeholder="painel.provedor.com" />
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
                <textarea className="form-input" rows="2" value={formData.description} onChange={e => set('description', e.target.value)} placeholder="Ex: acesso do cliente para 2ª via de boleto"></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>{editing ? 'SALVAR' : 'SALVAR LINK'}</button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ open: false, id: null })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Excluir link</h3>
            <p className="confirm-modal-text">Deseja remover este atalho?</p>
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

export default Links;
