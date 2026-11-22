import React from 'react';
import Icon from './Icons';

export default function Toast({ toast, onClose }) {
  if (!toast) return null;

  const isSuccess = toast.type !== 'error';

  return (
    <div
      className="dawry-toast"
      style={{
        backgroundColor: isSuccess ? '#1e2653' : '#7f1d1d',
        border: `1px solid ${isSuccess ? '#3949ab' : '#ef4444'}`
      }}
    >
      <Icon name={isSuccess ? 'check' : 'alertTriangle'} size={20} className={isSuccess ? 'text-teal' : 'text-danger'} />
      <span style={{ fontWeight: 600 }}>{toast.message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: '2px',
          marginRight: '8px'
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
