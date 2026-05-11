import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, CheckCircle2, Circle, ListTodo, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = '/api/tasks';

function ActionPlan() {
  const [tasks, setTasks] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');

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
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTasks();
    // Atualização automática a cada 30 segundos para ver tarefas concluídas por outros
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    try {
      await axios.post(API_URL, { title: newTaskTitle, description: newTaskDesc }, getAuthConfig());
      setNewTaskTitle('');
      setNewTaskDesc('');
      toast.success('Nova tarefa enviada!');
      fetchTasks();
    } catch (error) {
      toast.error('Erro ao criar tarefa');
    }
  };

  const toggleTask = async (id, currentStatus) => {
    try {
      const user = localStorage.getItem('klarke_user') || 'Desconhecido';
      await axios.put(`${API_URL}/${id}`, { 
        is_completed: !currentStatus,
        completed_by: user
      }, getAuthConfig());
      
      if (!currentStatus) {
        toast.success(`TAREFA CONCLUÍDA POR: ${user.toUpperCase()}`, {
          duration: 4000,
          icon: '🛠️',
          style: {
            borderRadius: '4px',
            background: '#1e293b',
            color: '#fff',
            fontWeight: 'bold',
            border: '1px solid #10b981'
          }
        });
      }
      fetchTasks();
    } catch (error) {
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

  const deleteStaticTask = async (id) => {
    if (window.confirm('Excluir esta tarefa?')) {
      try {
        await axios.delete(`${API_URL}/${id}`, getAuthConfig());
        toast.success('Tarefa removida');
        fetchTasks();
      } catch (error) {
        toast.error('Erro ao remover tarefa');
      }
    }
  };

  const completedCount = tasks.filter(t => t.is_completed).length;
  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const pendingTasks = tasks.filter(t => Number(t.is_completed) === 0);
  const completedTasks = tasks.filter(t => Number(t.is_completed) === 1);

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

      <div className="new-task-section">
        <form onSubmit={addTask} className="new-task-form">
          <input 
            type="text" 
            placeholder="Nova tarefa..." 
            value={newTaskTitle} 
            onChange={e => setNewTaskTitle(e.target.value)} 
            required 
            className="form-input"
          />
          <button type="submit" className="btn btn-primary" style={{marginTop: 0, padding: '12px 24px', width: 'auto'}}>
            <Plus size={20} />
          </button>
        </form>
      </div>

      <div className="tasks-lists">
        <div className="task-list">
          <h3 className="task-list-title"><ListTodo size={18}/> Pendentes ({pendingTasks.length})</h3>
          {pendingTasks.length === 0 && <div className="empty-tasks">Tudo em dia! ✅</div>}
          {pendingTasks.map(task => (
            <div key={task.id} className="task-item pending">
              <button className="task-check-btn" onClick={() => toggleTask(task.id, task.is_completed)}>
                <Circle size={24} color="var(--color-text-muted)" />
              </button>
              <div className="task-content">
                <span className="task-title">{task.title}</span>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px'}}>
                  <span style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <Calendar size={10} />
                    Criado: {formatDate(task.created_at)}
                  </span>
                </div>
              </div>
              <button className="delete-btn" onClick={() => deleteStaticTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
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
                    <span style={{fontSize: '0.65rem', color: '#10b981', fontWeight: 'bold'}}>
                      FEITO POR: {task.completed_by || 'Sistema'}
                    </span>
                    <span style={{fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                      <Calendar size={10} />
                      Concluído em: {formatDate(task.completed_at || task.created_at)}
                    </span>
                  </div>
                </div>
                <button className="delete-btn" onClick={() => deleteStaticTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActionPlan;
