import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Search, Plus, X, Copy, Monitor, MapPin, Check, Download, Trash2, QrCode, Edit, Printer, RotateCw, Wrench, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

const API_URL = '/api/machines';

// Normaliza o "created_by": alguns registros antigos salvaram o objeto do usuário
// inteiro (JSON) em vez do username. Aqui devolvemos só o nome legível.
const cleanCreatedBy = (raw) => {
  if (!raw) return 'Sistema';
  const s = String(raw).trim();
  if (s.startsWith('{')) {
    try { return JSON.parse(s).username || s; } catch { return s; }
  }
  return s;
};

// Reinsere os pontos em IPs salvos sem máscara (ex: "192168158" -> "192.168.15.8").
// Best-effort: em casos ambíguos escolhe a divisão válida com octetos iniciais maiores.
// Se já tiver ponto, ou não for só dígito, devolve como está.
const formatIp = (raw) => {
  if (!raw) return raw;
  const s = String(raw).trim();
  if (s.includes('.')) return s;
  const d = s.replace(/\D/g, '');
  if (d.length !== s.length || d.length < 4 || d.length > 12) return s;
  const solve = (i, parts) => {
    if (parts.length === 4) return i === d.length ? parts : null;
    for (let len = 3; len >= 1; len--) {
      if (i + len > d.length) continue;
      const seg = d.slice(i, i + len);
      if (len > 1 && seg[0] === '0') continue;
      if (parseInt(seg, 10) > 255) continue;
      const remaining = d.length - (i + len);
      const octetsLeft = 3 - parts.length;
      if (remaining < octetsLeft || remaining > octetsLeft * 3) continue;
      const r = solve(i + len, [...parts, seg]);
      if (r) return r;
    }
    return null;
  };
  const parts = solve(0, []);
  return parts ? parts.join('.') : s;
};

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [revealed, setRevealed] = useState({}); // { [machineId]: true } -> senha visível
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '', mac: '', ip: '', location: '', company: '',
    rustdesk_id: '', anydesk_id: '', password: '', serial_number: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('klarke_token');
    if (!token) { navigate('/'); return; }
    fetchMachines();
  }, [navigate]);

  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      html5QrCode = new window.Html5Qrcode("reader");
      const qrCodeSuccessCallback = (decodedText) => {
        setIsScannerOpen(false);
        html5QrCode.stop();
        const match = machines.find(m =>
          m.serial_number === decodedText ||
          m.id.toString() === decodedText ||
          m.name === decodedText
        );
        if (match) {
          openModal(match);
          toast.success(`Equipamento Identificado: ${match.name}`);
        } else {
          setSearchTerm(decodedText);
          toast.error("Equipamento não encontrado, filtrando lista...");
        }
      };
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
    }
    return () => {
      if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop();
    };
  }, [isScannerOpen, machines]);

  const fetchMachines = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setMachines(response.data);
      if (manual) toast.success('Lista atualizada!');
    } catch (error) {
      console.error('Erro ao buscar máquinas:', error);
      if (manual) toast.error('Erro ao atualizar lista');
      if (error.response?.status === 401) {
        localStorage.removeItem('klarke_token');
        navigate('/');
      }
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Trava o scroll do fundo enquanto qualquer modal está aberto (evita 2 barras de rolagem)
  useEffect(() => {
    const anyOpen = isModalOpen || isScannerOpen || confirmDialog.open;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isModalOpen, isScannerOpen, confirmDialog.open]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'mac') {
      formattedValue = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
      const parts = formattedValue.match(/.{1,2}/g);
      if (parts) formattedValue = parts.slice(0, 6).join(':');
    }
    if (name === 'ip') {
      formattedValue = value.replace(/[^0-9.]/g, '');
      formattedValue = formattedValue.replace(/\.\./g, '.');
      const parts = formattedValue.split('.');
      if (parts.length > 4) formattedValue = parts.slice(0, 4).join('.');
    }
    if (name === 'anydesk_id' || name === 'rustdesk_id') {
      formattedValue = value.replace(/[^0-9]/g, '');
    }
    const finalValue = name === 'password' ? formattedValue : formattedValue.toUpperCase();
    setFormData({ ...formData, [name]: finalValue });
  };

  const openModal = (machine = null) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData({ ...machine, ip: formatIp(machine.ip) });
    } else {
      setEditingMachine(null);
      setFormData({ name: '', mac: '', ip: '', location: '', company: '', rustdesk_id: '', anydesk_id: '', password: '', serial_number: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingMachine(null);
  };

  const saveMachine = async (e) => {
    e.preventDefault();
    try {
      const userData = localStorage.getItem('klarke_user');
      let user = 'Desconhecido';
      try { user = JSON.parse(userData).username || userData; } catch (e) { user = userData || 'Desconhecido'; }

      if (editingMachine) {
        await axios.put(`${API_URL}/${editingMachine.id}`, formData, getAuthConfig());
        toast.success('Máquina atualizada!');
      } else {
        await axios.post(API_URL, { ...formData, created_by: user }, getAuthConfig());
        toast.success('Máquina cadastrada!');
      }
      fetchMachines();
      closeModal();
    } catch (error) {
      console.error('Erro ao salvar máquina:', error);
      toast.error('Erro ao conectar com o servidor.');
    }
  };

  const deleteMachine = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir Equipamento',
      message: 'Esta ação é irreversível. Deseja realmente remover este item do inventário?',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/${id}`, getAuthConfig());
          toast.success('Máquina excluída!');
          fetchMachines();
          closeModal();
        } catch (error) {
          toast.error('Erro ao excluir máquina.');
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  // Copia um valor e sinaliza visualmente por 1.5s
  const copyValue = (text, fieldId) => {
    if (!text) { toast.error('Sem valor cadastrado'); return; }
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado!');
    setTimeout(() => setCopiedField((f) => (f === fieldId ? null : f)), 1500);
  };

  const toggleReveal = (id) => setRevealed((r) => ({ ...r, [id]: !r[id] }));

  // Etiqueta térmica: papel de 82x25mm com DUAS colunas (dois rótulos de ~40mm lado a lado).
  // Mesma lógica do projeto Armazém: gera via jsPDF (mm exatos) e abre o PDF em nova aba.
  // A mesma máquina é impressa nas duas colunas (QR + nome + RustDesk/AnyDesk).
  const handlePrintLabel = async (machine) => {
    // Abre a aba já (gesto do clique) pra não ser bloqueada como pop-up.
    const win = window.open('', '_blank');
    const name = (machine.name || 'SEM NOME').toUpperCase();
    const rust = String(machine.rustdesk_id || '---');
    const any = String(machine.anydesk_id || '---');
    const qrCode = String(machine.serial_number || '').trim() || String(machine.id);

    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(qrCode, { margin: 0, width: 240, errorCorrectionLevel: 'M' }); }
    catch (e) { /* sem QR se falhar */ }

    try {
      const doc = new jsPDF('l', 'mm', [82, 25]);

      // Desenha um rótulo (uma coluna) a partir do offset X `ox`.
      const drawLabel = (ox) => {
        // Nome no topo, centralizado na largura da coluna (até 2 linhas)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const nameLines = doc.splitTextToSize(name, 37).slice(0, 2);
        doc.text(nameLines, ox + 19.5, 4, { align: 'center' });
        const qy = 4 + (nameLines.length - 1) * 3.2 + 2.5;

        // QR à esquerda + código embaixo
        if (qrDataUrl) doc.addImage(qrDataUrl, 'PNG', ox + 1.5, qy, 13, 13);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(4.2);
        doc.text(qrCode, ox + 8, qy + 15, { align: 'center', maxWidth: 15 });

        // Bloco direito: RustDesk / AnyDesk
        const tx = ox + 17;
        let ty = qy + 1.5;
        doc.setFontSize(4.6); doc.text('RUSTDESK', tx, ty);
        ty += 3.2; doc.setFontSize(8); doc.text(rust, tx, ty, { maxWidth: 23 });
        ty += 4.8; doc.setFontSize(4.6); doc.text('ANYDESK', tx, ty);
        ty += 3.2; doc.setFontSize(8); doc.text(any, tx, ty, { maxWidth: 23 });
      };

      drawLabel(1);   // coluna esquerda
      drawLabel(42);  // coluna direita (mesma máquina)

      // Abre o PDF como blob (evita o bloqueio de CSP dos data: URLs).
      const url = URL.createObjectURL(doc.output('blob'));
      if (win) {
        win.location.href = url;
      } else {
        // Pop-up bloqueado: baixa o arquivo como alternativa.
        doc.save(`etiqueta-${qrCode}.pdf`);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('Etiqueta gerada!');
    } catch (err) {
      console.error('Erro ao gerar etiqueta:', err);
      if (win) win.close();
      toast.error('Erro ao gerar a etiqueta.');
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'IP', 'MAC', 'Local', 'AnyDesk', 'RustDesk', 'Senha', 'Série', 'Criado em'];
    const csvRows = [headers.join(',')];
    machines.forEach(m => {
      const row = [
        m.id,
        `"${(m.name || '').replace(/"/g, '""')}"`,
        `"${(m.ip || '').replace(/"/g, '""')}"`,
        `"${(m.mac || '').replace(/"/g, '""')}"`,
        `"${(m.location || '').replace(/"/g, '""')}"`,
        `"${(m.anydesk_id || '').replace(/"/g, '""')}"`,
        `"${(m.rustdesk_id || '').replace(/"/g, '""')}"`,
        `"${(m.password || '').replace(/"/g, '""')}"`,
        `"${(m.serial_number || '').replace(/"/g, '""')}"`,
        `"${(m.created_at || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'klarke_maquinas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const downloadRepair = async () => {
    try {
      const response = await axios.get('/api/monitoring/repair-download', { ...getAuthConfig(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Klarke Repair.exe');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Klarke Repair baixado com sucesso!');
    } catch (e) {
      toast.error('Erro ao baixar Klarke Repair');
    }
  };

  const filteredMachines = machines.filter(m =>
    (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.ip && (m.ip.includes(searchTerm) || formatIp(m.ip).includes(searchTerm))) ||
    (m.location && m.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (m.anydesk_id && m.anydesk_id.includes(searchTerm)) ||
    (m.rustdesk_id && m.rustdesk_id.includes(searchTerm)) ||
    (m.serial_number && m.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMachines = filteredMachines.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMachines.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  // Chip de acesso rápido: 1 clique copia. Ícone + rótulo curto. Fica verde ao copiar.
  const Chip = ({ id, label, value, icon, secret = false, machineId }) => {
    const isCopied = copiedField === id;
    return (
      <button
        type="button"
        className={`tile-chip ${secret ? 'secret' : ''} ${!value ? 'off' : ''} ${isCopied ? 'copied' : ''}`}
        onClick={() => copyValue(value, id)}
        disabled={!value}
        title={value ? (secret ? 'Copiar senha remota' : `Copiar ${label}: ${value}`) : `${label} não cadastrado`}
      >
        <span className="tile-chip-ico">{isCopied ? <Check size={16} /> : icon}</span>
        <span className="tile-chip-lbl">{isCopied ? 'copiado' : label}</span>
      </button>
    );
  };

  return (
    <>
      <header className="mq-topbar">
        <div>
          <h1>Máquinas & Acessos</h1>
          <p>{machines.length} equipamento{machines.length === 1 ? '' : 's'} cadastrado{machines.length === 1 ? '' : 's'} — clique para copiar e conectar.</p>
        </div>
      </header>

      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar nome, local, IP, AnyDesk, RustDesk ou série..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>
        <div className="action-buttons-group">
          <button className={`btn-refresh-sober ${isRefreshing ? 'spinning' : ''}`} onClick={() => fetchMachines(true)} title="Atualizar Lista" disabled={isRefreshing}>
            <RotateCw size={20} />
          </button>
          <button className="btn-action-square" style={{ background: 'var(--color-accent)' }} onClick={() => setIsScannerOpen(true)} title="Escanear QR Code">
            <QrCode size={20} color="white" />
          </button>
          <button className="btn-action-square" style={{ background: '#334155' }} onClick={downloadRepair} title="Baixar Klarke Repair">
            <Wrench size={20} />
          </button>
          <button className="btn-action-square" onClick={exportToCSV} title="Exportar CSV">
            <Download size={20} />
          </button>
        </div>
      </div>

      {isScannerOpen && createPortal((
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
              <h2 className="modal-title">Escanear QR Code</h2>
              <button className="close-btn" onClick={() => setIsScannerOpen(false)}><X size={24} /></button>
            </div>
            <div id="reader" style={{ width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden' }}></div>
            <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Aponte a câmera para o QR Code da etiqueta.</p>
          </div>
        </div>
      ), document.body)}

      {machines.length === 0 ? (
        <div className="empty-state">
          <Monitor className="empty-icon" size={64} />
          <h2>Nenhuma máquina encontrada</h2>
          <p>Adicione sua primeira máquina para começar o gerenciamento.</p>
        </div>
      ) : filteredMachines.length === 0 ? (
        <div className="empty-state">
          <Search className="empty-icon" size={64} />
          <h2>Nada encontrado para “{searchTerm}”</h2>
          <p>Tente outro nome, IP ou ID de acesso remoto.</p>
        </div>
      ) : (
        <div className="tile-grid">
          {currentMachines.map(machine => (
            <div key={machine.id} className="tile">
              <div className="tile-head">
                <div className="tile-id">
                  <span className="tile-dot"><Monitor size={13} /></span>
                  <span className="tile-name" title={machine.name}>{machine.name || 'Sem nome'}</span>
                </div>
                <div className="tile-acts">
                  <button className="tile-act" title="Editar" onClick={() => openModal(machine)}><Edit size={13} /></button>
                  <button className="tile-act" title="Etiqueta" onClick={() => handlePrintLabel(machine)}><Printer size={13} /></button>
                  <button className="tile-act danger" title="Excluir" onClick={() => deleteMachine(machine.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              {(() => {
                const badge = companyBadge(machine.company, machine.location);
                return (
                  <span className="tile-loc">
                    {badge && <img src={badge.src} alt={badge.label} title={badge.label} className="tile-company-badge" />}
                    <MapPin size={11} /> {machine.location || 'Sem local'}
                  </span>
                );
              })()}
              <div className="tile-meta">
                {machine.ip && (
                  <button className="tile-line" onClick={() => copyValue(formatIp(machine.ip), `ip-${machine.id}`)} title={`Copiar IP: ${formatIp(machine.ip)}`}>
                    <span className="tile-line-k">IP</span>
                    <span className="tile-line-v">{formatIp(machine.ip)}</span>
                    {copiedField === `ip-${machine.id}` ? <Check size={11} /> : <Copy size={11} className="tile-line-ic" />}
                  </button>
                )}
                {machine.mac && (
                  <button className="tile-line" onClick={() => copyValue(machine.mac, `mac-${machine.id}`)} title={`Copiar MAC: ${machine.mac}`}>
                    <span className="tile-line-k">MAC</span>
                    <span className="tile-line-v">{machine.mac}</span>
                    {copiedField === `mac-${machine.id}` ? <Check size={11} /> : <Copy size={11} className="tile-line-ic" />}
                  </button>
                )}
              </div>

              <div className="tile-chips">
                <Chip id={`ad-${machine.id}`} label="AnyDesk" value={machine.anydesk_id} icon={<img src="/anydesk.svg" alt="" className="tile-chip-img" />} />
                <Chip id={`rd-${machine.id}`} label="RustDesk" value={machine.rustdesk_id} icon={<img src="/rustdesk.png" alt="" className="tile-chip-img" />} />
                <Chip id={`pw-${machine.id}`} label="Senha" value={machine.password} secret icon={<KeyRound size={16} />} />
              </div>
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

      <button className="fab" onClick={() => openModal()} title="Nova máquina"><Plus size={24} /></button>

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingMachine ? 'Editar Máquina' : 'Nova Máquina'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>

            <form onSubmit={saveMachine}>
              {editingMachine && (
                <div className="audit-strip">
                  <span>Cadastrado por <b>{cleanCreatedBy(editingMachine.created_by)}</b></span>
                  {editingMachine.created_at && <span>· {new Date((editingMachine.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}</span>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Nome da Máquina</label>
                <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: PC RECEPÇÃO" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Empresa</label>
                  <select className="form-input" name="company" value={formData.company || ''} onChange={handleInputChange}>
                    <option value="">— Selecione —</option>
                    {COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Localização / Setor</label>
                  <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: MATRIZ - RH" style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Nº de Série / Patrimônio</label>
                  <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: K001" style={{ textTransform: 'uppercase' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">IP</label>
                  <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.0.X" style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">MAC Address</label>
                  <input type="text" className="form-input" name="mac" value={formData.mac} onChange={handleInputChange} placeholder="00:00:00:00:00:00" style={{ textTransform: 'uppercase' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha de Acesso Remoto</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="Senha" />
                </div>
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">AnyDesk ID</label>
                  <input type="text" className="form-input" name="anydesk_id" value={formData.anydesk_id} onChange={handleInputChange} placeholder="123 456 789" style={{ textTransform: 'uppercase' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">RustDesk ID</label>
                  <input type="text" className="form-input" name="rustdesk_id" value={formData.rustdesk_id} onChange={handleInputChange} placeholder="123 456 789" style={{ textTransform: 'uppercase' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: editingMachine ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '16px' }}>
                <button type="submit" className="btn btn-primary" style={{ marginTop: 0 }}>{editingMachine ? 'SALVAR' : 'ADICIONAR'}</button>
                {editingMachine && (
                  <button type="button" className="btn" style={{ backgroundColor: '#64748b', color: 'white', marginTop: 0 }} onClick={() => handlePrintLabel(editingMachine)}>
                    <Printer size={18} style={{ marginRight: '8px' }} /> ETIQUETA
                  </button>
                )}
              </div>
              {editingMachine && (
                <button type="button" className="btn btn-danger" style={{ marginTop: '10px' }} onClick={() => deleteMachine(editingMachine.id)}>
                  <Trash2 size={18} style={{ marginRight: '8px' }} /> EXCLUIR EQUIPAMENTO
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

export default Dashboard;
