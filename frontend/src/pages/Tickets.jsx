import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Search, Trash2, Filter, AlertCircle,
  MessageSquare, User, Tag, Calendar, RefreshCw, Camera,
  FileText, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';

// Resolve a URL de uma foto: aceita nome de arquivo (servido em /uploads),
// data URL (base64 legado) ou caminho/URL ja completo.
const resolveUploadUrl = (photo) => {
  if (!photo) return '';
  if (photo.startsWith('data:') || photo.startsWith('http') || photo.startsWith('/uploads/')) return photo;
  return `/uploads/${photo.replace(/^\/?uploads\//, '')}`;
};

function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

  // Estados para comentários
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState(null);
  const [commentImageName, setCommentImageName] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

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

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;

    setIsSendingComment(true);
    try {
      const response = await axios.post(`/api/tickets/${selectedTicket.id}/comments`, {
        text: commentText,
        image: commentImage
      }, getAuthConfig());

      toast.success('Comentário adicionado com sucesso!');
      setCommentText('');
      setCommentImage(null);
      setCommentImageName('');
      
      // Atualiza o chamado selecionado e a lista
      const updatedComments = response.data.comments;
      const updatedTicket = { ...selectedTicket, comments: JSON.stringify(updatedComments) };
      setSelectedTicket(updatedTicket);
      setTickets(tickets.map(t => t.id === selectedTicket.id ? updatedTicket : t));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar comentário');
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleCommentPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem excede o limite de 5MB');
      return;
    }

    setCommentImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCommentImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch =
      t.requester.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(t.id).includes(searchTerm);

    const matchesStatus = statusFilter === 'Todos' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'Todos' || t.priority === priorityFilter;

    // Filtro por período (compara só a data, ignora hora)
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const created = (t.created_at || '').slice(0, 10);
      if (dateFrom && created < dateFrom) matchesDate = false;
      if (dateTo && created > dateTo) matchesDate = false;
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesDate;
  });

  // Resumo dos chamados filtrados (para os contadores e o relatório)
  const summary = {
    total: filteredTickets.length,
    pendente: filteredTickets.filter(t => t.status === 'Pendente').length,
    atendimento: filteredTickets.filter(t => t.status === 'Em Atendimento').length,
    resolvido: filteredTickets.filter(t => t.status === 'Resolvido').length,
  };

  const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Exporta os chamados filtrados em CSV (compatível com Excel)
  const exportCsv = () => {
    if (filteredTickets.length === 0) { toast.error('Nenhum chamado para exportar'); return; }
    const headers = ['ID', 'Data', 'Solicitante', 'Categoria', 'Status', 'Assunto', 'Descrição'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(';')];
    filteredTickets.forEach(t => {
      lines.push([
        t.id,
        new Date(t.created_at).toLocaleString('pt-BR'),
        t.requester,
        t.category,
        t.status,
        t.title,
        (t.description || '').replace(/\s+/g, ' '),
      ].map(esc).join(';'));
    });
    const csv = '﻿' + lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chamados_klarke_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  // Gera um relatório bonito em nova janela, pronto pra imprimir/salvar em PDF
  const generatePdfReport = () => {
    if (filteredTickets.length === 0) { toast.error('Nenhum chamado para o relatório'); return; }
    const periodo = (dateFrom || dateTo)
      ? `${dateFrom ? new Date(dateFrom + 'T00:00').toLocaleDateString('pt-BR') : '...'} até ${dateTo ? new Date(dateTo + 'T00:00').toLocaleDateString('pt-BR') : '...'}`
      : 'Todos os períodos';
    const badgeClass = (s) => s === 'Pendente' ? 'b-pend' : s === 'Em Atendimento' ? 'b-atend' : 'b-resol';
    const rowsHtml = filteredTickets.map(t => `<tr>
      <td>#${t.id}</td>
      <td>${new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
      <td>${escHtml(t.requester)}</td>
      <td>${escHtml(t.category)}</td>
      <td><span class="badge ${badgeClass(t.status)}">${escHtml(t.status)}</span></td>
      <td>${escHtml(t.title)}</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de Chamados - Klarke</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;padding:32px;}
  .h{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0f172a;padding-bottom:16px;margin-bottom:24px;}
  .h h1{font-size:22px;letter-spacing:-.5px;} .h .sub{color:#64748b;font-size:13px;margin-top:4px;}
  .logo{font-size:28px;font-weight:800;color:#0f172a;letter-spacing:-1px;}
  .meta{display:flex;gap:24px;margin-bottom:20px;font-size:13px;color:#475569;flex-wrap:wrap;}
  .cards{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;}
  .card{flex:1;min-width:110px;border:1px solid #e2e8f0;border-radius:8px;padding:14px;}
  .card .n{font-size:26px;font-weight:800;line-height:1;} .card .l{font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.5px;margin-top:6px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#0f172a;color:#fff;text-align:left;padding:9px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
  td{padding:8px 10px;border-bottom:1px solid #e2e8f0;}
  tr:nth-child(even) td{background:#f8fafc;}
  .badge{padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;white-space:nowrap;}
  .b-pend{background:#fef3c7;color:#92400e;} .b-atend{background:#dbeafe;color:#1e40af;} .b-resol{background:#d1fae5;color:#065f46;}
  .ft{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;}
  @media print{body{padding:0;} @page{margin:1.2cm;}}
</style></head><body>
  <div class="h"><div><h1>Relatório de Chamados Técnicos</h1><div class="sub">Klarke Solutions · Suporte & Tecnologia</div></div><div class="logo">KLARKE</div></div>
  <div class="meta">
    <div><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</div>
    <div><strong>Período:</strong> ${escHtml(periodo)}</div>
    <div><strong>Filtro de status:</strong> ${escHtml(statusFilter)}</div>
  </div>
  <div class="cards">
    <div class="card"><div class="n">${summary.total}</div><div class="l">Total</div></div>
    <div class="card"><div class="n" style="color:#d97706">${summary.pendente}</div><div class="l">Pendentes</div></div>
    <div class="card"><div class="n" style="color:#2563eb">${summary.atendimento}</div><div class="l">Em Atendimento</div></div>
    <div class="card"><div class="n" style="color:#059669">${summary.resolvido}</div><div class="l">Resolvidos</div></div>
  </div>
  <table><thead><tr><th>#</th><th>Data</th><th>Solicitante</th><th>Categoria</th><th>Status</th><th>Assunto</th></tr></thead><tbody>${rowsHtml}</tbody></table>
  <div class="ft">Relatório gerado automaticamente pelo Klarke Control · ${new Date().getFullYear()} · Klarke Solutions</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Permita pop-ups para gerar o relatório'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

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
      <header className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Central de Chamados (Klarke Flow)</h1>
          <p>Gerencie as solicitações de suporte dos usuários da empresa.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={generatePdfReport}
            className="add-btn is-neutral"
            title="Gerar relatório em PDF dos chamados filtrados"
          >
            <FileText size={16} /> <span className="hide-mobile">Relatório PDF</span>
          </button>
          <button
            onClick={exportCsv}
            className="add-btn is-success"
            title="Exportar os chamados filtrados em CSV"
          >
            <Download size={16} /> <span className="hide-mobile">CSV</span>
          </button>
        </div>
      </header>

      {/* Barra de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total', value: summary.total, color: 'var(--color-text)' },
          { label: 'Pendentes', value: summary.pendente, color: '#f59e0b' },
          { label: 'Em Atendimento', value: summary.atendimento, color: 'var(--color-accent)' },
          { label: 'Resolvidos', value: summary.resolvido, color: '#10b981' },
        ].map((s, i) => (
          <div key={i} className="stat-box-industrial" style={{ padding: '16px 20px', borderLeftColor: s.color }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: '700' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros e Busca */}
      <div className="search-wrapper" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px', width: '100%' }}>
        <div className="search-container" style={{ flex: '1 1 300px', display: 'flex', alignItems: 'center', background: 'var(--color-secondary)', border: '1px solid var(--color-border)', padding: '0 16px', borderRadius: '0px' }}>
          <Search className="search-icon" size={20} color="var(--color-text-muted)" style={{ marginRight: '12px' }} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por solicitante, assunto, descrição ou ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '14px 0 14px 40px', background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', fontSize: '0.95rem' }}
          />
        </div>
        
        <div className="action-buttons-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filtro Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-secondary)', border: '1px solid var(--color-border)', padding: '0 16px', borderRadius: '0px', height: '52px' }}>
            <Filter size={16} color="var(--color-text-muted)" />
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', height: '100%', width: '140px', padding: '0 4px', appearance: 'none', WebkitAppearance: 'none' }}
            >
              <option value="Todos" style={{ background: 'var(--color-secondary)', color: 'var(--color-text)' }}>Todos os Status</option>
              <option value="Pendente" style={{ background: 'var(--color-secondary)', color: '#ef4444' }}>Pendentes</option>
              <option value="Em Atendimento" style={{ background: 'var(--color-secondary)', color: 'var(--color-accent)' }}>Em Atendimento</option>
              <option value="Resolvido" style={{ background: 'var(--color-secondary)', color: '#10b981' }}>Resolvidos</option>
            </select>
          </div>
 
          {/* Filtro Prioridade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-secondary)', border: '1px solid var(--color-border)', padding: '0 16px', borderRadius: '0px', height: '52px' }}>
            <AlertCircle size={16} color="var(--color-text-muted)" />
            <select 
              value={priorityFilter} 
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', height: '100%', width: '140px', padding: '0 4px', appearance: 'none', WebkitAppearance: 'none' }}
            >
              <option value="Todos" style={{ background: 'var(--color-secondary)', color: 'var(--color-text)' }}>Todas Prioridades</option>
              <option value="Alta" style={{ background: 'var(--color-secondary)', color: '#ef4444' }}>Alta</option>
              <option value="Média" style={{ background: 'var(--color-secondary)', color: '#f59e0b' }}>Média</option>
              <option value="Baixa" style={{ background: 'var(--color-secondary)', color: '#10b981' }}>Baixa</option>
            </select>
          </div>
 
          {/* Filtro por período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-secondary)', border: '1px solid var(--color-border)', padding: '0 12px', height: '52px' }}>
            <Calendar size={16} color="var(--color-text-muted)" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Data inicial"
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', fontSize: '0.85rem', fontWeight: '600', colorScheme: 'dark' }}
            />
            <span style={{ color: 'var(--color-text-muted)' }}>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Data final"
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text)', outline: 'none', fontSize: '0.85rem', fontWeight: '600', colorScheme: 'dark' }}
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                title="Limpar período"
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
              >×</button>
            )}
          </div>

          <button
            className={`btn-refresh-sober ${isRefreshing ? 'spinning' : ''}`}
            onClick={() => fetchTickets(true)}
            title="Atualizar Chamados"
            disabled={isRefreshing}
            style={{ width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--color-border)', background: 'var(--color-secondary)', color: 'var(--color-text)', borderRadius: '0px', cursor: 'pointer' }}
          >
            <RefreshCw size={20} style={{ margin: 'auto' }} />
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
                          <a href={resolveUploadUrl(photo)} target="_blank" rel="noopener noreferrer">
                            <img
                              src={resolveUploadUrl(photo)}
                              alt={`Evidência ${index + 1}`}
                              style={{ width: '100%', height: '120px', objectFit: 'cover', cursor: 'zoom-in', borderRadius: '4px' }}
                            />
                          </a>
                          <div style={{ marginTop: '6px', fontSize: '0.75rem' }}>
                            <a href={resolveUploadUrl(photo)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--color-accent)', fontWeight: '600' }}>
                              Ver foto completa
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Histórico & Timeline de Notas */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Histórico & Anotações
                </div>
                
                {/* Timeline Bubble List */}
                {(() => {
                  let comments = [];
                  try {
                    if (selectedTicket.comments) {
                      comments = JSON.parse(selectedTicket.comments);
                    }
                  } catch (e) {
                    comments = [];
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                      {comments.length === 0 ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '12px', background: 'rgba(0,0,0,0.02)', border: '1px dashed var(--color-border)', textAlign: 'center' }}>
                          Nenhuma nota ou comentário adicionado ainda.
                        </div>
                      ) : (
                        comments.map(c => (
                          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--color-secondary)', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '0px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '4px' }}>
                              <span style={{ fontWeight: '700', color: 'var(--color-accent)' }}>{c.author}</span>
                              <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap', color: 'var(--color-text)' }}>{c.text}</p>
                            {c.image && (
                              <div style={{ marginTop: '8px', border: '1px solid var(--color-border)', borderRadius: '0px', overflow: 'hidden', maxWidth: '120px' }}>
                                <a href={resolveUploadUrl(c.image)} target="_blank" rel="noopener noreferrer">
                                  <img src={resolveUploadUrl(c.image)} alt="Anexo do comentário" style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                                </a>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <textarea 
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Escreva uma nota técnica ou comentário..."
                      style={{ flex: 1, height: '60px', background: 'var(--color-secondary)', border: '1px solid var(--color-border)', borderRadius: '0px', color: 'var(--color-text)', padding: '10px 12px', fontSize: '0.88rem', outline: 'none', resize: 'none' }}
                    />
                    
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', border: '1px dashed var(--color-border)', background: 'var(--color-secondary)', borderRadius: '0px', cursor: 'pointer', color: commentImage ? '#10b981' : 'var(--color-text-muted)' }} title="Anexar foto">
                      <Camera size={20} style={{ margin: 'auto' }} />
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCommentPhotoChange} />
                    </label>
                  </div>

                  {commentImageName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 12px', color: '#10b981' }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        📎 Foto: {commentImageName}
                      </span>
                      <button type="button" onClick={() => { setCommentImage(null); setCommentImageName(''); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 'bold', cursor: 'pointer' }}>
                        Remover
                      </button>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn" 
                    disabled={isSendingComment || (!commentText.trim() && !commentImage)}
                    style={{ marginTop: 0, padding: '10px 16px', fontSize: '0.85rem', alignSelf: 'flex-end', width: 'auto', background: 'var(--color-accent)', color: 'white' }}
                  >
                    {isSendingComment ? 'Adicionando...' : 'Adicionar Nota'}
                  </button>
                </form>
              </div>

              {/* Status Update & Actions */}
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Ações do Chamado
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn" 
                      style={{ 
                        flex: 1, 
                        marginTop: 0,
                        padding: '12px 8px', 
                        background: selectedTicket.status === 'Pendente' ? '#ef4444' : 'rgba(239,68,68,0.1)', 
                        color: selectedTicket.status === 'Pendente' ? 'white' : '#ef4444', 
                        border: '1px solid #ef4444',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        borderRadius: '0px',
                        textTransform: 'uppercase'
                      }}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'Pendente')}
                    >
                      Pendente
                    </button>
                    
                    <button 
                      className="btn" 
                      style={{ 
                        flex: 1, 
                        marginTop: 0,
                        padding: '12px 8px', 
                        background: selectedTicket.status === 'Em Atendimento' ? 'var(--color-accent)' : 'rgba(56,189,248,0.1)', 
                        color: selectedTicket.status === 'Em Atendimento' ? 'white' : 'var(--color-accent)', 
                        border: '1px solid var(--color-accent)',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        borderRadius: '0px',
                        textTransform: 'uppercase'
                      }}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'Em Atendimento')}
                    >
                      Atender
                    </button>

                    <button 
                      className="btn" 
                      style={{ 
                        flex: 1, 
                        marginTop: 0,
                        padding: '12px 8px', 
                        background: selectedTicket.status === 'Resolvido' ? '#10b981' : 'rgba(16,185,129,0.1)', 
                        color: selectedTicket.status === 'Resolvido' ? 'white' : '#10b981', 
                        border: '1px solid #10b981',
                        fontWeight: 'bold',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        borderRadius: '0px',
                        textTransform: 'uppercase'
                      }}
                      onClick={() => updateTicketStatus(selectedTicket.id, 'Resolvido')}
                    >
                      Resolver
                    </button>
                  </div>

                  <button 
                    className="btn btn-danger" 
                    style={{ marginTop: 0, width: '100%' }}
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
