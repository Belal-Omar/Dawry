import React from 'react';
import Icon from './Icons';

export default function ThemeToggle({ dark, setDark }) {
  return (
    <button
      className="icon-button"
      onClick={() => setDark(!dark)}
      title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
      type="button"
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
