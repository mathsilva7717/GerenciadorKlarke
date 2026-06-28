import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History, User, Clock, Search } from 'lucide-react';
import { getAuthConfig } from '../utils/auth';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const API_URL = '/api/audit-logs';

  useEffect(() => {
    fetchLogs();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchLogs = async () => {
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setLogs(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const normalizedDate = dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const d = new Date(normalizedDate);
    return d.toLocaleString('pt-BR');
  };

  const filteredLogs = logs.filter(log => 
    (log.user?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.action?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getBadgeClass = (action) => {
    const a = action?.toLowerCase() || '';
    if (a.includes('login')) return 'badge-login';
    if (a.includes('novo') || a.includes('cadastrou') || a.includes('criou')) return 'badge-create';
    if (a.includes('editou') || a.includes('alterou') || a.includes('atualizou')) return 'badge-update';
    if (a.includes('excluiu') || a.includes('removeu') || a.includes('deletou')) return 'badge-delete';
    return 'badge-default';
  };

  return (
    <div className="audit-container">
      <header className="page-header" style={{marginBottom: '32px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div className="industrial-icon" style={{background: 'var(--color-primary)', color: 'white', padding: '8px', borderRadius: '6px'}}>
            <History size={20} />
          </div>
          <div>
            <h1 style={{marginBottom: '4px'}}>Auditoria do Ecossistema</h1>
            <p style={{fontSize: '0.9rem', color: 'var(--color-text-muted)'}}>Histórico completo de acessos e eventos técnicos.</p>
          </div>
        </div>
      </header>

      <div className="search-wrapper">
        <div className="search-container" style={{maxWidth: '100%', marginBottom: '32px'}}>
          <Search className="search-icon" size={20} color="#94a3b8" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por usuário, ação ou detalhe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', width: '100%', padding: '12px 12px 12px 40px', outline: 'none' }}
          />
        </div>
      </div>

      <div className="logs-list">
        {loading ? (
          <div className="loading-spinner">Carregando histórico...</div>
        ) : currentLogs.length === 0 ? (
          <div className="empty-state">
            <History size={48} className="empty-icon" />
            <p>Nenhuma atividade registrada ainda.</p>
          </div>
        ) : (
          <>
            {currentLogs.map(log => (
              <div key={log.id} className="log-item">
                <div className="log-icon-wrapper">
                  <Clock size={16} color="var(--color-text-muted)" />
                </div>
                <div className="log-content">
                  <div className="log-header">
                    <span className="log-user">
                      <User size={14} style={{marginRight: '6px'}} />
                      {(() => {
                        try {
                          const u = JSON.parse(log.user);
                          return (u.username || log.user).toUpperCase();
                        } catch(e) {
                          return log.user?.toUpperCase();
                        }
                      })()}
                    </span>
                    <span className="log-date">{formatDate(log.created_at)}</span>
                  </div>
                  <div className="log-action-row">
                    <span className={`log-badge ${getBadgeClass(log.action)}`}>{log.action}</span>
                    <span className="log-details">{log.details}</span>
                  </div>
                </div>
              </div>
            ))}

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
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .audit-container {
          max-width: 1300px;
          margin: 0 auto;
        }
        .log-item {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--border-radius);
          padding: 20px 24px;
          margin-bottom: 16px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: var(--transition);
        }
        .log-item:hover {
          background: var(--color-primary-light);
          border-color: var(--color-accent);
        }
        .log-icon-wrapper {
          padding-top: 4px;
        }
        .log-content {
          flex: 1;
        }
        .log-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .log-user {
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--color-accent);
          display: flex;
          align-items: center;
        }
        .log-date {
          font-size: 0.7rem;
          color: var(--color-text-muted);
        }
        .log-action-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .log-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 4px 8px;
          color: white;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .badge-login { background: var(--color-primary); }
        .badge-create { background: #065f46; } /* Emerald 800 */
        .badge-update { background: #1e40af; } /* Blue 800 */
        .badge-delete { background: #991b1b; } /* Red 800 */
        .badge-default { background: var(--color-primary); }
        .log-details {
          font-size: 0.9rem;
          color: var(--color-text);
        }
      `}} />
    </div>
  );
};

export default AuditLogs;
