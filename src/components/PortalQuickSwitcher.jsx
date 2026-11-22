import React, { useState } from 'react';
import Icon from './Icons';
import { PORTALS, portalStyleVars } from './portals';

export default function PortalQuickSwitcher({ currentRole, inApp, onSelectRole, onGoHome }) {
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  if (collapsed) {
    return (
      <aside aria-label="شريط البوابات السريع" className="portal-dock-collapsed">
        <button
          type="button"
          className="portal-dock-fab"
          onClick={() => setCollapsed(false)}
          title="فتح بوابات الوصول السريع (الطبيب · الاستقبال · الإدارة)"
          aria-label="فتح بوابات الوصول السريع"
        >
          <span className="portal-fab-dot" />
          <Icon name="grid" size={16} />
          <span>بوابات العمل</span>
        </button>
      </aside>
    );
  }

  return (
    <nav aria-label="شريط البوابات السريع" className="portal-dock">
      <div className="portal-dock-head">
        <div className="portal-dock-title">
          <span className="portal-live-dot">
            <span className="portal-live-ping" />
            <span className="portal-live-core" />
          </span>
          <b>بوابات النظام</b>
          <span className="portal-dock-chip">تبديل فوري</span>
        </div>

        <div className="portal-dock-actions">
          {inApp && (
            <button
              type="button"
              className="portal-dock-home"
              onClick={onGoHome}
              title="العودة للموقع العام (واجهة المريض)"
            >
              <Icon name="home" size={14} />
              <span>واجهة المريض</span>
            </button>
          )}
          <button
            type="button"
            className="portal-dock-min"
            onClick={() => setCollapsed(true)}
            title="تصغير الشريط"
            aria-label="تصغير الشريط"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      <div className="portal-dock-grid">
        {PORTALS.map((p) => {
          const isActive = inApp && currentRole === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`portal-dock-btn ${isActive ? 'active' : ''}`}
              style={portalStyleVars(p)}
              onClick={() => onSelectRole(p.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="portal-dock-icon">
                <Icon name={p.icon} size={18} strokeWidth={1.9} />
              </span>
              <span className="portal-dock-meta">
                <b className="portal-dock-name">{p.name}</b>
                <small className="portal-dock-sub">{p.tagline}</small>
              </span>
              {isActive ? (
                <span className="portal-dock-live">متصل</span>
              ) : (
                <Icon name="chevronLeft" size={14} className="portal-dock-arrow" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

