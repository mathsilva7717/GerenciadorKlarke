import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Package, Plus, Search, Box, Trash2, Edit, X, Minus, PlusCircle,
  Monitor, Cpu, MemoryStick, HardDrive, Tag, MapPin, Building2, Laptop, Printer, Mouse
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const TYPE_OPTIONS = ['Computador', 'Notebook', 'Monitor', 'Impressora', 'Periférico', 'Outro'];
const STATUS_OPTIONS = ['Em uso', 'Disponível', 'Manutenção'];
const UNIT_OPTIONS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
];
const CATEGORY_OPTIONS = ['Cabos', 'Conectores', 'Cameras', 'Rede', 'Fixação', 'Ferramentas', 'Outros'];

const statusStyle = (s) => {
  if (s === 'Em uso') return { color: '#10b981', bg: 'rgba(16,185,129,0.14)' };
  if (s === 'Manutenção') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' };
  if (s === 'Disponível') return { color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' };
  return { color: 'var(--color-text-muted)', bg: 'rgba(148,163,184,0.14)' };
};

const typeIcon = (t) => {
  if (t === 'Computador') return <Monitor size={18} />;
  if (t === 'Notebook') return <Laptop size={18} />;
  if (t === 'Monitor') return <Monitor size={18} />;
  if (t === 'Impressora') return <Printer size={18} />;
  if (t === 'Periférico') return <Mouse size={18} />;
  return <Box size={18} />;
};

const emptyEquip = { kind: 'equipamento', name: '', type: 'Computador', brand: '', model: '', cpu: '', ram: '', storage: '', serial_number: '', status: 'Em uso', company: '', location: '', notes: '' };
const emptyInsumo = { kind: 'insumo', name: '', quantity: 0, unit: 'un', category: 'Cabos', location: 'DML / Depósito', notes: '' };

function Inventory() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('equipamento'); // 'equipamento' | 'insumo'
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(emptyEquip);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const fetchItems = async () => {
    try {
      const res = await axios.get('/api/inventory', getAuthConfig());
      setItems(res.data);
    } catch (e) {
      toast.error('Erro ao buscar inventário');
    }
  };

  useEffect(() => { fetchItems(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, tab]);

  useEffect(() => {
    const anyOpen = isModalOpen || confirmDialog.open;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const set = (k, v) => setFormData(f => ({ ...f, [k]: v }));

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ ...(item.kind === 'equipamento' ? emptyEquip : emptyInsumo), ...item, kind: item.kind || 'insumo' });
    } else {
      setEditingItem(null);
      setFormData(tab === 'equipamento' ? { ...emptyEquip } : { ...emptyInsumo });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingItem(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.put(`/api/inventory/${editingItem.id}`, formData, getAuthConfig());
        toast.success('Atualizado!');
      } else {
        await axios.post('/api/inventory', formData, getAuthConfig());
        toast.success('Cadastrado!');
      }
      closeModal();
      fetchItems();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const updateQuantity = async (item, delta) => {
    const newQty = Math.max(0, (Number(item.quantity) || 0) + delta);
    try {
      await axios.put(`/api/inventory/${item.id}`, { ...item, quantity: newQty }, getAuthConfig());
      setItems(list => list.map(i => i.id === item.id ? { ...i, quantity: newQty } : i));
    } catch (e) {
      toast.error('Erro ao atualizar quantidade');
    }
  };

  const deleteItem = (id) => {
    setConfirmDialog({
      open: true,
      title: 'Remover do Inventário',
      message: 'Tem certeza que deseja excluir este item permanentemente?',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/inventory/${id}`, getAuthConfig());
          toast.success('Removido');
          fetchItems();
        } catch (e) { toast.error('Erro ao excluir'); }
        setConfirmDialog(d => ({ ...d, open: false }));
      }
    });
  };

  const q = searchTerm.toLowerCase();
  const inTab = items.filter(i => (i.kind || 'insumo') === tab);
  const filtered = inTab.filter(i =>
    (i.name || '').toLowerCase().includes(q) ||
    (i.brand || '').toLowerCase().includes(q) ||
    (i.model || '').toLowerCase().includes(q) ||
    (i.cpu || '').toLowerCase().includes(q) ||
    (i.serial_number || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q) ||
    (i.location || '').toLowerCase().includes(q)
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginate = (p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const countEquip = items.filter(i => (i.kind || 'insumo') === 'equipamento').length;
  const countInsumo = items.filter(i => (i.kind || 'insumo') === 'insumo').length;

  return (
    <div className="users-container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="industrial-icon" style={{ background: 'var(--color-primary)', color: 'white', padding: '10px' }}>
            <Package size={24} />
          </div>
          <div>
            <h1>Inventário</h1>
            <p>Equipamentos e estoque técnico da Klarke.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">{tab === 'equipamento' ? 'Novo Equipamento' : 'Novo Item'}</span>
        </button>
      </div>

      {/* Abas */}
      <div className="inv-tabs">
        <button className={`inv-tab ${tab === 'equipamento' ? 'active' : ''}`} onClick={() => setTab('equipamento')}>
          <Monitor size={16} /> Equipamentos <span className="inv-tab-count">{countEquip}</span>
        </button>
        <button className={`inv-tab ${tab === 'insumo' ? 'active' : ''}`} onClick={() => setTab('insumo')}>
          <Box size={16} /> Estoque <span className="inv-tab-count">{countInsumo}</span>
        </button>
      </div>

      <div className="search-wrapper" style={{ marginBottom: '20px' }}>
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text" className="search-input"
            placeholder={tab === 'equipamento' ? 'Buscar nome, marca, CPU, série...' : 'Buscar item, categoria, local...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="empty-state">
          {tab === 'equipamento' ? <Monitor size={64} className="empty-icon" /> : <Box size={64} className="empty-icon" />}
          <h2>{tab === 'equipamento' ? 'Nenhum equipamento' : 'Estoque vazio'}</h2>
          <p>Clique em “{tab === 'equipamento' ? 'Novo Equipamento' : 'Novo Item'}” para começar.</p>
        </div>
      ) : tab === 'equipamento' ? (
        /* ===== EQUIPAMENTOS ===== */
        <div className="inv-grid">
          {pageItems.map(item => {
            const st = statusStyle(item.status);
            const badge = companyBadge(item.company, item.location);
            return (
              <div key={item.id} className="inv-card">
                <div className="inv-card-top">
                  <span className="inv-type"><span className="inv-type-ico">{typeIcon(item.type)}</span>{item.type || 'Equipamento'}</span>
                  {item.status && <span className="inv-status" style={{ color: st.color, background: st.bg }}>{item.status}</span>}
                </div>

                <div className="inv-name-row">
                  <span className="inv-name" title={item.name}>{item.name || 'Sem nome'}</span>
                  {badge && <img className="inv-badge" src={badge.src} alt="" title={badge.label} />}
                </div>
                {(item.brand || item.model) && (
                  <span className="inv-sub">{[item.brand, item.model].filter(Boolean).join(' · ')}</span>
                )}

                <div className="inv-specs">
                  {item.cpu && <div className="inv-spec"><Cpu size={13} /><span>{item.cpu}</span></div>}
                  {item.ram && <div className="inv-spec"><MemoryStick size={13} /><span>{item.ram}</span></div>}
                  {item.storage && <div className="inv-spec"><HardDrive size={13} /><span>{item.storage}</span></div>}
                  {item.serial_number && <div className="inv-spec"><Tag size={13} /><span>{item.serial_number}</span></div>}
                </div>

                <div className="inv-card-foot">
                  <span className="inv-loc"><MapPin size={12} /> {item.location || 'Sem local'}</span>
                  <div className="inv-acts">
                    <button className="mq-icon-btn" title="Editar" onClick={() => openModal(item)}><Edit size={14} /></button>
                    <button className="mq-icon-btn danger" title="Excluir" onClick={() => deleteItem(item.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ===== ESTOQUE (insumos) ===== */
        <div className="inv-grid">
          {pageItems.map(item => (
            <div key={item.id} className="inv-card" style={{ borderTopColor: Number(item.quantity) === 0 ? '#ef4444' : 'var(--color-accent)' }}>
              <div className="inv-card-top">
                <span className="inv-type"><span className="inv-type-ico"><Box size={16} /></span>{item.category || 'Insumo'}</span>
                <div className="inv-acts">
                  <button className="mq-icon-btn" title="Editar" onClick={() => openModal(item)}><Edit size={14} /></button>
                  <button className="mq-icon-btn danger" title="Excluir" onClick={() => deleteItem(item.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <span className="inv-name" title={item.name}>{item.name}</span>
              <span className="inv-loc" style={{ marginBottom: '6px' }}><MapPin size={12} /> {item.location || 'Sem local'}</span>

              <div className="inv-qty">
                <button className="inv-qty-btn minus" onClick={() => updateQuantity(item, -1)}><Minus size={16} /></button>
                <div className="inv-qty-val">
                  <span className="inv-qty-num" style={{ color: Number(item.quantity) === 0 ? '#ef4444' : 'var(--color-text)' }}>{item.quantity}</span>
                  <span className="inv-qty-unit">{(item.unit || 'un').toUpperCase()}</span>
                </div>
                <button className="inv-qty-btn plus" onClick={() => updateQuantity(item, 1)}><PlusCircle size={16} /></button>
              </div>
              {item.notes && <div className="inv-notes"><strong>Obs:</strong> {item.notes}</div>}
            </div>
          ))}
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
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingItem ? 'Editar' : 'Novo'} {formData.kind === 'equipamento' ? 'Equipamento' : 'Item'}
              </h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              {formData.kind === 'equipamento' ? (
                <>
                  <div className="machine-details-grid-form">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Nome / Identificação</label>
                      <input required className="form-input" value={formData.name} onChange={e => set('name', e.target.value)} placeholder="Ex: PC RECEPÇÃO" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Tipo</label>
                      <select className="form-input" value={formData.type} onChange={e => set('type', e.target.value)}>
                        {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="machine-details-grid-form">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Marca</label>
                      <input className="form-input" value={formData.brand} onChange={e => set('brand', e.target.value)} placeholder="Ex: Dell, Positivo" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Modelo</label>
                      <input className="form-input" value={formData.model} onChange={e => set('model', e.target.value)} placeholder="Ex: OptiPlex 3080" />
                    </div>
                  </div>
                  <div className="machine-details-grid-form">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">CPU</label>
                      <input className="form-input" value={formData.cpu} onChange={e => set('cpu', e.target.value)} placeholder="Ex: i5-10400" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Memória (RAM)</label>
                      <input className="form-input" value={formData.ram} onChange={e => set('ram', e.target.value)} placeholder="Ex: 8 GB DDR4" />
                    </div>
                  </div>
                  <div className="machine-details-grid-form">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Armazenamento</label>
                      <input className="form-input" value={formData.storage} onChange={e => set('storage', e.target.value)} placeholder="Ex: SSD 240 GB" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Nº Série / Patrimônio</label>
                      <input className="form-input" value={formData.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="Ex: K009" />
                    </div>
                  </div>
                  <div className="machine-details-grid-form">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Status</label>
                      <select className="form-input" value={formData.status} onChange={e => set('status', e.target.value)}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Empresa</label>
                      <select className="form-input" value={formData.company || ''} onChange={e => set('company', e.target.value)}>
                        <option value="">Selecione...</option>
                        {COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Localização / Setor</label>
                    <input className="form-input" value={formData.location} onChange={e => set('location', e.target.value)} placeholder="Ex: MATRIZ - RH" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas</label>
                    <textarea className="form-input" rows="2" value={formData.notes} onChange={e => set('notes', e.target.value)} placeholder="Observações..."></textarea>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Nome do Item</label>
                    <input required className="form-input" value={formData.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Conector RJ45 CAT6" />
                  </div>
                  <div className="machine-details-grid-form">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Quantidade</label>
                      <input type="number" required className="form-input" value={formData.quantity} onChange={e => set('quantity', parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Unidade</label>
                      <select className="form-input" value={formData.unit} onChange={e => set('unit', e.target.value)}>
                        {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select className="form-input" value={formData.category} onChange={e => set('category', e.target.value)}>
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Localização (Onde está?)</label>
                    <input className="form-input" value={formData.location} onChange={e => set('location', e.target.value)} placeholder="Ex: Armário 01 ou Carro Matheus" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notas</label>
                    <textarea className="form-input" rows="2" value={formData.notes} onChange={e => set('notes', e.target.value)} placeholder="Ex: Marca Furukawa"></textarea>
                  </div>
                </>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                {editingItem ? 'SALVAR' : 'CADASTRAR'}
              </button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog(d => ({ ...d, open: false }))}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">{confirmDialog.title}</h3>
            <p className="confirm-modal-text">{confirmDialog.message}</p>
            <div className="confirm-modal-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmDialog(d => ({ ...d, open: false }))}>CANCELAR</button>
              <button className="btn-confirm-danger" onClick={confirmDialog.onConfirm}>CONFIRMAR EXCLUSÃO</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

export default Inventory;
