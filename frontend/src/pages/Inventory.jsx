import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, Search, Box, Database, Trash2, Edit, X, Minus, PlusCircle, MapPin, Tag } from 'lucide-react';
import toast from 'react-hot-toast';

function Inventory() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    unit: 'un',
    category: 'Cabos',
    location: 'DML / Depósito',
    notes: ''
  });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    const user = localStorage.getItem('klarke_user') || 'Sistema';
    return { headers: { Authorization: `Bearer ${token}`, 'X-User': user } };
  };

  const fetchItems = async () => {
    try {
      const response = await axios.get('/api/inventory', getAuthConfig());
      setItems(response.data);
    } catch (e) {
      toast.error('Erro ao buscar estoque');
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.put(`/api/inventory/${editingItem.id}`, formData, getAuthConfig());
        toast.success('Item atualizado');
      } else {
        await axios.post('/api/inventory', formData, getAuthConfig());
        toast.success('Item adicionado!');
      }
      closeModal();
      fetchItems();
    } catch (err) {
      toast.error('Erro ao salvar');
    }
  };

  const updateQuantity = async (item, delta) => {
    const newQty = Math.max(0, item.quantity + delta);
    try {
      await axios.put(`/api/inventory/${item.id}`, { ...item, quantity: newQty }, getAuthConfig());
      fetchItems();
    } catch (e) {
      toast.error('Erro ao atualizar quantidade');
    }
  };

  const deleteItem = async (id) => {
    if (window.confirm('Excluir este item do estoque?')) {
      try {
        await axios.delete(`/api/inventory/${id}`, getAuthConfig());
        toast.success('Removido');
        fetchItems();
      } catch (e) {
        toast.error('Erro ao excluir');
      }
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({ name: '', quantity: 0, unit: 'un', category: 'Cabos', location: 'DML / Depósito', notes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const filtered = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="users-container">
      <div className="page-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div className="industrial-icon" style={{background: 'var(--color-primary)', color: 'white', padding: '10px', borderRadius: '8px'}}>
            <Package size={24} />
          </div>
          <div>
            <h1>Inventory</h1>
            <p>Controle de estoque técnico e ativos.</p>
          </div>
        </div>
        <button className="add-btn" onClick={() => openModal()}>
          <Plus size={16} /> <span className="hide-mobile">ADICIONAR ITEM</span>
        </button>
      </div>

      <div className="search-wrapper" style={{marginBottom: '24px'}}>
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar no estoque..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="machines-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Box size={64} className="empty-icon" />
            <h2>Estoque Vazio</h2>
            <p>Clique em "+ ADICIONAR ITEM" para começar.</p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} className="machine-card" style={{cursor: 'default', borderLeft: item.quantity === 0 ? '4px solid #ef4444' : '4px solid var(--color-accent)'}}>
              <div className="machine-header">
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <Box size={20} color={item.quantity === 0 ? '#ef4444' : 'var(--color-accent)'} />
                  <div>
                    <span className="machine-title" style={{fontSize: '1.1rem'}}>{item.name}</span>
                    <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block'}}>
                      {item.category} • {item.location}
                    </span>
                  </div>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button className="copy-btn" onClick={() => openModal(item)} title="Editar"><Edit size={16} /></button>
                  <button className="delete-btn" onClick={() => deleteItem(item.id)} title="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>

              <div style={{marginTop: '20px', background: 'rgba(0,0,0,0.02)', padding: '15px', borderRadius: '8px', textAlign: 'center'}}>
                <div style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase'}}>Quantidade em Mãos</div>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px'}}>
                  <button 
                    className="copy-btn" 
                    style={{padding: '8px', background: '#f1f5f9', borderRadius: '50%'}}
                    onClick={() => updateQuantity(item, -1)}
                  >
                    <Minus size={18} />
                  </button>
                  
                  <div style={{textAlign: 'center'}}>
                    <span style={{fontSize: '2.5rem', fontWeight: '900', color: item.quantity === 0 ? '#ef4444' : 'var(--color-primary)', lineHeight: 1}}>
                      {item.quantity}
                    </span>
                    <span style={{display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 'bold'}}>
                      {item.unit.toUpperCase()}
                    </span>
                  </div>

                  <button 
                    className="copy-btn" 
                    style={{padding: '8px', background: '#f1f5f9', borderRadius: '50%'}}
                    onClick={() => updateQuantity(item, 1)}
                  >
                    <PlusCircle size={18} />
                  </button>
                </div>
              </div>

              {item.notes && (
                <div style={{marginTop: '12px', fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '4px'}}>
                  <strong>Obs:</strong> {item.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" style={{maxWidth: '450px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? 'Editar Item' : 'Novo Item no Estoque'}</h2>
              <button className="close-btn" onClick={closeModal}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome do Item</label>
                <input 
                  type="text" required className="form-input" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Conector RJ45 CAT6 ou Cabo Coaxial"
                />
              </div>
              <div className="machine-details-grid-form">
                <div className="form-group">
                  <label className="form-label">Quantidade Inicial</label>
                  <input 
                    type="number" required className="form-input" 
                    value={formData.quantity} 
                    onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unidade</label>
                  <select 
                    className="form-input"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="m">Metros (m)</option>
                    <option value="cx">Caixa (cx)</option>
                    <option value="pct">Pacote (pct)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Categoria</label>
                <select 
                  className="form-input"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="Cabos">Cabos / Fios</option>
                  <option value="Conectores">Conectores / Adaptadores</option>
                  <option value="Cameras">Câmeras / Lentes</option>
                  <option value="Rede">Roteadores / Switches</option>
                  <option value="Fixação">Parafusos / Suportes</option>
                  <option value="Ferramentas">Ferramentas</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Localização (Onde está?)</label>
                <input 
                  type="text" className="form-input" 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})}
                  placeholder="Ex: Armário 01 ou Carro Matheus"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea 
                  className="form-input" rows="2"
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                  placeholder="Ex: Marca Furukawa ou Modelo específico"
                ></textarea>
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                {editingItem ? 'ATUALIZAR' : 'SALVAR NO ESTOQUE'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;
