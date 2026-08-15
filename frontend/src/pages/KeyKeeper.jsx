import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Key, Plus, Search, Eye, EyeOff, Copy, Trash2, Edit, X, Check,
  ExternalLink, RefreshCw, ShieldCheck, Server, Router as RouterIcon, Camera, Mail, Boxes
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const CATEGORIES = [
  { value: 'Sistemas', label: 'Sistemas / Servidores', short: 'Sistemas', color: '#3b82f6', icon: Server },
  { value: 'Rede', label: 'Equipamentos de Rede', short: 'Rede', color: '#10b981', icon: RouterIcon },
  { value: 'Cameras', label: 'Câmeras / NVRs', short: 'Câmeras', color: '#8b5cf6', icon: Camera },
  { value: 'Email', label: 'Email / Comunicação', short: 'Email', color: '#f59e0b', icon: Mail },
  { value: 'Outros', label: 'Outros', short: 'Outros', color: '#64748b', icon: Boxes },
];
const catInfo = (v) => CATEGORIES.find(c => c.value === v) || CATEGORIES[4];

// Gerador de senha forte (usa CSRNG do navegador)
const genPassword = (len = 16) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
};

// Força da senha: 0..4
const strengthOf = (pw = '') => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
};
const STRENGTH = [
  { label: 'Muito fraca', color: '#ef4444' },
  { label: 'Fraca', color: '#ef4444' },
  { label: 'Média', color: '#f59e0b' },
  { label: 'Boa', color: '#3b82f6' },
  { label: 'Forte', color: '#10b981' },
];

const normalizeUrl = (u) => {
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
};

const emptyForm = { title: '', username: '', password: '', category: 'Sistemas', notes: '', url: '', company: '' };

