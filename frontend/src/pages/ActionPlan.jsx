import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, CheckCircle2, Circle, ListTodo, Trash2, Calendar, User, CheckCheck, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { getAuthConfig } from '../utils/auth';

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
  };

  // Card de tarefa reutilizável (pendente ou concluída)
  const TaskCard = ({ task, done }) => (
    <div className={`ap-card ${done ? 'done' : ''}`}>
      <button className="ap-check" onClick={() => toggleTask(task.id, task.is_completed)} title={done ? 'Reabrir' : 'Concluir'}>
        {done ? <CheckCircle2 size={22} color="#10b981" /> : <Circle size={22} />}
      </button>
      <div className="ap-card-body">
        <span className="ap-card-title">{task.title}</span>
        <div className="ap-card-meta">
          {task.assigned_to && (
            <span className="ap-chip user"><User size={10} />{task.assigned_to.toUpperCase()}</span>
          )}
          {done && (
            <span className="ap-chip green"><CheckCheck size={10} />{task.completed_by || 'Sistema'}</span>
          )}
          <span className="ap-chip date"><Calendar size={10} />{formatDate(done ? (task.completed_at || task.created_at) : task.created_at)}</span>
        </div>
      </div>
      {loggedInRole === 'admin' && (
        <button className="ap-del" onClick={() => deleteStaticTask(task.id)} title="Excluir"><Trash2 size={15} /></button>
      )}
    </div>
  );

  return (
    <div className="ap-wrap">
      {/* CABEÇALHO COM ANEL DE PROGRESSO */}
      <div className="ap-top">
        <div className="ap-top-title">
          <h1>Plano de Ação</h1>
          <p>Checklist de tarefas e pendências da equipe.</p>
        </div>
        <div className="ap-progress">
          <div className="ap-ring" style={{ background: `conic-gradient(#10b981 ${progressPercent * 3.6}deg, rgba(120,120,120,0.22) 0)` }}>
            <div className="ap-ring-inner">{progressPercent}<small>%</small></div>
          </div>
          <div className="ap-progress-info">
            <span className="ap-progress-lbl">Progresso geral</span>
            <span className="ap-progress-sub">{completedCount} de {tasks.length} concluídas</span>
          </div>
        </div>
      </div>

      {/* STATS RÁPIDOS */}
      <div className="ap-stats">
        <div className="ap-stat"><span className="ap-stat-num">{pendingTasks.length}</span><span className="ap-stat-lbl">Pendentes</span></div>
        <div className="ap-stat accent"><span className="ap-stat-num">{myPendingTasks.length}</span><span className="ap-stat-lbl">Minhas</span></div>
        <div className="ap-stat green"><span className="ap-stat-num">{completedCount}</span><span className="ap-stat-lbl">Concluídas</span></div>
        <div className="ap-stat"><span className="ap-stat-num">{tasks.length}</span><span className="ap-stat-lbl">Total</span></div>
      </div>

      {/* COMPOSER (ADMIN) */}
      {loggedInRole === 'admin' && (
        <form onSubmit={addTask} className="ap-composer">
          <input
            type="text"
            placeholder="Escreva uma nova tarefa..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            required
            className="form-input ap-composer-input"
          />
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="form-input ap-composer-select">
            <option value="">Atribuir a... (ninguém)</option>
            {users.map(u => <option key={u.id} value={u.username}>{u.username.toUpperCase()}</option>)}
          </select>
          <button type="submit" className="ap-composer-btn"><Plus size={18} /> Adicionar</button>
        </form>
      )}

      {/* QUADRO KANBAN */}
      <div className="ap-board">
        {/* MINHAS */}
        <div className="ap-col accent">
          <div className="ap-col-head">
            <span className="ap-col-title"><ListTodo size={16} /> Minhas Tarefas</span>
            <span className="ap-col-count">{myPendingTasks.length}</span>
          </div>
          <div className="ap-col-body">
            {myPendingTasks.length === 0
              ? <div className="ap-empty">Nada atribuído a você.</div>
              : myPendingTasks.map(task => <TaskCard key={task.id} task={task} done={false} />)}
          </div>
        </div>

        {/* GERAIS */}
        <div className="ap-col neutral">
          <div className="ap-col-head">
            <span className="ap-col-title"><Layers size={16} /> Gerais</span>
            <span className="ap-col-count">{otherPendingTasks.length}</span>
          </div>
          <div className="ap-col-body">
            {otherPendingTasks.length === 0
              ? <div className="ap-empty">Nenhuma pendência geral.</div>
              : otherPendingTasks.map(task => <TaskCard key={task.id} task={task} done={false} />)}
          </div>
        </div>

        {/* CONCLUÍDAS */}
        <div className="ap-col green">
          <div className="ap-col-head">
            <span className="ap-col-title"><CheckCheck size={16} /> Concluídas</span>
            <span className="ap-col-count">{allCompletedTasks.length}</span>
          </div>
          <div className="ap-col-body">
            {allCompletedTasks.length === 0
              ? <div className="ap-empty">Nenhuma tarefa concluída ainda</div>
              : completedTasks.map(task => <TaskCard key={task.id} task={task} done={true} />)}
            {totalPages > 1 && (
              <div className="ap-pager">
                <button disabled={currentPage === 1} onClick={() => paginate(currentPage - 1)} className="page-btn">‹</button>
                <span className="ap-pager-info">{currentPage}/{totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => paginate(currentPage + 1)} className="page-btn">›</button>
              </div>
            )}
          </div>
        </div>
      </div>

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
