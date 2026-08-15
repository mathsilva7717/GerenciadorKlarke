import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthConfig } from '../utils/auth';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getFirstName = () => {
  try {
    const u = JSON.parse(localStorage.getItem('klarke_user'));
    const raw = (u?.username || '').split('@')[0].trim();
    if (!raw) return '';
    const first = raw.split(/[\s._-]+/)[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return '';
  }
};

function CheckInModal() {
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem('klarke_user') || '{}'); } catch (e) { /* ignore */ }
    if (user.role !== 'funcionario') return;

    axios.get('/api/attendance/today', getAuthConfig())
      .then(res => { if (!res.data.checkedIn) setVisible(true); })
      .catch(() => {});
  }, []);

  const confirmar = async () => {
    setConfirming(true);
    try {
      await axios.post('/api/attendance', {}, getAuthConfig());
      toast.success('Check-in feito! Bom trabalho.');
      setVisible(false);
    } catch (e) {
      toast.error('Erro ao confirmar presença');
    } finally {
      setConfirming(false);
    }
  };

  if (!visible) return null;

  const nome = getFirstName();
  const dataFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="modal-overlay" style={{ zIndex: 20000 }}>
      <div className="modal-content" style={{ maxWidth: '380px', textAlign: 'center', padding: '36px 28px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(16,185,129,0.12)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px'
        }}>
          <Clock size={26} color="#10b981" />
        </div>
        <h2 className="modal-title" style={{ marginBottom: '6px' }}>
          {getGreeting()}{nome ? `, ${nome}` : ''}!
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '4px', textTransform: 'capitalize' }}>
          {dataFormatada}
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '26px' }}>
          Faça seu check-in pra começar o dia.
        </p>
        <button className="btn btn-primary" onClick={confirmar} disabled={confirming} style={{ marginTop: 0 }}>
          <CheckCircle2 size={18} style={{ marginRight: '8px' }} />
          {confirming ? 'REGISTRANDO...' : 'CHECK-IN'}
        </button>
      </div>
    </div>
  );
}

export default CheckInModal;
