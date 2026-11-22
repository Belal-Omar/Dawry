import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Logo from '../components/Logo';
import Icon from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';

export default function ReceptionistDashboard({
  receptionistId = 1,
  receptionist = null,
  onLogout,
  onHome,
  dark,
  setDark,
  showToast
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 7 exact navigation sections from Prompt Section 9:
  // 'dashboard' | 'appointments' | 'queue' | 'walkin' | 'search' | 'notifications' | 'settings'
  const [activeTab, setActiveTab] = useState('queue');
  const [loading, setLoading] = useState(true);

  // Core Data
  const [dashboardData, setData] = useState(null);
  const [queueEntries, setQueueEntries] = useState([]);
  const [queueState, setQueueState] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Filters & Inputs
  const todayDateStr = new Date().toISOString().split('T')[0];
  const tomorrowDateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterdayDateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const [selectedApptDate, setSelectedApptDate] = useState(todayDateStr);
  const [selectedQueueDate, setSelectedQueueDate] = useState(todayDateStr);
  const [apptSearch, setApptSearch] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);

  // Fast Check-in Input
  const [quickCheckinCode, setQuickCheckinCode] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Walk-in Form State
  const defaultToday = new Date().toISOString().split('T')[0];
  const [walkinForm, setWalkinForm] = useState({
    patient_name: '',
    patient_phone: '',
    notes: '',
    is_emergency: false,
    booking_mode: 'today', // 'today' | 'future'
    appointment_date: defaultToday,
    appointment_time: '18:00'
  });
  const [isSubmittingWalkin, setIsSubmittingWalkin] = useState(false);
  const [lastRegisteredWalkin, setLastRegisteredWalkin] = useState(null);

  // Modals State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'تأكيد',
    isDanger: false
  });

  const [rescheduleModal, setRescheduleModal] = useState({
    isOpen: false,
    appointment: null,
    newTime: ''
  });

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: ''
  });

  // Initial load
  useEffect(() => {
    loadAllData();
  }, [receptionistId]);

  // Real-time synchronization every 3 seconds
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncLiveQueue();
    }, 3000);
    return () => clearInterval(syncInterval);
  }, [receptionistId, selectedQueueDate]);

  const loadAppointments = async (date = selectedApptDate, status = apptStatusFilter, search = apptSearch) => {
    try {
      const params = {};
      if (date && date !== 'all') params.date = date;
      if (date === 'all') params.date = 'all';
      if (status && status !== 'all') params.status = status;
      if (search) params.search = search;
      const res = await api.getReceptionistAppointments(receptionistId, params);
      if (res.success) setAppointments(res.appointments || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAppointments(selectedApptDate, apptStatusFilter, apptSearch);
  }, [receptionistId, selectedApptDate, apptStatusFilter, apptSearch]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, queueRes, apptsRes, notifRes] = await Promise.all([
        api.getReceptionistDashboard(receptionistId),
        api.getReceptionistQueue(receptionistId, { date: selectedQueueDate }),
        api.getReceptionistAppointments(receptionistId, { date: selectedApptDate }),
        api.getReceptionistNotifications(receptionistId)
      ]);

      if (dashRes.success) {
        setData(dashRes);
        if (dashRes.receptionist) {
          setProfileForm({
            name: dashRes.receptionist.name || '',
            phone: dashRes.receptionist.phone || '',
            email: dashRes.receptionist.email || ''
          });
        }
      }
      if (queueRes.success) {
        setQueueEntries(queueRes.queueEntries || []);
        setQueueState(queueRes.queueState || null);
      }
      if (apptsRes.success) setAppointments(apptsRes.appointments || []);
      if (notifRes.success) setNotifications(notifRes.notifications || []);
    } catch (err) {
      console.error('Error loading receptionist workspace:', err);
    }
    setLoading(false);
  };

  const syncLiveQueue = async (qDate = selectedQueueDate) => {
    try {
      const [dashRes, queueRes] = await Promise.all([
        api.getReceptionistDashboard(receptionistId),
        api.getReceptionistQueue(receptionistId, { date: qDate })
      ]);
      if (dashRes.success) setData(dashRes);
      if (queueRes.success) {
        setQueueEntries(queueRes.queueEntries || []);
        setQueueState(queueRes.queueState || null);
      }
    } catch (e) {
      // silent background sync
    }
  };

  useEffect(() => {
    syncLiveQueue(selectedQueueDate);
  }, [selectedQueueDate]);

  // -------------------------------------------------------------
  // QUEUE CONTROL ACTIONS
  // -------------------------------------------------------------
  const executeQueueAction = async (action, queueId = null, extraParams = {}) => {
    const res = await api.receptionistQueueAction(receptionistId, {
      action,
      queue_id: queueId,
      ...extraParams
    });

    if (res.success) {
      showToast(res.message, 'success');
      syncLiveQueue();
      // Also reload appointments to reflect status updates
      api.getReceptionistAppointments(receptionistId).then(r => {
        if (r.success) setAppointments(r.appointments || []);
      });
    } else {
      showToast(res.message || 'حدث خطأ في تنفيذ الإجراء', 'error');
    }
  };

  // Call Next Patient
  const handleCallNext = (queueId = null) => {
    executeQueueAction('call_next', queueId);
  };

  // Start Serving (جاري الكشف)
  const handleStartServing = (queueId) => {
    executeQueueAction('start_serving', queueId);
  };

  // Complete Visit (انتهى الكشف)
  const handleCompleteVisit = (queueId) => {
    executeQueueAction('complete_visit', queueId);
  };

  // Skip Patient (تخطي)
  const handleSkipPatient = (queueId) => {
    executeQueueAction('skip', queueId);
  };

  // Return to Queue (إعادة للانتظار)
  const handleReturnToQueue = (queueId) => {
    executeQueueAction('return_to_queue', queueId);
  };

  // Toggle Priority / Reorder
  const handleTogglePriority = (queueId) => {
    executeQueueAction('reorder', queueId, { new_position: 'priority' });
  };

  // Remove Entry with Confirmation Dialog
  const handleRemoveEntryPrompt = (entry) => {
    setConfirmModal({
      isOpen: true,
      title: 'حذف مريض من الطابور',
      message: `هل أنت متأكد من حذف المريض "${entry.patient_name}" (دور رقم ${entry.queue_number}) من الطابور اليوم؟`,
      confirmText: 'نعم، حذف القيد',
      isDanger: true,
      onConfirm: () => {
        executeQueueAction('remove_entry', entry.id, { reason: 'إلغاء وتفريغ بواسطة الاستقبال' });
        setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
      }
    });
  };

  // Pause / Resume Queue
  const handleToggleQueuePause = () => {
    if (queueState?.status === 'paused') {
      executeQueueAction('resume_queue');
    } else {
      executeQueueAction('pause_queue');
    }
  };

  // Notify Doctor Ready
  const handleNotifyDoctor = (queueId = null) => {
    executeQueueAction('notify_doctor', queueId);
  };

  // -------------------------------------------------------------
  // APPOINTMENT ACTIONS
  // -------------------------------------------------------------
  const handleApptAction = async (apptId, action, extra = {}) => {
    const res = await api.receptionistAppointmentAction(receptionistId, apptId, { action, ...extra });
    if (res.success) {
      showToast(res.message, 'success');
      api.getReceptionistAppointments(receptionistId).then(r => {
        if (r.success) setAppointments(r.appointments || []);
      });
      syncLiveQueue();
    } else {
      showToast(res.message || 'فشل تنفيذ الإجراء', 'error');
    }
  };

  // Fast Checkin by Code or Phone
  const handleFastCheckin = async (e) => {
    e.preventDefault();
    if (!quickCheckinCode.trim()) return;
    setIsCheckingIn(true);
    const res = await api.receptionistCheckin(receptionistId, quickCheckinCode.trim());
    setIsCheckingIn(false);
    if (res.success) {
      showToast(res.message, 'success');
      setQuickCheckinCode('');
      syncLiveQueue();
      api.getReceptionistAppointments(receptionistId).then(r => {
        if (r.success) setAppointments(r.appointments || []);
      });
    } else {
      showToast(res.message || 'لم يتم العثور على الحجز', 'error');
    }
  };

  // Helper to validate Egyptian mobile phone numbers
  const isValidEgyptianPhone = (phone) => {
    const cleaned = String(phone || '').trim().replace(/[\s\-\+]/g, '');
    return /^(?:(?:01[0125]\d{8})|(?:201[0125]\d{8}))$/.test(cleaned);
  };

  // Walk-in Registration Submit
  const handleWalkinSubmit = async (e) => {
    e.preventDefault();
    if (!walkinForm.patient_name.trim() || !walkinForm.patient_phone.trim()) {
      showToast('يرجى إدخال اسم المريض ورقم الهاتف', 'error');
      return;
    }
    if (!isValidEgyptianPhone(walkinForm.patient_phone)) {
      showToast('يرجى إدخال رقم هاتف محمول صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015', 'error');
      return;
    }
    setIsSubmittingWalkin(true);
    const targetPayload = {
      ...walkinForm,
      appointment_date: walkinForm.booking_mode === 'today' ? defaultToday : walkinForm.appointment_date,
      appointment_time: walkinForm.booking_mode === 'today' ? new Date().toTimeString().split(' ')[0].slice(0, 5) : walkinForm.appointment_time
    };
    const res = await api.registerWalkin(receptionistId, targetPayload);
    setIsSubmittingWalkin(false);

    if (res.success) {
      showToast(res.message, 'success');
      setLastRegisteredWalkin({
        name: walkinForm.patient_name,
        phone: walkinForm.patient_phone,
        queue_number: res.queue_number,
        booking_code: res.booking_code,
        appointment_date: res.appointment_date || targetPayload.appointment_date,
        appointment_time: res.appointment_time || targetPayload.appointment_time,
        is_future: res.is_future,
        tracking_link: res.tracking_link
      });
      setWalkinForm({
        patient_name: '',
        patient_phone: '',
        notes: '',
        is_emergency: false,
        booking_mode: 'today',
        appointment_date: defaultToday,
        appointment_time: '18:00'
      });
      syncLiveQueue();
    } else {
      showToast(res.message || 'حدث خطأ أثناء التسجيل', 'error');
    }
  };

  // Patient Search
  const handlePatientSearch = async (e) => {
    e.preventDefault();
    if (!patientSearchQuery.trim()) return;
    setIsSearchingPatients(true);
    const res = await api.searchReceptionistPatients(receptionistId, patientSearchQuery.trim());
    setIsSearchingPatients(false);
    if (res.success) {
      setPatientSearchResults(res.patients || []);
      if (res.patients?.length === 0) {
        showToast('لا توجد سجلات مطابقة للبحث', 'info');
      }
    }
  };

  // Profile Form Submit
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    const res = await api.updateReceptionistProfile(receptionistId, profileForm);
    if (res.success) {
      showToast(res.message, 'success');
      loadAllData();
    } else {
      showToast(res.message || 'تعذر حفظ البيانات', 'error');
    }
  };

  // Navigation Items (Exact 7 sections from prompt)
  const navItems = [
    { id: 'dashboard', label: 'الرئيسية', icon: 'grid' },
    { id: 'appointments', label: 'مواعيد اليوم', icon: 'calendar', badge: appointments.filter(a => a.status === 'confirmed').length || null },
    { id: 'queue', label: 'إدارة الدور', icon: 'users', badge: queueEntries.filter(e => e.status === 'waiting').length || null },
    { id: 'walkin', label: 'تسجيل مريض', icon: 'plus' },
    { id: 'search', label: 'البحث عن مريض', icon: 'search' },
    { id: 'notifications', label: 'الإشعارات', icon: 'shield', badge: notifications.length || null },
    { id: 'settings', label: 'الإعدادات الشخصية', icon: 'settings' }
  ];

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: 'var(--muted)' }} className="rtl">
        جاري تحميل مساحة عمل مكتب الاستقبال...
      </div>
    );
  }

  const recInfo = dashboardData?.receptionist || receptionist || {};
  const stats = dashboardData?.stats || {};
  const currentServing = queueEntries.find(e => e.status === 'in_progress' || e.status === 'called') || dashboardData?.currentPatient;
  const waitingPatients = queueEntries.filter(e => e.status === 'waiting');
  const nextInLine = waitingPatients[0] || dashboardData?.nextPatient;
  const completedPatients = queueEntries.filter(e => e.status === 'completed');
  const skippedPatients = queueEntries.filter(e => e.status === 'skipped');

  // Filtered Appointments
  const filteredAppts = appointments.filter(a => {
    if (apptStatusFilter !== 'all' && a.status !== apptStatusFilter) return false;
    if (apptSearch.trim()) {
      const q = apptSearch.toLowerCase();
      return a.patient_name?.toLowerCase().includes(q) || a.patient_phone?.includes(q) || a.booking_code?.toLowerCase().includes(q);
    }
    return true;
  });

  // Filtered Queue
  const filteredQueue = queueEntries.filter(e => {
    if (queueFilter === 'all') return true;
    if (queueFilter === 'waiting') return e.status === 'waiting';
    if (queueFilter === 'in_progress') return e.status === 'in_progress' || e.status === 'called';
    if (queueFilter === 'completed') return e.status === 'completed';
    if (queueFilter === 'skipped') return e.status === 'skipped';
    return true;
  });

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

      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION (FIGMA STYLE WITH EXACT 7 SECTIONS) */}
      {/* ------------------------------------------------------------- */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Logo onClick={onHome} />
        </div>

        {/* Receptionist & Assigned Doctor Identity Card */}
        <div style={{ padding: '12px 14px 6px' }}>
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <img
              src={recInfo.doctor_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80'}
              alt={recInfo.doctor_name}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '1px solid var(--line)'
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b
                style={{
                  fontSize: '11px',
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text)'
                }}
              >
                {recInfo.clinic_name || 'مركز الحياة للقلب'}
              </b>
              <small style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '10px', display: 'block' }}>
                {recInfo.doctor_name || 'د. طارق عبد العزيز'} · {recInfo.branch_name || 'الفرع الرئيسي'}
              </small>
            </div>
          </div>
        </div>

        {/* 7 Nav Items in Sidebar */}
        <nav
          style={{
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            flex: 1,
            overflowY: 'auto'
          }}
        >
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={isActive ? 'active' : ''}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                style={{
                  width: '100%',
                  minHeight: '40px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'var(--primary-soft)' : 'transparent',
                  color: isActive ? 'var(--primary)' : 'var(--muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  textAlign: 'right',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon name={item.icon} size={16} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge ? (
                  <span
                    style={{
                      background: item.id === 'queue' ? 'var(--primary)' : 'var(--primary-soft)',
                      color: item.id === 'queue' ? '#fff' : 'var(--primary)',
                      borderRadius: '12px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: 800
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Receptionist Profile & Logout */}
        <div className="sidebar-user" style={{ borderTop: '1px solid var(--line)', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '12px'
            }}
          >
            استقبال
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
              {recInfo.name || 'موظف الاستقبال'}
            </b>
            <small style={{ color: '#16a36a', fontSize: '9px', fontWeight: 600 }}>تحكم كامل بالطابور</small>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={onLogout}
            style={{
              fontSize: '11px',
              color: 'var(--danger)',
              fontWeight: 700,
              padding: '4px 6px',
              cursor: 'pointer'
            }}
            title="تسجيل الخروج والعودة لصفحة الدخول"
          >
            خروج
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* WORKSPACE MAIN (TOPBAR + ACTIVE TAB CONTENT) */}
      {/* ------------------------------------------------------------- */}
      <div className="workspace-main">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-start" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="icon-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="القائمة"
            >
              <Icon name="bars" size={18} />
            </button>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                {navItems.find(i => i.id === activeTab)?.label}
              </h2>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                عيادة: {recInfo.doctor_name} · {recInfo.branch_name}
              </small>
            </div>
          </div>

          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Quick Queue Pause / Resume button */}
            <button
              type="button"
              className={`btn small ${queueState?.status === 'paused' ? 'danger' : 'secondary'}`}
              onClick={handleToggleQueuePause}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="إيقاف أو استئناف الطابور"
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: queueState?.status === 'paused' ? '#e05252' : '#16a36a' }} />
              <span>{queueState?.status === 'paused' ? 'الطابور موقوف مؤقتاً (استئناف)' : 'الطابور نشط (إيقاف)'}</span>
            </button>

            <span
              style={{
                background: 'rgba(57, 73, 171, 0.08)',
                color: 'var(--primary)',
                border: '1px solid rgba(57, 73, 171, 0.2)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              مزامنة فورية (٣ ثوانٍ)
            </span>

            <ThemeToggle dark={dark} setDark={setDark} />

            <button
              type="button"
              className="btn secondary small"
              onClick={onLogout}
              title="تبديل موظف الاستقبال أو العيادة"
            >
              تبديل الاستقبال
            </button>

            <button
              type="button"
              className="btn secondary small"
              onClick={onHome}
            >
              الموقع العام
            </button>
          </div>
        </header>

        {/* DASHBOARD CONTENT BODY */}
        <main className="dashboard-content" style={{ padding: '24px' }}>
          {/* ========================================================= */}
          {/* 1. الرئيسية (RECEPTION DASHBOARD OVERVIEW) */}
          {/* ========================================================= */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Quick Operational Action Bar */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e2442 0%, #3949ab 100%)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  color: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  boxShadow: '0 8px 24px rgba(57, 73, 171, 0.2)'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>
                    غرفة عمليات الطابور الحي — عيادة {recInfo.doctor_name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', opacity: 0.9 }}>
                    لديك الصلاحية التشغيلية الحصرية لإدارة الطابور، تأكيد الحضور، ونداء المرضى فورياً
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn white"
                    onClick={() => setActiveTab('walkin')}
                    style={{ fontWeight: 700, fontSize: '13px' }}
                  >
                    + تسجيل مريض مباشر (Walk-in)
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setActiveTab('queue')}
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontWeight: 700 }}
                  >
                    فتح إدارة الطابور الكاملة ←
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => handleCallNext()}
                    disabled={waitingPatients.length === 0}
                    style={{ background: '#16a36a', borderColor: '#16a36a', color: '#fff', fontWeight: 800 }}
                  >
                    نداء التالي ({waitingPatients.length > 0 ? `#${waitingPatients[0].queue_number}` : 'فارغ'})
                  </button>
                </div>
              </div>

              {/* Fast Checkin Form */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                    <Icon name="check" size={18} />
                  </span>
                  <div>
                    <b style={{ fontSize: '13px', display: 'block' }}>تأكيد وصول مريض سريع (Check-in)</b>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>أدخل كود الحجز (مثال: DWR-1001) أو رقم هاتف المريض لإضافته للطابور فوراً</small>
                  </div>
                </div>
                <form onSubmit={handleFastCheckin} style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '420px' }}>
                  <input
                    type="text"
                    value={quickCheckinCode}
                    onChange={(e) => setQuickCheckinCode(e.target.value)}
                    placeholder="كود الحجز أو رقم الهاتف..."
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  />
                  <button
                    type="submit"
                    className="btn primary small"
                    disabled={isCheckingIn}
                    style={{ fontWeight: 700 }}
                  >
                    {isCheckingIn ? 'جاري التحقق...' : 'تأكيد الحضور'}
                  </button>
                </form>
              </div>

              {/* Operational Metrics (Prompt Section 2) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '14px'
                }}
              >
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>مواعيد اليوم الكلية</span>
                  <b style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>{stats.total_appointments || 0}</b>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#16a36a', display: 'block', marginBottom: '6px' }}>وصلوا العيادة</span>
                  <b style={{ fontSize: '24px', fontWeight: 800, color: '#16a36a' }}>{stats.arrived || 0}</b>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>في الانتظار حالياً</span>
                  <b style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{stats.waiting || 0}</b>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#e9a23b', display: 'block', marginBottom: '6px' }}>جاري الكشف عليه</span>
                  <b style={{ fontSize: '24px', fontWeight: 800, color: '#e9a23b' }}>
                    {currentServing ? `#${currentServing.queue_number}` : 'لا يوجد'}
                  </b>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>الكشوفات المكتملة</span>
                  <b style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>{stats.completed || 0}</b>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#e05252', display: 'block', marginBottom: '6px' }}>مواعيد متأخرة</span>
                  <b style={{ fontSize: '24px', fontWeight: 800, color: stats.delayed > 0 ? '#e05252' : 'var(--text)' }}>
                    {stats.delayed || 0}
                  </b>
                </div>
              </div>

              {/* Current Serving & Next in Line Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {/* Current Serving Card */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: currentServing ? '#16a36a' : 'var(--muted)' }} />
                      <b style={{ fontSize: '14px' }}>المريض الحالي داخل العيادة</b>
                    </div>
                    {currentServing && (
                      <span className="badge badge-success">
                        {currentServing.status === 'in_progress' ? 'جاري الكشف' : 'تم استدعاؤه'}
                      </span>
                    )}
                  </div>

                  {currentServing ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'var(--primary-soft)',
                            color: 'var(--primary)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '22px',
                            fontWeight: 900
                          }}
                        >
                          #{currentServing.queue_number}
                        </div>
                        <div>
                          <b style={{ fontSize: '16px', display: 'block', color: 'var(--text)' }}>{currentServing.patient_name}</b>
                          <small style={{ color: 'var(--muted)', fontSize: '12px' }}>{currentServing.patient_phone} · {currentServing.booking_code || 'حجز مباشر'}</small>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn primary small"
                          onClick={() => handleCompleteVisit(currentServing.id)}
                          style={{ flex: 1, background: '#16a36a', borderColor: '#16a36a', fontWeight: 700 }}
                        >
                          ✓ إنهاء الكشف
                        </button>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => handleSkipPatient(currentServing.id)}
                          style={{ fontWeight: 600 }}
                        >
                          تخطي
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                      لا يوجد مريض يتم الكشف عليه الآن
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          className="btn primary small"
                          disabled={waitingPatients.length === 0}
                          onClick={() => handleCallNext()}
                        >
                          استدعاء المريض التالي
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Next Patient in Line */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: nextInLine ? 'var(--primary)' : 'var(--muted)' }} />
                      <b style={{ fontSize: '14px' }}>المريض التالي في قائمة الانتظار</b>
                    </div>
                    {nextInLine && (
                      <span className="badge badge-primary">
                        التالي مباشرة
                      </span>
                    )}
                  </div>

                  {nextInLine ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '16px',
                            background: 'var(--surface-2)',
                            color: 'var(--primary)',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '22px',
                            fontWeight: 900,
                            border: '1px solid var(--line)'
                          }}
                        >
                          #{nextInLine.queue_number}
                        </div>
                        <div>
                          <b style={{ fontSize: '16px', display: 'block', color: 'var(--text)' }}>{nextInLine.patient_name}</b>
                          <small style={{ color: 'var(--muted)', fontSize: '12px' }}>
                            وقت الانتظار المتوقع: ~ {nextInLine.estimated_wait_minutes || 15} دقيقة
                          </small>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn primary small"
                          onClick={() => handleCallNext(nextInLine.id)}
                          style={{ flex: 1, fontWeight: 700 }}
                        >
                          📢 نداء المريض
                        </button>
                        <button
                          type="button"
                          className="btn secondary small"
                          onClick={() => handleNotifyDoctor(nextInLine.id)}
                          title="إشعار الطبيب بأن المريض جاهز"
                        >
                          إشعار الطبيب
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                      قائمة الانتظار فارغة حالياً
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. مواعيد اليوم (TODAY'S APPOINTMENTS) */}
          {/* ========================================================= */}
          {activeTab === 'appointments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Header & Search */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px' }}>
                    جدول ومواعيد العيادة {selectedApptDate === 'all' ? '(كافة المواعيد)' : selectedApptDate === todayDateStr ? '(مواعيد اليوم)' : `(${selectedApptDate})`}
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>إدارة حجوزات أي يوم، تأكيد وصول المرضى، وإدخالهم لقائمة الانتظار مباشرة (إجمالي: {appointments.length} حجز)</small>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={apptSearch}
                    onChange={(e) => setApptSearch(e.target.value)}
                    placeholder="بحث بالاسم أو الهاتف أو الكود..."
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      minWidth: '220px'
                    }}
                  />

                  <select
                    value={apptStatusFilter}
                    onChange={(e) => setApptStatusFilter(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '12px'
                    }}
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="confirmed">في انتظار الحضور (مؤكد)</option>
                    <option value="waiting">وصل العيادة (بالانتظار)</option>
                    <option value="in_progress">جاري الكشف</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>

                {/* Quick Date Pills & Custom Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📅 تصفية حسب التاريخ:
                  </span>
                  <button
                    type="button"
                    className={`btn small ${selectedApptDate === todayDateStr ? 'primary' : 'secondary'}`}
                    onClick={() => setSelectedApptDate(todayDateStr)}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
                  >
                    اليوم ({todayDateStr})
                  </button>
                  <button
                    type="button"
                    className={`btn small ${selectedApptDate === tomorrowDateStr ? 'primary' : 'secondary'}`}
                    onClick={() => setSelectedApptDate(tomorrowDateStr)}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
                  >
                    غداً
                  </button>
                  <button
                    type="button"
                    className={`btn small ${selectedApptDate === yesterdayDateStr ? 'primary' : 'secondary'}`}
                    onClick={() => setSelectedApptDate(yesterdayDateStr)}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
                  >
                    أمس
                  </button>
                  <button
                    type="button"
                    className={`btn small ${selectedApptDate === 'all' ? 'primary' : 'secondary'}`}
                    onClick={() => setSelectedApptDate('all')}
                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}
                  >
                    كافة المواعيد
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>تاريخ مخصص:</span>
                    <input
                      type="date"
                      value={selectedApptDate === 'all' ? '' : selectedApptDate}
                      onChange={(e) => setSelectedApptDate(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '11px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '12px 16px' }}>وقت الموعد</th>
                        <th style={{ padding: '12px 16px' }}>اسم المريض</th>
                        <th style={{ padding: '12px 16px' }}>رقم الهاتف</th>
                        <th style={{ padding: '12px 16px' }}>كود الحجز</th>
                        <th style={{ padding: '12px 16px' }}>حالة الحضور</th>
                        <th style={{ padding: '12px 16px' }}>رقم الدور</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left' }}>إجراءات الاستقبال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppts.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                            لا توجد مواعيد مطابقة للبحث اليوم
                          </td>
                        </tr>
                      ) : (
                        filteredAppts.map(appt => {
                          const isInQueue = !!appt.queue_entry_id;
                          return (
                            <tr key={appt.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)' }}>
                                {appt.appointment_time}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <b style={{ display: 'block', color: 'var(--text)' }}>{appt.patient_name}</b>
                                {appt.type === 'walkin' && <small className="badge badge-warning" style={{ fontSize: '9px', padding: '1px 5px' }}>مباشر</small>}
                              </td>
                              <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                                {appt.patient_phone}
                              </td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                                {appt.booking_code}
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <span
                                  className={`badge ${
                                    appt.status === 'completed'
                                      ? 'badge-success'
                                      : appt.status === 'waiting' || appt.status === 'in_progress'
                                      ? 'badge-primary'
                                      : appt.status === 'cancelled'
                                      ? 'badge-danger'
                                      : 'badge-warning'
                                  }`}
                                >
                                  {appt.status === 'confirmed'
                                    ? 'في انتظار الحضور'
                                    : appt.status === 'waiting'
                                    ? 'وصل العيادة'
                                    : appt.status === 'in_progress'
                                    ? 'جاري الكشف'
                                    : appt.status === 'completed'
                                    ? 'انتهى الكشف'
                                    : appt.status === 'cancelled'
                                    ? 'ملغي'
                                    : appt.status}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                {appt.queue_number ? (
                                  <b style={{ color: 'var(--primary)' }}>#{appt.queue_number}</b>
                                ) : (
                                  <span style={{ color: 'var(--muted)', fontSize: '11px' }}>لم يدخل</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'left' }}>
                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                  {!isInQueue && appt.status !== 'completed' && appt.status !== 'cancelled' && (
                                    <button
                                      type="button"
                                      className="btn primary small"
                                      onClick={() => handleApptAction(appt.id, 'check_in')}
                                      style={{ fontWeight: 700, padding: '5px 10px', fontSize: '11px' }}
                                    >
                                      ✓ تأكيد وصول
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="btn secondary small"
                                    onClick={() => setRescheduleModal({ isOpen: true, appointment: appt, newTime: appt.appointment_time })}
                                    style={{ padding: '5px 8px', fontSize: '11px' }}
                                    title="تعديل وقت الموعد"
                                  >
                                    تعديل
                                  </button>

                                  {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                                    <button
                                      type="button"
                                      className="btn secondary small"
                                      onClick={() => {
                                        setConfirmModal({
                                          isOpen: true,
                                          title: 'إلغاء الموعد',
                                          message: `هل أنت متأكد من إلغاء موعد المريض ${appt.patient_name}؟`,
                                          confirmText: 'نعم، إلغاء الموعد',
                                          isDanger: true,
                                          onConfirm: () => {
                                            handleApptAction(appt.id, 'cancel');
                                            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
                                          }
                                        });
                                      }}
                                      style={{ padding: '5px 8px', fontSize: '11px', color: 'var(--danger)' }}
                                      title="إلغاء الموعد"
                                    >
                                      إلغاء
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. إدارة الدور الكاملة (THE MOST IMPORTANT QUEUE CONTROL CENTER) */}
          {/* ========================================================= */}
          {activeTab === 'queue' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Queue Control Header Toolbar */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '18px 22px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                      مركز التحكم في طابور المرضى (Queue Control Center)
                    </h3>
                    <span
                      style={{
                        background: queueState?.status === 'paused' ? 'rgba(224, 82, 82, 0.12)' : 'rgba(22, 163, 106, 0.12)',
                        color: queueState?.status === 'paused' ? '#e05252' : '#16a36a',
                        border: `1px solid ${queueState?.status === 'paused' ? '#e05252' : '#16a36a'}`,
                        borderRadius: '20px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 700
                      }}
                    >
                      {queueState?.status === 'paused' ? 'الطابور موقوف مؤقتاً' : 'الطابور نشط ومنتظم'}
                    </span>
                  </div>
                  <small style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    أي تحديث تقوم به ينعكس لحظياً عند الطبيب (Read-Only) وعلى شاشات تتبع المريض المباشرة
                  </small>
                </div>

                {/* Main Queue Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => handleCallNext()}
                    disabled={waitingPatients.length === 0}
                    style={{ fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Icon name="check" size={16} />
                    <span>نداء المريض التالي ({waitingPatients.length > 0 ? `#${waitingPatients[0].queue_number}` : '0'})</span>
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setActiveTab('walkin')}
                    style={{ fontWeight: 700, fontSize: '13px' }}
                  >
                    + مريض مباشر
                  </button>

                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => handleNotifyDoctor()}
                    style={{ fontSize: '12px' }}
                    title="إرسال تنبيه للطبيب بأن المريض جاهز"
                  >
                    إشعار الطبيب
                  </button>
                </div>

                {/* Date Switcher for Queue */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', borderTop: '1px solid var(--line)', paddingTop: '12px', marginTop: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    📅 استعراض طابور يوم:
                  </span>
                  <button
                    type="button"
                    className={`btn small ${selectedQueueDate === todayDateStr ? 'primary' : 'secondary'}`}
                    onClick={() => setSelectedQueueDate(todayDateStr)}
                    style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px' }}
                  >
                    🟢 طابور اليوم المباشر ({todayDateStr})
                  </button>
                  <button
                    type="button"
                    className={`btn small ${selectedQueueDate === tomorrowDateStr ? 'primary' : 'secondary'}`}
                    onClick={() => setSelectedQueueDate(tomorrowDateStr)}
                    style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px' }}
                  >
                    📅 طابور غداً ({tomorrowDateStr})
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>تاريخ مخصص:</span>
                    <input
                      type="date"
                      value={selectedQueueDate}
                      onChange={(e) => setSelectedQueueDate(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        background: 'var(--bg)',
                        color: 'var(--text)',
                        fontSize: '11px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {selectedQueueDate !== todayDateStr && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e40af', fontSize: '13px' }}>
                  <Icon name="calendar" size={18} />
                  <div>
                    <b>أنت تستعرض طابور يوم مجدول ({selectedQueueDate})</b>
                    <span style={{ display: 'block', fontSize: '11px', opacity: 0.9 }}>
                      هذا جدول تسلسل الحجوزات المسبقة لهذا اليوم (إجمالي {queueEntries.length} مرضى). أدوات النداء والاستدعاء المباشر تعمل في يوم العيادة الفعلي.
                    </span>
                  </div>
                </div>
              )}

              {/* Status Tabs Filter */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {[
                  { id: 'all', label: `الكل (${queueEntries.length})` },
                  { id: 'waiting', label: `في الانتظار (${waitingPatients.length})` },
                  { id: 'in_progress', label: `جاري الكشف (${currentServing ? 1 : 0})` },
                  { id: 'skipped', label: `تم تخطيهم (${skippedPatients.length})` },
                  { id: 'completed', label: `مكتمل (${completedPatients.length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className={queueFilter === tab.id ? 'btn primary small' : 'btn secondary small'}
                    onClick={() => setQueueFilter(tab.id)}
                    style={{ fontWeight: 600, fontSize: '12px' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Live Queue Table with Full Actions */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                        <th style={{ padding: '12px 14px' }}>الدور</th>
                        <th style={{ padding: '12px 14px' }}>اسم المريض</th>
                        <th style={{ padding: '12px 14px' }}>رقم الهاتف</th>
                        <th style={{ padding: '12px 14px' }}>الحالة والوضع</th>
                        <th style={{ padding: '12px 14px' }}>الأولوية</th>
                        <th style={{ padding: '12px 14px' }}>الانتظار التقديري</th>
                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>إجراءات التحكم التشغيلي الكامل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                            لا يوجد مرضى في هذه القائمة حالياً
                          </td>
                        </tr>
                      ) : (
                        filteredQueue.map((entry, idx) => {
                          const isServing = entry.status === 'in_progress' || entry.status === 'called';
                          const isWaiting = entry.status === 'waiting';
                          const isSkipped = entry.status === 'skipped';
                          const isDone = entry.status === 'completed';

                          return (
                            <tr
                              key={entry.id}
                              style={{
                                borderBottom: '1px solid var(--line)',
                                background: isServing
                                  ? 'rgba(57, 73, 171, 0.05)'
                                  : entry.priority === 1
                                  ? 'rgba(233, 162, 59, 0.05)'
                                  : 'transparent'
                              }}
                            >
                              <td style={{ padding: '12px 14px' }}>
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: isServing
                                      ? 'var(--primary)'
                                      : entry.priority === 1
                                      ? '#e9a23b'
                                      : 'var(--surface-2)',
                                    color: isServing || entry.priority === 1 ? '#fff' : 'var(--text)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 900,
                                    fontSize: '15px'
                                  }}
                                >
                                  #{entry.queue_number}
                                </div>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <b style={{ display: 'block', color: 'var(--text)' }}>{entry.patient_name}</b>
                                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                                  {entry.appointment_time || 'وصول مباشر'} · {entry.booking_code || 'Walk-in'}
                                </small>
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                                {entry.patient_phone}
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                <span
                                  className={`badge ${
                                    isDone
                                      ? 'badge-success'
                                      : isServing
                                      ? 'badge-primary'
                                      : isSkipped
                                      ? 'badge-danger'
                                      : 'badge-warning'
                                  }`}
                                >
                                  {entry.status === 'in_progress'
                                    ? 'جاري الكشف'
                                    : entry.status === 'called'
                                    ? 'تم استدعاؤه'
                                    : entry.status === 'waiting'
                                    ? 'في الانتظار'
                                    : entry.status === 'skipped'
                                    ? 'تم تخطيه'
                                    : entry.status === 'completed'
                                    ? 'انتهى الكشف'
                                    : entry.status}
                                </span>
                              </td>

                              <td style={{ padding: '12px 14px' }}>
                                {entry.priority === 1 ? (
                                  <span className="badge badge-emergency" style={{ fontSize: '10px' }}>
                                    🚨 حالة عاجلة
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--muted)', fontSize: '11px' }}>عادي</span>
                                )}
                              </td>

                              <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>
                                {isDone ? 'اكتملت الزيارة' : isServing ? 'داخل العيادة الآن' : `~ ${entry.estimated_wait_minutes || 15} دقيقة`}
                              </td>

                              <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                                <div style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap' }}>
                                  {/* Call Next Button */}
                                  {isWaiting && (
                                    <button
                                      type="button"
                                      className="btn primary small"
                                      onClick={() => handleCallNext(entry.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700 }}
                                      title="استدعاء هذا المريض للكشف"
                                    >
                                      📢 استدعاء
                                    </button>
                                  )}

                                  {/* Start Serving Button */}
                                  {entry.status === 'called' && (
                                    <button
                                      type="button"
                                      className="btn primary small"
                                      onClick={() => handleStartServing(entry.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px', background: '#16a36a', borderColor: '#16a36a' }}
                                    >
                                      بدء الكشف
                                    </button>
                                  )}

                                  {/* Complete Visit Button */}
                                  {isServing && (
                                    <button
                                      type="button"
                                      className="btn primary small"
                                      onClick={() => handleCompleteVisit(entry.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px', background: '#16a36a', borderColor: '#16a36a', fontWeight: 700 }}
                                    >
                                      ✓ إنهاء
                                    </button>
                                  )}

                                  {/* Skip Button */}
                                  {(isWaiting || isServing) && (
                                    <button
                                      type="button"
                                      className="btn secondary small"
                                      onClick={() => handleSkipPatient(entry.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                      title="تخطي المريض وتأجيل دوره"
                                    >
                                      تخطي
                                    </button>
                                  )}

                                  {/* Return Skipped to Queue */}
                                  {isSkipped && (
                                    <button
                                      type="button"
                                      className="btn primary small"
                                      onClick={() => handleReturnToQueue(entry.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--primary)' }}
                                    >
                                      إعادة للطابور
                                    </button>
                                  )}

                                  {/* Priority Toggle / Reorder */}
                                  {isWaiting && (
                                    <button
                                      type="button"
                                      className="btn secondary small"
                                      onClick={() => handleTogglePriority(entry.id)}
                                      style={{ padding: '4px 8px', fontSize: '11px', color: entry.priority === 1 ? '#e9a23b' : 'var(--muted)' }}
                                      title="تغيير الأولوية / تقديم الدور"
                                    >
                                      {entry.priority === 1 ? 'إلغاء العاجل' : '⚡ تقديم دور'}
                                    </button>
                                  )}

                                  {/* Remove Invalid Entry */}
                                  {!isDone && (
                                    <button
                                      type="button"
                                      className="btn secondary small"
                                      onClick={() => handleRemoveEntryPrompt(entry)}
                                      style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                                      title="حذف القيد من الطابور"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. تسجيل مريض مباشر (WALK-IN REGISTRATION) */}
          {/* ========================================================= */}
          {activeTab === 'walkin' && (
            <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '18px',
                  padding: '28px',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <div style={{ marginBottom: '22px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
                    تسجيل مريض بدون حجز مسبق (Walk-in Registration)
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                    تسجيل فوري للمريض عند وصوله العيادة، توليد رقم دور تلقائي، وإضافته فورياً لقائمة الانتظار ورؤية الطبيب
                  </p>
                </div>

                <form onSubmit={handleWalkinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                      اسم المريض بالكامل <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="مثال: محمد السيد أحمد"
                      value={walkinForm.patient_name}
                      onChange={(e) => setWalkinForm({ ...walkinForm, patient_name: e.target.value })}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', fontSize: '13px' }}
                    />
                  </div>

                  {/* Booking Mode Selector (Today vs Future Date) */}
                  <div style={{ background: 'var(--surface-2)', padding: '6px', borderRadius: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setWalkinForm({ ...walkinForm, booking_mode: 'today' })}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: walkinForm.booking_mode === 'today' ? 'var(--primary)' : 'transparent',
                        color: walkinForm.booking_mode === 'today' ? '#ffffff' : 'var(--text)',
                        transition: 'all 0.2s'
                      }}
                    >
                      ⚡ دخول مباشر اليوم (الآن)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWalkinForm({ ...walkinForm, booking_mode: 'future' })}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        background: walkinForm.booking_mode === 'future' ? 'var(--primary)' : 'transparent',
                        color: walkinForm.booking_mode === 'future' ? '#ffffff' : 'var(--text)',
                        transition: 'all 0.2s'
                      }}
                    >
                      📅 حجز مباشر لموعد قادم (مستقبلي)
                    </button>
                  </div>

                  {/* Future Date & Time Inputs */}
                  {walkinForm.booking_mode === 'future' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: 'var(--surface-2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--line)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>
                          تاريخ الموعد المحجوز <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                          type="date"
                          className="form-input"
                          required
                          min={defaultToday}
                          value={walkinForm.appointment_date}
                          onChange={(e) => setWalkinForm({ ...walkinForm, appointment_date: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--primary)' }}>
                          توقيت الحضور التقريبي
                        </label>
                        <input
                          type="time"
                          className="form-input"
                          value={walkinForm.appointment_time}
                          onChange={(e) => setWalkinForm({ ...walkinForm, appointment_time: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                        رقم هاتف المريض <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        className="form-input"
                        required
                        placeholder="01XXXXXXXXX"
                        value={walkinForm.patient_phone}
                        onChange={(e) => setWalkinForm({ ...walkinForm, patient_phone: e.target.value })}
                        style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                        الفرع والعيادة
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${recInfo.clinic_name || 'العيادة'} - ${recInfo.branch_name || 'الفرع'}`}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--line)',
                          color: 'var(--muted)'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                      ملاحظة أو شكوى المريض (اختياري)
                    </label>
                    <textarea
                      rows={2}
                      className="form-input"
                      placeholder="استشارة عاجلة، كشف أولي، فحص ضغط..."
                      value={walkinForm.notes}
                      onChange={(e) => setWalkinForm({ ...walkinForm, notes: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' }}
                    />
                  </div>

                  <div
                    style={{
                      background: 'rgba(233, 162, 59, 0.08)',
                      border: '1px solid rgba(233, 162, 59, 0.25)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <input
                      type="checkbox"
                      id="emergencyWalkin"
                      checked={walkinForm.is_emergency}
                      onChange={(e) => setWalkinForm({ ...walkinForm, is_emergency: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="emergencyWalkin" style={{ fontSize: '12px', fontWeight: 700, color: '#e9a23b', cursor: 'pointer' }}>
                      ⚡ تحديد كحالة طارئة أو أولوية عاجلة (يرتفع في مقدمة قائمة الانتظار)
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="btn primary"
                    disabled={isSubmittingWalkin}
                    style={{ padding: '13px', borderRadius: '10px', fontWeight: 700, fontSize: '14px' }}
                  >
                    {isSubmittingWalkin ? 'جاري التسجيل وإصدار الدور...' : 'تسجيل المريض وإصدار رقم الدور ←'}
                  </button>
                </form>
              </div>

              {/* Success Result Card */}
              {lastRegisteredWalkin && (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '2px solid #16a36a',
                    borderRadius: '16px',
                    padding: '20px',
                    textAlign: 'center'
                  }}
                >
                  <span style={{ color: '#16a36a', fontWeight: 800, fontSize: '14px', display: 'block', marginBottom: '6px' }}>
                    {lastRegisteredWalkin.is_future ? '✓ تم حجز الموعد وتثبيت الدور في التاريخ المحدد بنجاح!' : '✓ تم تسجيل المريض بنجاح في الطابور الحي!'}
                  </span>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--primary)', margin: '10px 0' }}>
                    رقم الدور: #{lastRegisteredWalkin.queue_number}
                  </div>
                  {lastRegisteredWalkin.appointment_date && (
                    <div style={{ background: 'var(--surface-2)', display: 'inline-block', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, margin: '4px 0 12px', color: 'var(--primary)' }}>
                      تاريخ الموعد: {lastRegisteredWalkin.appointment_date} {lastRegisteredWalkin.appointment_time ? `(${lastRegisteredWalkin.appointment_time})` : ''}
                    </div>
                  )}
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text)' }}>
                    المريض: <b>{lastRegisteredWalkin.name}</b> ({lastRegisteredWalkin.phone}) · كود الحجز: <b>{lastRegisteredWalkin.booking_code}</b>
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn primary small"
                      onClick={() => setActiveTab('queue')}
                    >
                      الانتقال إلى شاشة الطابور
                    </button>
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => setLastRegisteredWalkin(null)}
                    >
                      تسجيل مريض آخر
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. البحث عن مريض (PATIENT SEARCH) */}
          {/* ========================================================= */}
          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px' }}>البحث السريع في سجلات المرضى</h3>
                  <small style={{ color: 'var(--muted)' }}>ابحث بالاسم الكامل أو رقم الهاتف أو كود الحجز لعرض الزيارات وحالة الحجز</small>
                </div>

                <form onSubmit={handlePatientSearch} style={{ display: 'flex', gap: '10px', maxWidth: '600px' }}>
                  <input
                    type="text"
                    value={patientSearchQuery}
                    onChange={(e) => setPatientSearchQuery(e.target.value)}
                    placeholder="أدخل اسم المريض أو رقم الهاتف أو كود الحجز..."
                    style={{
                      flex: 1,
                      padding: '11px 14px',
                      borderRadius: '10px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '13px'
                    }}
                    required
                  />
                  <button type="submit" className="btn primary" disabled={isSearchingPatients} style={{ fontWeight: 700 }}>
                    {isSearchingPatients ? 'جاري البحث...' : 'بحث'}
                  </button>
                </form>
              </div>

              {/* Results */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                  <b style={{ fontSize: '14px' }}>نتائج البحث ({patientSearchResults.length})</b>
                </div>

                {patientSearchResults.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                    {patientSearchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'أدخل بيانات المريض للبحث في قاعدة البيانات'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: '12px' }}>
                          <th style={{ padding: '12px 16px' }}>اسم المريض</th>
                          <th style={{ padding: '12px 16px' }}>رقم الهاتف</th>
                          <th style={{ padding: '12px 16px' }}>إجمالي الزيارات</th>
                          <th style={{ padding: '12px 16px' }}>تاريخ آخر زيارة</th>
                          <th style={{ padding: '12px 16px' }}>كود آخر حجز</th>
                          <th style={{ padding: '12px 16px' }}>حالة الحجز</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientSearchResults.map((pat, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 700 }}>{pat.patient_name}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{pat.patient_phone}</td>
                            <td style={{ padding: '12px 16px' }}>{pat.total_visits} زيارة</td>
                            <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{pat.last_visit || 'اليوم'}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600 }}>{pat.last_booking_code}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className="badge badge-primary">{pat.last_status || 'مكتمل'}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. الإشعارات والتنبيهات (NOTIFICATIONS) */}
          {/* ========================================================= */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 2px' }}>سجل النشاط وتنبيهات الطابور</h3>
                  <small style={{ color: 'var(--muted)' }}>متابعة فورية لكافة حركات الاستدعاء والتأكيد وتنبيهات العيادة</small>
                </div>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => api.getReceptionistNotifications(receptionistId).then(r => r.success && setNotifications(r.notifications || []))}
                >
                  تحديث السجل
                </button>
              </div>

              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    لا توجد إشعارات جديدة حالياً
                  </div>
                ) : (
                  notifications.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: log.target_type === 'doctor_alert' ? 'rgba(233, 162, 59, 0.12)' : 'var(--primary-soft)',
                            color: log.target_type === 'doctor_alert' ? '#e9a23b' : 'var(--primary)',
                            display: 'grid',
                            placeItems: 'center'
                          }}
                        >
                          <Icon name="clock" size={16} />
                        </span>
                        <div>
                          <b style={{ fontSize: '13px', display: 'block', color: 'var(--text)' }}>{log.action}</b>
                          <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{log.details}</small>
                        </div>
                      </div>
                      <small style={{ color: 'var(--muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {new Date(log.created_at).toLocaleTimeString('ar-EG')}
                      </small>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 7. الإعدادات الشخصية (PERSONAL SETTINGS) */}
          {/* ========================================================= */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '650px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '18px',
                  padding: '28px',
                  boxShadow: 'var(--shadow)'
                }}
              >
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
                    الملف الشخصي لموظف الاستقبال
                  </h3>
                  <small style={{ color: 'var(--muted)' }}>تعديل بيانات حسابك ومعلومات التواصل</small>
                </div>

                <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>الاسم الكامل</label>
                    <input
                      type="text"
                      className="form-input"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>رقم الهاتف</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>البريد الإلكتروني</label>
                    <input
                      type="email"
                      className="form-input"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
                    <div>العيادة المسندة: <b>{recInfo.clinic_name}</b> ({recInfo.branch_name})</div>
                    <div style={{ marginTop: '4px' }}>الطبيب المسؤول: <b>{recInfo.doctor_name}</b></div>
                  </div>

                  <button
                    type="submit"
                    className="btn primary"
                    style={{ padding: '12px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    حفظ التغييرات
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* CONFIRMATION DIALOG MODAL */}
      {/* ========================================================= */}
      {confirmModal.isOpen && (
        <Modal
          title={confirmModal.title}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        >
          <div style={{ padding: '10px 0' }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 20px', color: 'var(--text)' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={`btn ${confirmModal.isDanger ? 'danger' : 'primary'}`}
                onClick={confirmModal.onConfirm}
                style={{ fontWeight: 700 }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* RESCHEDULE APPOINTMENT MODAL */}
      {/* ========================================================= */}
      {rescheduleModal.isOpen && (
        <Modal
          title="تعديل وقت الموعد"
          onClose={() => setRescheduleModal({ isOpen: false, appointment: null, newTime: '' })}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleApptAction(rescheduleModal.appointment.id, 'reschedule', { new_time: rescheduleModal.newTime });
              setRescheduleModal({ isOpen: false, appointment: null, newTime: '' });
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '10px 0' }}
          >
            <div>
              <b style={{ display: 'block', fontSize: '13px' }}>المريض: {rescheduleModal.appointment?.patient_name}</b>
              <small style={{ color: 'var(--muted)' }}>الوقت الحالي: {rescheduleModal.appointment?.appointment_time}</small>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>الوقت الجديد للموعد</label>
              <input
                type="time"
                className="form-input"
                required
                value={rescheduleModal.newTime}
                onChange={(e) => setRescheduleModal({ ...rescheduleModal, newTime: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setRescheduleModal({ isOpen: false, appointment: null, newTime: '' })}
              >
                إلغاء
              </button>
              <button type="submit" className="btn primary" style={{ fontWeight: 700 }}>
                حفظ الموعد الجديد
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
