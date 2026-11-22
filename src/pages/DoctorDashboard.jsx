import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Logo from '../components/Logo';
import Icon from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';
import PatientEMRModal from '../components/PatientEMRModal';

export default function DoctorDashboard({
  doctorId = 1,
  doctor = null,
  onLogout,
  onHome,
  dark,
  setDark,
  showToast
}) {
  // Mobile drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Navigation tabs: 11 exact sections from prompt
  // 'overview' | 'appointments' | 'calendar' | 'queue' | 'patients' | 'schedule' | 'branches' | 'staff' | 'reports' | 'subscription' | 'settings'
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [emrModal, setEmrModal] = useState({ isOpen: false, phone: '', name: '', appointmentId: null });

  // Core Data
  const [dashboardData, setDashboardData] = useState(null);
  const [queueState, setQueueState] = useState(null);
  const [queueEntries, setQueueEntries] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [vacationForm, setVacationForm] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [isAddingVacation, setIsAddingVacation] = useState(false);
  const [branches, setBranches] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Filters & State
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [apptSearch, setApptSearch] = useState('');
  const todayDateStr = new Date().toISOString().split('T')[0];
  const tomorrowDateStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterdayDateStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const [apptStatusFilter, setApptStatusFilter] = useState('');
  const [apptDateFilter, setApptDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [calendarView, setCalendarView] = useState('weekly'); // 'daily' | 'weekly' | 'monthly'

  // Modals
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', phone: '', branch_id: '' });
  const [isAddBranchModalOpen, setIsAddBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({ branch_name: '', clinic_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' });

  // Settings Form
  const [settingsForm, setSettingsForm] = useState({
    full_name: '',
    title: '',
    bio: '',
    consultation_fee: 450,
    appointment_duration: 25,
    daily_capacity: 30,
    phone: ''
  });

  // Last update timestamp for Live Queue Read-Only display
  const [lastQueueUpdate, setLastQueueUpdate] = useState(() => new Date().toLocaleTimeString('ar-EG'));

  // 1. Initial Data Fetch
  useEffect(() => {
    loadAllData();
  }, [doctorId]);

  // Fetch appointments whenever filters or dates change
  const fetchAppointments = async (date = apptDateFilter, status = apptStatusFilter, search = apptSearch) => {
    try {
      const params = {};
      if (date && date !== 'all') params.date = date;
      if (status) params.status = status;
      if (search) params.search = search;
      const res = await api.getDoctorAppointments(doctorId, params);
      if (res.success) setAppointments(res.appointments || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAppointments(apptDateFilter, apptStatusFilter, apptSearch);
  }, [doctorId, apptDateFilter, apptStatusFilter, apptSearch]);

  // 2. Real-time Queue Synchronization (Auto-refresh every 3 seconds)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncQueueData();
    }, 3000);
    return () => clearInterval(syncInterval);
  }, [doctorId, apptDateFilter]);

  const syncQueueData = async () => {
    const qRes = await api.getDoctorQueue(doctorId, { date: apptDateFilter !== 'all' ? apptDateFilter : undefined });
    if (qRes.success) {
      setQueueState(qRes.queueState);
      setQueueEntries(qRes.queueEntries || []);
      setLastQueueUpdate(new Date().toLocaleTimeString('ar-EG'));
    }
    const dRes = await api.getDoctorDashboard(doctorId);
    if (dRes.success) {
      setDashboardData(dRes);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [dashRes, queueRes, apptsRes, patRes, schedRes, branchRes, staffRes, anaRes] = await Promise.all([
        api.getDoctorDashboard(doctorId),
        api.getDoctorQueue(doctorId),
        api.getDoctorAppointments(doctorId),
        api.getDoctorPatients(doctorId),
        api.getDoctorSchedule(doctorId),
        api.getDoctorBranches(doctorId),
        api.getDoctorReceptionists(doctorId),
        api.getDoctorAnalytics(doctorId)
      ]);

      if (dashRes.success) {
        setDashboardData(dashRes);
        if (dashRes.doctor) {
          setSettingsForm({
            full_name: dashRes.doctor.full_name || '',
            title: dashRes.doctor.title || '',
            bio: dashRes.doctor.bio || '',
            consultation_fee: dashRes.doctor.consultation_fee || 450,
            appointment_duration: dashRes.doctor.appointment_duration || 25,
            daily_capacity: dashRes.doctor.daily_capacity || 30,
            phone: dashRes.doctor.phone || ''
          });
        }
      }
      if (queueRes.success) {
        setQueueState(queueRes.queueState);
        setQueueEntries(queueRes.queueEntries || []);
        setLastQueueUpdate(new Date().toLocaleTimeString('ar-EG'));
      }
      if (apptsRes.success) setAppointments(apptsRes.appointments || []);
      if (patRes.success) setPatients(patRes.patients || []);
      if (schedRes.success) {
        setSchedules(schedRes.schedules || []);
        setVacations(schedRes.vacations || []);
      }
      if (branchRes.success) {
        setBranches(branchRes.branches || []);
        if (branchRes.branches?.[0]) setSelectedBranchId(branchRes.branches[0].id);
      }
      if (staffRes.success) setStaffList(staffRes.staff || []);
      if (anaRes.success) setAnalytics(anaRes.analytics || null);
    } catch (err) {
      console.error('Error loading doctor workspace:', err);
    }
    setLoading(false);
  };

  // Reception Staff: Invite Receptionist
  const handleInviteStaff = async (e) => {
    e.preventDefault();
    if (!inviteForm.name || !inviteForm.email || !inviteForm.phone) {
      showToast('يرجى ملء جميع حقول دعوة الموظف', 'error');
      return;
    }
    const bId = inviteForm.branch_id || selectedBranchId || branches[0]?.id || 1;
    const res = await api.inviteReceptionist(doctorId, { ...inviteForm, branch_id: bId });
    if (res.success) {
      showToast('تم إرسال دعوة الانضمام لموظف الاستقبال بنجاح', 'success');
      setIsInviteModalOpen(false);
      setInviteForm({ name: '', email: '', phone: '', branch_id: '' });
      const staffRes = await api.getDoctorReceptionists(doctorId);
      if (staffRes.success) setStaffList(staffRes.staff || []);
    } else {
      showToast(res.message || 'تعذر إرسال الدعوة', 'error');
    }
  };

  // Reception Staff: Toggle Active Status
  const handleToggleStaffStatus = async (staffId) => {
    const res = await api.toggleReceptionistStatus(doctorId, staffId);
    if (res.success) {
      showToast(res.message || 'تم تحديث حالة الموظف', 'success');
      const staffRes = await api.getDoctorReceptionists(doctorId);
      if (staffRes.success) setStaffList(staffRes.staff || []);
    } else {
      showToast(res.message || 'تعذر تحديث الحالة', 'error');
    }
  };

  // Branches: Add Branch
  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.branch_name || !branchForm.city || !branchForm.address) {
      showToast('يرجى ملء بيانات الفرع كاملة', 'error');
      return;
    }
    const res = await api.addDoctorBranch(doctorId, branchForm);
    if (res.success) {
      showToast('تمت إضافة الفرع بنجاح', 'success');
      setIsAddBranchModalOpen(false);
      setBranchForm({ branch_name: '', clinic_name: '', governorate: 'القاهرة', city: '', address: '', phone: '' });
      const bRes = await api.getDoctorBranches(doctorId);
      if (bRes.success) setBranches(bRes.branches || []);
    } else {
      showToast(res.message || 'تعذر إضافة الفرع', 'error');
    }
  };

  // Schedule: Save Working Hours & Capacity
  const handleScheduleChange = (schedId, field, value) => {
    setSchedules(prev => prev.map(s => s.id === schedId ? { ...s, [field]: value } : s));
  };

  const handleSaveSchedule = async () => {
    const res = await api.saveDoctorSchedule(doctorId, schedules);
    if (res.success) {
      showToast('تم حفظ وتحديث مواعيد العمل بنجاح (محدثة لحظياً على موقع حجز المرضى)', 'success');
    } else {
      showToast(res.message || 'تعذر حفظ المواعيد', 'error');
    }
  };

  // Doctor Vacations Handlers
  const handleAddVacation = async (e) => {
    e.preventDefault();
    if (!vacationForm.start_date || !vacationForm.end_date) {
      showToast('يرجى تحديد تاريخ بداية ونهاية الإجازة', 'error');
      return;
    }
    if (vacationForm.start_date > vacationForm.end_date) {
      showToast('تاريخ بداية الإجازة يجب أن يسبق تاريخ نهايتها', 'error');
      return;
    }
    setIsAddingVacation(true);
    const res = await api.addDoctorVacation(doctorId, vacationForm);
    setIsAddingVacation(false);
    if (res.success) {
      showToast(res.message, 'success');
      setVacationForm({ start_date: '', end_date: '', reason: '' });
      const updated = await api.getDoctorSchedule(doctorId);
      if (updated.success) setVacations(updated.vacations || []);
    } else {
      showToast(res.message || 'حدث خطأ أثناء إضافة الإجازة', 'error');
    }
  };

  const handleDeleteVacation = async (vacationId) => {
    const res = await api.deleteDoctorVacation(doctorId, vacationId);
    if (res.success) {
      showToast(res.message, 'success');
      setVacations(prev => prev.filter(v => v.id !== vacationId));
    } else {
      showToast(res.message || 'تعذر إلغاء الإجازة', 'error');
    }
  };

  // Settings: Save Doctor Profile
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const res = await api.updateDoctorSettings(doctorId, settingsForm);
    if (res.success) {
      showToast('تم تحديث إعدادات الطبيب والعيادة بنجاح', 'success');
      loadAllData();
    } else {
      showToast(res.message || 'تعذر حفظ الإعدادات', 'error');
    }
  };

  const navItems = [
    { id: 'overview', label: 'الرئيسية', icon: 'grid' },
    { id: 'appointments', label: 'المواعيد', icon: 'calendar' },
    { id: 'calendar', label: 'التقويم', icon: 'clock' },
    { id: 'queue', label: 'متابعة الدور', icon: 'users', badge: queueEntries.filter(e => e.status === 'waiting').length || null },
    { id: 'patients', label: 'المرضى', icon: 'userCheck' },
    { id: 'schedule', label: 'جدول العمل', icon: 'sliders' },
    { id: 'branches', label: 'الفروع', icon: 'mapPin' },
    { id: 'staff', label: 'فريق الاستقبال', icon: 'shield' },
    { id: 'reports', label: 'التقارير', icon: 'trendingUp' },
    { id: 'subscription', label: 'الاشتراك', icon: 'creditCard' },
    { id: 'settings', label: 'الإعدادات', icon: 'settings' }
  ];

  if (loading && !dashboardData) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>
        جاري تحميل مساحة عمل الطبيب...
      </div>
    );
  }

  const doctorInfo = dashboardData?.doctor || {};
  const currentServing = queueEntries.find(e => e.status === 'in_progress') || dashboardData?.currentPatient;
  const waitingPatients = queueEntries.filter(e => e.status === 'waiting');
  const nextInQueue = waitingPatients[0] || null;
  const completedPatients = queueEntries.filter(e => e.status === 'completed');

  // Filtered appointments
  const filteredAppts = appointments.filter(a => {
    if (apptStatusFilter && a.status !== apptStatusFilter) return false;
    if (apptSearch) {
      const q = apptSearch.toLowerCase();
      return a.patient_name?.toLowerCase().includes(q) || a.patient_phone?.includes(q) || a.booking_code?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="workspace rtl">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="overlay"
          style={{ display: 'block' }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* SIDEBAR NAVIGATION (11 DOCTOR WORKSPACE ITEMS IN THE SIDEBAR) */}
      {/* ------------------------------------------------------------- */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Logo onClick={onHome} />
        </div>

        {/* Doctor & Clinic Identity Card (Figma Style) */}
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
              src={doctorInfo.profile_photo || doctor?.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80'}
              alt={doctorInfo.full_name || doctor?.full_name}
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
                {doctorInfo.clinic_name || doctor?.clinic_name || 'عيادة دُوري'}
              </b>
              <small style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '10px', display: 'block' }}>
                {doctorInfo.full_name || doctor?.full_name}
              </small>
            </div>
          </div>
        </div>

        {/* The 11 Nav Items in the Sidebar (Figma Nav Style) */}
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
                  minHeight: '38px',
                  padding: '7px 11px',
                  borderRadius: '9px',
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
                <Icon name={item.icon} size={15} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge ? (
                  <span
                    style={{
                      background: 'var(--primary)',
                      color: '#fff',
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

        {/* Sidebar Footer: Plan Badge + Doctor Profile & Logout */}
        <div className="sidebar-user" style={{ borderTop: '1px solid var(--line)', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src={doctorInfo.profile_photo || doctor?.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80'}
            alt="doctor"
            style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
              {doctorInfo.full_name || doctor?.full_name}
            </b>
            <small style={{ color: '#16a36a', fontSize: '9px', fontWeight: 600 }}>متصل · باقة برو</small>
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
                {doctorInfo.clinic_name || doctor?.clinic_name || 'عيادة دوري'} · {doctorInfo.full_name || doctor?.full_name}
              </small>
            </div>
          </div>

          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'rgba(22, 163, 106, 0.1)',
                color: '#16a36a',
                border: '1px solid rgba(22, 163, 106, 0.25)',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a36a' }} />
              مزامنة حية (كل ٣ ثوانٍ)
            </span>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                localStorage.setItem('dawry_view_doctor_id', doctorId);
                window.location.hash = '';
                window.location.reload();
              }}
              style={{ fontSize: '11px', padding: '4px 9px', fontWeight: 700 }}
              title="معاينة صفحة العيادة كما يراها المرضى بالموقع العام"
            >
              👁️ صفحتي كطبيب
            </button>
            <ThemeToggle dark={dark} setDark={setDark} />
            <button
              type="button"
              className="btn secondary small"
              onClick={onLogout}
              title="تسجيل الخروج للتبديل لحساب طبيب آخر"
            >
              تبديل الطبيب
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

      {/* ------------------------------------------------------------- */}
      {/* 1. الرئيسية (OVERVIEW) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Clinic Status & Doctor Header */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '20px',
              padding: '20px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img
                src={doctorInfo.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120'}
                alt={doctorInfo.full_name}
                style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }}
              />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--ink)' }}>{doctorInfo.full_name}</h2>
                  <span className="badge badge-success" style={{ fontSize: '11px' }}>
                    <span className="live-dot" style={{ width: '6px', height: '6px' }} /> العيادة تعمل الآن
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '12px' }}>
                  {doctorInfo.specialty_name} · {doctorInfo.clinic_name || 'مركز الحياة'} · {branches[0]?.city || 'مصر الجديدة'}
                </p>
              </div>
            </div>

            {/* Read-only Sync Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface-2)', padding: '8px 14px', borderRadius: '12px' }}>
              <span className="live-dot" />
              <span style={{ fontSize: '12px', color: 'var(--ink)', fontWeight: 600 }}>مزامنة حية مع مكتب الاستقبال</span>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>({lastQueueUpdate})</small>
            </div>
          </div>

          {/* Clean Metric Cards: Only relevant clinical statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>إجمالي مواعيد اليوم</small>
              <b style={{ fontSize: '26px', color: 'var(--ink)' }}>{dashboardData?.todayAppts || appointments.length || 18}</b>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--primary)' }}>حجوزات مسجلة</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>المرضى في الانتظار</small>
              <b style={{ fontSize: '26px', color: '#e9a23b' }}>{waitingPatients.length}</b>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--muted)' }}>جاهزون للكشف بالعيادة</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>كشوفات تم الانتهاء منها</small>
              <b style={{ fontSize: '26px', color: '#16a36a' }}>{completedPatients.length || dashboardData?.completedCount || 4}</b>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--muted)' }}>استشارات مكتملة اليوم</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>متوسط وقت الكشف</small>
              <b style={{ fontSize: '26px', color: 'var(--primary)' }}>{doctorInfo.appointment_duration || 20} دقيقة</b>
              <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--muted)' }}>حسب جدول العمل</span>
            </div>
          </div>

          {/* Current & Next Patient Highlight */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
            {/* Current Patient Card (Prominent) */}
            <div
              style={{
                background: 'linear-gradient(135deg, var(--surface) 0%, var(--primary-soft) 100%)',
                border: '1.5px solid var(--primary)',
                borderRadius: '18px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                  يتم الكشف الآن داخل الغرفة
                </span>
                <b style={{ color: 'var(--primary)', fontSize: '18px' }}>
                  {currentServing ? `دور #${currentServing.queue_number}` : 'لا يوجد مريض حالياً'}
                </b>
              </div>

              {currentServing ? (
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: 'var(--ink)' }}>
                    {currentServing.patient_name}
                  </h3>
                  <p style={{ margin: '0 0 6px', color: 'var(--muted)', fontSize: '13px' }}>
                    رقم الهاتف: {currentServing.patient_phone || 'غير مسجل'} · كود الحجز: {currentServing.booking_code || 'WALK-IN'}
                  </p>
                  {currentServing.appt_notes && (
                    <div style={{ background: 'var(--surface)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: 'var(--ink)' }}>
                      📝 ملاحظات: {currentServing.appt_notes}
                    </div>
                  )}
                  {currentServing.patient_phone && (
                    <button
                      type="button"
                      className="btn primary small"
                      style={{ marginTop: '10px', fontWeight: 700 }}
                      onClick={() => setEmrModal({
                        isOpen: true,
                        phone: currentServing.patient_phone,
                        name: currentServing.patient_name,
                        appointmentId: currentServing.appointment_id || null
                      })}
                    >
                      🩺 فتح الملف الطبي والتاريخ المرضي
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ padding: '16px 0', color: 'var(--muted)', fontSize: '13px' }}>
                  في انتظار نداء المريض القادم من قِبل موظف الاستقبال
                </div>
              )}

              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                * إدارة تسلسل الدخول والنداء مسندة بالكامل لمكتب الاستقبال.
              </small>
            </div>

            {/* Next in Queue */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>المريض التالي في قائمة الانتظار</small>
                {nextInQueue ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-warning" style={{ fontSize: '10px' }}>دور #{nextInQueue.queue_number}</span>
                      <b style={{ fontSize: '16px', color: 'var(--ink)' }}>{nextInQueue.patient_name}</b>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                      حالة الحضور: {nextInQueue.checkin_time ? `وصل الساعة ${nextInQueue.checkin_time}` : 'في صالة الانتظار'}
                    </p>
                  </div>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>لا يوجد مرضى في الانتظار حالياً</p>
                )}
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>إجمالي المنتظرين بالخارج</span>
                <b style={{ color: 'var(--primary)', fontSize: '16px' }}>{waitingPatients.length}</b>
              </div>
            </div>
          </div>

          {/* Today's Schedule Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>جدول مواعيد اليوم</h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>الوقت</th>
                    <th>اسم المريض</th>
                    <th>رقم الموبايل</th>
                    <th>كود الحجز</th>
                    <th>نوع الكشف</th>
                    <th>حالة الموعد</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.slice(0, 8).map(appt => (
                    <tr key={appt.id}>
                      <td><b>{appt.appointment_time}</b></td>
                      <td>{appt.patient_name}</td>
                      <td>{appt.patient_phone}</td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>{appt.booking_code}</span></td>
                      <td>{appt.type === 'online' ? 'حجز إلكتروني' : 'حضور مباشر'}</td>
                      <td>
                        <span className={`badge ${appt.status === 'confirmed' ? 'badge-primary' : appt.status === 'completed' ? 'badge-success' : appt.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                          {appt.status === 'confirmed' ? 'مؤكد' : appt.status === 'completed' ? 'تم الكشف' : appt.status === 'cancelled' ? 'ملغي' : 'في الانتظار'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. المواعيد (APPOINTMENTS) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'appointments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>
                سجل مواعيد الكشف والعيادة {apptDateFilter === 'all' ? '(كافة المواعيد)' : apptDateFilter === todayDateStr ? '(مواعيد اليوم)' : `(${apptDateFilter})`}
              </h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
                عرض وتتبع كافة الحجوزات لأي يوم والبحث في تفاصيل المرضى المسجلين (إجمالي: {appointments.length} حجز)
              </p>
            </div>

            {/* Search & Filters */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                placeholder="بحث باسم المريض أو الهاتف أو الكود..."
                value={apptSearch}
                onChange={(e) => setApptSearch(e.target.value)}
                style={{ width: '240px', padding: '8px 12px', fontSize: '12px' }}
              />

              <select
                className="form-input"
                value={apptStatusFilter}
                onChange={(e) => setApptStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                <option value="">كل الحالات</option>
                <option value="confirmed">مؤكد</option>
                <option value="completed">تم الكشف</option>
                <option value="cancelled">ملغي</option>
                <option value="no_show">لم يحضر</option>
              </select>
            </div>

            {/* Date Quick Selector Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', background: 'var(--surface)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--line)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📅 عرض مواعيد يوم:
              </span>
              <button
                type="button"
                className={`btn small ${apptDateFilter === todayDateStr ? 'primary' : 'secondary'}`}
                onClick={() => setApptDateFilter(todayDateStr)}
                style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px' }}
              >
                اليوم ({todayDateStr})
              </button>
              <button
                type="button"
                className={`btn small ${apptDateFilter === tomorrowDateStr ? 'primary' : 'secondary'}`}
                onClick={() => setApptDateFilter(tomorrowDateStr)}
                style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px' }}
              >
                غداً ({tomorrowDateStr})
              </button>
              <button
                type="button"
                className={`btn small ${apptDateFilter === yesterdayDateStr ? 'primary' : 'secondary'}`}
                onClick={() => setApptDateFilter(yesterdayDateStr)}
                style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px' }}
              >
                أمس
              </button>
              <button
                type="button"
                className={`btn small ${apptDateFilter === 'all' ? 'primary' : 'secondary'}`}
                onClick={() => setApptDateFilter('all')}
                style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px' }}
              >
                كافة المواعيد المسجلة
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>تاريخ مخصص:</span>
                <input
                  type="date"
                  value={apptDateFilter === 'all' ? '' : apptDateFilter}
                  onChange={(e) => setApptDateFilter(e.target.value)}
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

          {/* Appointments Table */}
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>كود الحجز</th>
                  <th>التاريخ</th>
                  <th>الوقت</th>
                  <th>اسم المريض</th>
                  <th>رقم الهاتف</th>
                  <th>الفرع</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppts.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                      لا توجد مواعيد مطابقة لخيارات البحث المحددة
                    </td>
                  </tr>
                ) : (
                  filteredAppts.map(appt => (
                    <tr key={appt.id}>
                      <td><b style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{appt.booking_code}</b></td>
                      <td>{appt.appointment_date}</td>
                      <td>{appt.appointment_time}</td>
                      <td><b>{appt.patient_name}</b></td>
                      <td>{appt.patient_phone}</td>
                      <td>{appt.branch_name || branches[0]?.branch_name || 'الفرع الرئيسي'}</td>
                      <td>{appt.type === 'online' ? 'أونلاين' : 'استقبال'}</td>
                      <td>
                        <span className={`badge ${appt.status === 'confirmed' ? 'badge-primary' : appt.status === 'completed' ? 'badge-success' : appt.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                          {appt.status === 'confirmed' ? 'مؤكد' : appt.status === 'completed' ? 'مكتمل' : appt.status === 'cancelled' ? 'ملغي' : 'لم يحضر'}
                        </span>
                      </td>
                      <td><small style={{ color: 'var(--muted)' }}>{appt.notes || '—'}</small></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. التقويم (CALENDAR: Daily, Weekly, Monthly) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>تقويم مواعيد العيادة</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>استعراض المواعيد باليوم، الأسبوع، والشهر مع تحديد فترات الراحة والأوقات المحجوزة</p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Branch Selector */}
              <select
                className="form-input"
                value={selectedBranchId || ''}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                style={{ padding: '8px 12px', fontSize: '12px' }}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.branch_name || b.clinic_name}</option>
                ))}
              </select>

              {/* View Switcher: Daily, Weekly, Monthly */}
              <div style={{ background: 'var(--surface-2)', padding: '3px', borderRadius: '10px', display: 'flex', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => setCalendarView('daily')}
                  style={{ border: 'none', background: calendarView === 'daily' ? 'var(--surface)' : 'transparent', color: calendarView === 'daily' ? 'var(--primary)' : 'var(--muted)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  يومي
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarView('weekly')}
                  style={{ border: 'none', background: calendarView === 'weekly' ? 'var(--surface)' : 'transparent', color: calendarView === 'weekly' ? 'var(--primary)' : 'var(--muted)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  أسبوعي
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarView('monthly')}
                  style={{ border: 'none', background: calendarView === 'monthly' ? 'var(--surface)' : 'transparent', color: calendarView === 'monthly' ? 'var(--primary)' : 'var(--muted)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  شهري
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid Representation */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', textAlign: 'center' }}>
              {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day, idx) => {
                const isOff = idx === 6; // Friday off
                return (
                  <div key={day} style={{ background: isOff ? 'var(--surface-2)' : 'var(--surface)', border: '1px solid var(--line)', borderRadius: '12px', padding: '14px 8px', minHeight: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: '13px', color: isOff ? 'var(--muted)' : 'var(--ink)' }}>{day}</b>
                    {isOff ? (
                      <span style={{ fontSize: '11px', color: '#e05252', background: 'rgba(224,82,82,0.1)', padding: '4px', borderRadius: '6px', margin: 'auto 0' }}>
                        عطلة أسبوعية
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: 'auto 0' }}>
                        <span style={{ fontSize: '11px', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '4px', borderRadius: '6px', fontWeight: 700 }}>
                          ٥:٠٠ م – ١٠:٠٠ م
                        </span>
                        <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                          استراحة: ٦:٣٠ – ٧:٠٠ م
                        </small>
                      </div>
                    )}
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>سعة: {isOff ? '٠' : doctorInfo.daily_capacity || 30} كشف</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. متابعة الدور — READ ONLY (STRICTLY NO QUEUE CONTROLS FOR DOCTOR) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'queue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Strict Permission Notification Banner */}
          <div
            style={{
              background: '#fff8e9',
              border: '1px solid #f3dfb4',
              borderRadius: '16px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '22px' }}>ℹ️</span>
              <div>
                <b style={{ color: '#8a5a0d', fontSize: '14px', display: 'block' }}>
                  وضع المشاهدة والمتابعة فقط للطبيب (Read-Only)
                </b>
                <small style={{ color: '#9e6d19', fontSize: '12px' }}>
                  إدارة الطابور بالكامل، نداء المرضى، تغيير الترتيب، وتسجيل الحضور مسندة حصرياً لموظف الاستقبال.
                </small>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(138, 90, 13, 0.1)', padding: '6px 14px', borderRadius: '20px' }}>
              <span className="live-dot" />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#8a5a0d' }}>تحديث تلقائي لحظي ({lastQueueUpdate})</span>
            </div>
          </div>

          {/* Quick Queue Status Indicators */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>رقم الدور الجاري كشفه</small>
              <b style={{ fontSize: '28px', color: 'var(--primary)' }}>
                {currentServing ? `#${currentServing.queue_number}` : '—'}
              </b>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                {currentServing ? currentServing.patient_name : 'لا يوجد مريض الآن'}
              </span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>المريض التالي (المستدعى)</small>
              <b style={{ fontSize: '28px', color: '#e9a23b' }}>
                {nextInQueue ? `#${nextInQueue.queue_number}` : '—'}
              </b>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>
                {nextInQueue ? nextInQueue.patient_name : 'لا يوجد مريض منتظر'}
              </span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>عدد المنتظرين بالعيادة</small>
              <b style={{ fontSize: '28px', color: 'var(--ink)' }}>{waitingPatients.length}</b>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>حالات في قائمة الانتظار</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '16px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>الوقت المتوقع المتبقي</small>
              <b style={{ fontSize: '28px', color: '#16a36a' }}>{waitingPatients.length * (doctorInfo.appointment_duration || 20)} دقيقة</b>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>لإنهاء جميع حالات اليوم</span>
            </div>
          </div>

          {/* Read-Only Live Queue Table (NO ACTION BUTTONS) */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '16px', fontWeight: 800 }}>تسلسل الطابور الفعلي لليوم (قراءة ومتابعة فقط)</h3>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ترتيب الدور</th>
                    <th>كود الحجز</th>
                    <th>اسم المريض</th>
                    <th>رقم الموبايل</th>
                    <th>وقت الوصول</th>
                    <th>الأولوية</th>
                    <th>حالة الطابور</th>
                  </tr>
                </thead>
                <tbody>
                  {queueEntries.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>
                        لا يوجد مرضى مسجلين في طابور اليوم حتى الآن
                      </td>
                    </tr>
                  ) : (
                    queueEntries.map(entry => {
                      const isCurrent = entry.status === 'in_progress';
                      return (
                        <tr key={entry.id} style={{ background: isCurrent ? 'var(--primary-soft)' : 'inherit' }}>
                          <td>
                            <b style={{ fontSize: '16px', color: isCurrent ? 'var(--primary)' : 'var(--ink)' }}>
                              #{entry.queue_number}
                            </b>
                          </td>
                          <td><span style={{ fontFamily: 'monospace', fontSize: '11px', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>{entry.booking_code || 'WALK-IN'}</span></td>
                          <td>
                            <b>{entry.patient_name}</b>
                            {isCurrent && <span style={{ marginRight: '6px', fontSize: '10px', color: 'var(--primary)', fontWeight: 800 }}>(جاري الكشف)</span>}
                          </td>
                          <td>{entry.patient_phone || '—'}</td>
                          <td>{entry.checkin_time || '—'}</td>
                          <td>
                            {entry.priority === 1 ? (
                              <span className="badge badge-emergency" style={{ fontSize: '10px' }}>طوارئ</span>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>عادي</span>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${entry.status === 'in_progress' ? 'badge-primary' : entry.status === 'waiting' ? 'badge-warning' : 'badge-success'}`}>
                              {entry.status === 'in_progress' ? 'يتم الكشف' : entry.status === 'waiting' ? 'في الانتظار' : 'مكتمل'}
                            </span>
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

      {/* ------------------------------------------------------------- */}
      {/* 5. المرضى (PATIENTS — MINIMAL) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'patients' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>سجل مرضى العيادة</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>عرض مختصر لبيانات المرضى والمواعيد السابقة والقادمة دون تعقيد طبي</p>
            </div>

            <input
              type="text"
              className="form-input"
              placeholder="بحث بالاسم أو رقم الهاتف..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              style={{ width: '240px', padding: '8px 12px', fontSize: '12px' }}
            />
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>اسم المريض</th>
                  <th>رقم الهاتف</th>
                  <th>الزيارات السابقة</th>
                  <th>آخر موعد كشف</th>
                  <th>الموعد القادم</th>
                  <th>الحالة</th>
                  <th>السجل الطبي</th>
                </tr>
              </thead>
              <tbody>
                {patients
                  .filter(p => !patientSearch || p.name?.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone?.includes(patientSearch))
                  .map(p => (
                    <tr key={p.id}>
                      <td><b>{p.name}</b></td>
                      <td>{p.phone}</td>
                      <td><b>{p.visits_count || 1} زيارات</b></td>
                      <td>{p.last_visit_date || '2026-11-10'}</td>
                      <td><span style={{ color: 'var(--primary)', fontWeight: 600 }}>{p.upcoming_date || 'لا يوجد موعد'}</span></td>
                      <td><span className="badge badge-success">نشط</span></td>
                      <td>
                        <button
                          type="button"
                          className="btn primary small"
                          style={{ fontSize: '11px', padding: '5px 10px' }}
                          onClick={() => setEmrModal({ isOpen: true, phone: p.phone, name: p.name, appointmentId: null })}
                        >
                          🩺 التاريخ المرضي
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. جدول العمل (SCHEDULE MANAGEMENT) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Admin Onboarding Info Alert */}
          <div style={{
            background: 'rgba(59, 80, 196, 0.08)',
            border: '1px solid rgba(59, 80, 196, 0.22)',
            borderRadius: '14px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '22px' }}>🛡️</span>
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text)' }}>
              <b>ملاحظة إعداد الحساب:</b> تم ضبط إعدادات ومواعيد عيادتك الأولية مسبقاً عبر <b>إدارة المنصة (السوبر أدمن)</b>. كطبيب، تمتلك الحرية الكاملة أدناه لتعديل ساعات العمل، تفعيل أو تعطيل أي يوم، وإضافة أيام إجازاتك وعطلاتك الخاصة ليتم غلق المواعيد على الفور وحماية طابورك.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>إدارة جدول العمل وأوقات الحجز</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
                تحديد أيام العمل، ساعات الكشف، وفترات الراحة (تؤثر تلقائياً ولحظياً على مواعيد الحجز المتاحة للمرضى)
              </p>
            </div>

            <button className="btn primary" onClick={handleSaveSchedule} style={{ padding: '10px 20px', fontWeight: 700 }}>
              💾 حفظ وتطبيق مواعيد العمل
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>مدة الكشف لكل مريض</label>
              <select
                className="form-input"
                value={settingsForm.appointment_duration}
                onChange={(e) => setSettingsForm({ ...settingsForm, appointment_duration: Number(e.target.value) })}
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                <option value={15}>15 دقيقة</option>
                <option value={20}>20 دقيقة</option>
                <option value={25}>25 دقيقة (موصى به)</option>
                <option value={30}>30 دقيقة</option>
                <option value={45}>45 دقيقة</option>
              </select>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>الحد الأقصى للكشوفات اليومية</label>
              <input
                type="number"
                className="form-input"
                value={settingsForm.daily_capacity}
                onChange={(e) => setSettingsForm({ ...settingsForm, daily_capacity: Number(e.target.value) })}
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Days Schedule Table */}
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>اليوم</th>
                  <th>بداية الكشف</th>
                  <th>نهاية الكشف</th>
                  <th>بداية الاستراحة</th>
                  <th>نهاية الاستراحة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {schedules.length > 0 ? (
                  schedules.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.day_name}</b></td>
                      <td>
                        <input
                          type="time"
                          value={s.start_time || '17:00'}
                          disabled={!s.is_active}
                          onChange={(e) => handleScheduleChange(s.id, 'start_time', e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={s.end_time || '22:00'}
                          disabled={!s.is_active}
                          onChange={(e) => handleScheduleChange(s.id, 'end_time', e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={s.break_start || ''}
                          disabled={!s.is_active}
                          onChange={(e) => handleScheduleChange(s.id, 'break_start', e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={s.break_end || ''}
                          disabled={!s.is_active}
                          onChange={(e) => handleScheduleChange(s.id, 'break_end', e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }}
                        />
                      </td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(s.is_active)}
                            onChange={(e) => handleScheduleChange(s.id, 'is_active', e.target.checked ? 1 : 0)}
                            style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                          />
                          <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                            {s.is_active ? 'متاح للحجز' : 'يوم عطلة مغلق'}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))
                ) : (
                  ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((dayName, idx) => {
                    const isFriday = idx === 6;
                    return (
                      <tr key={dayName}>
                        <td><b>{dayName}</b></td>
                        <td><input type="time" defaultValue={isFriday ? '' : '17:00'} disabled={isFriday} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }} /></td>
                        <td><input type="time" defaultValue={isFriday ? '' : '22:00'} disabled={isFriday} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }} /></td>
                        <td><input type="time" defaultValue={isFriday ? '' : '18:30'} disabled={isFriday} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }} /></td>
                        <td><input type="time" defaultValue={isFriday ? '' : '19:00'} disabled={isFriday} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', background: 'var(--surface-2)', color: 'var(--ink)' }} /></td>
                        <td>
                          <span className={`badge ${isFriday ? 'badge-danger' : 'badge-success'}`}>
                            {isFriday ? 'عطلة أسبوعية' : 'متاح للحجز'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section: Doctor Vacations & Leaves Management */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '24px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>🏖️ إدارة الإجازات والعطلات الخاصة للطبيب</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
                  تسجيل فترات الإجازة الرسمية، المؤتمرات، أو العطلات الطارئة (يتم قفل وإخفاء مواعيد الحجز خلال هذه الفترة تلقائياً للمرضى)
                </p>
              </div>
            </div>

            {/* Add Vacation Form */}
            <form onSubmit={handleAddVacation} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>من تاريخ (بداية الإجازة) *</label>
                  <input
                    type="date"
                    required
                    min={todayDateStr}
                    value={vacationForm.start_date}
                    onChange={(e) => setVacationForm({ ...vacationForm, start_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>إلى تاريخ (نهاية الإجازة) *</label>
                  <input
                    type="date"
                    required
                    min={vacationForm.start_date || todayDateStr}
                    value={vacationForm.end_date}
                    onChange={(e) => setVacationForm({ ...vacationForm, end_date: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>سبب الإجازة (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مؤتمر طبي، إجازة سنوية، تجديدات..."
                    value={vacationForm.reason}
                    onChange={(e) => setVacationForm({ ...vacationForm, reason: e.target.value })}
                    className="form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isAddingVacation}
                    className="btn primary"
                    style={{ width: '100%', padding: '11px', borderRadius: '8px', fontWeight: 700, fontSize: '13px' }}
                  >
                    {isAddingVacation ? 'جاري الإضافة...' : '+ تسجيل الإجازة وإغلاق المواعيد'}
                  </button>
                </div>
              </div>
            </form>

            {/* Existing Vacations List */}
            {vacations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 800 }}>الإجازات المسجلة حالياً:</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                  {vacations.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid rgba(224, 82, 82, 0.3)',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--ink)', marginBottom: '4px' }}>
                          📅 من {v.start_date} إلى {v.end_date}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          السبب: <b>{v.reason || 'إجازة عيادة'}</b>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteVacation(v.id)}
                        className="btn small danger"
                        title="إلغاء الإجازة وإعادة إتاحة الحجز"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        إلغاء الإجازة
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '13px', background: 'var(--surface-2)', borderRadius: '12px' }}>
                لا توجد إجازات أو عطلات مسجلة حالياً — جدول العيادة متاح للحجز في جميع أيام العمل النشطة.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. الفروع (BRANCHES) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'branches' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>فروع ومقرات العيادة</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>إدارة عناوين الفروع، طاقم الاستقبال المرتبط، وتفعيل أو تعطيل الحجز لكل فرع</p>
            </div>

            <button className="btn primary" onClick={() => setIsAddBranchModalOpen(true)}>
              <span>+</span> إضافة فرع جديد
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {branches.map(b => (
              <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{b.branch_name || b.clinic_name}</h4>
                    {b.is_main ? <span className="badge badge-primary">الفرع الرئيسي</span> : <span className="badge badge-success">فرع فرعي</span>}
                  </div>
                  <p style={{ margin: '0 0 6px', color: 'var(--muted)', fontSize: '12px' }}>
                    📍 {b.address} · {b.city} ({b.governorate})
                  </p>
                  <p style={{ margin: 0, color: 'var(--ink)', fontSize: '12px' }}>
                    📞 الهاتف: {b.phone || 'غير مسجل'}
                  </p>
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: 'var(--muted)' }}>موظفي الاستقبال: <b>{b.staff_count || 1}</b></span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>الحجز متاح ومفعل ✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. فريق الاستقبال (RECEPTION STAFF) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>فريق الاستقبال وإدارة الطابور</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>موظفو الاستقبال المخولون بإدارة حضور المرضى والنداء والتحكم بالطابور</p>
            </div>

            <button className="btn primary" onClick={() => setIsInviteModalOpen(true)}>
              <span>+</span> دعوة موظف استقبال جديد
            </button>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>اسم الموظف</th>
                  <th>البريد الإلكتروني</th>
                  <th>رقم الهاتف</th>
                  <th>الفرع المعين له</th>
                  <th>صلاحية إدارة الطابور</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(staff => (
                  <tr key={staff.id}>
                    <td><b>{staff.name}</b></td>
                    <td>{staff.email}</td>
                    <td>{staff.phone}</td>
                    <td>{staff.branch_name || branches[0]?.branch_name || 'الفرع الرئيسي'}</td>
                    <td><span style={{ color: '#16a36a', fontWeight: 700 }}>كاملة (إدارة الطابور بالكامل)</span></td>
                    <td>
                      <span className={`badge ${staff.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {staff.status === 'active' ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary small"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => handleToggleStaffStatus(staff.id)}
                      >
                        {staff.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. التقارير (REPORTS — MINIMAL & USEFUL) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>تقارير أداء العيادة والحجوزات</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>مؤشرات عملية مفيدة بعيداً عن الرسوم المعقدة</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>إجمالي الحجوزات هذا الشهر</small>
              <b style={{ fontSize: '26px', color: 'var(--ink)' }}>{analytics?.monthly_bookings || 142}</b>
              <span style={{ display: 'block', fontSize: '11px', color: '#16a36a', marginTop: '4px' }}>+18% عن الشهر السابق</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>نسبة حضور المرضى الفعلي</small>
              <b style={{ fontSize: '26px', color: 'var(--primary)' }}>92%</b>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>حالات الحضور في موعدها</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>حالات الإلغاء وعدم الحضور</small>
              <b style={{ fontSize: '26px', color: '#e05252' }}>8%</b>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>إجمالي الإلغاءات</span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px', padding: '18px' }}>
              <small style={{ color: 'var(--muted)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>متوسط وقت انتظار المريض</small>
              <b style={{ fontSize: '26px', color: '#e9a23b' }}>14 دقيقة</b>
              <span style={{ display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>بفضل نظام دوري الذكي</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 10. الاشتراك (SUBSCRIPTION) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'subscription' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>خطة الاشتراك والباقة</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>تفاصيل اشتراك العيادة في منصة دوري وحدود الحجوزات وفواتير الدفع</p>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '10px' }}>الباقة النشطة: باقة العيادات الاحترافية (Pro)</span>
              <h4 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800 }}>1,200 ج.م / شهرياً</h4>
              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7 }}>
                تتضمن حجوزات غير محدودة، دعم حتى 5 فروع، شاشة انتظار ذكية، وإدارة طابور كاملة لموظفي الاستقبال.
              </p>
              <p style={{ fontSize: '13px', margin: 0 }}>
                تاريخ التجديد القادم: <b>١٥ ديسمبر ٢٠٢٦</b> (تجديد تلقائي)
              </p>
            </div>

            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: '20px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700 }}>سجل المدفوعات الأخير</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <span>فاتورة نوفمبر 2026</span>
                  <b style={{ color: '#16a36a' }}>مدفوع (1,200 ج.م) ✓</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '8px 10px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <span>فاتورة أكتوبر 2026</span>
                  <b style={{ color: '#16a36a' }}>مدفوع (1,200 ج.م) ✓</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 11. الإعدادات (SETTINGS) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>إعدادات الطبيب والملف التعريفي</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>تحديث بيانات الطبيب، سعر الكشف، والنبذة التعريفية المعروضة للمرضى</p>
          </div>

          <form onSubmit={handleSaveSettings} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>اسم الطبيب بالكامل</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsForm.full_name}
                  onChange={(e) => setSettingsForm({ ...settingsForm, full_name: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>اللقب والدرجة العلمية</label>
                <input
                  type="text"
                  className="form-input"
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>سعر الكشف (ج.م)</label>
                <input
                  type="number"
                  className="form-input"
                  value={settingsForm.consultation_fee}
                  onChange={(e) => setSettingsForm({ ...settingsForm, consultation_fee: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>رقم الهاتف للتواصل</label>
                <input
                  type="tel"
                  dir="ltr"
                  className="form-input"
                  value={settingsForm.phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>نبذة عن الطبيب (تظهر بالملف الشخصي)</label>
              <textarea
                className="form-input"
                rows={4}
                value={settingsForm.bio}
                onChange={(e) => setSettingsForm({ ...settingsForm, bio: e.target.value })}
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              />
            </div>

            <button className="btn primary" type="submit" style={{ alignSelf: 'flex-start' }}>
              حفظ وتحديث الملف الشخصي
            </button>
          </form>
        </div>
      )}

      {/* Invite Staff Modal */}
      {isInviteModalOpen && (
        <Modal title="دعوة موظف استقبال جديد" onClose={() => setIsInviteModalOpen(false)}>
          <form onSubmit={handleInviteStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اسم الموظف</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="مثال: سارة أحمد"
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>البريد الإلكتروني</label>
              <input
                type="email"
                className="form-input"
                required
                placeholder="sara@clinic.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>رقم الموبايل</label>
              <input
                type="tel"
                className="form-input"
                required
                placeholder="010XXXXXXXX"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>تعيين للفرع</label>
              <select
                className="form-input"
                value={inviteForm.branch_id}
                onChange={(e) => setInviteForm({ ...inviteForm, branch_id: e.target.value })}
                style={{ width: '100%' }}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.branch_name || b.clinic_name}</option>
                ))}
              </select>
            </div>
            <button className="btn primary" type="submit">إرسال رابط التفعيل</button>
          </form>
        </Modal>
      )}

      {/* Add Branch Modal */}
      {isAddBranchModalOpen && (
        <Modal title="إضافة فرع جديد للعيادة" onClose={() => setIsAddBranchModalOpen(false)}>
          <form onSubmit={handleAddBranch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>اسم الفرع</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="مثال: فرع التجمع الخامس"
                value={branchForm.branch_name}
                onChange={(e) => setBranchForm({ ...branchForm, branch_name: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>المدينة / الحي</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="مثال: التجمع الخامس"
                value={branchForm.city}
                onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>العنوان التفصيلي</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="شارع التسعين الشمالي، ميديكال سنتر"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>هاتف الفرع</label>
              <input
                type="tel"
                className="form-input"
                placeholder="010XXXXXXXX"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>
            <button className="btn primary" type="submit">حفظ وإضافة الفرع</button>
          </form>
        </Modal>
      )}

      <PatientEMRModal
        isOpen={emrModal.isOpen}
        onClose={() => setEmrModal({ isOpen: false, phone: '', name: '', appointmentId: null })}
        doctorId={doctorId}
        doctorInfo={doctorInfo}
        patientPhone={emrModal.phone}
        patientName={emrModal.name}
        appointmentId={emrModal.appointmentId}
        showToast={showToast}
      />
        </main>
      </div>
    </div>
  );
}
