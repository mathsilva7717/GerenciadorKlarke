import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Excluir', type = 'danger' }) => {
  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal-content" onClick={e => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className={`confirm-modal-icon ${type}`}>
            <AlertTriangle size={24} />
          </div>
          <button className="confirm-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="confirm-modal-body">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className="confirm-modal-actions">
          <button className="btn-confirm-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button 
            className={`btn-confirm-proceed ${type}`} 
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
