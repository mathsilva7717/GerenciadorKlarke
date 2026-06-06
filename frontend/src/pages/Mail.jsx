import React from 'react';
import { Mail, Send, Search, Settings, ExternalLink, Inbox, Clock, ShieldCheck } from 'lucide-react';

function MailPage() {
  const mailActions = [
    {
      title: 'Caixa de Entrada',
      description: 'Acesse suas mensagens recebidas e gerencie sua inbox principal.',
      icon: <Inbox size={24} />,
      url: 'https://mail.zoho.com/zm/#mail/inbox',
      color: 'var(--color-accent)'
    },
    {
      title: 'Escrever E-mail',
      description: 'Abra diretamente a tela de composição para enviar uma nova mensagem.',
      icon: <Send size={24} />,
      url: 'https://mail.zoho.com/zm/#mail/compose',
      color: 'var(--color-success)'
    },
    {
      title: 'Pesquisar',
      description: 'Busque por contatos, assuntos ou conteúdos específicos em seus e-mails.',
      icon: <Search size={24} />,
      url: 'https://mail.zoho.com/zm/#search/',
      color: 'var(--color-primary-light)'
    },
    {
      title: 'Configurações',
      description: 'Ajuste preferências de conta, filtros e assinaturas do Zoho.',
      icon: <Settings size={24} />,
      url: 'https://mail.zoho.com/zm/#settings/mail',
      color: 'var(--color-text-muted)'
    }
  ];

  return (
    <div className="mail-page">
      <div className="page-header">
        <div className="header-title-group">
          <Mail className="header-icon" size={24} />
          <h1>Central de E-mail</h1>
        </div>
        <span className="status-badge">
          <ShieldCheck size={14} />
          Zoho Mail Secure
        </span>
      </div>

      <div className="search-wrapper" style={{ marginBottom: '32px' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Integração simplificada com o ecossistema Zoho. Selecione uma ação abaixo para abrir em uma nova aba.
        </p>
      </div>

      <div className="machines-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '20px' 
      }}>
        {mailActions.map((action, idx) => (
          <a 
            key={idx} 
            href={action.url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="machine-card"
            style={{ textDecoration: 'none', height: '100%' }}
          >
            <div className="machine-header">
              <div style={{ 
                background: `rgba(0,0,0,0.05)`, 
                padding: '12px', 
                borderRadius: '0px',
                color: action.color
              }}>
                {action.icon}
              </div>
              <ExternalLink size={16} style={{ opacity: 0.3 }} />
            </div>
            
            <div style={{ marginTop: '12px' }}>
              <h3 className="machine-title" style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                {action.title}
              </h3>
              <p style={{ 
                fontSize: '0.85rem', 
                color: 'var(--color-text-muted)', 
                lineHeight: '1.5' 
              }}>
                {action.description}
              </p>
            </div>

            <div className="machine-details-grid" style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '16px', paddingTop: '16px' }}>
              <div className="detail-item">
                <span className="detail-label">Serviço</span>
                <span className="detail-value">Zoho Corporation</span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ 
        marginTop: '40px', 
        padding: '24px', 
        background: 'rgba(59, 130, 246, 0.05)', 
        border: '1px dashed var(--color-accent)',
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
      }}>
        <Clock size={32} style={{ color: 'var(--color-accent)', opacity: 0.8 }} />
        <div>
          <h4 style={{ marginBottom: '4px' }}>Dica de Produtividade</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Mantenha sua aba do Zoho Mail aberta para receber notificações em tempo real enquanto trabalha no Klarke Control.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MailPage;
