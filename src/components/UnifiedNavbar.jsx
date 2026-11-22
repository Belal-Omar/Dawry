import React, { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import Icon from './Icons';
import { PORTALS, portalStyleVars } from './portals';

const NAV_LINKS = [
  { id: 'home', label: 'الرئيسية', drawerLabel: 'الرئيسية', icon: 'home' },
  { id: 'specialties', label: 'التخصصات', drawerLabel: 'التخصصات الطبية', icon: 'stethoscope' },
  { id: 'search', label: 'ابحث عن طبيب', drawerLabel: 'ابحث عن طبيب', icon: 'search' },
  { id: 'bookings', label: 'حجوزاتي', drawerLabel: 'حجوزاتي', icon: 'calendarCheck' },
  { id: 'tracking', label: 'متابعة الدور', drawerLabel: 'متابعة الدور الحي', icon: 'clock' }
];

export default function UnifiedNavbar({
  activePage = 'home',
  onNavigate,
  onOpenPortal,
  dark,
  setDark,
  onOpenPatientModal,
  patientName
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalsOpen, setPortalsOpen] = useState(false);
  const portalsRef = useRef(null);

  const handleNav = (target) => {
    setMobileMenuOpen(false);
    setPortalsOpen(false);
    if (onNavigate) {
      onNavigate(target);
    } else {
      window.location.hash = target === 'home' ? '' : target;
    }
  };

  const handlePortal = (id) => {
    setMobileMenuOpen(false);
    setPortalsOpen(false);
    if (onOpenPortal) onOpenPortal(id);
    else handleNav(id);
  };

  // Close the portals popover on outside click / Escape
  useEffect(() => {
    if (!portalsOpen) return undefined;
    const onDoc = (e) => {
      if (portalsRef.current && !portalsRef.current.contains(e.target)) setPortalsOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setPortalsOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [portalsOpen]);

  // Lock page scroll while the mobile drawer is open
  useEffect(() => {
    document.body.classList.toggle('no-scroll', mobileMenuOpen);
    return () => document.body.classList.remove('no-scroll');
  }, [mobileMenuOpen]);

  const logoutPatient = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dawry_patient_name');
      localStorage.removeItem('dawry_patient_phone');
      localStorage.removeItem('dawry_patient_city');
      localStorage.removeItem('dawry_last_booking_code');
      window.location.reload();
    }
  };

  return (
    <>
      <header className="patient-header">
        <div className="header-brand-nav">
          <Logo onClick={() => handleNav('home')} />
          {/* Desktop Navigation */}
          <nav className="desktop-nav">
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={activePage === l.id ? 'active' : ''}
                onClick={() => handleNav(l.id)}
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Left Actions (Desktop & Mobile) */}
        <div className="header-left-actions">
          {/* Work portals (Doctor / Reception / Admin) — highlighted dropdown */}
          <div className="portals-menu-wrap desktop-only" ref={portalsRef}>
            <button
              type="button"
              className={`portals-trigger ${portalsOpen ? 'open' : ''}`}
              onClick={() => setPortalsOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={portalsOpen}
            >
              <Icon name="grid" size={16} />
              <span>بوابات العمل</span>
              <Icon name="chevronDown" size={14} className="chev" />
            </button>

            {portalsOpen && (
              <div className="portals-menu" role="menu">
                <div className="portals-menu-head">اختر البوابة المناسبة لدورك</div>
                {PORTALS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    className="portals-menu-item"
                    style={portalStyleVars(p)}
                    onClick={() => handlePortal(p.id)}
                  >
                    <span className="pm-icon"><Icon name={p.icon} size={20} /></span>
                    <span className="pm-text">
                      <b>{p.name}</b>
                      <small>{p.tagline}</small>
                    </span>
                    <Icon name="chevronLeft" size={16} className="pm-arrow" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <ThemeToggle dark={dark} setDark={setDark} />

          {patientName ? (
            <>
              <button
                type="button"
                className="login-pill-btn desktop-only"
                onClick={onOpenPatientModal}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-2)', borderColor: 'var(--primary)' }}
                title="تعديل بيانات الحساب"
              >
                <Icon name="user" size={15} />
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{patientName.split(' ')[0]}</span>
              </button>
              <button
                type="button"
                className="login-pill-btn desktop-only"
                onClick={logoutPatient}
                style={{ color: 'var(--danger)', fontSize: '12px' }}
                title="تسجيل الخروج والحجز بمريض جديد"
              >
                خروج
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`login-pill-btn desktop-only ${activePage === 'login' ? 'active-pill' : ''}`}
              onClick={() => handleNav('login')}
              style={{
                background: activePage === 'login' ? 'var(--primary)' : undefined,
                color: activePage === 'login' ? '#fff' : undefined
              }}
            >
              تسجيل الدخول
            </button>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="القائمة الرئيسية"
            aria-expanded={mobileMenuOpen}
            title="القائمة"
          >
            <Icon name={mobileMenuOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Drawer Menu */}
      <div className={`mobile-nav-drawer ${mobileMenuOpen ? 'open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="mobile-drawer-header">
          <Logo onClick={() => handleNav('home')} />
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mobile-drawer-user-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="mobile-user-avatar"><Icon name="user" size={20} /></span>
            <div>
              <b style={{ display: 'block', fontSize: '14px', color: 'var(--text)' }}>
                {patientName || 'زائر (Guest)'}
              </b>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                منصة دُوري لإدارة المواعيد
              </small>
            </div>
          </div>
        </div>

        <nav className="mobile-drawer-links">
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`mobile-link-item ${activePage === l.id ? 'active' : ''}`}
              onClick={() => handleNav(l.id)}
            >
              <span className="link-icon"><Icon name={l.icon} size={19} /></span>
              <span>{l.drawerLabel}</span>
            </button>
          ))}
        </nav>

        {/* Work portals — highlighted block */}
        <div className="mobile-portals">
          <div className="mobile-portals-title">بوابات العمل</div>
          {PORTALS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="mobile-portal-item"
              style={portalStyleVars(p)}
              onClick={() => handlePortal(p.id)}
            >
              <span className="pm-icon"><Icon name={p.icon} size={20} /></span>
              <span className="pm-text">
                <b>{p.name}</b>
                <small>{p.tagline}</small>
              </span>
              <Icon name="chevronLeft" size={16} className="pm-arrow" />
            </button>
          ))}
        </div>

        <div className="mobile-drawer-actions">
          {patientName ? (
            <>
              {onOpenPatientModal && (
                <button
                  type="button"
                  className="mobile-action-btn primary"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenPatientModal();
                  }}
                >
                  <Icon name="user" size={17} />
                  <span>تعديل بياناتي ({patientName.split(' ')[0]})</span>
                </button>
              )}
              <button
                type="button"
                className="mobile-action-btn secondary"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={logoutPatient}
              >
                <Icon name="logout" size={17} />
                <span>خروج (الدخول بمريض جديد)</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="mobile-action-btn primary"
                onClick={() => handleNav('login')}
              >
                <span>تسجيل الدخول</span>
                <Icon name="arrowLeft" size={17} />
              </button>

              <button
                type="button"
                className="mobile-action-btn secondary"
                onClick={() => handleNav('signup')}
              >
                <span>إنشاء حساب جديد</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
