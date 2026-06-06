import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, CheckCircle2, Circle, ListTodo, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

const API_URL = '/api/tasks';

function ActionPlan() {
  const [tasks, setTasks] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [users, setUsers] = useState([]);
  const [assignedTo, setAssignedTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getAuthConfig = () => {
    const token = localStorage.getItem('klarke_token');
    const user = localStorage.getItem('klarke_user') || 'Sistema';
    return { headers: { Authorization: `Bearer ${token}`, 'X-User': user } };
  };

  const fetchTasks = async () => {
    try {
      const res = await axios.get(API_URL, getAuthConfig());
      setTasks(res.data);
    } catch (error) {
      console.error('[API ERROR] Falha ao buscar tarefas:', error.response?.data || error.message);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users', getAuthConfig());
      setUsers(res.data);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    // Atualização automática a cada 30 segundos para ver tarefas concluídas por outros
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    try {
      await axios.post(API_URL, { 
        title: newTaskTitle, 
        description: newTaskDesc,
        assigned_to: assignedTo || null
      }, getAuthConfig());
      setNewTaskTitle('');
      setNewTaskDesc('');
      setAssignedTo('');
      toast.success('Nova tarefa enviada!');
      fetchTasks();
    } catch (error) {
      console.error('[API ERROR] Falha ao criar tarefa:', error.response?.data || error.message);
      toast.error('Erro ao criar tarefa');
    }
  };

  const toggleTask = async (id, currentStatus) => {
    try {
      console.log(`[DEBUG] Tentando alternar tarefa ${id}. Status atual: ${currentStatus}`);
      const userData = localStorage.getItem('klarke_user');
      let userName = 'Sistema';
      
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          userName = parsed.username || parsed;
        } catch (e) {
          userName = userData;
        }
      }

      const newStatus = Number(currentStatus) === 1 ? 0 : 1;
      
      await axios.put(`${API_URL}/${id}`, { 
        is_completed: newStatus,
        completed_by: userName
      }, getAuthConfig());
      if (newStatus === 1) {
        toast.success(`TAREFA CONCLUÍDA!`, { id: 'task-success' });
      }
      fetchTasks();
    } catch (error) {
      console.error('[API ERROR] Erro ao atualizar tarefa:', error);
      toast.error('Erro ao atualizar tarefa');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // Forçar interpretação como UTC se vier do banco sem Z, ou usar o valor direto
    const d = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    return d.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const deleteStaticTask = (id) => {
    setTaskToDelete(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await axios.delete(`${API_URL}/${taskToDelete}`, getAuthConfig());
      toast.success('Tarefa removida');
      fetchTasks();
    } catch (error) {
      toast.error('Erro ao remover tarefa');
    }
  };

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const pendingTasks = tasks.filter(t => Number(t.is_completed) === 0);
  const allCompletedTasks = tasks.filter(t => Number(t.is_completed) === 1);

  // Extrair perfil e nome do usuário logado
  const userData = localStorage.getItem('klarke_user');
  let loggedInUser = 'Sistema';
  let loggedInRole = 'user';
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      loggedInUser = parsed.username || userData;
      loggedInRole = parsed.role || 'user';
    } catch (e) {
      loggedInUser = userData;
    }
  }

  // Filtragem das pendentes em dois campos (Minhas Tarefas vs Tarefas Gerais)
  const myPendingTasks = pendingTasks.filter(t => t.assigned_to && t.assigned_to.toUpperCase() === loggedInUser.toUpperCase());
  const otherPendingTasks = pendingTasks.filter(t => !t.assigned_to || t.assigned_to.toUpperCase() !== loggedInUser.toUpperCase());

  // Lógica de Paginação para Concluídas
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const completedTasks = allCompletedTasks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(allCompletedTasks.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll suave para o topo da lista de concluídas
    const listElement = document.querySelector('.task-list.mt-24');
    if (listElement) listElement.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="action-plan-container">
      <div className="progress-section">
        <div className="progress-header">
          <h2>Monitor de Tarefas</h2>
          <span className="progress-badge">{progressPercent}%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {loggedInRole === 'admin' && (
        <div className="new-task-section">
          <form onSubmit={addTask} className="new-task-form" style={{ display: 'flex', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="Nova tarefa..." 
              value={newTaskTitle} 
              onChange={e => setNewTaskTitle(e.target.value)} 
              required 
              className="form-input"
              style={{ flex: 1, minWidth: '200px' }}
            />
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="form-input"
              style={{ width: 'auto', minWidth: '180px' }}
            >
              <option value="">Atribuir a... (Ninguém)</option>
              {users.map(u => (
                <option key={u.id} value={u.username}>{u.username.toUpperCase()}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" style={{marginTop: 0, padding: '12px 24px', width: 'auto'}}>
              <Plus size={20} />
            </button>
          </form>
        </div>
      )}

      <div className="tasks-lists">
        {/* COLUNA 1: MINHAS TAREFAS PENDENTES */}
        <div className="task-list">
          <h3 className="task-list-title" style={{ color: 'var(--color-accent)' }}>
            <ListTodo size={18}/> Minhas Tarefas ({myPendingTasks.length})
          </h3>
          {myPendingTasks.length === 0 && <div className="empty-tasks">Nenhuma tarefa atribuída a você! 🎉</div>}
          {myPendingTasks.map(task => (
            <div key={task.id} className="task-item pending" style={{ borderLeft: '4px solid var(--color-accent)' }}>
              <button className="task-check-btn" onClick={() => toggleTask(task.id, task.is_completed)}>
                <Circle size={24} color="var(--color-text-muted)" />
              </button>
              <div className="task-content">
                <span className="task-title" style={{ fontWeight: 'bold' }}>{task.title}</span>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap'}}>
                  <span style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <Calendar size={10} />
                    Criado: {formatDate(task.created_at)}
                  </span>
                </div>
              </div>
              {loggedInRole === 'admin' && (
                <button className="delete-btn" onClick={() => deleteStaticTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* COLUNA 2: OUTRAS TAREFAS PENDENTES / GERAIS */}
        <div className="task-list">
          <h3 className="task-list-title">
            <ListTodo size={18}/> Outras Tarefas ({otherPendingTasks.length})
          </h3>
          {otherPendingTasks.length === 0 && <div className="empty-tasks">Nenhuma outra tarefa pendente! ✅</div>}
          {otherPendingTasks.map(task => (
            <div key={task.id} className="task-item pending">
              <button className="task-check-btn" onClick={() => toggleTask(task.id, task.is_completed)}>
                <Circle size={24} color="var(--color-text-muted)" />
              </button>
              <div className="task-content">
                <span className="task-title">{task.title}</span>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap'}}>
                  <span style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <Calendar size={10} />
                    Criado: {formatDate(task.created_at)}
                  </span>
                  {task.assigned_to && (
                    <span style={{fontSize: '0.65rem', color: 'white', background: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'}}>
                      PARA: {task.assigned_to.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              {loggedInRole === 'admin' && (
                <button className="delete-btn" onClick={() => deleteStaticTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

        {completedTasks.length > 0 && (
          <div className="task-list mt-24">
            <h3 className="task-list-title">Histórico de Conclusão</h3>
            {completedTasks.map(task => (
              <div key={task.id} className="task-item completed">
                <button className="task-check-btn" onClick={() => toggleTask(task.id, task.is_completed)}>
                  <CheckCircle2 size={24} color="#2ecc71" />
                </button>
                <div className="task-content">
                  <span className="task-title" style={{textDecoration: 'line-through', opacity: 0.6}}>{task.title}</span>
                  <div style={{marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px'}}>
                    {task.assigned_to && (
                      <span style={{fontSize: '0.65rem', color: 'var(--color-accent)', fontWeight: 'bold'}}>
                        ATRIBUÍDO A: {task.assigned_to.toUpperCase()}
                      </span>
                    )}
                    <span style={{fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold'}}>
                      FEITO POR: {task.completed_by || 'Sistema'}
                    </span>
                    <span style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                      <Calendar size={10} />
                      Concluído em: {formatDate(task.completed_at || task.created_at)}
                    </span>
                  </div>
                </div>
                {loggedInRole === 'admin' && (
                  <button className="delete-btn" onClick={() => deleteStaticTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
                    <Trash2 size={16} />
                  </button>
                )}
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
          </div>
        )}
      <ConfirmModal 
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmDelete}
        title="Excluir Tarefa"
        message="Tem certeza que deseja remover esta tarefa permanentemente?"
      />
    </div>
  );
}

export default ActionPlan;
