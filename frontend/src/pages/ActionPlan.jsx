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
    return { headers: { Authorization: `Bearer ${token}` } };
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
      await axios.put(`${API_URL}/${id}`, { is_completed: !currentStatus }, getAuthConfig());
      if (!currentStatus) {
        toast.success('✅ Excelente! Tarefa concluída!');
      }
      fetchTasks();
    } catch (error) {
      toast.error('Erro ao atualizar tarefa');
    }
  };

  const deleteTask = async (id) => {
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

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <div className="action-plan-container">
      <div className="progress-section">
        <div className="progress-header">
          <h2>Progresso da Equipe</h2>
          <span>{progressPercent}% Concluído</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      <div className="new-task-section">
        <form onSubmit={addTask} className="new-task-form">
          <input 
            type="text" 
            placeholder="O que precisa ser feito?" 
            value={newTaskTitle} 
            onChange={e => setNewTaskTitle(e.target.value)} 
            required 
            className="form-input"
          />
          <input 
            type="text" 
            placeholder="Detalhes (opcional)" 
            value={newTaskDesc} 
            onChange={e => setNewTaskDesc(e.target.value)} 
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
          {pendingTasks.length === 0 && <p className="empty-tasks">Nenhuma tarefa pendente!</p>}
          {pendingTasks.map(task => (
            <div key={task.id} className="task-item pending">
              <button className="task-check-btn" onClick={() => toggleTask(task.id, task.is_completed)}>
                <Circle size={24} color="var(--color-text-muted)" />
              </button>
              <div className="task-content">
                <span className="task-title">{task.title}</span>
                <div style={{display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px'}}>
                  {task.description && <span className="task-desc">{task.description}</span>}
                  <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    <Calendar size={10} />
                    {new Date(task.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
              <button className="delete-btn" onClick={() => deleteTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {completedTasks.length > 0 && (
          <div className="task-list mt-24">
            <h3 className="task-list-title">Concluídas ({completedTasks.length})</h3>
            {completedTasks.map(task => (
              <div key={task.id} className="task-item completed">
                <button className="task-check-btn" onClick={() => toggleTask(task.id, task.is_completed)}>
                  <CheckCircle2 size={24} color="#2ecc71" />
                </button>
                <div className="task-content">
                  <span className="task-title">{task.title}</span>
                  <span style={{fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px'}}>
                    <Calendar size={10} />
                    {new Date(task.created_at).toLocaleString()}
                  </span>
                </div>
                <button className="delete-btn" onClick={() => deleteTask(task.id)} style={{background: 'transparent', padding: '8px'}}>
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
