import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Search, Plus, X, Copy, Router as RouterIcon, MapPin, Check, Download, Clipboard, Trash2, QrCode, RotateCw, Edit, Wifi, Network, ShieldCheck, Cpu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const API_URL = '/api/network-devices';

// Tipos de equipamento: cor + ícone pra diferenciar de bate-olho.
const TYPE_META = {
  MODEM:    { label: 'Modem',    cls: 'modem',    Icon: RouterIcon },
  ROTEADOR: { label: 'Roteador', cls: 'roteador', Icon: Wifi },
  SWITCH:   { label: 'Switch',   cls: 'switch',   Icon: Network },
  FIREWALL: { label: 'Firewall', cls: 'firewall', Icon: ShieldCheck },
  OUTRO:    { label: 'Outro',    cls: 'outro',    Icon: Cpu },
};
const typeMeta = (t) => TYPE_META[String(t || '').toUpperCase()] || TYPE_META.OUTRO;
const TYPE_OPTIONS = ['Modem', 'Roteador', 'Switch', 'Firewall', 'Outro'];

function NetworkDevices() {
  const [devices, setDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', type: 'Modem', ip: '', username: '', password: '', location: '', isp: '', company: '', serial_number: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('klarke_token');
    if (!token) { navigate('/'); return; }
    fetchDevices();
  }, [navigate]);

  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      html5QrCode = new window.Html5Qrcode('reader-network');
      const qrCodeSuccessCallback = (decodedText) => {
        setIsScannerOpen(false);
        html5QrCode.stop();
        const match = devices.find(d =>
          d.serial_number === decodedText || d.id.toString() === decodedText || d.name === decodedText
        );
        if (match) {
          openModal(match);
          toast.success(`Equipamento Identificado: ${match.name}`);
        } else {
          setSearchTerm(decodedText);
          toast.error('Equipamento não encontrado, filtrando lista...');
        }
      };
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      html5QrCode.start({ facingMode: 'environment' }, config, qrCodeSuccessCallback);
    }
    return () => { if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop(); };
  }, [isScannerOpen, devices]);

  const fetchDevices = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setDevices(response.data);
      if (manual) toast.success('Lista atualizada!');
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error);
      if (manual) toast.error('Erro ao atualizar lista');
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Trava o scroll do fundo enquanto qualquer modal está aberto
  useEffect(() => {
    const anyOpen = isModalOpen || isScannerOpen || confirmDialog.open;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, isScannerOpen, confirmDialog.open]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    if (name === 'ip') {
      formattedValue = value.replace(/[^0-9.]/g, '').replace(/\.\./g, '.');
    }
    setFormData({ ...formData, [name]: formattedValue });
  };

  const openModal = (device = null) => {
    if (device) {
      setEditingDevice(device);
      setFormData(device);
    } else {
      setEditingDevice(null);
      setFormData({ name: '', type: 'Modem', ip: '', username: '', password: '', location: '', isp: '', company: '', serial_number: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDevice(null);
  };

  const saveDevice = async (e) => {
    e.preventDefault();
    try {
      const userData = localStorage.getItem('klarke_user');
      let user = 'Desconhecido';
      try { user = JSON.parse(userData).username || userData; } catch (err) { user = userData || 'Desconhecido'; }

      if (editingDevice) {
        await axios.put(`${API_URL}/${editingDevice.id}`, formData, getAuthConfig());
        toast.success('Equipamento atualizado!');
      } else {
        await axios.post(API_URL, { ...formData, created_by: user }, getAuthConfig());
        toast.success('Equipamento cadastrado!');
      }
      fetchDevices();
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar equipamento.');
    }
  };

  const deleteDevice = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir Equipamento',
      message: 'Deseja remover permanentemente este dispositivo da rede?',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/${id}`, getAuthConfig());
          toast.success('Equipamento excluído!');
          fetchDevices();
          closeModal();
        } catch (error) {
          toast.error('Erro ao excluir equipamento.');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text || '');
    setCopiedField(fieldId);
    toast.success('Copiado!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullData = (device) => {
    const text = `Nome: ${device.name}\nTipo: ${device.type}\nSérie: ${device.serial_number || '-'}\nIP: ${device.ip}\nLocal: ${device.location}\nOperadora: ${device.isp}\nUsuário: ${device.username}\nSenha: ${device.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Dados completos copiados!');
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'Tipo', 'IP', 'Local', 'Empresa', 'Operadora', 'Usuário', 'Senha', 'Série', 'Criado em'];
    const csvRows = [headers.join(',')];
    devices.forEach(d => {
      csvRows.push([
        d.id,
        `"${(d.name || '').replace(/"/g, '""')}"`,
        `"${(d.type || '').replace(/"/g, '""')}"`,
        `"${(d.ip || '').replace(/"/g, '""')}"`,
        `"${(d.location || '').replace(/"/g, '""')}"`,
        `"${(d.company || '').replace(/"/g, '""')}"`,
        `"${(d.isp || '').replace(/"/g, '""')}"`,
        `"${(d.username || '').replace(/"/g, '""')}"`,
        `"${(d.password || '').replace(/"/g, '""')}"`,
        `"${(d.serial_number || '').replace(/"/g, '""')}"`,
        `"${(d.created_at || '').replace(/"/g, '""')}"`
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'klarke_rede.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const filtered = devices.filter(d => {
    const term = searchTerm.toLowerCase();
    return (d.name?.toLowerCase() || '').includes(term) ||
      (d.ip?.toLowerCase() || '').includes(term) ||
      (d.location?.toLowerCase() || '').includes(term) ||
      (d.isp?.toLowerCase() || '').includes(term) ||
      (d.type?.toLowerCase() || '').includes(term) ||
      (d.serial_number?.toLowerCase() || '').includes(term);
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  return (
    <>
      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nome, IP, tipo ou série..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="action-buttons-group">
          <button className={`btn-refresh-sober ${isRefreshing ? 'spinning' : ''}`} onClick={() => fetchDevices(true)} title="Atualizar Lista" disabled={isRefreshing}>
            <RotateCw size={20} />
          </button>
          <button className="btn-action-square" style={{ background: 'var(--color-accent)' }} onClick={() => setIsScannerOpen(true)} title="Escanear QR Code">
            <QrCode size={20} color="white" />
          </button>
          <button className="btn-action-square" onClick={exportToCSV} title="Exportar CSV">
            <Download size={20} />
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="empty-state">
          <RouterIcon className="empty-icon" size={64} />
          <h2>Nenhum equipamento cadastrado</h2>
          <p>Adicione modems, switches e roteadores da rede.</p>
        </div>
      ) : (
        <div className="net-grid">
          {currentItems.map(device => {
            const tm = typeMeta(device.type);
            const badge = companyBadge(device.company, device.location);
            return (
              <div key={device.id} className="net-tile">
                <div className="net-tile-head">
                  <div className="net-tile-id">
                    <span className={`net-ico ${tm.cls}`}><tm.Icon size={15} /></span>
                    <span className="net-name" title={device.name}>{device.name || 'Equipamento'}</span>
                  </div>
                  <div className="net-acts">
                    <button className="net-act" title="Editar" onClick={() => openModal(device)}><Edit size={13} /></button>
                    <button className="net-act" title="Copiar tudo" onClick={() => copyFullData(device)}><Clipboard size={13} /></button>
                    <button className="net-act danger" title="Excluir" onClick={() => deleteDevice(device.id)}><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="net-badges">
                  <span className={`net-type-badge ${tm.cls}`}>{tm.label}</span>
                  <span className="net-loc"><MapPin size={10} /> {device.location || 'Sem local'}</span>
                </div>

                <div className="net-meta">
                  <button className="net-line" onClick={() => copyToClipboard(device.ip, `ip-${device.id}`)} title="Copiar IP">
                    <span className="net-k">IP</span>
                    <span className="net-v">{device.ip || '-'}</span>
                    {copiedField === `ip-${device.id}` ? <Check size={11} /> : <Copy size={11} className="net-ic" />}
                  </button>
                  {device.isp && (
                    <div className="net-line static">
                      <span className="net-k">LINK</span>
                      <span className="net-v">{device.isp}</span>
                    </div>
                  )}
                  <button className="net-line" onClick={() => copyToClipboard(device.username, `usr-${device.id}`)} title="Copiar usuário">
                    <span className="net-k">USER</span>
                    <span className="net-v">{device.username || '-'}</span>
                    {copiedField === `usr-${device.id}` ? <Check size={11} /> : <Copy size={11} className="net-ic" />}
                  </button>
                  <button className="net-line" onClick={() => copyToClipboard(device.password, `pw-${device.id}`)} title="Copiar senha">
                    <span className="net-k">SENHA</span>
                    <span className="net-v">••••••••</span>
                    {copiedField === `pw-${device.id}` ? <Check size={11} /> : <Copy size={11} className="net-ic" />}
                  </button>
                </div>

                <div className="net-foot">
                  {badge && <img src={badge.src} alt={badge.label} title={badge.label} className="net-foot-badge" />}
                  <span className="net-sn" title="Número de série">{device.serial_number || 'sem série'}</span>
                </div>
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

      <button className="fab" onClick={() => openModal()} title="Novo equipamento"><Plus size={24} /></button>

      {isScannerOpen && createPortal((
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title">Escanear QR Code</h2>
              <button className="close-btn" onClick={() => setIsScannerOpen(false)}><X size={24} /></button>
            </div>
            <div id="reader-network" style={{ width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}></div>
            <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Aponte a câmera para o QR Code da etiqueta.</p>
          </div>
        </div>
      ), document.body)}

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingDevice ? 'Editar Equipamento' : 'Novo Equipamento'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>

            <form onSubmit={saveDevice}>
              {editingDevice && (
                <div className="audit-strip">
                  <span>Cadastrado por <b>{editingDevice.created_by || 'Sistema'}</b></span>
                  {editingDevice.created_at && <span>· {new Date((editingDevice.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}</span>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nome / Identificação</label>
                <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: Roteador Principal" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" name="type" value={formData.type} onChange={handleInputChange}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Empresa</label>
                  <select className="form-input" name="company" value={formData.company || ''} onChange={handleInputChange}>
                    <option value="">— Selecione —</option>
                    {COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Número de Série</label>
                  <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: SN-ROUTER-01" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Localização</label>
                  <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: Rack TI" />
                </div>
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">IP de Acesso</label>
                  <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.x.x" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Operadora / Link</label>
                  <input type="text" className="form-input" name="isp" value={formData.isp} onChange={handleInputChange} placeholder="Ex: Vivo, Claro" />
                </div>
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Usuário</label>
                  <input type="text" className="form-input" name="username" value={formData.username} onChange={handleInputChange} placeholder="admin" />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="senha" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block">
                {editingDevice ? 'Salvar Alterações' : 'Adicionar Equipamento'}
              </button>
              {editingDevice && (
                <button type="button" className="btn btn-danger btn-block" onClick={() => deleteDevice(editingDevice.id)}>
                  Excluir Equipamento
                </button>
              )}
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
    </>
  );
}

export default NetworkDevices;
