import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Trash2, CheckCircle2, Clock, Filter, AlertCircle, 
  MessageSquare, User, Tag, Shield, Calendar, RefreshCw 
} from 'lucide-react';
import toast from 'react-hot-toast';

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchTickets = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await axios.get('/api/tickets', getAuthConfig());
      setTickets(response.data);
      if (manual) toast.success('Lista de chamados atualizada!');
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
      if (manual) toast.error('Erro ao atualizar chamados');
    } finally {
      if (manual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => fetchTickets(), 30000);
    return () => clearInterval(interval);
  }, []);

  const updateTicketStatus = async (id, newStatus) => {
    try {
      await axios.put(`/api/tickets/${id}`, { status: newStatus }, getAuthConfig());
      toast.success(`Chamado #${id} atualizado para ${newStatus}`);
      fetchTickets();
      if (selectedTicket && selectedTicket.id === id) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (error) {
      toast.error('Erro ao atualizar status do chamado');
    }
  };

  const deleteTicket = async (id) => {
    try {
      await axios.delete(`/api/tickets/${id}`, getAuthConfig());
      toast.success('Chamado removido com sucesso!');
      setSelectedTicket(null);
      setConfirmDelete({ open: false, id: null });
      fetchTickets();
    } catch (error) {
      toast.error('Erro ao excluir chamado');
    }
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.id).includes(searchTerm);
      
    const matchesStatus = statusFilter === 'Todos' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'Todos' || t.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Alta': return '#ef4444'; // Vermelho
      case 'Média': return '#f59e0b'; // Amarelo/Laranja
      case 'Baixa': return '#10b981'; // Verde
      default: return 'var(--color-text-muted)';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pendente': return 'status-badge pendente';
      case 'Em Atendimento': return 'status-badge em-atendimento';
      case 'Resolvido': return 'status-badge resolvido';
      default: return '';
    }
  };

  return (
    <>
      <header className="page-header" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Central de Chamados (Klarke Flow)</h1>
          <p>Gerencie as solicitações de suporte dos usuários da empresa.</p>
        </div>
      </header>

      {/* Filtros e Busca */}
      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por solicitante, assunto, descrição ou ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="action-buttons-group">
          {/* Filtro Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '0 12px' }}>
            <Filter size={16} color="var(--color-text-muted)" />
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', padding: '12px 4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
            >
              <option value="Todos">Todos os Status</option>
              <option value="Pendente">Pendentes</option>
              <option value="Em Atendimento">Em Atendimento</option>
              <option value="Resolvido">Resolvidos</option>
            </select>
          </div>

          {/* Filtro Prioridade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '0 12px' }}>
            <AlertCircle size={16} color="var(--color-text-muted)" />
            <select 
              value={priorityFilter} 
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', padding: '12px 4px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500' }}
            >
              <option value="Todos">Todas Prioridades</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
          </div>

          <button 
            className={`btn-refresh-sober ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => fetchTickets(true)}
            title="Atualizar Chamados"
            disabled={isRefreshing}
            style={{ width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyCenter: 'center', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1.2fr 1fr' : '1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Painel Esquerdo: Lista de Chamados */}
        <div>
          {filteredTickets.length === 0 ? (
            <div className="empty-state">
              <MessageSquare className="empty-icon" size={64} />
              <h2>Nenhum chamado encontrado</h2>
              <p>Não há chamados com os filtros atuais.</p>
            </div>
          ) : (
            <div className="machines-grid" style={{ gridTemplateColumns: '1fr' }}>
              {filteredTickets.map(ticket => (
                <div 
                  key={ticket.id} 
                  className={`machine-card ${selectedTicket?.id === ticket.id ? 'active-selection' : ''}`}
                  onClick={() => setSelectedTicket(ticket)}
                  style={{ 
                    borderLeft: `4px solid ${getPriorityColor(ticket.priority)}`,
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderColor: selectedTicket?.id === ticket.id ? 'var(--color-accent)' : ''
                  }}
                >
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--color-text-muted)', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '2px 6px' }}>
                        #{ticket.id}
                      </span>
                      <span className={getStatusBadgeClass(ticket.status)}>
                        {ticket.status}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> {new Date(ticket.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text)', marginBottom: '4px' }}>
                      {ticket.title}
                    </h3>
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={14} /> <strong>Solicitante:</strong> {ticket.requester}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={14} /> <strong>Categoria:</strong> {ticket.category}
                      </span>
                    </div>
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ display: 'flex', gap: '8px', zIndex: 2 }} onClick={e => e.stopPropagation()}>
                    {ticket.status === 'Pendente' && (
                      <button 
                        className="action-chip" 
                        onClick={() => updateTicketStatus(ticket.id, 'Em Atendimento')}
                        style={{ background: 'var(--color-accent)', color: 'white', border: 'none' }}
                      >
                        ATENDER
                      </button>
                    )}
                    {ticket.status !== 'Resolvido' && (
                      <button 
                        className="action-chip" 
                        onClick={() => updateTicketStatus(ticket.id, 'Resolvido')}
                        style={{ background: '#10b981', color: 'white', border: 'none' }}
                      >
                        RESOLVER
                      </button>
                    )}
                    <button 
                      className="action-chip delete"
                      onClick={() => setConfirmDelete({ open: true, id: ticket.id })}
                      title="Excluir Chamado"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Painel Direito: Detalhes do Chamado Selecionado */}
        {selectedTicket && (
          <div className="machine-card" style={{ cursor: 'default', background: 'var(--color-surface)', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                  DETALHES DO CHAMADO #{selectedTicket.id}
                </span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '4px' }}>{selectedTicket.title}</h2>
              </div>
              <button 
                className="close-btn" 
                onClick={() => setSelectedTicket(null)}
                style={{ padding: '6px' }}
              >
                fechar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Solicitante</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', marginTop: '4px', color: 'var(--color-text)' }}>{selectedTicket.requester}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Categoria</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', marginTop: '4px', color: 'var(--color-text)' }}>{selectedTicket.category}</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Prioridade</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', marginTop: '4px', color: getPriorityColor(selectedTicket.priority) }}>
                    {selectedTicket.priority}
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Status Atual</div>
                  <div style={{ marginTop: '6px' }}>
                    <span className={getStatusBadgeClass(selectedTicket.status)}>
                      {selectedTicket.status}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Descrição do Problema</div>
                <div style={{ 
                  background: 'rgba(0,0,0,0.03)', 
                  padding: '20px', 
                  borderRadius: '0px', 
                  fontFamily: 'var(--font-primary)', 
                  fontSize: '0.95rem', 
                  lineHeight: '1.6', 
                  whiteSpace: 'pre-wrap', 
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)' 
                }}>
                  {selectedTicket.description}
                </div>
              </div>

              {selectedTicket.photo && (() => {
                let photos = [];
                try {
                  if (typeof selectedTicket.photo === 'string' && selectedTicket.photo.startsWith('[')) {
                    photos = JSON.parse(selectedTicket.photo);
                  } else {
                    photos = [selectedTicket.photo];
                  }
                } catch (e) {
                  photos = [selectedTicket.photo];
                }

                return (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Foto(s) do Problema ({photos.length})
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '12px', 
                      border: '1px solid var(--color-border)', 
                      padding: '12px', 
                      background: 'rgba(0,0,0,0.02)',
                      justifyContent: 'flex-start'
                    }}>
                      {photos.map((photo, index) => (
                        <div key={index} style={{ border: '1px solid var(--color-border)', padding: '6px', background: 'var(--color-surface)', textAlign: 'center', minWidth: '120px', flex: '1 1 120px', maxWidth: '200px' }}>
                          <a href={`/uploads/${photo}`} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={`/uploads/${photo}`} 
                              alt={`Evidência ${index + 1}`} 
                              style={{ width: '100%', height: '120px', objectFit: 'cover', cursor: 'zoom-in', borderRadius: '4px' }} 
                            />
                          </a>
                          <div style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                            <a href={`/uploads/${photo}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--color-accent)', fontWeight: '600' }}>
                              Ver foto completa
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Ações de Resolução</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {selectedTicket.status !== 'Em Atendimento' && selectedTicket.status !== 'Resolvido' && (
                    <button 
                      className="btn" 
                      style={{ background: 'var(--color-accent)', color: 'white', marginTop: 0 }}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'Em Atendimento')}
                    >
                      Marcar "Em Atendimento"
                    </button>
                  )}
                  {selectedTicket.status !== 'Resolvido' && (
                    <button 
                      className="btn" 
                      style={{ background: '#10b981', color: 'white', marginTop: 0 }}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'Resolvido')}
                    >
                      Marcar "Resolvido"
                    </button>
                  )}
                  {selectedTicket.status === 'Resolvido' && (
                    <button 
                      className="btn" 
                      style={{ background: '#f59e0b', color: 'white', marginTop: 0 }}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'Pendente')}
                    >
                      Reabrir Chamado
                    </button>
                  )}
                  <button 
                    className="btn btn-danger" 
                    style={{ marginTop: 0 }}
                    onClick={() => setConfirmDelete({ open: true, id: selectedTicket.id })}
                  >
                    Excluir Chamado
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmação de Exclusão */}
      {confirmDelete.open && (
        <div className="confirm-modal-overlay" onClick={() => setConfirmDelete({ open: false, id: null })}>
          <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">Excluir Chamado</h3>
            <p className="confirm-modal-text">Você tem certeza que deseja remover este chamado permanentemente da base de dados?</p>
            <div className="confirm-modal-actions">
              <button className="btn-confirm-cancel" onClick={() => setConfirmDelete({ open: false, id: null })}>
                CANCELAR
              </button>
              <button className="btn-confirm-danger" onClick={() => deleteTicket(confirmDelete.id)}>
                CONFIRMAR
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Tickets;
