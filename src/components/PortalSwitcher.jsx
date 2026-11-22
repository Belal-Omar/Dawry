import React from 'react';
import Icon from './Icons';
import { PORTALS, portalStyleVars } from './portals';

/* Compact 3-tile switcher placed inside every dashboard sidebar / mobile drawer. */
export default function PortalSwitcher({ current, onSwitch, onHome }) {
  if (!onSwitch) return null;
  return (
    <div className="portal-switcher" role="navigation" aria-label="التنقل بين بوابات المنصة">
      <div className="portal-switcher-title">
        <span className="live-dot-green" />
        بوابات المنصة
      </div>
      <div className="portal-switcher-tiles">
        {PORTALS.map((p) => {
          const active = p.id === current;
          return (
            <button
              key={p.id}
              type="button"
              className={`portal-tile ${active ? 'active' : ''}`}
              style={portalStyleVars(p)}
              onClick={() => (active ? null : onSwitch(p.id))}
              aria-current={active ? 'page' : undefined}
              title={p.name}
            >
              <span className="portal-tile-icon"><Icon name={p.icon} size={18} /></span>
              <span className="portal-tile-label">{p.short}</span>
            </button>
          );
        })}
      </div>
      {onHome && (
        <button type="button" className="portal-switcher-home" onClick={onHome}>
          <Icon name="home" size={14} />
          <span>الموقع العام (واجهة المريض)</span>
        </button>
      )}
    </div>
  );
}

