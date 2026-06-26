import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, Copy, Monitor, MapPin, Check, Download, Clipboard, Trash2, QrCode, Activity, Edit, Printer, ChevronLeft, ChevronRight, RotateCw, Database, Wifi, Globe, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';

const API_URL = '/api/machines';

function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [logsCount, setLogsCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState({ disk: { percent: '0%', avail: '0' }, latency: 0 });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    mac: '',
    ip: '',
    location: '',
    rustdesk_id: '',
    anydesk_id: '',
    password: '',
    serial_number: ''
  });

  useEffect(() => {
    const token = localStorage.getItem('klarke_token');
    if (!token) {
      navigate('/'); 
      return;
    }
    fetchMachines();

    // Polling para monitoramento ao vivo (30 segundos)
    const interval = setInterval(fetchMachines, 30000);
    return () => clearInterval(interval);
  }, [navigate]);

  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      html5QrCode = new window.Html5Qrcode("reader");
      const qrCodeSuccessCallback = (decodedText) => {
        setIsScannerOpen(false);
        html5QrCode.stop();
        
        // Busca automática e abertura do modal
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
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop();
      }
    };
  }, [isScannerOpen, machines]);

  const fetchMachines = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setMachines(response.data);
      
      // Busca contagem total de logs
      const logsRes = await axios.get('/api/audit-logs', getAuthConfig()).catch(() => ({ data: [] }));
      setLogsCount(logsRes.data?.length || 0);
      
      // Busca status do sistema
      const sysRes = await axios.get('/api/system-status', getAuthConfig()).catch(() => ({ data: { disk: { percent: '0%', avail: '0' }, latency: 0 } }));
      setSystemStatus(sysRes.data);

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

  useEffect(() => {
    fetchMachines();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'mac') {
      formattedValue = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
      const parts = formattedValue.match(/.{1,2}/g);
      if (parts) formattedValue = parts.slice(0, 6).join(':');
    }

    if (name === 'ip') {
      formattedValue = value.replace(/[^0-9.]/g, ''); // Apenas números e pontos
      formattedValue = formattedValue.replace(/\.\./g, '.'); // Evita pontos duplos
      const parts = formattedValue.split('.');
      if (parts.length > 4) formattedValue = parts.slice(0, 4).join('.');
    }

    if (name === 'anydesk_id' || name === 'rustdesk_id') {
      formattedValue = value.replace(/[^0-9]/g, '');
    }

    // Tudo em maiúsculo para máquinas (exceto a senha remota)
    const finalValue = name === 'password' ? formattedValue : formattedValue.toUpperCase();
    setFormData({ ...formData, [name]: finalValue });
  };

  const openModal = (machine = null) => {
    if (machine) {
      setEditingMachine(machine);
      setFormData(machine);
    } else {
      setEditingMachine(null);
      setFormData({ name: '', mac: '', ip: '', location: '', rustdesk_id: '', anydesk_id: '', password: '', serial_number: '' });
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
      try {
        const parsed = JSON.parse(userData);
        user = parsed.username || userData;
      } catch (e) {
        user = userData || 'Desconhecido';
      }

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

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado para a área de transferência');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copyFullData = (machine) => {
    const text = `Nome: ${machine.name}\nSérie: ${machine.serial_number || '-'}\nIP: ${machine.ip}\nMAC: ${machine.mac}\nLocal: ${machine.location}\nAnyDesk: ${machine.anydesk_id}\nRustDesk: ${machine.rustdesk_id}\nSenha: ${machine.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Dados completos copiados!');
  };

  const handlePrintLabel = (machine) => {
    const printWindow = window.open('', '_blank');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(machine.serial_number || machine.name)}`;
    const kCode = machine.serial_number || `K${String(machine.id).padStart(3, '0')}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>ETIQUETA - ${kCode}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { 
              margin: 0; 
              padding: 0; 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              background: #fff;
              font-family: 'Inter', sans-serif;
            }
            .sticker {
              width: 350px;
              height: 200px;
              border: 3px solid #0f172a;
              padding: 0;
              position: relative;
              overflow: hidden;
              background: white;
            }
            .header-bar {
              background: #0f172a;
              color: white;
              padding: 8px;
              text-align: center;
              font-weight: 900;
              font-size: 14px;
              letter-spacing: 2px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 10px;
            }
            .main-content {
              display: flex;
              padding: 10px;
              height: 135px;
            }
            .qr-side {
              flex: 0 0 130px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .info-side {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding-left: 15px;
              border-left: 1px dashed #cbd5e1;
            }
            .k-number {
              font-size: 32px;
              font-weight: 900;
              color: #0f172a;
              margin: 0;
              line-height: 1;
            }
            .machine-name {
              font-size: 14px;
              font-weight: 700;
              color: #475569;
              margin-top: 5px;
              text-transform: uppercase;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            }
            .footer-tags {
              position: absolute;
              bottom: 0;
              width: 100%;
              background: #f8fafc;
              border-top: 1px solid #0f172a;
              display: flex;
              justify-content: space-between;
              padding: 4px 10px;
              font-size: 9px;
              font-weight: 800;
              color: #0f172a;
              box-sizing: border-box;
            }
            @media print {
              body { background: none; }
              .sticker { border: 4px solid #000; }
            }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
          <div class="sticker">
            <div class="header-bar">
              KLARKE SOLUTIONS
            </div>
            <div class="main-content">
              <div class="qr-side">
                <img src="${qrUrl}" width="110" height="110" />
              </div>
              <div class="info-side">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 2px;">PATRIMÔNIO / ID</div>
                <div class="k-number">${kCode}</div>
                <div class="machine-name">${machine.name}</div>
                <div style="font-size: 10px; font-weight: 600; color: #94a3b8; margin-top: 8px;">IP: ${machine.ip || '---'}</div>
              </div>
            </div>
            <div class="footer-tags">
              <span>GERENCIAMENTO DE INFRAESTRUTURA</span>
              <span>VERIFICADO</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
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
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
      const response = await axios.get('/api/monitoring/repair-download', {
        ...getAuthConfig(),
        responseType: 'blob'
      });
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

  // Considera online se last_seen foi há menos de 5 minutos
  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
  };

  const onlineCount = machines.filter(m => isOnline(m.last_seen)).length;
  const offlineCount = machines.length - onlineCount;

  const filteredMachines = machines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.ip && m.ip.includes(searchTerm)) ||
    (m.serial_number && m.serial_number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Lógica de Paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMachines = filteredMachines.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMachines.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Resetar para página 1 ao buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <>
      <div className="quick-stats-row-sober" style={{marginBottom: '32px'}}>
        {/* SAÚDE GLOBAL */}
        <div className="stat-box-industrial" style={{borderLeft: '4px solid #10b981', background: 'var(--color-surface)', backdropFilter: 'blur(8px)'}}>
          <span className="stat-label">Saúde Global</span>
          <div className="stat-value-row">
            <Activity size={18} color="#10b981" />
            <span className="stat-value">{machines.length > 0 ? Math.round((onlineCount / machines.length) * 100) : 0}%</span>
          </div>
          <span className="stat-desc">Sincronizado em tempo real</span>
        </div>

        {/* ÚLTIMO BACKUP */}
        <div className="stat-box-industrial" style={{borderLeft: '4px solid var(--color-accent)', background: 'var(--color-surface)', backdropFilter: 'blur(8px)'}}>
          <span className="stat-label">Último Backup</span>
          <div className="stat-value-row">
            <Database size={18} color="var(--color-accent)" />
            <span className="stat-value">STATUS: OK</span>
          </div>
          <div style={{marginTop: '8px'}}>
             <span className="action-chip" style={{display: 'inline-flex', background: 'var(--color-accent)', color: 'white', border: 'none'}} onClick={() => navigate('/api/backup')}>
               BAIXAR CÓPIA AGORA
             </span>
          </div>
        </div>

        {/* ATIVIDADE LOGS */}
        <div className="stat-box-industrial" style={{borderLeft: '4px solid #f59e0b', background: 'var(--color-surface)', backdropFilter: 'blur(8px)'}}>
          <span className="stat-label">Atividade Logs</span>
          <div className="stat-value-row">
            <RotateCw size={18} color="#f59e0b" />
            <span className="stat-value">{logsCount}</span>
          </div>
          <span className="stat-desc">Total de eventos registrados</span>
        </div>

        {/* ESTADO DA REDE */}
        <div className="stat-box-industrial" style={{borderLeft: '4px solid #10b981', background: 'var(--color-surface)', backdropFilter: 'blur(8px)'}}>
          <span className="stat-label">Estado da Rede</span>
          <div className="stat-value-row">
            <Globe size={18} color="#10b981" />
            <span className="stat-value">{systemStatus?.latency > 0 ? 'ESTÁVEL' : 'OFFLINE'}</span>
          </div>
          <span className="stat-desc">Latência média: {systemStatus?.latency || 0}ms</span>
        </div>

        {/* ARMAZENAMENTO */}
        <div className="stat-box-industrial" style={{borderLeft: '4px solid #ef4444', background: 'var(--color-surface)', backdropFilter: 'blur(8px)'}}>
          <span className="stat-label">Armazenamento VPS</span>
          <div className="stat-value-row">
            <Database size={18} color="#ef4444" />
            <span className="stat-value">{systemStatus?.disk?.percent || '0%'}</span>
          </div>
          <span className="stat-desc">{systemStatus?.disk?.avail || '0'} disponíveis no HD</span>
        </div>
      </div>

      <header className="page-header" style={{marginBottom: '32px'}}>
        <h1 style={{marginBottom: '8px'}}>Gerenciamento de Máquinas</h1>
        <p>Controle de inventário e acessos remotos.</p>
      </header>
      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por nome, IP ou série..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="action-buttons-group">
          <button 
            className={`btn-refresh-sober ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => fetchMachines(true)}
            title="Atualizar Lista"
            disabled={isRefreshing}
          >
            <RotateCw size={20} />
          </button>
          <button 
            className="btn-action-square" 
            style={{background: 'var(--color-accent)'}}
            onClick={() => setIsScannerOpen(true)}
            title="Escanear QR Code"
          >
            <QrCode size={20} color="white" />
          </button>
          <button 
            className="btn-action-square" 
            style={{background: '#334155'}} 
            onClick={downloadRepair} 
            title="Baixar Klarke Repair"
          >
            <Wrench size={20} />
          </button>
          <button 
            className="btn-action-square" 
            onClick={exportToCSV} 
            title="Exportar CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {isScannerOpen && (
        <div className="modal-overlay" style={{zIndex: 3000}}>
          <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center'}}>
             <div className="modal-header">
                <h2 className="modal-title">Escanear QR Code</h2>
                <button className="close-btn" onClick={() => setIsScannerOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              <div id="reader" style={{width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden'}}></div>
              <p style={{marginTop: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>
                Aponte a câmera para o QR Code da etiqueta.
              </p>
          </div>
        </div>
      )}

        {machines.length === 0 ? (
          <div className="empty-state">
            <Monitor className="empty-icon" size={64} />
            <h2>Nenhuma máquina encontrada</h2>
            <p>Adicione sua primeira máquina para começar o gerenciamento.</p>
          </div>
        ) : (
          <div className="machines-grid">
            {currentMachines.map(machine => (
              <div key={machine.id} className="machine-card" onClick={() => openModal(machine)}>
                <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div 
                    title={isOnline(machine.last_seen) ? 'Online' : 'Offline'}
                    style={{
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: isOnline(machine.last_seen) ? '#10b981' : '#ef4444'
                    }} 
                  />
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{machine.name || 'Máquina sem nome'}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {machine.created_at ? new Date(machine.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                </div>
                <div className="card-actions-wrapper">
                  <span className="machine-location">
                    <MapPin size={12} style={{display: 'inline', marginRight: 4}} />
                    {machine.location || 'Sem local'}
                  </span>
                  
                  <div className="actions-group utility">
                    <button className="action-chip" title="Copiar Tudo" onClick={(e) => { e.stopPropagation(); copyFullData(machine); }}>
                      <Clipboard size={14} /> <span>COPIAR</span>
                    </button>
                    <button className="action-chip" title="Imprimir Etiqueta" onClick={(e) => { e.stopPropagation(); handlePrintLabel(machine); }}>
                      <Printer size={14} /> <span>ETIQUETA</span>
                    </button>
                  </div>

                  <div className="actions-separator"></div>

                  <div className="actions-group management">
                    <button className="action-chip edit" title="Editar" onClick={(e) => { e.stopPropagation(); openModal(machine); }}>
                      <Edit size={14} />
                    </button>
                    <button className="action-chip delete" title="Excluir" onClick={(e) => { e.stopPropagation(); deleteMachine(machine.id); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
                
                <div className="machine-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">IP Address</span>
                    <span className="detail-value">
                      {machine.ip || '-'}
                      {machine.ip && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.ip, `ip-${machine.id}`); }}>
                          {copiedField === `ip-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">AnyDesk</span>
                    <span className="detail-value">
                      {machine.anydesk_id || '-'}
                      {machine.anydesk_id && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.anydesk_id, `ad-${machine.id}`); }}>
                          {copiedField === `ad-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">RustDesk</span>
                    <span className="detail-value">
                      {machine.rustdesk_id || '-'}
                      {machine.rustdesk_id && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.rustdesk_id, `rd-${machine.id}`); }}>
                          {copiedField === `rd-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Nº Série</span>
                    <span className="detail-value">
                      {machine.serial_number || '-'}
                      {machine.serial_number && (
                        <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(machine.serial_number, `sn-${machine.id}`); }}>
                          {copiedField === `sn-${machine.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Controles de Paginação */}
        {totalPages > 1 && (
          <div className="pagination-industrial">
            <button 
              disabled={currentPage === 1}
              onClick={() => paginate(currentPage - 1)}
              className="page-btn"
            >
              Anterior
            </button>
            <div className="page-info">
              Página <span>{currentPage}</span> de {totalPages}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => paginate(currentPage + 1)}
              className="page-btn"
            >
              Próxima
            </button>
          </div>
        )}

        <button className="fab" onClick={() => openModal()}>
          <Plus size={24} />
        </button>

        {isModalOpen && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">{editingMachine ? 'Editar Máquina' : 'Nova Máquina'}</h2>
                <button className="close-btn" onClick={closeModal}>
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={saveMachine}>
                {editingMachine && (
                  <div style={{marginBottom: '20px', padding: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', borderRadius: '4px'}}>
                    <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px'}}>AUDITORIA DE CADASTRO</div>
                    <div style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)'}}>
                      POR: {editingMachine.created_by || 'Sistema'}
                    </div>
                    <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>
                      EM: {new Date((editingMachine.created_at || '').replace(' ', 'T') + 'Z').toLocaleString()}
                    </div>
                  </div>
                )}
                {editingMachine && formData.serial_number && (
                  <div className="qr-container">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formData.serial_number)}`} 
                      alt="QR Code do Equipamento"
                    />
                    <p className="qr-label">QR Code de Identificação</p>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Nome da Máquina</label>
                  <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: PC RECEPÇÃO" style={{textTransform: 'uppercase'}} />
                </div>

                <div className="form-group">
                  <label className="form-label">Número de Série / Patrimônio</label>
                  <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: K001" style={{textTransform: 'uppercase'}} />
                </div>
                
                <div className="machine-details-grid-form">
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">IP</label>
                    <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.0.X" style={{textTransform: 'uppercase'}} />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">MAC Address</label>
                    <input type="text" className="form-input" name="mac" value={formData.mac} onChange={handleInputChange} placeholder="00:00:00:00:00:00" style={{textTransform: 'uppercase'}} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Localização / Setor</label>
                  <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: MATRIZ - RH" style={{textTransform: 'uppercase'}} />
                </div>

                <div className="machine-details-grid-form">
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">AnyDesk ID</label>
                    <input type="text" className="form-input" name="anydesk_id" value={formData.anydesk_id} onChange={handleInputChange} placeholder="123 456 789" style={{textTransform: 'uppercase'}} />
                  </div>
                  <div className="form-group" style={{marginBottom: 0}}>
                    <label className="form-label">RustDesk ID</label>
                    <input type="text" className="form-input" name="rustdesk_id" value={formData.rustdesk_id} onChange={handleInputChange} placeholder="123 456 789" style={{textTransform: 'uppercase'}} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Senha de Acesso Remoto</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="SENHA" style={{textTransform: 'uppercase'}} />
                </div>

                <div style={{display: 'grid', gridTemplateColumns: editingMachine ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '20px'}}>
                  <button type="submit" className="btn btn-primary" style={{marginTop: 0}}>
                    {editingMachine ? 'SALVAR' : 'ADICIONAR'}
                  </button>
                  {editingMachine && (
                    <button type="button" className="btn" style={{backgroundColor: '#64748b', color: 'white', marginTop: 0}} onClick={() => handlePrintLabel(editingMachine)}>
                      <Printer size={18} style={{marginRight: '8px'}} /> ETIQUETA
                    </button>
                  )}
                </div>
                
                {editingMachine && (
                  <button type="button" className="btn btn-danger" style={{marginTop: '10px'}} onClick={() => deleteMachine(editingMachine.id)}>
                    <Trash2 size={18} style={{marginRight: '8px'}} /> EXCLUIR EQUIPAMENTO
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
        {confirmDialog.open && (
          <div className="confirm-modal-overlay" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
              <h3 className="confirm-modal-title">{confirmDialog.title}</h3>
              <p className="confirm-modal-text">{confirmDialog.message}</p>
              <div className="confirm-modal-actions">
                <button className="btn-confirm-cancel" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
                  CANCELAR
                </button>
                <button className="btn-confirm-danger" onClick={confirmDialog.onConfirm}>
                  CONFIRMAR EXCLUSÃO
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default Dashboard;
