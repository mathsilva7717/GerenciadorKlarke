import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, Shield, User } from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const API_URL = '';

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('klarke_token');
      await axios.post(`${API_URL}/api/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUser({ username: '', password: '', role: 'user' });
      setMessage({ type: 'success', text: 'Usuário cadastrado com sucesso!' });
      fetchUsers();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao cadastrar usuário.' });
    }
  };

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    const user = localStorage.getItem('klarke_user') || 'Sistema';
    return { headers: { Authorization: `Bearer ${token}`, 'X-User': user } };
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Tem certeza que deseja remover este usuário?')) return;
    try {
      await axios.delete(`${API_URL}/api/users/${id}`, getAuthConfig());
      fetchUsers();
    } catch (error) {
      alert('Erro ao remover usuário.');
    }
  };

  return (
    <div className="users-container">
      <header className="page-header">
        <h1 className="text-3xl font-bold text-slate-900">Gerenciamento de Usuários</h1>
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
              <input
                type="text"
                className="form-input"
                placeholder="ex: matheus@klarke"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                required
              />
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
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-info">
                          <div className="user-avatar">
                            <User size={18} />
                          </div>
                          <span className="font-medium text-slate-700">{user.username}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${
                          user.role === 'admin' ? 'role-admin' : 'role-user'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{textAlign: 'right'}}>
                        {user.username !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="delete-btn"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Users;
