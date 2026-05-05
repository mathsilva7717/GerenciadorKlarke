import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, User, ShieldCheck } from 'lucide-react';

const API_URL = '/api/login';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(API_URL, { username, password });
      if (response.data.token) {
        localStorage.setItem('klarke_token', response.data.token);
        localStorage.setItem('klarke_user', username);
        
        const now = new Date();
        const hour = now.getHours();
        let greeting = 'BOM DIA';
        if (hour >= 12 && hour < 18) greeting = 'BOA TARDE';
        else if (hour >= 18) greeting = 'BOA NOITE';
        
        setSuccessData({
          greeting,
          user: username.toUpperCase(),
          date: now.toLocaleDateString('pt-BR'),
          time: now.toLocaleTimeString('pt-BR')
        });
        
        setIsSuccess(true);
        setTimeout(() => {
          navigate('/control');
        }, 6000);
      }
    } catch (err) {
      setError('Credenciais inválidas. Tente novamente.');
      setIsLoading(false);
    }
  };

  if (isSuccess && successData) {
    return (
      <div className="login-container">
        <div className="fbi-success-screen">
          <ShieldCheck size={64} className="fbi-icon" />
          <h1 className="fbi-title">ACESSO CONCEDIDO</h1>
          <div className="fbi-divider"></div>
          <div className="fbi-details">
            <p className="fbi-line"><span className="fbi-label">STATUS:</span> AUTENTICADO</p>
            <p className="fbi-line"><span className="fbi-label">USUÁRIO:</span> {successData.user}</p>
            <p className="fbi-line"><span className="fbi-label">MENSAGEM:</span> {successData.greeting}</p>
            <p className="fbi-line"><span className="fbi-label">DATA/HORA:</span> {successData.date} {successData.time}</p>
            <p className="fbi-line fbi-blink"><span className="fbi-label">AÇÃO:</span> INICIANDO SISTEMA...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="Klarke Logo" className="login-logo" />
          <h1>Klarke Control</h1>
          <p>Acesse o painel de gerenciamento de infraestrutura.</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group-login">
            <div className="input-icon-wrapper">
              <User size={20} className="input-icon" />
              <input
                type="text"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-group-login">
            <div className="input-icon-wrapper">
              <Lock size={20} className="input-icon" />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
