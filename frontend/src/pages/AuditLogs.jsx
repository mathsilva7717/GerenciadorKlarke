import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Trash2, RotateCw, History } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

const API_URL = '/api/audit-logs';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const itemsPerPage = 20;

  let isAdmin = false;
  try { isAdmin = JSON.parse(localStorage.getItem('klarke_user'))?.role === 'admin'; } catch (e) { /* noop */ }

  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const fetchLogs = async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const response = await axios.get(API_URL, getAuthConfig());
      setLogs(response.data);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
      if (manual) toast.error('Erro ao atualizar');
    } finally {
      setLoading(false);
      if (manual) setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const clearLogs = async () => {
    try {
      const res = await axios.delete(API_URL, getAuthConfig());
      toast.success(`Histórico zerado (${res.data.removed ?? 0} registros).`);
      fetchLogs();
    } catch (error) {
      toast.error('Erro ao limpar histórico');
    } finally {
      setShowConfirm(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const normalized = dateStr.includes('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    return new Date(normalized).toLocaleString('pt-BR');
  };

  const actionType = (action) => {
    const a = (action || '').toLowerCase();
    if (a.includes('login')) return 'login';
    if (a.includes('novo') || a.includes('cadastrou') || a.includes('criou') || a.includes('usuário')) return 'create';
    if (a.includes('edi') || a.includes('alterou') || a.includes('atualizou') || a.includes('troca') || a.includes('foto')) return 'update';
    if (a.includes('exclus') || a.includes('removeu') || a.includes('deletou') || a.includes('limpeza')) return 'delete';
    return 'default';
  };

  const userName = (u) => {
    try { return (JSON.parse(u).username || u).toUpperCase(); }
    catch (e) { return (u || '—').toUpperCase(); }
  };

  const filteredLogs = logs.filter(log =>
    (log.user?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.action?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginate = (n) => { setCurrentPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="log-wrap">
      <div className="log-head">
        <div className="log-head-title">
          <h1>Auditoria</h1>
          <p>Histórico de acessos e eventos do ecossistema.</p>
        </div>
        <div className="log-head-actions">
          <button className={`btn-refresh-sober ${isRefreshing ? 'spinning' : ''}`} onClick={() => fetchLogs(true)} title="Atualizar" disabled={isRefreshing}>
            <RotateCw size={18} />
          </button>
          {isAdmin && (
            <button className="log-clear-btn" onClick={() => setShowConfirm(true)} disabled={logs.length === 0}>
              <Trash2 size={15} /> Limpar histórico
            </button>
          )}
        </div>
      </div>

      <div className="log-search">
        <Search size={18} />
        <input
          type="text"
          placeholder="Buscar por usuário, ação ou detalhe..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="log-empty">Carregando histórico...</div>
      ) : currentLogs.length === 0 ? (
        <div className="log-empty"><History size={40} style={{ opacity: 0.3, marginBottom: 10 }} /><div>Nenhuma atividade registrada.</div></div>
      ) : (
        <div className="log-timeline">
          {currentLogs.map(log => {
            const t = actionType(log.action);
            return (
              <div key={log.id} className="log-row">
                <span className={`log-dot ${t}`} />
                <div className="log-main">
                  <div className="log-line1">
                    <span className={`log-act ${t}`}>{log.action}</span>
                    <span className="log-user">{userName(log.user)}</span>
                  </div>
                  <span className="log-det">{log.details}</span>
                </div>
                <span className="log-time">{formatDate(log.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-industrial">
          <button disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)} className="page-btn">Anterior</button>
          <div className="page-info">Página <span>{currentPage}</span> de {totalPages}</div>
          <button disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)} className="page-btn">Próxima</button>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={clearLogs}
        title="Zerar histórico"
        message="Isso apaga TODOS os registros de auditoria permanentemente. Esta ação não pode ser desfeita. Deseja continuar?"
      />
    </div>
  );
};

export default AuditLogs;