function KeyKeeper() {
  const [credentials, setCredentials] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showPassMap, setShowPassMap] = useState({});
  const [showFormPass, setShowFormPass] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const fetchCredentials = async () => {
    try {
      const res = await axios.get('/api/credentials', getAuthConfig());
      setCredentials(res.data);
    } catch (e) {
      toast.error('Erro ao carregar cofre');
    }
  };

  useEffect(() => { fetchCredentials(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, catFilter]);
  useEffect(() => {
    const open = isModalOpen || confirmDialog.open;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  const openModal = (cred = null) => {
    setShowFormPass(false);
    if (cred) { setEditingCred(cred); setFormData({ ...emptyForm, ...cred }); }
    else { setEditingCred(null); setFormData(emptyForm); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditingCred(null); };

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

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/credentials/${confirmDialog.id}`, getAuthConfig());
      toast.success('Removido');
      fetchCredentials();
    } catch (e) { toast.error('Erro ao excluir'); }
    setConfirmDialog({ open: false, id: null });
  };

  const toggleShow = (id) => setShowPassMap(p => ({ ...p, [id]: !p[id] }));

  const copyValue = (text, fieldId) => {
    if (!text) { toast.error('Vazio'); return; }
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado');
    setTimeout(() => setCopiedField(f => (f === fieldId ? null : f)), 1500);
  };

  const openUrl = (u) => { const url = normalizeUrl(u); if (url) window.open(url, '_blank', 'noopener,noreferrer'); };

  const q = searchTerm.toLowerCase();
  const filtered = credentials.filter(c =>
    (!catFilter || c.category === catFilter) &&
    ((c.title || '').toLowerCase().includes(q) ||
     (c.username || '').toLowerCase().includes(q) ||
     (c.category || '').toLowerCase().includes(q) ||
     (c.url || '').toLowerCase().includes(q))
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginate = (p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const countByCat = (v) => credentials.filter(c => c.category === v).length;
  const fs = strengthOf(formData.password);

  return (
    <div className="users-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="inv-hd-ico"><Key size={20} /></div>
          <div>
            <h1>Key Keeper</h1>
            <p>Cofre de senhas e acessos — criptografados em repouso.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Nova Senha</span>
        </button>
      </div>

      {/* Filtro por categoria */}
      <div className="kk-chips">
        <button className={`kk-chip ${catFilter === '' ? 'active' : ''}`} onClick={() => setCatFilter('')}>
          <ShieldCheck size={14} /> Todas <span className="kk-chip-c">{credentials.length}</span>
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
          <input type="text" className="search-input" placeholder="Buscar título, usuário, URL..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="empty-state">
          <Key size={64} className="empty-icon" />
          <h2>Cofre vazio</h2>
          <p>Clique em “Nova Senha” para guardar o primeiro acesso.</p>
        </div>
      ) : (
        <div className="kk-grid">
          {pageItems.map(cred => {
            const ci = catInfo(cred.category);
            const Ico = ci.icon;
            const badge = companyBadge(cred.company, '');
            const shown = !!showPassMap[cred.id];
            return (
              <div key={cred.id} className="kk-card" style={{ borderTopColor: ci.color }}>
                <div className="kk-top">
                  <span className="kk-cat" style={{ color: ci.color }}><Ico size={13} /> {ci.short}</span>
                  <div className="kk-acts">
                    {cred.url && <button className="mq-icon-btn" title="Abrir URL" onClick={() => openUrl(cred.url)}><ExternalLink size={14} /></button>}
                    <button className="mq-icon-btn" title="Editar" onClick={() => openModal(cred)}><Edit size={14} /></button>
                    <button className="mq-icon-btn danger" title="Excluir" onClick={() => setConfirmDialog({ open: true, id: cred.id })}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="kk-title-row">
                  <span className="kk-title" title={cred.title}>{cred.title}</span>
                  {badge && <img className="kk-badge" src={badge.src} alt="" title={badge.label} />}
                </div>

                <button className="kk-field" onClick={() => copyValue(cred.username, `u-${cred.id}`)} title="Copiar usuário">
                  <span className="kk-field-k">Usuário</span>
                  <span className="kk-field-v">{cred.username || '—'}</span>
                  {copiedField === `u-${cred.id}` ? <Check size={14} className="kk-ok" /> : <Copy size={14} className="kk-field-ic" />}
                </button>

                <div className="kk-field secret">
                  <span className="kk-field-k">Senha</span>
                  <span className="kk-field-v" style={{ letterSpacing: shown ? '0' : '2px' }}>{shown ? cred.password : '••••••••'}</span>
                  <button className="kk-mini" title={shown ? 'Ocultar' : 'Revelar'} onClick={() => toggleShow(cred.id)}>{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button className="kk-mini" title="Copiar senha" onClick={() => copyValue(cred.password, `p-${cred.id}`)}>{copiedField === `p-${cred.id}` ? <Check size={14} className="kk-ok" /> : <Copy size={14} />}</button>
                </div>

                {cred.notes && <div className="kk-notes">{cred.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-industrial">
          <button disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)} className="page-btn">Anterior</button>
          <div className="page-info">Página <span>{currentPage}</span> de {totalPages}</div>
          <button disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)} className="page-btn">Próxima</button>
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCred ? 'Editar credencial' : 'Nova credencial'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome / Serviço</label>
                <input required className="form-input" value={formData.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Root Mikrotik, Painel Vivo" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Usuário</label>
                  <input required className="form-input" value={formData.username} onChange={e => set('username', e.target.value)} placeholder="admin" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Categoria</label>
                  <select className="form-input" value={formData.category} onChange={e => set('category', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Senha</label>
                <div className="kk-pass-row">
                  <input required type={showFormPass ? 'text' : 'password'} className="form-input" style={{ fontFamily: 'monospace' }} value={formData.password} onChange={e => set('password', e.target.value)} placeholder="senha" />
                  <button type="button" className="kk-pass-btn" title={showFormPass ? 'Ocultar' : 'Mostrar'} onClick={() => setShowFormPass(s => !s)}>{showFormPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  <button type="button" className="kk-pass-btn" title="Gerar senha forte" onClick={() => { set('password', genPassword(16)); setShowFormPass(true); }}><RefreshCw size={16} /></button>
                </div>
                {formData.password && (
                  <div className="kk-strength">
                    <div className="kk-strength-bar">
                      {[0, 1, 2, 3].map(i => <span key={i} style={{ background: i < fs ? STRENGTH[fs].color : 'rgba(120,120,120,0.2)' }} />)}
                    </div>
                    <span className="kk-strength-lbl" style={{ color: STRENGTH[fs].color }}>{STRENGTH[fs].label}</span>
                  </div>
                )}
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">URL (opcional)</label>
                  <input className="form-input" value={formData.url} onChange={e => set('url', e.target.value)} placeholder="painel.provedor.com" />
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
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows="2" value={formData.notes} onChange={e => set('notes', e.target.value)} placeholder="Ex: só acessa via VPN, trocar a cada 90 dias"></textarea>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                {editingCred ? 'SALVAR' : 'SALVAR NO COFRE'}
              </button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ open: false, id: null })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Excluir credencial</h3>
            <p className="confirm-modal-text">Esta ação é permanente. Deseja remover esta senha do cofre?</p>
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

export default KeyKeeper;
