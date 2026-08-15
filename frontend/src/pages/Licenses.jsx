import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  AppWindow, Plus, Search, Edit, Trash2, X, Copy, Check, KeyRound,
  Users, Calendar, Building2, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const TYPES = [
  { value: 'Assinatura', color: '#3b82f6' },
  { value: 'Perpétua', color: '#10b981' },
  { value: 'OEM', color: '#8b5cf6' },
  { value: 'Gratuita', color: '#64748b' },
  { value: 'Trial', color: '#f59e0b' },
];
const typeColor = (v) => (TYPES.find(t => t.value === v) || TYPES[3]).color;

// Status do vencimento: null = sem data; senão dias restantes
const expiryInfo = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d)) return null;
  const dias = Math.round((d - new Date()) / 86400000);
  if (dias < 0) return { label: 'Vencido', color: '#ef4444', dias };
  if (dias <= 30) return { label: `${dias}d p/ vencer`, color: '#f59e0b', dias };
  return { label: d.toLocaleDateString('pt-BR'), color: '#10b981', dias };
};

const emptyForm = { name: '', vendor: '', version: '', license_type: 'Assinatura', license_key: '', seats: '', expires_at: '', used_on: '', company: '', notes: '' };

function Licenses() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null });
  const [copiedId, setCopiedId] = useState(null);

  const fetchItems = async () => {
    try { const res = await axios.get('/api/licenses', getAuthConfig()); setItems(res.data); }
    catch { toast.error('Erro ao carregar softwares'); }
  };
  useEffect(() => { fetchItems(); }, []);
  useEffect(() => {
    const open = isModalOpen || confirmDialog.open;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));
  const openModal = (it = null) => {
    if (it) { setEditing(it); setFormData({ ...emptyForm, ...it, seats: it.seats ?? '', expires_at: it.expires_at || '' }); }
    else { setEditing(null); setFormData(emptyForm); }
    setIsModalOpen(true);
  };
  const closeModal = () => { setIsModalOpen(false); setEditing(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, seats: formData.seats === '' ? null : Number(formData.seats) };
    try {
      if (editing) { await axios.put(`/api/licenses/${editing.id}`, payload, getAuthConfig()); toast.success('Atualizado'); }
      else { await axios.post('/api/licenses', payload, getAuthConfig()); toast.success('Software cadastrado!'); }
      closeModal(); fetchItems();
    } catch { toast.error('Erro ao salvar'); }
  };
  const confirmDelete = async () => {
    try { await axios.delete(`/api/licenses/${confirmDialog.id}`, getAuthConfig()); toast.success('Removido'); fetchItems(); }
    catch { toast.error('Erro ao excluir'); }
    setConfirmDialog({ open: false, id: null });
  };
  const copyKey = (text, id) => {
    if (!text) { toast.error('Sem chave'); return; }
    navigator.clipboard.writeText(text);
    setCopiedId(id); toast.success('Chave copiada');
    setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1500);
  };

  const q = searchTerm.toLowerCase();
  const filtered = items.filter(it =>
    (!typeFilter || it.license_type === typeFilter) &&
    ((it.name || '').toLowerCase().includes(q) ||
     (it.vendor || '').toLowerCase().includes(q) ||
     (it.used_on || '').toLowerCase().includes(q))
  );
  const countByType = (v) => items.filter(it => it.license_type === v).length;

  return (
    <div className="users-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="inv-hd-ico"><AppWindow size={20} /></div>
          <div>
            <h1>Licenças &amp; Apps</h1>
            <p>Catálogo de softwares e licenças — chaves, assentos e vencimentos.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">Novo Software</span>
        </button>
      </div>

      <div className="kk-chips">
        <button className={`kk-chip ${typeFilter === '' ? 'active' : ''}`} onClick={() => setTypeFilter('')}>
          <ShieldCheck size={14} /> Todos <span className="kk-chip-c">{items.length}</span>
        </button>
        {TYPES.map(t => (
          <button key={t.value} className={`kk-chip ${typeFilter === t.value ? 'active' : ''}`} onClick={() => setTypeFilter(t.value)} style={typeFilter === t.value ? { borderColor: t.color, color: t.color } : undefined}>
            {t.value} <span className="kk-chip-c">{countByType(t.value)}</span>
          </button>
        ))}
      </div>

      <div className="search-wrapper" style={{ marginBottom: '20px', maxWidth: '460px' }}>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input type="text" className="search-input" placeholder="Buscar software, fabricante, onde usa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <AppWindow size={64} className="empty-icon" />
          <h2>Nenhum software</h2>
          <p>Clique em “Novo Software” para cadastrar o primeiro app/licença.</p>
        </div>
      ) : (
        <div className="kk-grid">
          {filtered.map(it => {
            const color = typeColor(it.license_type);
            const badge = companyBadge(it.company, '');
            const exp = expiryInfo(it.expires_at);
            return (
              <div key={it.id} className="kk-card" style={{ borderTopColor: color }}>
                <div className="kk-top">
                  <span className="kk-cat" style={{ color }}><AppWindow size={13} /> {it.license_type || 'Licença'}</span>
                  <div className="kk-acts">
                    <button className="mq-icon-btn" title="Editar" onClick={() => openModal(it)}><Edit size={14} /></button>
                    <button className="mq-icon-btn danger" title="Excluir" onClick={() => setConfirmDialog({ open: true, id: it.id })}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div className="kk-title-row">
                  <span className="kk-title" title={it.name}>{it.name}{it.version ? ` ${it.version}` : ''}</span>
                  {badge && <img className="kk-badge" src={badge.src} alt="" title={badge.label} />}
                </div>
                {it.vendor && <div className="kk-notes" style={{ marginTop: 0, marginBottom: 6 }}>{it.vendor}</div>}

                {it.license_key && (
                  <div className="kk-field secret">
                    <span className="kk-field-k"><KeyRound size={12} style={{ verticalAlign: '-2px' }} /> Chave</span>
                    <span className="kk-field-v" style={{ fontFamily: 'monospace' }}>{it.license_key}</span>
                    <button className="kk-mini" title="Copiar chave" onClick={() => copyKey(it.license_key, it.id)}>{copiedId === it.id ? <Check size={14} className="kk-ok" /> : <Copy size={14} />}</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {it.seats != null && <span><Users size={12} style={{ verticalAlign: '-2px' }} /> {it.seats} lic.</span>}
                  {exp && <span style={{ color: exp.color }}><Calendar size={12} style={{ verticalAlign: '-2px' }} /> {exp.label}</span>}
                  {it.used_on && <span><Building2 size={12} style={{ verticalAlign: '-2px' }} /> {it.used_on}</span>}
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
              <h2 className="modal-title">{editing ? 'Editar software' : 'Novo software'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome do app</label>
                  <input required className="form-input" value={formData.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Microsoft 365, AnyDesk" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Fabricante</label>
                  <input className="form-input" value={formData.vendor} onChange={e => set('vendor', e.target.value)} placeholder="Ex: Microsoft" />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Versão</label>
                  <input className="form-input" value={formData.version} onChange={e => set('version', e.target.value)} placeholder="Ex: 2024, v7" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tipo de licença</label>
                  <select className="form-input" value={formData.license_type} onChange={e => set('license_type', e.target.value)}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.value}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Chave / Serial (opcional)</label>
                <input className="form-input" style={{ fontFamily: 'monospace' }} value={formData.license_key} onChange={e => set('license_key', e.target.value)} placeholder="XXXXX-XXXXX-XXXXX" />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nº de licenças</label>
                  <input type="number" min="0" className="form-input" value={formData.seats} onChange={e => set('seats', e.target.value)} placeholder="Ex: 5" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Vence em</label>
                  <input type="date" className="form-input" value={formData.expires_at} onChange={e => set('expires_at', e.target.value)} />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Onde usa</label>
                  <input className="form-input" value={formData.used_on} onChange={e => set('used_on', e.target.value)} placeholder="Ex: PC recepção, servidor" />
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
                <textarea className="form-input" rows="2" value={formData.notes} onChange={e => set('notes', e.target.value)} placeholder="Ex: conta admin@empresa, renovação anual"></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>{editing ? 'SALVAR' : 'CADASTRAR'}</button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ open: false, id: null })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Excluir software</h3>
            <p className="confirm-modal-text">Deseja remover este software/licença do catálogo?</p>
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

export default Licenses;
