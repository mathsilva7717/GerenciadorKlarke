import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

const ResetPassword = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // No Dashboard o axios é usado diretamente ou via instância
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleReset = async (e) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      return toast.error('A senha deve ter pelo menos 6 caracteres.');
    }

    if (newPassword !== confirmPassword) {
      return toast.error('As senhas não coincidem.');
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('klarke_token');
      await axios.post(`${API_URL}/change-password`, 
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Atualiza o status no localStorage
      const userData = JSON.parse(localStorage.getItem('klarke_user') || '{}');
      const updatedUser = typeof userData === 'string' ? { username: userData } : userData;
      updatedUser.mustChangePassword = 0;
      localStorage.setItem('klarke_user', JSON.stringify(updatedUser));
      
      toast.success('Senha atualizada com sucesso!');
      navigate('/control');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#0f172a'
    }}>
      <div className="login-card animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '400px', 
        padding: '40px',
        background: '#1e293b',
        border: '1px solid #334155'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: '#3b82f6', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Lock size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'white', letterSpacing: '-0.5px' }}>Segurança da Conta</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>Defina uma senha pessoal para continuar</p>
        </div>

        <form onSubmit={handleReset}>
          <div className="login-input-group" style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                <Lock size={14} style={{ marginRight: '6px' }} /> Nova Senha
            </label>
            <input 
              type="password" 
              style={{ 
                width: '100%', 
                padding: '12px', 
                background: '#0f172a', 
                border: '1px solid #334155',
                color: 'white',
                borderRadius: '8px'
              }}
              placeholder="Mínimo 6 caracteres" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div className="login-input-group" style={{ marginBottom: '32px' }}>
            <label style={{ color: '#94a3b8', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                <Check size={14} style={{ marginRight: '6px' }} /> Confirmar Senha
            </label>
            <input 
              type="password" 
              style={{ 
                width: '100%', 
                padding: '12px', 
                background: '#0f172a', 
                border: '1px solid #334155',
                color: 'white',
                borderRadius: '8px'
              }}
              placeholder="Repita a nova senha" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" style={{ 
            width: '100%', 
            padding: '14px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            cursor: 'pointer'
          }} disabled={loading}>
            {loading ? 'SALVANDO...' : 'ATUALIZAR E ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
