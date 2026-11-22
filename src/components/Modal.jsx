import React, { useEffect } from 'react';
import Icon from './Icons';

export default function Modal({ isOpen = true, onClose, title, children, footer, maxWidth = '600px' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && (isOpen === undefined || isOpen)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (isOpen === false) return null;

  return (
    <div className="dawry-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="dawry-modal-content"
        style={{ maxWidth, zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dawry-modal-header">
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{title}</h3>
          <button className="icon-button" onClick={onClose} type="button">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="dawry-modal-body">{children}</div>
        {footer && <div className="dawry-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
