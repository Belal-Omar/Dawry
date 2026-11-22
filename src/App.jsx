import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import PublicWebsite from './pages/PublicWebsite';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DoctorDashboard from './pages/DoctorDashboard';
import ReceptionistDashboard from './pages/ReceptionistDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Logo from './components/Logo';
import Icon from './components/Icons';
import ThemeToggle from './components/ThemeToggle';
import Toast from './components/Toast';
import PortalQuickSwitcher from './components/PortalQuickSwitcher';

const roleLabels = {
  doctor: 'لوحة الطبيب',
  reception: 'مكتب الاستقبال',
  admin: 'مدير المنصة (Super Admin)',
  patient: 'شاشة الطابور الحي'
};

function getInitialState() {
  const hash = window.location.hash.toLowerCase();
  if (hash.includes('signup')) return { view: 'signup', inApp: false, role: 'patient' };
  if (hash.includes('login')) return { view: 'login', inApp: false, role: 'patient' };
  if (hash.includes('admin')) return { view: 'app', inApp: true, role: 'admin' };
  if (hash.includes('reception')) return { view: 'app', inApp: true, role: 'reception' };
  if (hash.includes('doctor')) return { view: 'app', inApp: true, role: 'doctor' };
  if (hash.includes('patient') || hash.includes('queue')) return { view: 'app', inApp: true, role: 'patient' };
  if (hash.includes('app')) return { view: 'app', inApp: true, role: 'doctor' };
  return { view: 'website', inApp: false, role: 'patient' };
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('dawry-theme') === 'dark');
  const [currentView, setCurrentView] = useState(() => getInitialState().view);
  const [inApp, setInApp] = useState(() => getInitialState().inApp);
  const [currentRole, setCurrentRole] = useState(() => getInitialState().role);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Authenticated Doctor Session State
  const [authenticatedDoctor, setAuthenticatedDoctor] = useState(() => {
    try {
      const saved = localStorage.getItem('dawry_authenticated_doctor');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Listen to hash changes for deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const state = getInitialState();
      setCurrentView(state.view);
      setInApp(state.inApp);
      setCurrentRole(state.role);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Active doctor for doctor/receptionist workspace
  const [activeDoctorId, setActiveDoctorId] = useState(1);
  const [availableDoctors, setAvailableDoctors] = useState([]);

  // Theme synchronization
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('dawry-theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Load doctors list for workspace selector
  useEffect(() => {
    api.getDoctors().then((res) => {
      if (res.success && res.doctors) {
        setAvailableDoctors(res.doctors);
        if (res.doctors[0] && !authenticatedDoctor) {
          setActiveDoctorId(res.doctors[0].id);
        }
      }
    });
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleOpenApp = async (role = 'doctor') => {
    if (role === 'login') {
      setCurrentView('login');
      setInApp(false);
      window.location.hash = '#login';
      window.scrollTo(0, 0);
      return;
    }
    if (role === 'signup') {
      setCurrentView('signup');
      setInApp(false);
      window.location.hash = '#signup';
      window.scrollTo(0, 0);
      return;
    }

    // Auto-authenticate demo account for frictionless 1-tap portal preview (issues valid signed token)
    if (role === 'doctor') {
      const res = await api.login({ identifier: authenticatedDoctor?.email || 'dr.tarek@dawry.com', password: '123456' });
      if (res && res.success && res.user) {
        setAuthenticatedDoctor(res.user);
        setActiveDoctorId(res.user.id);
        localStorage.setItem('dawry_authenticated_doctor', JSON.stringify(res.user));
      }
    } else if (role === 'reception') {
      const res = await api.login({ identifier: authenticatedReceptionist?.email || 'reception.tarek@dawry.com', password: '123456' });
      if (res && res.success && res.user) {
        setAuthenticatedReceptionist(res.user);
        localStorage.setItem('dawry_authenticated_receptionist', JSON.stringify(res.user));
      }
    } else if (role === 'admin') {
      await api.login({ identifier: 'admin@dawry.com', password: 'admin123' });
    }

    setCurrentRole(role);
    setInApp(true);
    setCurrentView('app');
    location.hash = role;
    window.scrollTo(0, 0);
  };

  const handleSelectRole = (role) => {
    setCurrentRole(role);
    location.hash = role;
  };

  const handleReturnHome = () => {
    setInApp(false);
    setCurrentView('website');
    location.hash = '';
    window.scrollTo(0, 0);
  };

  const handleNavigate = (target) => {
    if (target === 'login') {
      setCurrentView('login');
      setInApp(false);
      window.location.hash = '#login';
    } else if (target === 'signup') {
      setCurrentView('signup');
      setInApp(false);
      window.location.hash = '#signup';
    } else if (target === 'home' || target === '') {
      setCurrentView('website');
      setInApp(false);
      window.location.hash = '';
    } else {
      window.location.hash = '#' + target;
    }
    window.scrollTo(0, 0);
  };

  const handleUnifiedLoginSuccess = (user, role) => {
    if (role === 'admin') {
      setCurrentRole('admin');
      setInApp(true);
      setCurrentView('app');
      window.location.hash = '#admin';
    } else if (role === 'doctor') {
      setAuthenticatedDoctor(user);
      setActiveDoctorId(user.id);
      localStorage.setItem('dawry_authenticated_doctor', JSON.stringify(user));
      setInApp(true);
      setCurrentRole('doctor');
      setCurrentView('app');
      window.location.hash = '#doctor';
    } else if (role === 'reception') {
      setAuthenticatedReceptionist(user);
      localStorage.setItem('dawry_authenticated_receptionist', JSON.stringify(user));
      setInApp(true);
      setCurrentRole('reception');
      setCurrentView('app');
      window.location.hash = '#reception';
    } else {
      // Patient
      if (user && user.name) localStorage.setItem('dawry_patient_name', user.name);
      if (user && user.phone) localStorage.setItem('dawry_patient_phone', user.phone);
      setInApp(false);
      setCurrentView('website');
      window.location.hash = '';
    }
  };

  const handleDoctorLoginSuccess = (doc) => {
    setAuthenticatedDoctor(doc);
    setActiveDoctorId(doc.id);
    localStorage.setItem('dawry_authenticated_doctor', JSON.stringify(doc));
    setInApp(true);
    setCurrentRole('doctor');
    setCurrentView('app');
    location.hash = 'doctor';
  };

  const handleDoctorLogout = () => {
    setAuthenticatedDoctor(null);
    localStorage.removeItem('dawry_authenticated_doctor');
    api.logout();
    showToast('تم تسجيل الخروج من حساب الطبيب بنجاح', 'info');
  };

  // Authenticated Receptionist Session State
  const [authenticatedReceptionist, setAuthenticatedReceptionist] = useState(() => {
    try {
      const saved = localStorage.getItem('dawry_authenticated_receptionist');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const handleReceptionistLoginSuccess = (rec) => {
    setAuthenticatedReceptionist(rec);
    localStorage.setItem('dawry_authenticated_receptionist', JSON.stringify(rec));
    setInApp(true);
    setCurrentRole('reception');
    setCurrentView('app');
    location.hash = 'reception';
  };

  const handleReceptionistLogout = () => {
    setAuthenticatedReceptionist(null);
    localStorage.removeItem('dawry_authenticated_receptionist');
    api.logout();
    showToast('تم تسجيل الخروج من حساب الاستقبال بنجاح', 'info');
  };

  const currentDoctorObj = availableDoctors.find((d) => d.id === Number(activeDoctorId)) || availableDoctors[0] || {
    full_name: 'د. طارق عبد العزيز',
    clinic_name: 'مركز الحياة للقلب',
    branch_name: 'فرع مصر الجديدة',
    title: 'استشاري أمراض القلب والأوعية الدموية'
  };

  // 1. DEDICATED SIGNUP PAGE (FOR PATIENTS ONLY)
  if (currentView === 'signup') {
    return (
      <>
        <SignupPage
          dark={dark}
          setDark={setDark}
          onSignupSuccess={(patient) => {
            setCurrentView('website');
            setInApp(false);
            window.location.hash = '';
          }}
          onNavigate={handleNavigate}
          showToast={showToast}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // 2. UNIFIED UNIVERSAL LOGIN PAGE (FOR ALL ROLES)
  if (currentView === 'login') {
    return (
      <>
        <LoginPage
          dark={dark}
          setDark={setDark}
          onLoginSuccess={handleUnifiedLoginSuccess}
          onNavigate={handleNavigate}
          showToast={showToast}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // 3. PUBLIC WEBSITE MODE
  if (!inApp) {
    return (
      <>
        <PublicWebsite
          dark={dark}
          setDark={setDark}
          onOpenApp={handleOpenApp}
          showToast={showToast}
        />
        <PortalQuickSwitcher
          currentRole={currentRole}
          inApp={false}
          onSelectRole={handleOpenApp}
          onGoHome={handleReturnHome}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // 4. DEDICATED DOCTOR WORKSPACE & LOGIN (ISOLATED MULTI-TENANT ARCHITECTURE)
  if (currentRole === 'doctor') {
    if (!authenticatedDoctor) {
      return (
        <>
          <LoginPage
            dark={dark}
            setDark={setDark}
            onLoginSuccess={handleUnifiedLoginSuccess}
            onNavigate={handleNavigate}
            showToast={showToast}
          />
          <PortalQuickSwitcher
            currentRole="doctor"
            inApp={true}
            onSelectRole={handleOpenApp}
            onGoHome={handleReturnHome}
          />
          <Toast toast={toast} onClose={() => setToast(null)} />
        </>
      );
    }

    return (
      <>
        <DoctorDashboard
          doctorId={authenticatedDoctor.id}
          doctor={authenticatedDoctor}
          onLogout={handleDoctorLogout}
          onHome={handleReturnHome}
          dark={dark}
          setDark={setDark}
          showToast={showToast}
        />
        <PortalQuickSwitcher
          currentRole="doctor"
          inApp={true}
          onSelectRole={handleOpenApp}
          onGoHome={handleReturnHome}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // 5. DEDICATED RECEPTIONIST WORKSPACE & LOGIN (OPERATIONAL QUEUE CONTROL)
  if (currentRole === 'reception') {
    if (!authenticatedReceptionist) {
      return (
        <>
          <LoginPage
            dark={dark}
            setDark={setDark}
            onLoginSuccess={handleUnifiedLoginSuccess}
            onNavigate={handleNavigate}
            showToast={showToast}
          />
          <PortalQuickSwitcher
            currentRole="reception"
            inApp={true}
            onSelectRole={handleOpenApp}
            onGoHome={handleReturnHome}
          />
          <Toast toast={toast} onClose={() => setToast(null)} />
        </>
      );
    }

    return (
      <>
        <ReceptionistDashboard
          receptionistId={authenticatedReceptionist.id}
          receptionist={authenticatedReceptionist}
          onLogout={handleReceptionistLogout}
          onHome={handleReturnHome}
          dark={dark}
          setDark={setDark}
          showToast={showToast}
        />
        <PortalQuickSwitcher
          currentRole="reception"
          inApp={true}
          onSelectRole={handleOpenApp}
          onGoHome={handleReturnHome}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // 4. DEDICATED SUPER ADMIN PLATFORM OWNER WORKSPACE
  if (currentRole === 'admin') {
    return (
      <>
        <SuperAdminDashboard
          onHome={handleReturnHome}
          dark={dark}
          setDark={setDark}
          showToast={showToast}
        />
        <PortalQuickSwitcher
          currentRole="admin"
          inApp={true}
          onSelectRole={handleOpenApp}
          onGoHome={handleReturnHome}
        />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  // 5. INTEGRATED WORKSPACE APP SHELL FOR PATIENT
  return (
    <div className="workspace rtl">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="overlay"
          style={{ display: 'block' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Logo onClick={handleReturnHome} />
        </div>

        <div className="workspace-label">
          {currentRole === 'reception'
            ? 'مكتب الاستقبال وإدارة الحضور'
            : currentRole === 'admin'
              ? 'لوحة إدارة المنصة (Super Admin)'
              : 'شاشة الطابور المباشر للمريض'}
        </div>

        <nav>
          {Object.keys(roleLabels).map((r) => (
            <button
              key={r}
              type="button"
              className={currentRole === r ? 'active' : ''}
              onClick={() => {
                handleSelectRole(r);
                setMobileMenuOpen(false);
              }}
            >
              <Icon
                name={
                  r === 'doctor'
                    ? 'briefcase'
                    : r === 'reception'
                      ? 'users'
                      : r === 'admin'
                        ? 'shield'
                        : 'clock'
                }
                size={16}
              />
              <span>{roleLabels[r]}</span>
              {currentRole === r && <i style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer User & Return */}
        <div className="sidebar-user">
          <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '12px' }}>
            {currentRole === 'reception' ? 'استقبال' : currentRole === 'admin' ? 'مدير' : 'مريض'}
          </span>
          <div>
            <b>{currentRole === 'admin' ? 'مدير دوري' : 'موظف الاستقبال'}</b>
            <small style={{ color: 'var(--muted)', fontSize: '10px' }}>متصل الآن بالنظام</small>
          </div>
          <button
            type="button"
            className="text-button"
            style={{ fontSize: '11px', color: 'var(--muted)' }}
            onClick={handleReturnHome}
            title="العودة للموقع العام"
          >
            خروج
          </button>
        </div>
      </aside>

      {/* WORKSPACE MAIN */}
      <div className="workspace-main">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="icon-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="القائمة"
            >
              <Icon name="bars" size={18} />
            </button>
            <Logo onClick={handleReturnHome} compact={true} />
          </div>

          <div className="topbar-actions">
            <ThemeToggle dark={dark} setDark={setDark} />
            <button
              type="button"
              className="btn secondary small"
              onClick={handleReturnHome}
            >
              العودة للرئيسية
            </button>
          </div>
        </header>

        {/* DASHBOARD CONTENT CONTAINER */}
        <main className="dashboard-content">
          {currentRole === 'reception' && (
            <ReceptionistDashboard
              receptionistId={1}
              showToast={showToast}
            />
          )}

          {currentRole === 'admin' && (
            <SuperAdminDashboard showToast={showToast} />
          )}

          {currentRole === 'patient' && (
            <div style={{ maxWidth: '700px', margin: '30px auto' }}>
              <div className="queue-hero">
                <div className="queue-ring">
                  <div>
                    <small>الكشف الآن</small>
                    <b>{currentDoctorObj.current_serving_number || 8}</b>
                  </div>
                </div>
                <div className="queue-message">
                  <span>بث مباشر من العيادة</span>
                  <h2>{currentDoctorObj.clinic_name}</h2>
                  <p>{currentDoctorObj.full_name} · {currentDoctorObj.title}</p>
                  <button
                    type="button"
                    className="btn white small"
                    onClick={handleReturnHome}
                  >
                    حجز موعد جديد
                  </button>
                </div>
              </div>

              <div className="queue-stats" style={{ marginTop: '16px' }}>
                <div>
                  <span><Icon name="users" size={18} /></span>
                  <small>يتم الكشف الآن</small>
                  <b>رقم {currentDoctorObj.current_serving_number || 8}</b>
                </div>
                <div>
                  <span><Icon name="clock" size={18} /></span>
                  <small>متوسط الانتظار</small>
                  <b>~ ١٥ دقيقة</b>
                </div>
                <div>
                  <span><Icon name="check" size={18} /></span>
                  <small>حالة العيادة</small>
                  <b>مفتوحة ومنتظمة</b>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <PortalQuickSwitcher
        currentRole={currentRole}
        inApp={true}
        onSelectRole={handleOpenApp}
        onGoHome={handleReturnHome}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
