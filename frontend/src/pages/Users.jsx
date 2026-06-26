import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, Shield, User, RotateCcw } from 'lucide-react';
import { getAuthConfig } from '../utils/auth';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  const API_URL = '';

  useEffect(() => {
    fetchUsers();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('klarke_token');
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      setLoading(false);
    }
  };

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = users.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(users.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('klarke_token');
      const finalUser = {
        ...newUser,
        username: newUser.username.includes('@klarke') ? newUser.username : `${newUser.username}@klarke`
      };
      await axios.post(`${API_URL}/api/users`, finalUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUser({ username: '', password: '', role: 'user' });
      setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
      fetchUsers();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao cadastrar usuário.' });
    }
  };

  const handleResetPassword = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Resetar Senha',
      message: 'Uma senha temporária aleatória será gerada e exibida uma única vez. O usuário será forçado a trocá-la no próximo acesso. Confirmar?',
      onConfirm: async () => {
        try {
          const { data } = await axios.post(`${API_URL}/api/users/${id}/reset-password`, {}, getAuthConfig());
          setMessage({ type: 'success', text: `Senha temporária (anote, não será exibida novamente): ${data.tempPassword}` });
        } catch (error) {
          setMessage({ type: 'error', text: 'Erro ao resetar senha.' });
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  const handleDeleteUser = async (id) => {
    setConfirmDialog({
      open: true,
      title: 'Remover Usuário',
      message: 'Tem certeza que deseja revogar permanentemente o acesso deste usuário?',
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/api/users/${id}`, getAuthConfig());
          fetchUsers();
          setMessage({ type: 'success', text: 'Usuário removido!' });
        } catch (error) {
          setMessage({ type: 'error', text: 'Erro ao remover usuário.' });
        }
        setConfirmDialog({ ...confirmDialog, open: false });
      }
    });
  };

  return (
    <div className="users-container">
      <header className="page-header" style={{marginBottom: '32px'}}>
        <h1 className="text-3xl font-bold text-slate-900" style={{marginBottom: '8px'}}>Gerenciamento de Usuários</h1>
        <p className="text-slate-500">Controle quem tem acesso ao painel Klarke.</p>
      </header>

      <div className="users-grid">
        {/* Formulário de Cadastro */}
        <div className="user-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="text-blue-600" size={20} /> Novo Usuário
          </h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Nome de Usuário / Email</label>
              <div style={{display: 'flex', alignItems: 'center', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px'}}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: matheus"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.replace('@klarke', '') })}
                  required
                  style={{border: 'none', flex: 1}}
                />
                <span style={{padding: '0 12px', color: 'var(--color-text-muted)', fontSize: '0.9rem', borderLeft: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.02)', height: '100%', display: 'flex', alignItems: 'center'}}>@klarke</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                type="password"
                className="form-input"
                placeholder="Senha segura"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nível de Acesso</label>
              <select
                className="form-input"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="user">Usuário Comum</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Cadastrar Usuário
            </button>
            {message.text && (
              <p className={`text-sm text-center ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`} style={{marginTop: '10px'}}>
                {message.text}
              </p>
            )}
          </form>
        </div>

        {/* Lista de Usuários */}
        <div className="user-card">
          <h2 className="text-lg font-semibold mb-4">Usuários Ativos</h2>
          {loading ? (
            <p>Carregando...</p>
          ) : (
            <div className="user-table-wrapper">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Nível</th>
                    <th style={{textAlign: 'right'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {currentUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            <User size={18} />
                          </div>
                          <span className="font-medium text-slate-700">{user.username}</span>
                          {user.must_change_password === 1 && (
                            <span style={{ 
                              marginLeft: '8px', 
                              fontSize: '0.6rem', 
                              background: 'rgba(234, 179, 8, 0.1)', 
                              color: '#eab308', 
                              padding: '2px 6px',
                              border: '1px solid rgba(234, 179, 8, 0.3)',
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>SENHA PENDENTE</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${
                          user.role === 'admin' ? 'role-admin' : 'role-user'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                        {user.username !== 'admin' && (
                          <>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="action-chip"
                              title="Resetar Senha"
                              style={{padding: '4px 8px'}}
                            >
                              <RotateCcw size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="delete-btn"
                              title="Remover Usuário"
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {totalPages > 1 && (
                <div className="pagination-industrial" style={{marginTop: '16px', borderTop: 'none', padding: '10px'}}>
                  <button 
                    disabled={currentPage === 1}
                    onClick={() => paginate(currentPage - 1)}
                    className="page-btn"
                  >
                    Anterior
                  </button>
                  <div className="page-info">
                    <span>{currentPage}</span> / {totalPages}
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
            </div>
          )}
        </div>
      </div>
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
                CONFIRMAR AÇÃO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
