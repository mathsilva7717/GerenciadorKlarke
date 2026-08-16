import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Cloud, Plus, Search, Edit, Trash2, X, Copy, Check, ShieldCheck, ShieldAlert,
  User, Users, Laptop, AppWindow, AtSign, BadgeCheck, Eye, EyeOff, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const TYPES = [
  { value: 'Usuário', color: '#3b82f6', icon: User },
  { value: 'Grupo', color: '#10b981', icon: Users },
  { value: 'Dispositivo', color: '#8b5cf6', icon: Laptop },
  { value: 'App', color: '#f59e0b', icon: AppWindow },
];
const typeInfo = (v) => TYPES.find(t => t.value === v) || TYPES[0];
const statusStyle = (s) => s === 'Bloqueado'
  ? { color: '#ef4444', bg: 'rgba(239,68,68,0.14)' }
  : { color: '#10b981', bg: 'rgba(16,185,129,0.14)' };

const genPassword = (len = 16) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
  const arr = new Uint32Array(len);
  window.crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
};
const strengthOf = (pw) => {
  pw = pw || '';
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

const emptyForm = { display_name: '', object_type: 'Usuário', upn: '', license: '', password: '', mfa: false, status: 'Ativo', department: '', company: '', notes: '' };

function EntraId() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });
  const [copiedId, setCopiedId] = useState(null);
  const [showPassMap, setShowPassMap] = useState({});
  const [showFormPass, setShowFormPass] = useState(false);

  const fetchItems = async () => {
    try { const res = await axios.get('/api/entra', getAuthConfig()); setItems(res.data); }
    catch { toast.error('Erro ao carregar Entra ID'); }
  };
  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    const open = isModalOpen || confirmDialog.open;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));
  const openModal = (it = null) => {
    setShowFormPass(false);
    if (it) { setEditing(it); setFormData({ ...emptyForm, ...it, password: it.password || '', mfa: !!it.mfa }); }
    else { setEditing(null); setFormData(emptyForm); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await axios.put(`/api/entra/${editing.id}`, formData, getAuthConfig()); toast.success('Atualizado'); }
      else { await axios.post('/api/entra', formData, getAuthConfig()); toast.success('Cadastrado!'); }
      closeModal(); fetchItems();
    } catch { toast.error('Erro ao salvar'); }
  };
  const confirmDelete = async () => {
    try { await axios.delete(`/api/entra/${confirmDialog.id}`, getAuthConfig()); toast.success('Removido'); fetchItems(); }
    catch { toast.error('Erro ao excluir'); }
    setConfirmDialog({ open: false, id: null });
  };
  const copyValue = (text, id) => {
    if (!text) { toast.error('Nada pra copiar'); return; }
    navigator.clipboard.writeText(text);
    setCopiedId(id); toast.success('Copiado');
    setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1500);
  };
  const toggleShow = (id) => setShowPassMap(m => ({ ...m, [id]: !m[id] }));

  const q = searchTerm.toLowerCase();
  const filtered = items.filter(it =>
    (!typeFilter || it.object_type === typeFilter) &&
    ((it.display_name || '').toLowerCase().includes(q) ||
     (it.upn || '').toLowerCase().includes(q) ||
     (it.department || '').toLowerCase().includes(q))
  );
  const countByType = (v) => items.filter(it => it.object_type === v).length;
  const fs = strengthOf(formData.password);

  return (
    <div className="users-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="inv-hd-ico"><Cloud size={20} /></div>
          <div>
            <h1>Entra ID</h1>
            <p>Diretório (Azure AD) — usuários, grupos, dispositivos e apps.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Novo Objeto</span>
        </button>
      </div>

      <div className="kk-chips">
        <button className={`kk-chip ${typeFilter === '' ? 'active' : ''}`} onClick={() => setTypeFilter('')}>
          <BadgeCheck size={14} /> Todos <span className="kk-chip-c">{items.length}</span>
        </button>
        {TYPES.map(t => {
          const Ico = t.icon;
          return (
            <button key={t.value} className={`kk-chip ${typeFilter === t.value ? 'active' : ''}`} onClick={() => setTypeFilter(t.value)} style={typeFilter === t.value ? { borderColor: t.color, color: t.color } : undefined}>
              <Ico size={14} /> {t.value} <span className="kk-chip-c">{countByType(t.value)}</span>
            </button>
          );
        })}
      </div>

      <div className="search-wrapper" style={{ marginBottom: '20px', maxWidth: '460px' }}>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input type="text" className="search-input" placeholder="Buscar nome, UPN, departamento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Cloud size={64} className="empty-icon" />
          <h2>Nada cadastrado</h2>
          <p>Clique em “Novo Objeto” para registrar o primeiro item do Entra ID.</p>
        </div>
      ) : (
        <div className="kk-grid">
          {filtered.map(it => {
            const ti = typeInfo(it.object_type);
            const Ico = ti.icon;
            const badge = companyBadge(it.company, '');
            const st = statusStyle(it.status);
            const shown = !!showPassMap[it.id];
            return (
              <div key={it.id} className="kk-card" style={{ borderTopColor: ti.color }}>
                <div className="kk-top">
                  <span className="kk-cat" style={{ color: ti.color }}><Ico size={13} /> {it.object_type}</span>
                  <div className="kk-acts">
                    <button className="mq-icon-btn" title="Editar" onClick={() => openModal(it)}><Edit size={14} /></button>
                    <button className="mq-icon-btn danger" title="Excluir" onClick={() => setConfirmDialog({ open: true, id: it.id })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="kk-title-row">
                  <span className="kk-title" title={it.display_name}>{it.display_name}</span>
                  {badge && <img className="kk-badge" src={badge.src} alt="" title={badge.label} />}
                </div>

                {it.upn && (
                  <button className="kk-field" onClick={() => copyValue(it.upn, `u-${it.id}`)} title="Copiar UPN">
                    <span className="kk-field-k"><AtSign size={12} style={{ verticalAlign: '-2px' }} /> UPN</span>
                    <span className="kk-field-v">{it.upn}</span>
                    {copiedId === `u-${it.id}` ? <Check size={14} className="kk-ok" /> : <Copy size={14} className="kk-field-ic" />}
                  </button>
                )}

                {it.password && (
                  <div className="kk-field secret">
                    <span className="kk-field-k">Senha</span>
                    <span className="kk-field-v" style={{ letterSpacing: shown ? '0' : '2px' }}>{shown ? it.password : '••••••••'}</span>
                    <button className="kk-mini" title={shown ? 'Ocultar' : 'Revelar'} onClick={() => toggleShow(it.id)}>{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                    <button className="kk-mini" title="Copiar senha" onClick={() => copyValue(it.password, `p-${it.id}`)}>{copiedId === `p-${it.id}` ? <Check size={14} className="kk-ok" /> : <Copy size={14} />}</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg }}>{it.status || 'Ativo'}</span>
                  {it.object_type === 'Usuário' && (
                    it.mfa
                      ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#10b981', background: 'rgba(16,185,129,0.14)' }}><ShieldCheck size={11} style={{ verticalAlign: '-2px' }} /> MFA</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#f59e0b', background: 'rgba(245,158,11,0.14)' }}><ShieldAlert size={11} style={{ verticalAlign: '-2px' }} /> Sem MFA</span>
                  )}
                  {it.license && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>· {it.license}</span>}
                  {it.department && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>· {it.department}</span>}
                </div>
                {it.notes && <div className="kk-notes">{it.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar objeto' : 'Novo objeto do Entra ID'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome de exibição</label>
                  <input required className="form-input" value={formData.display_name} onChange={e => set('display_name', e.target.value)} placeholder="Ex: João Silva, TI-Admins" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={formData.object_type} onChange={e => set('object_type', e.target.value)}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">UPN / E-mail</label>
                <input className="form-input" value={formData.upn} onChange={e => set('upn', e.target.value)} placeholder="usuario@empresa.onmicrosoft.com" />
              </div>

              <div className="form-group">
                <label className="form-label">Senha (opcional)</label>
                <div className="kk-pass-row">
                  <input type={showFormPass ? 'text' : 'password'} className="form-input" style={{ fontFamily: 'monospace' }} value={formData.password} onChange={e => set('password', e.target.value)} placeholder="senha" autoComplete="new-password" />
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
                  <label className="form-label">Licença M365</label>
                  <input className="form-input" value={formData.license} onChange={e => set('license', e.target.value)} placeholder="Ex: Business Premium, E3" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={formData.status} onChange={e => set('status', e.target.value)}>
                    <option value="Ativo">Ativo</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Departamento</label>
                  <input className="form-input" value={formData.department} onChange={e => set('department', e.target.value)} placeholder="Ex: Financeiro" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Empresa (opcional)</label>
                  <select className="form-input" value={formData.company || ''} onChange={e => set('company', e.target.value)}>
                    <option value="">—</option>
                    {COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {formData.object_type === 'Usuário' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 12px', cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={formData.mfa} onChange={e => set('mfa', e.target.checked)} />
                  MFA habilitado
                </label>
              )}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows="2" value={formData.notes} onChange={e => set('notes', e.target.value)} placeholder="Ex: conta de serviço, não desabilitar"></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>{editing ? 'SALVAR' : 'CADASTRAR'}</button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ open: false, id: null })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Excluir objeto</h3>
            <p className="confirm-modal-text">Deseja remover este registro do Entra ID?</p>
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

export default EntraId;
