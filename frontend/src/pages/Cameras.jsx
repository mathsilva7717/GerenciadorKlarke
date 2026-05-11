import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, Copy, Camera, MapPin, Check, Download, Clipboard, Trash2, QrCode, Activity, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = '/api/cameras';

function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '', ip: '', port: '', username: '', password: '', location: '', serial_number: '', rtsp_link: ''
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    const userData = localStorage.getItem('klarke_user');
    let user = 'Sistema';
    try {
      const parsed = JSON.parse(userData);
      user = parsed.username || userData;
    } catch (e) {
      user = userData || 'Sistema';
    }
    return { headers: { Authorization: `Bearer ${token}`, 'X-User': user } };
  };

  useEffect(() => {
    const token = localStorage.getItem('klarke_token');
    if (!token) {
      navigate('/');
      return;
    }
    fetchCameras();
  }, [navigate]);

  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      html5QrCode = new window.Html5Qrcode("reader-cameras");
      const qrCodeSuccessCallback = (decodedText) => {
        setIsScannerOpen(false);
        html5QrCode.stop();

        // Busca automática e abertura do modal
        const match = cameras.find(c => 
          c.serial_number === decodedText || 
          c.id.toString() === decodedText ||
          c.name === decodedText
        );

        if (match) {
          openModal(match);
          toast.success(`Câmera Identificada: ${match.name}`);
        } else {
          setSearchTerm(decodedText);
          toast.error("Câmera não encontrada, filtrando lista...");
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
  }, [isScannerOpen, cameras]);

  const fetchCameras = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setCameras(response.data);
      if (manual) toast.success('Lista atualizada!');
    } catch (error) {
      console.error('Erro ao buscar câmeras:', error);
      if (manual) toast.error('Erro ao atualizar lista');
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'ip') {
      formattedValue = value.replace(/[^0-9.]/g, ''); // Apenas números e pontos
      formattedValue = formattedValue.replace(/\.\./g, '.'); // Evita pontos duplos
    }

    if (name === 'port') {
      formattedValue = value.replace(/[^0-9]/g, '');
    }

    setFormData({ ...formData, [name]: formattedValue });
  };

  const openModal = (camera = null) => {
    if (camera) {
      setEditingCamera(camera);
      setFormData(camera);
    } else {
      setEditingCamera(null);
      setFormData({ name: '', ip: '', port: '', username: '', password: '', location: '', serial_number: '', rtsp_link: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCamera(null);
  };

  const saveCamera = async (e) => {
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

      if (editingCamera) {
        await axios.put(`${API_URL}/${editingCamera.id}`, formData, getAuthConfig());
        toast.success('Câmera atualizada!');
      } else {
        await axios.post(API_URL, { ...formData, created_by: user }, getAuthConfig());
        toast.success('Câmera cadastrada!');
      }
      fetchCameras();
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar câmera.');
    }
  };

  const deleteCamera = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir Câmera',
      message: 'Tem certeza que deseja remover esta câmera do sistema?',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/${id}`, getAuthConfig());
          toast.success('Câmera excluída!');
          fetchCameras();
          closeModal();
        } catch (error) {
          toast.error('Erro ao excluir câmera.');
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

  const copyFullData = (camera) => {
    const text = `Nome: ${camera.name}\nSérie: ${camera.serial_number || '-'}\nIP: ${camera.ip}\nPorta: ${camera.port}\nLocal: ${camera.location}\nUsuário: ${camera.username}\nSenha: ${camera.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Dados completos copiados!');
  };

  const handlePrintLabel = (camera) => {
    const printWindow = window.open('', '_blank');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(camera.serial_number || camera.name)}`;
    const kCode = camera.serial_number || `C${String(camera.id).padStart(3, '0')}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>ETIQUETA - ${kCode}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; font-family: 'Inter', sans-serif; }
            .sticker { width: 350px; height: 200px; border: 3px solid #0f172a; position: relative; overflow: hidden; background: white; }
            .header-bar { background: #0f172a; color: white; padding: 8px; text-align: center; font-weight: 900; font-size: 14px; letter-spacing: 2px; }
            .main-content { display: flex; padding: 10px; height: 135px; }
            .qr-side { flex: 0 0 130px; display: flex; align-items: center; justify-content: center; }
            .info-side { flex: 1; display: flex; flex-direction: column; justify-content: center; padding-left: 15px; border-left: 1px dashed #cbd5e1; }
            .k-number { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; line-height: 1; }
            .machine-name { font-size: 14px; font-weight: 700; color: #475569; margin-top: 5px; text-transform: uppercase; }
            .footer-tags { position: absolute; bottom: 0; width: 100%; background: #f8fafc; border-top: 1px solid #0f172a; display: flex; justify-content: space-between; padding: 4px 10px; font-size: 9px; font-weight: 800; color: #0f172a; box-sizing: border-box; }
            @media print { .sticker { border: 4px solid #000; } }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
          <div class="sticker">
            <div class="header-bar">KLARKE SOLUTIONS - CÂMERAS</div>
            <div class="main-content">
              <div class="qr-side"><img src="${qrUrl}" width="110" height="110" /></div>
              <div class="info-side">
                <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 2px;">PATRIMÔNIO / ID</div>
                <div class="k-number">${kCode}</div>
                <div class="machine-name">${camera.name}</div>
                <div style="font-size: 10px; font-weight: 600; color: #94a3b8; margin-top: 8px;">IP: ${camera.ip || '---'}</div>
              </div>
            </div>
            <div class="footer-tags"><span>MONITORAMENTO ATIVO</span><span>KLARKE</span></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'IP', 'Porta', 'Local', 'Usuário', 'Senha', 'Série', 'Criado em'];
    const rows = cameras.map(c => [
      c.id, c.name, c.ip, c.port, c.location, c.username, c.password, c.serial_number, c.created_at
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'klarke_cameras.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const isOnline = (lastSeen) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen + 'Z');
    const now = new Date();
    const diffInMinutes = (now - lastSeenDate) / (1000 * 60);
    return diffInMinutes < 5;
  };

  const filtered = cameras.filter(c => 
    (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.ip?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.location?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.serial_number?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Lógica de Paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <>
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
            onClick={() => fetchCameras(true)}
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
          <button className="btn-action-square" onClick={exportToCSV} title="Exportar CSV">
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
              <div id="reader-cameras" style={{width: '100%', minHeight: '300px', background: '#000', borderRadius: '8px', overflow: 'hidden'}}></div>
              <p style={{marginTop: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>
                Aponte a câmera para o QR Code da etiqueta.
              </p>
          </div>
        </div>
      )}

      {cameras.length === 0 ? (
        <div className="empty-state">
          <Camera className="empty-icon" size={64} />
          <h2>Nenhuma câmera cadastrada</h2>
          <p>Adicione as credenciais de acesso às suas câmeras/NVR.</p>
        </div>
      ) : (
        <div className="machines-grid">
          {currentItems.map(camera => (
            <div key={camera.id} className="machine-card" onClick={() => openModal(camera)}>
              <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <div 
                    title={isOnline(camera.last_seen) ? 'Online' : 'Offline'}
                    style={{
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: isOnline(camera.last_seen) ? '#10b981' : '#ef4444'
                    }} 
                  />
                  <div>
                    <span className="machine-title" style={{display: 'block'}}>{camera.name || 'Câmera'}</span>
                    <span style={{fontSize: '0.75rem', color: 'var(--color-text-muted)'}}>
                      {camera.created_at ? new Date(camera.created_at).toLocaleString() : ''}
                    </span>
                  </div>
                </div>
                <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                  <span className="machine-location">
                    <MapPin size={12} style={{display: 'inline', marginRight: 4}} />
                    {camera.location || 'Sem local'}
                  </span>
                  <button className="copy-btn" title="Copiar Tudo" onClick={(e) => { e.stopPropagation(); copyFullData(camera); }}>
                    <Clipboard size={16} />
                  </button>
                  <button className="delete-btn" title="Excluir" onClick={(e) => { e.stopPropagation(); deleteCamera(camera.id); }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="machine-details-grid">
                <div className="detail-item">
                  <span className="detail-label">IP Address</span>
                  <span className="detail-value">
                    {camera.ip || '-'}
                    {camera.ip && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.ip, `ip-${camera.id}`); }}>
                        {copiedField === `ip-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Porta</span>
                  <span className="detail-value">{camera.port || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Usuário</span>
                  <span className="detail-value">
                    {camera.username || '-'}
                    {camera.username && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.username, `usr-${camera.id}`); }}>
                        {copiedField === `usr-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Senha</span>
                  <span className="detail-value">
                    ********
                    {camera.password && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.password, `pw-${camera.id}`); }}>
                        {copiedField === `pw-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nº Série</span>
                  <span className="detail-value">
                    {camera.serial_number || '-'}
                    {camera.serial_number && (
                      <button className="copy-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(camera.serial_number, `sn-${camera.id}`); }}>
                        {copiedField === `sn-${camera.id}` ? <Check size={14} color="#2ecc71" /> : <Copy size={14} />}
                      </button>
                    )}
                  </span>
                </div>
              </div>

              {camera.last_snapshot && (
                <div style={{marginTop: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)'}}>
                   <img 
                    src={`/uploads/${camera.last_snapshot}`} 
                    alt="Último Snapshot" 
                    style={{width: '100%', height: '180px', objectFit: 'cover', display: 'block'}}
                   />
                   <div style={{padding: '4px 8px', fontSize: '0.65rem', background: 'rgba(15, 23, 42, 0.9)', textAlign: 'right', color: 'var(--color-accent)', fontWeight: 'bold'}}>
                    CAPTURADA EM: {new Date(parseInt(camera.last_snapshot.split('_')[2].split('.')[0])).toLocaleString()}
                   </div>
                </div>
              )}
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
              <h2 className="modal-title">{editingCamera ? 'Editar Câmera' : 'Nova Câmera'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            
            <form onSubmit={saveCamera}>
              {editingCamera && editingCamera.last_snapshot && (
                <div style={{marginBottom: '20px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--color-accent)'}}>
                  <img src={`/uploads/${editingCamera.last_snapshot}`} style={{width: '100%', display: 'block'}} alt="Preview" />
                </div>
              )}
                {editingCamera && (
                  <div style={{marginBottom: '20px', padding: '12px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', borderRadius: '4px'}}>
                    <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '4px'}}>AUDITORIA DE CADASTRO</div>
                    <div style={{fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-primary)'}}>
                      POR: {editingCamera.created_by || 'Sistema'}
                    </div>
                    <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)'}}>
                      EM: {new Date((editingCamera.created_at || '').replace(' ', 'T') + 'Z').toLocaleString()}
                    </div>
                  </div>
                )}
                {editingCamera && formData.serial_number && (
                  <div className="qr-container">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(formData.serial_number)}`} 
                      alt="QR Code do Equipamento"
                    />
                    <p className="qr-label">QR Code de Identificação</p>
                  </div>
                )}
              <div className="form-group">
                <label className="form-label">Nome / Identificação</label>
                <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: Câmera Recepção ou NVR Central" />
              </div>

              <div className="form-group">
                <label className="form-label">Número de Série</label>
                <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: SN98765432" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">IP ou DDNS</label>
                  <input type="text" className="form-input" name="ip" value={formData.ip} onChange={handleInputChange} placeholder="192.168.x.x ou ddns.net" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Porta</label>
                  <input type="text" className="form-input" name="port" value={formData.port} onChange={handleInputChange} placeholder="Ex: 8080, 37777" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Link RTSP (Opcional para fotos)</label>
                <input type="text" className="form-input" name="rtsp_link" value={formData.rtsp_link} onChange={handleInputChange} placeholder="rtsp://user:pass@ip:port/stream" />
              </div>

              <div className="form-group">
                <label className="form-label">Localização</label>
                <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: Teto Corredor, CPD" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Usuário (Login)</label>
                  <input type="text" className="form-input" name="username" value={formData.username} onChange={handleInputChange} placeholder="admin" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Senha</label>
                  <input type="text" className="form-input" name="password" value={formData.password} onChange={handleInputChange} placeholder="senha forte" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block">
                {editingCamera ? 'Salvar Alterações' : 'Adicionar Câmera'}
              </button>
              
              {editingCamera && (
                <button type="button" className="btn btn-danger btn-block" onClick={() => deleteCamera(editingCamera.id)}>
                  Excluir Câmera
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

export default Cameras;
