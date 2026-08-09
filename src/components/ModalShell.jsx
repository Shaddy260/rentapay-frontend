import React from 'react';

export default function ModalShell({ title, children, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3>{title}</h3>
          <button className="modal-card__close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
