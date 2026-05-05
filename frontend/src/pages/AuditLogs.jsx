import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History, User, Clock, Info, Search } from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const API_URL = '/api/audit-logs';

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    const user = localStorage.getItem('klarke_user') || 'Sistema';
    return { headers: { Authorization: `Bearer ${token}`, 'X-User': user } };
  };

  useEffect(() => {
    fetchLogs();
  }, []);

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
    // Garante que o JS entenda que a data do banco é UTC (adicionando o Z se necessário)
    const normalizedDate = dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const d = new Date(normalizedDate);
    return d.toLocaleString('pt-BR');
  };

  const filteredLogs = logs.filter(log => 
    (log.user?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.action?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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
      <div className="search-wrapper">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por usuário, ação ou detalhe..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="logs-list">
        {loading ? (
          <div className="loading-spinner">Carregando histórico...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="empty-state">
            <History size={48} className="empty-icon" />
            <p>Nenhuma atividade registrada ainda.</p>
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="log-item">
              <div className="log-icon-wrapper">
                <Clock size={16} color="var(--color-text-muted)" />
              </div>
              <div className="log-content">
                <div className="log-header">
                  <span className="log-user">
                    <User size={14} style={{marginRight: '6px'}} />
                    {log.user?.toUpperCase()}
                  </span>
                  <span className="log-date">{formatDate(log.created_at)}</span>
                </div>
                <div className="log-action-row">
                  <span className={`log-badge ${getBadgeClass(log.action)}`}>{log.action}</span>
                  <span className="log-details">{log.details}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .audit-container {
          max-width: 1000px;
          margin: 0 auto;
        }
        .log-item {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--border-radius);
          padding: 16px;
          margin-bottom: 12px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: var(--transition);
        }
        .log-item:hover {
          background: rgba(255, 255, 255, 0.9);
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
          margin-bottom: 8px;
        }
        .log-user {
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--color-primary);
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
        .badge-login { background: #334155; } /* Slate 700 */
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
