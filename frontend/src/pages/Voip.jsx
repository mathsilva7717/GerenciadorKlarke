import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Phone, Plus, Search, Trash2, Edit, X, Copy, ExternalLink, Check, KeyRound, Server, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';

const STATUS_META = {
  'Ativo': { cls: 'on', label: 'Ativo' },
  'Inativo': { cls: 'off', label: 'Inativo' },
  'Manutenção': { cls: 'maint', label: 'Manutenção' },
};
const statusMeta = (s) => STATUS_META[s] || STATUS_META['Ativo'];

function Voip() {
  const [extensions, setExtensions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExt, setEditingExt] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18;
  const [formData, setFormData] = useState({
    extension: '', name: '', password: '', ip_address: '', pabx_ip: '', status: 'Ativo', notes: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'ip_address') {
      formattedValue = value.replace(/[^0-9.]/g, '').replace(/\.\./g, '.');
    }
    setFormData({ ...formData, [name]: formattedValue });
  };

  const fetchExtensions = async () => {
    try {
      const response = await axios.get('/api/voip', getAuthConfig());
      setExtensions(response.data);
    } catch (e) {
      toast.error('Erro ao buscar ramais');
    }
  };

  useEffect(() => { fetchExtensions(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  // Trava scroll do fundo com modal aberto
  useEffect(() => {
    const anyOpen = isModalOpen || confirmDialog.open;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, confirmDialog.open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExt) {
        await axios.put(`/api/voip/${editingExt.id}`, formData, getAuthConfig());
        toast.success('Ramal atualizado');
      } else {
        await axios.post('/api/voip', formData, getAuthConfig());
        toast.success('Ramal cadastrado!');
      }
      closeModal();
      fetchExtensions();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const deleteExt = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Remover Ramal',
      message: 'Esta ação excluirá permanentemente o ramal. Confirmar?',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/voip/${id}`, getAuthConfig());
          toast.success('Removido');
          fetchExtensions();
        } catch (e) {
          toast.error('Erro ao excluir');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text || '');
    setCopiedField(fieldId);
    toast.success('Copiado');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openModal = (ext = null) => {
    if (ext) {
      setEditingExt(ext);
      setFormData(ext);
    } else {
      setEditingExt(null);
      setFormData({ extension: '', name: '', password: '', ip_address: '', pabx_ip: '', status: 'Ativo', notes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExt(null);
  };

  const filtered = extensions.filter(e =>
    (e.extension || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.ip_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.pabx_ip || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginate = (n) => { setCurrentPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const total = extensions.length;
  const ativos = extensions.filter(e => e.status === 'Ativo').length;
  const outros = total - ativos;

  return (
    <div className="voip-wrap">
      {/* HEADER */}
      <div className="voip-head-bar">
        <div className="voip-head-title">
          <h1>VOIP &amp; Telefonia</h1>
          <p>Ramais, ATAs e contas SIP da operação.</p>
        </div>
        <button className="voip-add-btn" onClick={() => openModal()}>
          <Plus size={18} /> Novo Ramal
        </button>
      </div>

      {/* STATS */}
      <div className="voip-stats">
        <div className="voip-stat"><span className="voip-stat-num">{total}</span><span className="voip-stat-lbl">Ramais</span></div>
        <div className="voip-stat on"><span className="voip-stat-num">{ativos}</span><span className="voip-stat-lbl">Ativos</span></div>
        <div className="voip-stat off"><span className="voip-stat-num">{outros}</span><span className="voip-stat-lbl">Inativos / Manut.</span></div>
      </div>

      {/* SEARCH */}
      <div className="log-search" style={{ marginBottom: '20px' }}>
        <Search size={18} />
        <input type="text" placeholder="Buscar ramal, nome ou IP..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* GRID */}
      {currentItems.length === 0 ? (
        <div className="log-empty"><Phone size={40} style={{ opacity: 0.3, marginBottom: 10 }} /><div>Nenhum ramal cadastrado.</div></div>
      ) : (
        <div className="voip-grid">
          {currentItems.map(ext => {
            const sm = statusMeta(ext.status);
            return (
              <div key={ext.id} className={`voip-tile ${sm.cls}`}>
                <div className="voip-tile-head">
                  <div className="voip-ext">
                    <span className="voip-num">{ext.extension}</span>
                    <span className="voip-name">{ext.name || 'Sem nome'}</span>
                  </div>
                  <div className="voip-acts">
                    <button className="voip-act" title="Editar" onClick={() => openModal(ext)}><Edit size={14} /></button>
                    <button className="voip-act danger" title="Excluir" onClick={() => deleteExt(ext.id)}><Trash2 size={14} /></button>
                  </div>
                </div>

                <span className={`voip-status ${sm.cls}`}>{sm.label}</span>

                <div className="voip-lines">
                  <button className="voip-line" onClick={() => copyToClipboard(ext.password, `pass-${ext.id}`)} title="Copiar senha SIP">
                    <KeyRound size={13} className="voip-line-ic-l" />
                    <span className="voip-line-v mono">{ext.password || '—'}</span>
                    {copiedField === `pass-${ext.id}` ? <Check size={12} /> : <Copy size={12} className="voip-line-ic" />}
                  </button>
                  <button className="voip-line" onClick={() => copyToClipboard(ext.pabx_ip, `pabx-${ext.id}`)} title="Copiar PABX">
                    <Server size={13} className="voip-line-ic-l" />
                    <span className="voip-line-v">{ext.pabx_ip || '—'}</span>
                    {copiedField === `pabx-${ext.id}` ? <Check size={12} /> : <Copy size={12} className="voip-line-ic" />}
                  </button>
                  <div className="voip-line static">
                    <Monitor size={13} className="voip-line-ic-l" />
                    <span className="voip-line-v">{ext.ip_address || '—'}</span>
                    {ext.ip_address && (
                      <a href={`http://${ext.ip_address}`} target="_blank" rel="noreferrer" className="voip-line-link" title="Abrir no navegador" onClick={e => e.stopPropagation()}><ExternalLink size={12} /></a>
                    )}
                  </div>
                </div>

                {ext.notes && <div className="voip-notes">{ext.notes}</div>}
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

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingExt ? 'Editar Ramal' : 'Novo Ramal SIP'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Número do Ramal</label>
                  <input type="text" required className="form-input" value={formData.extension} onChange={e => setFormData({ ...formData, extension: e.target.value })} placeholder="Ex: 1001" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nome do Usuário</label>
                  <input type="text" required className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Recepção" />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha SIP</label>
                  <input type="text" required className="form-input" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Manutenção">Manutenção</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">PABX / Servidor (IP ou DNS)</label>
                <input type="text" className="form-input" name="pabx_ip" value={formData.pabx_ip} onChange={e => setFormData({ ...formData, pabx_ip: e.target.value })} placeholder="Ex: 192.168.1.10 ou pabx.empresa.com.br" />
              </div>
              <div className="form-group">
                <label className="form-label">IP do Aparelho (opcional)</label>
                <input type="text" className="form-input" name="ip_address" value={formData.ip_address} onChange={handleInputChange} placeholder="Ex: 192.168.1.50" />
              </div>
              <div className="form-group">
                <label className="form-label">Notas / Localização do ATA</label>
                <textarea className="form-input" rows="2" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Ex: No rack da recepção, ATA Grandstream"></textarea>
              </div>
              <button type="submit" className="btn btn-primary btn-block">{editingExt ? 'Salvar Alterações' : 'Adicionar Ramal'}</button>
            </form>
          </div>
        </div>
      ), document.body)}

      {confirmDialog.open && createPortal((
        <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">{confirmDialog.title}</h3>
            <p className="confirm-modal-text">{confirmDialog.message}</p>
            <div className="confirm-modal-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>CANCELAR</button>
              <button className="btn-confirm-danger" onClick={confirmDialog.onConfirm}>CONFIRMAR EXCLUSÃO</button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  );
}

export default Voip;
