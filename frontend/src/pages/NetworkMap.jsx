import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Building2, Store, Factory, Server, Globe, Home as HomeIcon, 
  Plus, X, Monitor, Router as RouterIcon,
  Network,
  Camera, Phone, Clipboard, Check, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

const ICON_OPTIONS = [
  { value: 'building', label: 'Escritório / Prédio', component: Building2 },
  { value: 'store', label: 'Loja / Filial', component: Store },
  { value: 'factory', label: 'Depósito / Fábrica', component: Factory },
  { value: 'server', label: 'Datacenter / Servidores', component: Server },
  { value: 'globe', label: 'Nuvem / Central', component: Globe },
  { value: 'home', label: 'Home Office / Apoio', component: HomeIcon }
];

function NetworkMap() {
  const [locations, setLocations] = useState([]);
  const [machines, setMachines] = useState([]);
  const [devices, setDevices] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [activeTab, setActiveTab] = useState('machines');
  const [showConfirm, setShowConfirm] = useState(false);
  const [locToDelete, setLocToDelete] = useState(null);
  
  // Drag & Drop State
  const [positions, setPositions] = useState({});
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  
  // Pan (Arrastabilidade do fundo) State
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [copiedField, setCopiedField] = useState(null);
  const svgRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    icon: 'building'
  });

  const fetchData = async (initialize = false) => {
    try {
      const [resLoc, resMach, resDev, resCam, resVoip] = await Promise.all([
        axios.get('/api/network-locations', getAuthConfig()),
        axios.get('/api/machines', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/network-devices', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/cameras', getAuthConfig()).catch(() => ({ data: [] })),
        axios.get('/api/voip', getAuthConfig()).catch(() => ({ data: [] }))
      ]);

      setLocations(resLoc.data);
      setMachines(resMach.data);
      setDevices(resDev.data);
      setCameras(resCam.data);
      setExtensions(resVoip.data);

      if (initialize || Object.keys(positions).length === 0) {
        initializePositions(resLoc.data, resMach.data, resDev.data, resCam.data, resVoip.data);
      }
    } catch (e) {
      toast.error('Erro ao carregar dados do mapa');
    }
  };

  useEffect(() => {
    fetchData();
    document.body.classList.add('network-map-page-active');
    const interval = setInterval(() => fetchData(false), 30000);
    return () => {
      clearInterval(interval);
      document.body.classList.remove('network-map-page-active');
    };
  }, []);

  const initializePositions = (locationsData, machinesData, devicesData, camerasData, extensionsData) => {
    const saved = localStorage.getItem('klarke_network_map_positions');
    let pos = saved ? JSON.parse(saved) : {};

    const width = 2000;
    const height = 1200;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Nó Core Central (Internet/Borda)
    if (!pos['central_core']) {
      pos['central_core'] = { x: centerX, y: centerY };
    }

    // 2. Distribuir filiais (locais) em um círculo
    const numLocations = locationsData.length;
    locationsData.forEach((loc, idx) => {
      const angle = (idx / (numLocations || 1)) * 2 * Math.PI;
      const radius = 520;
      const locX = centerX + radius * Math.cos(angle);
      const locY = centerY + radius * Math.sin(angle);
      const locKey = `loc_${loc.id}`;

      if (!pos[locKey]) {
        pos[locKey] = { x: locX, y: locY };
      }

      // 3. Agrupar dispositivos deste local por localização correspondente
      const normLoc = loc.name.toUpperCase();
      const locMach = machinesData.filter(m => m.location && m.location.toUpperCase().includes(normLoc));
      const locDev = devicesData.filter(d => d.location && d.location.toUpperCase().includes(normLoc));
      const locCam = camerasData.filter(c => c.location && c.location.toUpperCase().includes(normLoc));
      const locVoip = extensionsData.filter(v => v.notes && v.notes.toUpperCase().includes(normLoc));

      const allItems = [
        ...locMach.map(m => ({ key: `mach_${m.id}`, name: m.name })),
        ...locDev.map(d => ({ key: `dev_${d.id}`, name: d.name })),
        ...locCam.map(c => ({ key: `cam_${c.id}`, name: c.name })),
        ...locVoip.map(v => ({ key: `voip_${v.id}`, name: v.extension }))
      ];

      const numItems = allItems.length;
      allItems.forEach((item, itemIdx) => {
        if (!pos[item.key]) {
          const itemAngle = (itemIdx / (numItems || 1)) * 2 * Math.PI;
          const itemRadius = 195;
          pos[item.key] = {
            x: pos[locKey].x + itemRadius * Math.cos(itemAngle),
            y: pos[locKey].y + itemRadius * Math.sin(itemAngle)
          };
        }
      });
    });

    setPositions(pos);
    localStorage.setItem('klarke_network_map_positions', JSON.stringify(pos));
  };

  const handleResetLayout = () => {
    localStorage.removeItem('klarke_network_map_positions');
    setPositions({});
    fetchData(true);
    toast.success('Layout do mapa reorganizado automaticamente!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      await axios.post('/api/network-locations', {
        name: formData.name.toUpperCase(),
        icon: formData.icon
      }, getAuthConfig());
      toast.success('Local cadastrado com sucesso!');
      setFormData({ name: '', icon: 'building' });
      setIsModalOpen(false);
      fetchData(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar local');
    }
  };

  const handleDelete = (id) => {
    setLocToDelete(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!locToDelete) return;
    try {
      await axios.delete(`/api/network-locations/${locToDelete}`, getAuthConfig());
      toast.success('Local removido do mapa');
      fetchData(true);
    } catch (e) {
      toast.error('Erro ao remover local');
    }
  };

  // Drag & Drop Mouse Handlers
  const handleMouseDown = (nodeKey, e) => {
    e.stopPropagation();
    setDraggingNode(nodeKey);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handlePanStart = (e) => {
    // Só inicia se não estiver arrastando um nó
    if (!draggingNode) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleNodeClick = (item, e) => {
    e.stopPropagation();
    const dx = Math.abs(e.clientX - dragStartPos.x);
    const dy = Math.abs(e.clientY - dragStartPos.y);
    if (dx < 6 && dy < 6) {
      setSelectedNode(item);
      setSelectedLocation(null);
    }
  };

  const handleLocationClick = (loc, e) => {
    e.stopPropagation();
    const dx = Math.abs(e.clientX - dragStartPos.x);
    const dy = Math.abs(e.clientY - dragStartPos.y);
    if (dx < 6 && dy < 6) {
      setSelectedLocation(loc);
      setSelectedNode(null);
      // Seleciona a aba que possui dados, para não abrir uma aba vazia
      const normName = loc.name.toUpperCase();
      const machs = machines.filter(m => m.location && m.location.toUpperCase().includes(normName));
      const devs = devices.filter(d => d.location && d.location.toUpperCase().includes(normName));
      const cams = cameras.filter(c => c.location && c.location.toUpperCase().includes(normName));
      const vps = extensions.filter(v => v.notes && v.notes.toUpperCase().includes(normName));
      if (machs.length > 0) setActiveTab('machines');
      else if (devs.length > 0) setActiveTab('devices');
      else if (cams.length > 0) setActiveTab('cameras');
      else if (vps.length > 0) setActiveTab('voip');
      else setActiveTab('machines');
    }
  };

  const handleMouseMove = (e) => {
    if (draggingNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgWidth = 2000;
      const svgHeight = 1200;
      const x = ((e.clientX - rect.left) / rect.width) * svgWidth - panOffset.x;
      const y = ((e.clientY - rect.top) / rect.height) * svgHeight - panOffset.y;

      // Expandir imensamente os limites de drag para suportar um canvas infinito/livre
      const boundedX = Math.max(-10000, Math.min(10000, x));
      const boundedY = Math.max(-10000, Math.min(10000, y));

      setPositions(prev => {
        const updated = {
          ...prev,
          [draggingNode]: { x: Math.round(boundedX), y: Math.round(boundedY) }
        };
        localStorage.setItem('klarke_network_map_positions', JSON.stringify(updated));
        return updated;
      });
    } else if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
    setIsPanning(false);
  };

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copiado!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const renderIcon = (iconName, size = 18) => {
    switch (iconName) {
      case 'building': return <Building2 size={size} />;
      case 'store': return <Store size={size} />;
      case 'factory': return <Factory size={size} />;
      case 'server': return <Server size={size} />;
      case 'globe': return <Globe size={size} />;
      case 'home': return <HomeIcon size={size} />;
      default: return <Building2 size={size} />;
    }
  };

  // Montar nós e conexões lógicas
  const renderConnectionsAndNodes = () => {
    const lines = [];
    const nodeElements = [];
    const coreX = positions['central_core']?.x || 1000;
    const coreY = positions['central_core']?.y || 600;

    // Filtrar provedores de internet (ícone globe) e filiais normais
    const providersList = locations.filter(l => l.icon === 'globe');
    const branchesList = locations.filter(l => l.icon !== 'globe');

    // 1. Conectar filiais aos Provedores de Rede (Redundância WAN tracejada)
    branchesList.forEach(loc => {
      const locKey = `loc_${loc.id}`;
      const locPos = positions[locKey];
      if (locPos) {
        if (providersList.length === 0) {
          // Fallback ao Provedor Central virtual estático
          const midX = (coreX + locPos.x) / 2;
          const midY = (coreY + locPos.y) / 2;

          lines.push(
            <g key={`line_core_fallback_${loc.id}`}>
              <line 
                x1={coreX} y1={coreY} 
                x2={locPos.x} y2={locPos.y} 
                stroke="#94a3b8" 
                strokeWidth="5" 
                strokeDasharray="10,10"
                className="pulse-line"
              />
              <rect x={midX - 55} y={midY - 16} width="110" height="32" rx="6" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              <text x={midX} y={midY + 5} fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">VPN WAN</text>
            </g>
          );
        } else {
          // Conectar a filial a CADA provedor dinâmico criado!
          providersList.forEach(prov => {
            const provKey = `loc_${prov.id}`;
            const provPos = positions[provKey];
            if (provPos) {
              const midX = (provPos.x + locPos.x) / 2;
              const midY = (provPos.y + locPos.y) / 2;

              lines.push(
                <g key={`line_core_${prov.id}_${loc.id}`}>
                  <line 
                    x1={provPos.x} y1={provPos.y} 
                    x2={locPos.x} y2={locPos.y} 
                    stroke="#3b82f6" 
                    strokeWidth="5" 
                    strokeDasharray="10,10"
                    className="pulse-line"
                  />
                  <rect x={midX - 55} y={midY - 16} width="110" height="32" rx="6" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5" />
                  <text x={midX} y={midY + 5} fill="#93c5fd" fontSize="12" fontWeight="bold" textAnchor="middle">VPN WAN</text>
                </g>
              );
            }
          });
        }

        // 2. Conectar computadores e ativos daquela filial ao Gateway Local
        const normLoc = loc.name.toUpperCase();
        const locMach = machines.filter(m => m.location && m.location.toUpperCase().includes(normLoc));
        const locDev = devices.filter(d => d.location && d.location.toUpperCase().includes(normLoc));
        const locCam = cameras.filter(c => c.location && c.location.toUpperCase().includes(normLoc));
        const locVoip = extensions.filter(v => v.notes && v.notes.toUpperCase().includes(normLoc));

        const allItems = [
          ...locMach.map(m => ({ key: `mach_${m.id}`, data: m, type: 'machine', label: m.name, sub: m.ip })),
          ...locDev.map(d => ({ key: `dev_${d.id}`, data: d, type: 'device', label: d.name, sub: `${d.type} • ${d.ip}` })),
          ...locCam.map(c => ({ key: `cam_${c.id}`, data: c, type: 'camera', label: c.name, sub: c.ip })),
          ...locVoip.map(v => ({ key: `voip_${v.id}`, data: v, type: 'voip', label: `Ramal ${v.extension}`, sub: v.name }))
        ];

        allItems.forEach(item => {
          const itemPos = positions[item.key];
          if (itemPos) {
            const itemMidX = (locPos.x + itemPos.x) / 2;
            const itemMidY = (locPos.y + itemPos.y) / 2;

            lines.push(
              <g key={`line_${item.key}`}>
                <line 
                  x1={locPos.x} y1={locPos.y} 
                  x2={itemPos.x} y2={itemPos.y} 
                  stroke="#10b981" 
                  strokeWidth="3.5" 
                />
                {/* Tag de Velocidade LAN */}
                <rect x={itemMidX - 40} y={itemMidY - 12} width="80" height="24" rx="5" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
                <text x={itemMidX} y={itemMidY + 4} fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle">1 Gbps</text>
              </g>
            );

            // Renderizar Nós dos Equipamentos
            let iconComponent = <Monitor size={48} />;
            let nodeColor = '#3b82f6'; // Azul
            if (item.type === 'device') {
              iconComponent = <RouterIcon size={48} />;
              nodeColor = '#10b981'; // Verde
            } else if (item.type === 'camera') {
              iconComponent = <Camera size={48} />;
              nodeColor = '#f97316'; // Laranja
            } else if (item.type === 'voip') {
              iconComponent = <Phone size={48} />;
              nodeColor = '#a855f7'; // Roxo
            }

            nodeElements.push(
              <g 
                key={item.key}
                transform={`translate(${itemPos.x}, ${itemPos.y})`}
                className={`map-node-item ${draggingNode === item.key ? 'dragging' : ''}`}
                onMouseDown={(e) => handleMouseDown(item.key, e)}
                onClick={(e) => handleNodeClick(item, e)}
                style={{ cursor: 'grab' }}
              >
                <circle r="38" fill="#0f172a" stroke={nodeColor} strokeWidth="5" className="node-glow" />
                <foreignObject x="-24" y="-24" width="48" height="48" style={{ color: nodeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {iconComponent}
                </foreignObject>
                
                {/* Badge de fundo para texto legível */}
                <rect 
                  x="-110" 
                  y="48" 
                  width="220" 
                  height="50" 
                  rx="8" 
                  fill="#0c101b" 
                  stroke={nodeColor} 
                  strokeWidth="1.5" 
                  strokeOpacity="0.5"
                  fillOpacity="0.95"
                />
                <text y="67" className="node-text label" textAnchor="middle">{item.label}</text>
                <text y="87" className="node-text sub" textAnchor="middle">{item.sub || '---'}</text>
              </g>
            );
          }
        });

        // Renderizar Nó da Filial (Gateway local)
        nodeElements.push(
          <g 
            key={locKey}
            transform={`translate(${locPos.x}, ${locPos.y})`}
            className={`map-node-item location-node ${draggingNode === locKey ? 'dragging' : ''}`}
            onMouseDown={(e) => handleMouseDown(locKey, e)}
            onClick={(e) => handleLocationClick(loc, e)}
            style={{ cursor: 'grab' }}
          >
            {/* Desenha uma nuvem estilizada de fundo (ampliada) */}
            <path 
              d="M -30,-5 A 20,20 0 0,1 -10,-25 A 25,25 0 0,1 20,-20 A 20,20 0 0,1 30,5 A 15,15 0 0,1 15,20 A 25,25 0 0,1 -20,18 A 15,15 0 0,1 -30,-5 Z" 
              fill="#1e293b" 
              stroke="var(--color-accent)" 
              strokeWidth="4" 
              transform="scale(1.8)"
              className="cloud-glow"
            />
            <foreignObject x="-40" y="-40" width="80" height="80" style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {renderIcon(loc.icon, 76)}
            </foreignObject>
            
            {/* Badge de fundo para o Nome da Filial */}
            <rect 
              x="-140" 
              y="-115" 
              width="280" 
              height="40" 
              rx="8" 
              fill="#0c101b" 
              stroke="var(--color-accent)" 
              strokeWidth="2" 
              strokeOpacity="0.7"
              fillOpacity="0.95"
            />
            <text y="-89" className="node-text location-label" textAnchor="middle">{loc.name}</text>

            {/* Badge de fundo para o Status do Gateway */}
            <rect 
              x="-105" 
              y="75" 
              width="210" 
              height="34" 
              rx="6" 
              fill="#0c101b" 
              stroke="#10b981" 
              strokeWidth="1.5" 
              strokeOpacity="0.6"
              fillOpacity="0.95"
            />
            <text y="98" className="node-text location-sub" textAnchor="middle">GATEWAY ACTV</text>
            
            {/* Botão deletar local diretamente no nó do mapa */}
            <g transform="translate(48, -48)" className="node-delete-trigger" onClick={(e) => { e.stopPropagation(); handleDelete(loc.id); }} style={{cursor: 'pointer'}}>
              <circle r="14" fill="#ef4444" />
              <text y="4" fontSize="13" fontWeight="bold" fill="white" textAnchor="middle">X</text>
            </g>
          </g>
        );
      }
    });

    // 2. Renderizar os Provedores Dinâmicos Criados
    providersList.forEach(prov => {
      const provKey = `loc_${prov.id}`;
      const provPos = positions[provKey];
      if (provPos) {
        nodeElements.push(
          <g 
            key={provKey}
            transform={`translate(${provPos.x}, ${provPos.y})`}
            className={`map-node-item location-node central-core-node ${draggingNode === provKey ? 'dragging' : ''}`}
            onMouseDown={(e) => handleMouseDown(provKey, e)}
            onClick={(e) => handleLocationClick(prov, e)}
            style={{ cursor: 'grab' }}
          >
            <circle r="60" fill="#0f172a" stroke="#3b82f6" strokeWidth="8" className="core-glow" />
            <foreignObject x="-48" y="-48" width="96" height="96" style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={90} />
            </foreignObject>

            {/* Badge de fundo para o Nome do Provedor */}
            <rect 
              x="-170" 
              y="-145" 
              width="340" 
              height="46" 
              rx="8" 
              fill="#0c101b" 
              stroke="#3b82f6" 
              strokeWidth="2.5" 
              strokeOpacity="0.8"
              fillOpacity="0.95"
            />
            <text y="-113" className="node-text core-label" textAnchor="middle">{prov.name}</text>
            
            {/* Badge de fundo para o Subtexto */}
            <rect 
              x="-120" 
              y="80" 
              width="240" 
              height="36" 
              rx="6" 
              fill="#0c101b" 
              stroke="#3b82f6" 
              strokeWidth="1.5" 
              strokeOpacity="0.6"
              fillOpacity="0.95"
            />
            <text y="104" className="node-text core-sub" textAnchor="middle">PROVEDOR ACTV</text>

            {/* Botão deletar provedor diretamente no nó do mapa */}
            <g transform="translate(48, -48)" className="node-delete-trigger" onClick={(e) => { e.stopPropagation(); handleDelete(prov.id); }} style={{cursor: 'pointer'}}>
              <circle r="14" fill="#ef4444" />
              <text y="4" fontSize="13" fontWeight="bold" fill="white" textAnchor="middle">X</text>
            </g>
          </g>
        );
      }
    });

    // 3. Renderizar o Provedor Central padrão estático se a lista de provedores for vazia (Fallback)
    if (providersList.length === 0) {
      nodeElements.push(
        <g 
          key="central_core"
          transform={`translate(${coreX}, ${coreY})`}
          className={`map-node-item central-core-node ${draggingNode === 'central_core' ? 'dragging' : ''}`}
          onMouseDown={(e) => handleMouseDown('central_core', e)}
          style={{ cursor: 'grab' }}
        >
          <circle r="60" fill="#0f172a" stroke="#3b82f6" strokeWidth="8" className="core-glow" />
          <foreignObject x="-48" y="-48" width="96" height="96" style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={90} />
          </foreignObject>

          <rect 
            x="-170" 
            y="-145" 
            width="340" 
            height="46" 
            rx="8" 
            fill="#0c101b" 
            stroke="#3b82f6" 
            strokeWidth="2.5" 
            strokeOpacity="0.8"
            fillOpacity="0.95"
          />
          <text y="-113" className="node-text core-label" textAnchor="middle">PROVEDOR CENTRAL</text>
          
          <rect 
            x="-120" 
            y="80" 
            width="240" 
            height="36" 
            rx="6" 
            fill="#0c101b" 
            stroke="#3b82f6" 
            strokeWidth="1.5" 
            strokeOpacity="0.6"
            fillOpacity="0.95"
          />
          <text y="104" className="node-text core-sub" textAnchor="middle">INTERNET / FIBRA</text>
        </g>
      );
    }

    return { lines, nodeElements };
  };

  const { lines, nodeElements } = renderConnectionsAndNodes();

  // Filtrar os dispositivos para a filial selecionada
  const getSelectedLocationData = () => {
    if (!selectedLocation) return { machinesList: [], devicesList: [], camerasList: [], voipList: [] };
    const normName = selectedLocation.name.toUpperCase();
    return {
      machinesList: machines.filter(m => m.location && m.location.toUpperCase().includes(normName)),
      devicesList: devices.filter(d => d.location && d.location.toUpperCase().includes(normName)),
      camerasList: cameras.filter(c => c.location && c.location.toUpperCase().includes(normName)),
      voipList: extensions.filter(v => v.notes && v.notes.toUpperCase().includes(normName))
    };
  };

  const { machinesList, devicesList, camerasList, voipList } = getSelectedLocationData();
  const totalLocItems = machinesList.length + devicesList.length + camerasList.length + voipList.length;

  return (
    <div className="network-map-container" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="page-header" style={{ marginBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="industrial-icon" style={{ background: '#3b82f6', color: 'white', padding: '10px', borderRadius: '8px', boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)' }}>
            <Network size={24} />
          </div>
          <div>
            <h1 style={{ marginBottom: '4px', color: '#ffffff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Network Map</h1>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Physical connections and branch routing.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-header-reset" onClick={handleResetLayout} title="Reset Layout">
            <RefreshCw size={15} /> <span className="hide-mobile">Reset Layout</span>
          </button>
          <button className="btn-header-add" onClick={() => setIsModalOpen(true)} title="Add Branch">
            <Plus size={15} /> <span className="hide-mobile">Add Branch</span>
          </button>
        </div>
      </div>

      {/* CANVAS SVG TOPOLÓGICO */}
      <div 
        className="map-canvas-container"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : draggingNode ? 'grabbing' : 'grab' }}
      >
        <svg 
          ref={svgRef}
          viewBox="0 0 2000 1200" 
          width="100%" 
          height="100%"
          className="topological-svg"
        >
          {/* Grade de fundo industrial premium */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="url(#grid)" 
            onMouseDown={handlePanStart}
          />
 
          {/* Grupo de Pan para arrastabilidade total do fundo */}
          <g transform={`translate(${panOffset.x}, ${panOffset.y})`}>
            {/* Render das conexões (linhas de rede) */}
            {lines}
  
            {/* Render dos nós ativos e filiais */}
            {nodeElements}
          </g>
        </svg>
      </div>

      {/* MODAL CADASTRAR LOCAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cadastrar Local / Provedor</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome da Filial ou Provedor de Internet (Ex: MATRIZ ou VIVO LINK)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="Ex: VIVO FIBRA ou FILIAL 02"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '12px' }}>Ícone (Selecione Nuvem/Central para criar um Provedor)</label>
                <div className="icon-selector-grid">
                  {ICON_OPTIONS.map(opt => {
                    const IconComp = opt.component;
                    return (
                      <div 
                        key={opt.value} 
                        className={`icon-select-box ${formData.icon === opt.value ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, icon: opt.value })}
                        title={opt.label}
                      >
                        <IconComp size={24} />
                        <span>{opt.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '24px' }}>
                SALVAR LOCAL
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO EXCLUSÃO */}
      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmDelete}
        title="Remover Local do Mapa"
        message="Deseja realmente remover este local? Os computadores e aparelhos individuais continuarão salvos, apenas o local no mapa de rede será excluído."
      />

      {/* SIDEBAR DETALHES DO NÓ FLUTUANTE */}
      {selectedNode && (
        <div className="node-sidebar-backdrop" onClick={() => setSelectedNode(null)}>
          <div className="node-sidebar-panel" onClick={e => e.stopPropagation()}>
            <div className="node-sidebar-header">
              <h3>Detalhes do Dispositivo</h3>
              <button onClick={() => setSelectedNode(null)} className="close-btn"><X size={20} /></button>
            </div>
            
            <div className="node-sidebar-body">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', 
                  background: 'var(--color-primary-light)', color: 'var(--color-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px auto', border: '2px solid var(--color-accent)'
                }}>
                  {selectedNode.type === 'machine' && <Monitor size={32} />}
                  {selectedNode.type === 'device' && <RouterIcon size={32} />}
                  {selectedNode.type === 'camera' && <Camera size={32} />}
                  {selectedNode.type === 'voip' && <Phone size={32} />}
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--color-text)', textTransform: 'uppercase' }}>
                  {selectedNode.label}
                </h2>
                <span style={{ fontSize: '0.7rem', color: '#10b981', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                  CONEXÃO LAN ATIVA
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedNode.data.ip && (
                  <div className="sidebar-detail-item">
                    <span className="sidebar-detail-label">Endereço IP</span>
                    <div className="sidebar-detail-value">
                      <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{selectedNode.data.ip || selectedNode.data.ip_address}</span>
                      <button className="copy-btn" onClick={() => copyToClipboard(selectedNode.data.ip || selectedNode.data.ip_address, 'ip')}>
                        {copiedField === 'ip' ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {selectedNode.data.mac && (
                  <div className="sidebar-detail-item">
                    <span className="sidebar-detail-label">Endereço MAC</span>
                    <div className="sidebar-detail-value">
                      <span style={{ fontFamily: 'monospace' }}>{selectedNode.data.mac}</span>
                      <button className="copy-btn" onClick={() => copyToClipboard(selectedNode.data.mac, 'mac')}>
                        {copiedField === 'mac' ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                      </button>
                    </div>
                  </div>
                )}

                {selectedNode.data.location && (
                  <div className="sidebar-detail-item">
                    <span className="sidebar-detail-label">Setor / Localização</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>{selectedNode.data.location}</span>
                  </div>
                )}

                {selectedNode.type === 'machine' && (
                  <>
                    {selectedNode.data.anydesk_id && (
                      <div className="sidebar-detail-item">
                        <span className="sidebar-detail-label">AnyDesk ID</span>
                        <div className="sidebar-detail-value">
                          <span>{selectedNode.data.anydesk_id}</span>
                          <button className="copy-btn" onClick={() => copyToClipboard(selectedNode.data.anydesk_id, 'anydesk')}>
                            {copiedField === 'anydesk' ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedNode.data.rustdesk_id && (
                      <div className="sidebar-detail-item">
                        <span className="sidebar-detail-label">RustDesk ID</span>
                        <div className="sidebar-detail-value">
                          <span>{selectedNode.data.rustdesk_id}</span>
                          <button className="copy-btn" onClick={() => copyToClipboard(selectedNode.data.rustdesk_id, 'rustdesk')}>
                            {copiedField === 'rustdesk' ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedNode.data.password && (
                      <div className="sidebar-detail-item">
                        <span className="sidebar-detail-label">Senha de Acesso</span>
                        <div className="sidebar-detail-value">
                          <span style={{ fontFamily: 'monospace' }}>{selectedNode.data.password}</span>
                          <button className="copy-btn" onClick={() => copyToClipboard(selectedNode.data.password, 'password')}>
                            {copiedField === 'password' ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'device' && (
                  <>
                    <div className="sidebar-detail-item">
                      <span className="sidebar-detail-label">Tipo de Equipamento</span>
                      <span>{selectedNode.data.type}</span>
                    </div>
                    {selectedNode.data.username && (
                      <div className="sidebar-detail-item">
                        <span className="sidebar-detail-label">Usuário</span>
                        <span style={{ fontWeight: 'bold' }}>{selectedNode.data.username}</span>
                      </div>
                    )}
                    {selectedNode.data.password && (
                      <div className="sidebar-detail-item">
                        <span className="sidebar-detail-label">Senha de Acesso</span>
                        <div className="sidebar-detail-value">
                          <span style={{ fontFamily: 'monospace' }}>{selectedNode.data.password}</span>
                          <button className="copy-btn" onClick={() => copyToClipboard(selectedNode.data.password, 'pass_dev')}>
                            {copiedField === 'pass_dev' ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR DETALHES DA FILIAL E SEUS DISPOSITIVOS */}
      {selectedLocation && (
        <div className="node-sidebar-backdrop" onClick={() => setSelectedLocation(null)}>
          <div className="node-sidebar-panel" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="node-sidebar-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ color: 'var(--color-accent)', display: 'flex', alignItems: 'center' }}>
                  {renderIcon(selectedLocation.icon, 24)}
                </div>
                <div>
                  <h3 style={{ textTransform: 'uppercase', margin: 0, fontWeight: '900', letterSpacing: '0.5px' }}>{selectedLocation.name}</h3>
                  <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold' }}>REDES & SUB-ESTAÇÃO</span>
                </div>
              </div>
              <button onClick={() => setSelectedLocation(null)} className="close-btn"><X size={20} /></button>
            </div>
            
            <div className="node-sidebar-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Painel Resumo Estatístico */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '8px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                textAlign: 'center'
              }}>
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Computadores</span>
                  <strong style={{ fontSize: '1.75rem', color: 'var(--color-text)', fontFamily: 'monospace' }}>{machinesList.length}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Dispositivos</span>
                  <strong style={{ fontSize: '1.75rem', color: 'var(--color-accent)', fontFamily: 'monospace' }}>{totalLocItems}</strong>
                </div>
              </div>

              {/* Seletor de Abas (Tabs) Moderno com ícones */}
              <div style={{
                display: 'flex',
                background: '#0f172a',
                padding: '4px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                gap: '4px'
              }}>
                <button
                  onClick={() => setActiveTab('machines')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '6px',
                    background: activeTab === 'machines' ? 'var(--color-surface)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'machines' ? '#3b82f6' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                >
                  <Monitor size={16} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>PCs ({machinesList.length})</span>
                </button>
                
                <button
                  onClick={() => setActiveTab('devices')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '6px',
                    background: activeTab === 'devices' ? 'var(--color-surface)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'devices' ? '#10b981' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                >
                  <RouterIcon size={16} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>Rede ({devicesList.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('cameras')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '6px',
                    background: activeTab === 'cameras' ? 'var(--color-surface)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'cameras' ? '#f97316' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                >
                  <Camera size={16} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>CFTV ({camerasList.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('voip')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 4px',
                    borderRadius: '6px',
                    background: activeTab === 'voip' ? 'var(--color-surface)' : 'transparent',
                    border: 'none',
                    color: activeTab === 'voip' ? '#a855f7' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    gap: '4px'
                  }}
                >
                  <Phone size={16} />
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold' }}>VoIP ({voipList.length})</span>
                </button>
              </div>

              {/* Lista dos Dispositivos da Aba Selecionada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {activeTab === 'machines' && (
                  <>
                    {machinesList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        Nenhum computador cadastrado neste local.
                      </div>
                    ) : (
                      machinesList.map(mach => (
                        <div key={mach.id} style={{
                          background: 'var(--color-primary-light)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--color-text)', textTransform: 'uppercase' }}>{mach.name}</strong>
                            <span style={{ fontSize: '0.65rem', background: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              ONLINE (FIXO)
                            </span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>IP</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{mach.ip}</span>
                                <button className="copy-btn" onClick={() => copyToClipboard(mach.ip, `mach_ip_${mach.id}`)}>
                                  {copiedField === `mach_ip_${mach.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                </button>
                              </div>
                            </div>
                            {mach.mac && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>MAC</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span style={{ fontFamily: 'monospace' }}>{mach.mac}</span>
                                  <button className="copy-btn" onClick={() => copyToClipboard(mach.mac, `mach_mac_${mach.id}`)}>
                                    {copiedField === `mach_mac_${mach.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                            {mach.anydesk_id && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>AnyDesk</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span>{mach.anydesk_id}</span>
                                  <button className="copy-btn" onClick={() => copyToClipboard(mach.anydesk_id, `mach_ad_${mach.id}`)}>
                                    {copiedField === `mach_ad_${mach.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                  </button>
                                </div>
                              </div>
                            )}
                            {mach.rustdesk_id && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>RustDesk</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span>{mach.rustdesk_id}</span>
                                  <button className="copy-btn" onClick={() => copyToClipboard(mach.rustdesk_id, `mach_rd_${mach.id}`)}>
                                    {copiedField === `mach_rd_${mach.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {mach.password && (
                            <div style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div>
                                <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>Senha Remota</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--color-text)' }}>{mach.password}</span>
                              </div>
                              <button className="copy-btn" onClick={() => copyToClipboard(mach.password, `mach_pwd_${mach.id}`)}>
                                {copiedField === `mach_pwd_${mach.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeTab === 'devices' && (
                  <>
                    {devicesList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        Nenhum dispositivo de rede cadastrado neste local.
                      </div>
                    ) : (
                      devicesList.map(dev => (
                        <div key={dev.id} style={{
                          background: 'var(--color-primary-light)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--color-text)', textTransform: 'uppercase' }}>{dev.name}</strong>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {dev.type}
                            </span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>IP de Gerência</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{dev.ip}</span>
                                <button className="copy-btn" onClick={() => copyToClipboard(dev.ip, `dev_ip_${dev.id}`)}>
                                  {copiedField === `dev_ip_${dev.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                </button>
                              </div>
                            </div>
                            {dev.mac && (
                              <div>
                                <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>MAC Address</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span style={{ fontFamily: 'monospace' }}>{dev.mac}</span>
                                  <button className="copy-btn" onClick={() => copyToClipboard(dev.mac, `dev_mac_${dev.id}`)}>
                                    {copiedField === `dev_mac_${dev.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {(dev.username || dev.password) && (
                            <div style={{ 
                              background: '#0f172a', 
                              padding: '10px 12px', 
                              borderRadius: '6px', 
                              display: 'grid', 
                              gridTemplateColumns: dev.username && dev.password ? '1fr 1fr' : '1fr', 
                              gap: '10px',
                              border: '1px solid rgba(255,255,255,0.03)' 
                            }}>
                              {dev.username && (
                                <div>
                                  <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>Usuário</span>
                                  <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--color-text)' }}>{dev.username}</span>
                                </div>
                              )}
                              {dev.password && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', display: 'block' }}>Senha</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--color-text)' }}>{dev.password}</span>
                                  </div>
                                  <button className="copy-btn" onClick={() => copyToClipboard(dev.password, `dev_pwd_${dev.id}`)}>
                                    {copiedField === `dev_pwd_${dev.id}` ? <Check size={12} color="#10b981" /> : <Clipboard size={12} />}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeTab === 'cameras' && (
                  <>
                    {camerasList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        Nenhuma câmera cadastrada neste local.
                      </div>
                    ) : (
                      camerasList.map(cam => (
                        <div key={cam.id} style={{
                          background: 'var(--color-primary-light)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)', textTransform: 'uppercase', display: 'block' }}>{cam.name}</strong>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px' }}>{cam.ip}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="copy-btn" onClick={() => copyToClipboard(cam.ip, `cam_ip_${cam.id}`)} style={{ padding: '8px', borderRadius: '4px' }}>
                              {copiedField === `cam_ip_${cam.id}` ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                            </button>
                            <span style={{ fontSize: '0.65rem', background: '#ecfdf5', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              CFTV ATIVO
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {activeTab === 'voip' && (
                  <>
                    {voipList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        Nenhum ramal VoIP cadastrado neste local.
                      </div>
                    ) : (
                      voipList.map(vp => (
                        <div key={vp.id} style={{
                          background: 'var(--color-primary-light)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong style={{ fontSize: '1rem', color: 'var(--color-text)', fontFamily: 'monospace' }}>Ramal {vp.extension}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '4px', textTransform: 'uppercase' }}>{vp.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="copy-btn" onClick={() => copyToClipboard(vp.extension, `vp_ext_${vp.id}`)} style={{ padding: '8px', borderRadius: '4px' }}>
                              {copiedField === `vp_ext_${vp.id}` ? <Check size={14} color="#10b981" /> : <Clipboard size={14} />}
                            </button>
                            <span style={{ fontSize: '0.65rem', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              SIP CANAL
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        /* OVERRIDES PARA A PÁGINA DE MAPA DE REDE TODA AZUL (#0b0f19) */
        body.network-map-page-active {
          background-color: #0b0f19 !important;
          background: #0b0f19 !important;
          color: #f1f5f9 !important;
        }

        body.network-map-page-active .dashboard-layout {
          background-color: #0b0f19 !important;
          background: #0b0f19 !important;
        }

        body.network-map-page-active .bg-visuals {
          background-color: #0b0f19 !important;
          background: #0b0f19 !important;
        }

        body.network-map-page-active .bg-visuals .shape {
          display: none !important;
        }

        body.network-map-page-active .app-container {
          background-color: #0b0f19 !important;
          max-width: 100% !important; /* Esticar para preencher a tela inteira! */
          padding: 24px 40px !important;
        }

        body.network-map-page-active .page-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        .btn-header-reset, .btn-header-add {
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          padding: 8px 14px !important;
          border-radius: 8px !important;
          font-size: 0.75rem !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          height: 38px !important;
          box-sizing: border-box !important;
        }

        .btn-header-reset {
          background: #1e293b !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: #cbd5e1 !important;
        }

        .btn-header-reset:hover {
          background: #334155 !important;
          color: #ffffff !important;
          border-color: rgba(255, 255, 255, 0.25) !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;
        }

        .btn-header-add {
          background: #3b82f6 !important;
          border: none !important;
          color: #ffffff !important;
        }

        .btn-header-add:hover {
          background: #2563eb !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 0 14px rgba(59, 130, 246, 0.5) !important;
        }

        /* MODAIS EM TEMA ESCURO */
        body.network-map-page-active .modal-content {
          background-color: #0f172a !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #f1f5f9 !important;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5) !important;
        }

        body.network-map-page-active .modal-header h2 {
          color: #ffffff !important;
        }

        body.network-map-page-active .form-label {
          color: #cbd5e1 !important;
        }

        body.network-map-page-active .form-input {
          background-color: #1e293b !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #ffffff !important;
        }

        body.network-map-page-active .form-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
        }

        body.network-map-page-active .icon-selector-grid .icon-select-box {
          background-color: #1e293b !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #94a3b8 !important;
        }

        body.network-map-page-active .icon-selector-grid .icon-select-box:hover {
          background-color: #334155 !important;
          color: #ffffff !important;
        }

        body.network-map-page-active .icon-selector-grid .icon-select-box.selected {
          background-color: rgba(59, 130, 246, 0.15) !important;
          border-color: #3b82f6 !important;
          color: #3b82f6 !important;
          box-shadow: 0 0 0 2px #3b82f6 !important;
        }

        body.network-map-page-active .close-btn {
          color: #94a3b8 !important;
        }

        body.network-map-page-active .close-btn:hover {
          color: #ef4444 !important;
          background-color: rgba(239, 68, 68, 0.1) !important;
        }

        /* CONFIRM MODAL EM TEMA ESCURO */
        body.network-map-page-active .confirm-modal-content {
          background-color: #0f172a !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #f1f5f9 !important;
        }

        body.network-map-page-active .confirm-modal-body h3 {
          color: #ffffff !important;
        }

        body.network-map-page-active .confirm-modal-body p {
          color: #94a3b8 !important;
        }

        body.network-map-page-active .btn-confirm-cancel {
          background-color: #1e293b !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #ffffff !important;
        }

        body.network-map-page-active .btn-confirm-cancel:hover {
          background-color: #334155 !important;
        }

        /* SIDEBAR DE DETALHES EM TEMA ESCURO */
        body.network-map-page-active .node-sidebar-panel {
          background-color: #0f172a !important;
          border-left: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #f1f5f9 !important;
        }

        body.network-map-page-active .node-sidebar-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        body.network-map-page-active .node-sidebar-header h3 {
          color: #ffffff !important;
        }

        body.network-map-page-active .node-sidebar-panel .sidebar-detail-item {
          background-color: #1e293b !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          color: #ffffff !important;
        }

        body.network-map-page-active .node-sidebar-panel .sidebar-detail-label {
          color: #94a3b8 !important;
        }

        body.network-map-page-active .node-sidebar-panel .sidebar-detail-value {
          color: #ffffff !important;
        }

        body.network-map-page-active .node-sidebar-panel strong,
        body.network-map-page-active .node-sidebar-panel h2,
        body.network-map-page-active .node-sidebar-panel h3,
        body.network-map-page-active .node-sidebar-panel span {
          color: #ffffff !important;
        }

        body.network-map-page-active .node-sidebar-panel .sidebar-detail-value button {
          color: #3b82f6 !important;
        }

        body.network-map-page-active .node-sidebar-panel .sidebar-detail-value button:hover {
          background-color: rgba(59, 130, 246, 0.1) !important;
        }

        body.network-map-page-active .node-sidebar-panel [style*="color: var(--color-text)"] {
          color: #ffffff !important;
        }
        
        body.network-map-page-active .node-sidebar-panel [style*="color: var(--color-text-muted)"] {
          color: #94a3b8 !important;
        }

        body.network-map-page-active .node-sidebar-panel div[style*="background: var(--color-primary-light)"] {
          background-color: #1e293b !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
        }

        .map-canvas-container {
          width: 100%;
          height: calc(100vh - 200px);
          min-height: 600px;
          background: #0b0f19;
          border: none !important;
          border-radius: 0 !important;
          overflow: hidden;
          box-shadow: none !important;
          position: relative;
        }

        .topological-svg {
          display: block;
          user-select: none;
        }

        .map-node-item {
          transition: transform 0.1s ease-out;
        }

        .map-node-item circle, .map-node-item path {
          transition: filter 0.2s, stroke-width 0.2s;
        }

        .map-node-item:hover circle, .map-node-item:hover path {
          filter: brightness(1.2) drop-shadow(0 0 10px rgba(255,255,255,0.2));
          stroke-width: 4px;
        }

        .location-node:hover path {
          stroke-width: 5px;
        }

        .node-text {
          fill: white;
          font-family: 'Inter', sans-serif;
          pointer-events: none;
        }

        .node-text.label {
          font-size: 16px;
          font-weight: 800;
          fill: #f1f5f9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .node-text.sub {
          font-size: 13px;
          fill: #cbd5e1;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .node-text.location-label {
          font-size: 24px;
          font-weight: 900;
          fill: #e9d5ff;
          letter-spacing: 0.8px;
        }

        .node-text.location-sub {
          font-size: 15px;
          fill: #34d399;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .node-text.core-label {
          font-size: 28px;
          font-weight: 900;
          fill: #93c5fd;
          letter-spacing: 0.8px;
        }

        .node-text.core-sub {
          font-size: 18px;
          fill: #60a5fa;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        /* GLOW EFFECTS */
        .node-glow {
          filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.4));
        }

        .cloud-glow {
          filter: drop-shadow(0 0 8px rgba(162, 85, 247, 0.3));
        }

        .core-glow {
          filter: drop-shadow(0 0 12px rgba(15, 23, 42, 0.5));
        }

        .dragging circle, .dragging path {
          stroke: white !important;
          filter: brightness(1.3) drop-shadow(0 0 15px white) !important;
        }

        .pulse-line {
          animation: dash 30s linear infinite;
        }

        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }

        /* DELETAR LOCAL MAPA */
        .node-delete-trigger {
          opacity: 0;
          transition: opacity 0.2s;
        }

        .location-node:hover .node-delete-trigger {
          opacity: 0.9;
        }

        .node-delete-trigger:hover {
          opacity: 1 !important;
        }

        /* SELETOR ICONES */
        .icon-selector-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .icon-select-box {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
          color: var(--color-text-muted);
        }

        .icon-select-box:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: var(--color-primary);
        }

        .icon-select-box.selected {
          border-color: var(--color-accent);
          background: var(--color-primary-light);
          color: var(--color-accent);
          box-shadow: 0 0 0 2px var(--color-accent);
        }

        .icon-select-box span {
          font-size: 0.65rem;
          font-weight: bold;
        }

        /* SIDEBAR FLUTUANTE DE DETALHES */
        .node-sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 5000;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.2s ease-out;
        }

        .node-sidebar-panel {
          width: 100%;
          max-width: 420px;
          height: 100%;
          background: var(--color-surface);
          border-left: 1px solid var(--color-border);
          box-shadow: -8px 0 32px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .node-sidebar-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .node-sidebar-header h3 {
          margin: 0;
          font-size: 1.1rem;
          fontWeight: 900;
        }

        .node-sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .sidebar-detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: var(--color-primary-light);
          padding: 12px 16px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
        }

        .sidebar-detail-label {
          font-size: 0.65rem;
          color: var(--color-text-muted);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sidebar-detail-value {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          color: var(--color-text);
          font-size: 0.95rem;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  );
}

export default NetworkMap;
