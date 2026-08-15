import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Search, Plus, X, Copy, Camera, MapPin, Check, Download, Clipboard, Trash2, QrCode, RotateCw, Upload, ImageOff, Edit, HardDrive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';
import { COMPANY_OPTIONS, companyBadge } from '../utils/companies';

const API_URL = '/api/cameras';

// Tipos de equipamento (badge de diferenciação no card).
const TYPE_OPTIONS = [
  { value: 'CAMERA', label: 'Câmera' },
  { value: 'NVR', label: 'NVR / DVR' },
];
const typeMeta = (t) => (String(t || '').toUpperCase() === 'NVR')
  ? { label: 'NVR', cls: 'nvr' }
  : { label: 'Câmera', cls: 'cam' };

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
  const [snapshotPreview, setSnapshotPreview] = useState(null); // base64 da nova foto a enviar
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [lightbox, setLightbox] = useState(null); // URL da foto ampliada
  const navigate = useNavigate();

  // Fecha o lightbox com a tecla Esc
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // Extrai a data de captura do nome do arquivo (cam_serial_TIMESTAMP.jpg) de forma robusta.
  const snapTime = (fileName) => {
    const m = String(fileName || '').match(/_(\d+)\.jpg$/);
    return m ? new Date(parseInt(m[1])) : null;
  };

  // Lê o arquivo escolhido como base64, sem redimensionar (mantém a foto original).
  // O envio acontece ao salvar a câmera.
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione um arquivo de imagem.'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error('Imagem muito grande (máx. 25MB).'); return; }
    const reader = new FileReader();
    reader.onload = () => setSnapshotPreview(reader.result);
    reader.onerror = () => toast.error('Falha ao ler o arquivo.');
    reader.readAsDataURL(file);
  };

  const [formData, setFormData] = useState({
    name: '', ip: '', port: '', username: '', password: '', location: '', company: '', type: 'CAMERA', parent_id: '', serial_number: '', rtsp_link: ''
  });

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
    setSnapshotPreview(null);
    if (camera) {
      setEditingCamera(camera);
      setFormData(camera);
    } else {
      setEditingCamera(null);
      setFormData({ name: '', ip: '', port: '', username: '', password: '', location: '', company: '', type: 'CAMERA', parent_id: '', serial_number: '', rtsp_link: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCamera(null);
    setSnapshotPreview(null);
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

      let camId = editingCamera?.id;
      if (editingCamera) {
        await axios.put(`${API_URL}/${editingCamera.id}`, formData, getAuthConfig());
      } else {
        const res = await axios.post(API_URL, { ...formData, created_by: user }, getAuthConfig());
        camId = res.data?.id;
      }

      // Se o usuário escolheu uma foto, envia agora (câmera já existe/tem id).
      if (snapshotPreview && camId) {
        setSavingPhoto(true);
        await axios.post(`${API_URL}/${camId}/snapshot`, { image: snapshotPreview }, getAuthConfig());
      }

      toast.success(editingCamera ? 'Câmera atualizada!' : 'Câmera cadastrada!');
      fetchCameras();
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar câmera.');
    } finally {
      setSavingPhoto(false);
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

  const exportToCSV = () => {
    const headers = ['ID', 'Nome', 'IP', 'Porta', 'Local', 'Usuário', 'Senha', 'Série', 'Criado em'];
    const csvRows = [headers.join(',')];
    
    cameras.forEach(c => {
      const row = [
        c.id,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.ip || '').replace(/"/g, '""')}"`,
        `"${(c.port || '').replace(/"/g, '""')}"`,
        `"${(c.location || '').replace(/"/g, '""')}"`,
        `"${(c.username || '').replace(/"/g, '""')}"`,
        `"${(c.password || '').replace(/"/g, '""')}"`,
        `"${(c.serial_number || '').replace(/"/g, '""')}"`,
        `"${(c.created_at || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'klarke_cameras.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exportação concluída!');
  };

  const isOnline = (lastSeen) => {
    return true; // Rede com IPs fixos: equipamentos sempre online
  };

  // Mapa id -> nome dos NVRs (pra mostrar de qual gravador o canal pertence)
  const nvrById = {};
  cameras.forEach(c => { if ((c.type || '').toUpperCase() === 'NVR') nvrById[c.id] = c.name; });
  const isNvr = (c) => (c.type || '').toUpperCase() === 'NVR';
  const parentName = (c) => (c.parent_id != null ? nvrById[c.parent_id] : null) || null;

  const filtered = cameras.filter(c => {
    const term = searchTerm.toLowerCase();
    return (c.name?.toLowerCase() || '').includes(term) ||
      (c.ip?.toLowerCase() || '').includes(term) ||
      (c.location?.toLowerCase() || '').includes(term) ||
      (c.serial_number?.toLowerCase() || '').includes(term) ||
      (parentName(c)?.toLowerCase() || '').includes(term);
  });

  // Agrupa: cada NVR seguido dos seus canais; câmeras avulsas no fim.
  const groupKey = (c) => isNvr(c) ? (c.name || '') : (parentName(c) || '~~~');
  const sorted = [...filtered].sort((a, b) => {
    const ga = groupKey(a).toLowerCase(), gb = groupKey(b).toLowerCase();
    if (ga !== gb) return ga.localeCompare(gb);
    const ta = isNvr(a) ? 0 : 1, tb = isNvr(b) ? 0 : 1; // NVR antes dos canais
    if (ta !== tb) return ta - tb;
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true });
  });

  // Lógica de Paginação
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sorted.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sorted.length / itemsPerPage);

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

      {lightbox && createPortal((
        <div className="cam-lightbox" onClick={() => setLightbox(null)}>
          <button className="cam-lightbox-close" onClick={() => setLightbox(null)} title="Fechar (Esc)"><X size={26} /></button>
          <img src={lightbox} alt="Foto da câmera" onClick={e => e.stopPropagation()} />
        </div>
      ), document.body)}

      {isScannerOpen && createPortal((
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
      ), document.body)}

      {cameras.length === 0 ? (
        <div className="empty-state">
          <Camera className="empty-icon" size={64} />
          <h2>Nenhuma câmera cadastrada</h2>
          <p>Adicione as credenciais de acesso às suas câmeras/NVR.</p>
        </div>
      ) : (
        <div className="cam-grid">
          {currentItems.map(camera => {
            const snapDate = snapTime(camera.last_snapshot);
            const badge = companyBadge(camera.company, camera.location);
            return (
              <div key={camera.id} className="cam-card">
                <div
                  className="cam-thumb"
                  onClick={() => camera.last_snapshot ? setLightbox(`/uploads/${camera.last_snapshot}`) : openModal(camera)}
                  title={camera.last_snapshot ? 'Ampliar foto' : 'Adicionar foto'}
                >
                  {camera.last_snapshot ? (
                    <img src={`/uploads/${camera.last_snapshot}`} alt={camera.name || 'Câmera'} />
                  ) : (
                    <div className="cam-thumb-empty"><ImageOff size={26} /><span>Sem foto</span></div>
                  )}
                  <div className="cam-thumb-grad" />
                  <span className={`cam-type-badge ${typeMeta(camera.type).cls}`}>{typeMeta(camera.type).label}</span>
                  <span className="cam-loc-badge"><MapPin size={11} />{camera.location || 'Sem local'}</span>
                  <div className="cam-thumb-bottom">
                    <span className="cam-name">{camera.name || 'Câmera'}</span>
                    {snapDate && <span className="cam-time">{snapDate.toLocaleString('pt-BR')}</span>}
                  </div>
                </div>

                <div className="cam-info">
                  <button className="cam-line" onClick={() => copyToClipboard(`${camera.ip || ''}${camera.port ? ':' + camera.port : ''}`, `ip-${camera.id}`)} title="Copiar IP">
                    <span className="cam-k">IP</span>
                    <span className="cam-v">{camera.ip || '-'}{camera.port ? `:${camera.port}` : ''}</span>
                    {copiedField === `ip-${camera.id}` ? <Check size={12} /> : <Copy size={12} className="cam-ic" />}
                  </button>
                  <button className="cam-line" onClick={() => copyToClipboard(camera.username || '', `usr-${camera.id}`)} title="Copiar usuário">
                    <span className="cam-k">USER</span>
                    <span className="cam-v">{camera.username || '-'}</span>
                    {copiedField === `usr-${camera.id}` ? <Check size={12} /> : <Copy size={12} className="cam-ic" />}
                  </button>
                  <button className="cam-line" onClick={() => copyToClipboard(camera.password || '', `pw-${camera.id}`)} title="Copiar senha">
                    <span className="cam-k">SENHA</span>
                    <span className="cam-v">••••••••</span>
                    {copiedField === `pw-${camera.id}` ? <Check size={12} /> : <Copy size={12} className="cam-ic" />}
                  </button>
                </div>

                <div className="cam-foot">
                  <div className="cam-foot-id">
                    {badge && <img src={badge.src} alt={badge.label} title={badge.label} className="cam-foot-badge" />}
                    {parentName(camera) ? (
                      <span className="cam-parent" title={`Canal do ${parentName(camera)}`}><HardDrive size={11} />{parentName(camera)}</span>
                    ) : (
                      <span className="cam-sn" title="Número de série">{camera.serial_number || 'sem série'}</span>
                    )}
                  </div>
                  <div className="cam-acts">
                    <button className="cam-act" title="Copiar tudo" onClick={() => copyFullData(camera)}><Clipboard size={14} /></button>
                    <button className="cam-act" title="Editar" onClick={() => openModal(camera)}><Edit size={14} /></button>
                    <button className="cam-act danger" title="Excluir" onClick={() => deleteCamera(camera.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
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

      {isModalOpen && createPortal((
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-compact" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCamera ? 'Editar Câmera' : 'Nova Câmera'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>

            <form onSubmit={saveCamera}>
              {/* Foto (upload manual) */}
              <div className="cam-upload">
                <div className="cam-upload-preview">
                  {snapshotPreview ? (
                    <img src={snapshotPreview} alt="Nova foto" />
                  ) : editingCamera?.last_snapshot ? (
                    <img src={`/uploads/${editingCamera.last_snapshot}`} alt="Foto atual" />
                  ) : (
                    <div className="cam-upload-empty"><ImageOff size={22} /><span>Sem foto</span></div>
                  )}
                </div>
                <div className="cam-upload-side">
                  <label className="btn-upload">
                    <Upload size={15} />
                    {snapshotPreview || editingCamera?.last_snapshot ? 'Trocar foto' : 'Enviar foto'}
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} hidden />
                  </label>
                  {snapshotPreview && (
                    <button type="button" className="btn-upload-clear" onClick={() => setSnapshotPreview(null)}>Cancelar</button>
                  )}
                  <span className="cam-upload-hint">JPG/PNG · foto atualizada manualmente.</span>
                </div>
              </div>

              {editingCamera && (
                <div className="audit-strip">
                  <span>Cadastrado por <b>{editingCamera.created_by || 'Sistema'}</b></span>
                  {editingCamera.created_at && <span>· {new Date((editingCamera.created_at || '').replace(' ', 'T') + 'Z').toLocaleDateString()}</span>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nome / Identificação</label>
                <input required type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: Câmera Recepção ou NVR Central" />
              </div>

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Tipo</label>
                  <select className="form-input" name="type" value={formData.type || 'CAMERA'} onChange={handleInputChange}>
                    {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Empresa</label>
                  <select className="form-input" name="company" value={formData.company || ''} onChange={handleInputChange}>
                    <option value="">— Selecione —</option>
                    {COMPANY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {(formData.type || 'CAMERA').toUpperCase() !== 'NVR' && (
                <div className="form-group">
                  <label className="form-label">Pertence ao NVR / Gravador</label>
                  <select className="form-input" name="parent_id" value={formData.parent_id || ''} onChange={handleInputChange}>
                    <option value="">— Nenhum (câmera avulsa) —</option>
                    {cameras
                      .filter(c => (c.type || '').toUpperCase() === 'NVR' && c.id !== editingCamera?.id)
                      .map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              )}

              <div className="machine-details-grid-form">
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Número de Série</label>
                  <input type="text" className="form-input" name="serial_number" value={formData.serial_number} onChange={handleInputChange} placeholder="Ex: SN98765432" />
                </div>
                <div className="form-group" style={{marginBottom: 0}}>
                  <label className="form-label">Localização</label>
                  <input type="text" className="form-input" name="location" value={formData.location} onChange={handleInputChange} placeholder="Ex: Teto Corredor, CPD" />
                </div>
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

              <button type="submit" className="btn btn-primary btn-block" disabled={savingPhoto}>
                {savingPhoto ? 'Enviando foto...' : (editingCamera ? 'Salvar Alterações' : 'Adicionar Câmera')}
              </button>

              {editingCamera && (
                <button type="button" className="btn btn-danger btn-block" onClick={() => deleteCamera(editingCamera.id)}>
                  Excluir Câmera
                </button>
              )}
            </form>
          </div>
        </div>
      ), document.body)}
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
