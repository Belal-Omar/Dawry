import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { trackMetaEvent } from '../utils/metaPixel';
import Logo from '../components/Logo';
import Icon, { SpecialtyIcon, getSpecialtyMeta } from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';
import UnifiedNavbar from '../components/UnifiedNavbar';
import { PORTALS, portalStyleVars } from '../components/portals';

export default function PublicWebsite({ dark, setDark, onOpenApp, showToast }) {
  // Page view state: 'home', 'search', 'profile', 'booking', 'confirmed', 'tracking', 'my-bookings'
  const [page, setPage] = useState('home');

  // Data state
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchName, setSearchName] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedGov, setSelectedGov] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Selected Doctor for Profile & Booking
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorBranches, setDoctorBranches] = useState([]);
  const [doctorReviews, setDoctorReviews] = useState([]);

  // Booking Flow State (Step 1, 2, 3)
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingBranchId, setBookingBranchId] = useState(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showFullCalendar, setShowFullCalendar] = useState(false);

  // Calendar navigation state
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());


  // My Bookings State
  const [myBookingsList, setMyBookingsList] = useState([]);
  // Auto-cleanup legacy mock patient data from localStorage if present
  if (typeof window !== 'undefined') {
    const legacyName = localStorage.getItem('dawry_patient_name');
    if (legacyName && (legacyName.includes('محمد نبيل') || legacyName.includes('محمد عبدالعزيز') || legacyName.includes('التست'))) {
      localStorage.removeItem('dawry_patient_name');
      localStorage.removeItem('dawry_patient_phone');
      localStorage.removeItem('dawry_patient_city');
      localStorage.removeItem('dawry_last_booking_code');
    }
  }

  const [bookingsTab, setBookingsTab] = useState('upcoming');
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [myBookingsPhone, setMyBookingsPhone] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('dawry_patient_phone') || '' : ''));

  // Read saved patient info from localStorage (Zero-Login friction)
  const getSaved = (k, def = '') => (typeof window !== 'undefined' ? localStorage.getItem(k) || def : def);

  // Minimal Patient Profile State
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientProfile, setPatientProfile] = useState({
    name: getSaved('dawry_patient_name', ''),
    phone: getSaved('dawry_patient_phone', ''),
    city: getSaved('dawry_patient_city', '')
  });

  const [patientForm, setPatientForm] = useState({
    name: getSaved('dawry_patient_name', ''),
    phone: getSaved('dawry_patient_phone', ''),
    email: '',
    notes: ''
  });
  const [bookingResult, setBookingResult] = useState(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Tracking State
  const [trackQuery, setTrackQuery] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('dawry_last_booking_code') || '' : ''));
  const [activeTrackCode, setActiveTrackCode] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('dawry_last_booking_code') || '' : ''));
  const [trackedBooking, setTrackedBooking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const prevTrackingRef = useRef('');

  // FAQ accordion
  const [openFaq, setOpenFaq] = useState(null);

  // Fetch initial specialties and doctors
  useEffect(() => {
    loadData();
  }, []);

  // Auto-load last booking on entering tracking page if not loaded
  useEffect(() => {
    if (page === 'tracking' && !trackedBooking) {
      const savedCode = activeTrackCode || (typeof window !== 'undefined' ? localStorage.getItem('dawry_last_booking_code') : null);
      if (savedCode) {
        handleTrackWithCode(savedCode);
      }
    }
  }, [page]);

  // Real-time synchronization for patient tracking screen (every 3 seconds)
  useEffect(() => {
    if (page !== 'tracking' || !activeTrackCode) return;
    const fetchTracking = async () => {
      try {
        const res = await api.trackBooking(activeTrackCode);
        if (res && res.success) {
          const snapshot = JSON.stringify({
            queue_number: res.queue?.queue_number,
            current_serving: res.queue?.current_serving,
            current_serving_number: res.queue?.current_serving_number,
            patients_ahead: res.queue?.patients_ahead,
            estimated_wait_minutes: res.queue?.estimated_wait_minutes,
            status: res.queue?.status || res.appointment?.status
          });
          if (snapshot !== prevTrackingRef.current) {
            prevTrackingRef.current = snapshot;
            setTrackedBooking(res);
          }
        }
      } catch (err) {
        // quiet periodic sync
      }
    };

    const trackingSync = setInterval(fetchTracking, 3000);
    return () => clearInterval(trackingSync);
  }, [page, activeTrackCode]);

  const loadData = async () => {
    setLoading(true);
    const specsRes = await api.getSpecialties();
    if (specsRes.success) setSpecialties(specsRes.specialties || []);

    const docsRes = await api.getDoctors();
    if (docsRes.success) setDoctors(docsRes.doctors || []);
    setLoading(false);

    // Auto-open doctor profile if coming from Admin preview
    const previewDocId = localStorage.getItem('dawry_view_doctor_id');
    if (previewDocId) {
      localStorage.removeItem('dawry_view_doctor_id');
      handleViewProfile({ id: Number(previewDocId) });
    }
  };

  // Re-fetch doctors on filter change
  useEffect(() => {
    const fetchFiltered = async () => {
      const params = {};
      if (searchName) params.search = searchName;
      if (selectedSpecialty) params.specialty_id = selectedSpecialty;
      if (selectedGov) params.governorate = selectedGov;
      if (sortBy) params.sort = sortBy;

      const res = await api.getDoctors(params);
      if (res.success) {
        let list = res.doctors || [];
        if (verifiedOnly) list = list.filter((d) => d.is_verified);
        setDoctors(list);
      }
    };

    const timer = setTimeout(fetchFiltered, 250);
    return () => clearTimeout(timer);
  }, [searchName, selectedSpecialty, selectedGov, sortBy, verifiedOnly]);

  // Load available slots when branch/date changes in booking
  useEffect(() => {
    if (page === 'booking' && selectedDoctor && bookingBranchId && bookingDate) {
      loadSlots(selectedDoctor.id, bookingBranchId, bookingDate);
    }
  }, [page, selectedDoctor, bookingBranchId, bookingDate]);

  const loadSlots = async (docId, branchId, date) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    const res = await api.getAvailableSlots(docId, branchId, date);
    if (res.success) {
      setAvailableSlots(res.slots || []);
    }
    setLoadingSlots(false);
  };

  // Navigate to Doctor Profile view (Screenshot 5)
  const handleViewProfile = async (doctor) => {
    const res = await api.getDoctorProfile(doctor.id);
    if (res.success) {
      setSelectedDoctor(res.doctor || doctor);
      setDoctorBranches(res.branches || []);
      setDoctorReviews(res.reviews || []);
      setPage('profile');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast(res.message || 'تعذر تحميل الملف التعريفي', 'error');
    }
  };

  // Start booking flow for doctor (Screenshot 6, 4, 3)
  const handleStartBooking = async (doctor) => {
    const profRes = await api.getDoctorProfile(doctor.id);
    const docData = profRes.success ? profRes.doctor : doctor;
    const branches = profRes.success ? (profRes.branches || []) : [];

    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedDoctor(docData);
    setDoctorBranches(branches);
    setBookingBranchId(branches[0]?.id || 1);
    setBookingDate(todayStr);
    setCalendarYear(new Date().getFullYear());
    setCalendarMonth(new Date().getMonth());
    setShowFullCalendar(false);
    setBookingStep(1);
    setSelectedSlot(null);
    setBookingResult(null);
    setPage('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Helper to validate Egyptian mobile phone numbers
  const isValidEgyptianPhone = (phone) => {
    const cleaned = String(phone || '').trim().replace(/[\s\-\+]/g, '');
    return /^(?:(?:01[0125]\d{8})|(?:201[0125]\d{8}))$/.test(cleaned);
  };

  // Submit appointment booking
  const handleConfirmBooking = async () => {
    if (!patientForm.name || !patientForm.phone) {
      showToast('يرجى إدخال اسم المريض ورقم الهاتف', 'error');
      return;
    }
    if (!isValidEgyptianPhone(patientForm.phone)) {
      showToast('يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً (مثال: 01012345678)', 'error');
      return;
    }
    if (!selectedSlot) {
      showToast('يرجى اختيار الموعد المناسب', 'error');
      return;
    }

    setIsSubmittingBooking(true);
    const res = await api.createBooking({
      doctor_id: selectedDoctor.id,
      branch_id: bookingBranchId,
      patient_name: patientForm.name,
      patient_phone: patientForm.phone,
      patient_email: patientForm.email,
      appointment_date: bookingDate,
      appointment_time: selectedSlot.time,
      notes: patientForm.notes,
      device_fingerprint: window.screen ? `${window.screen.width}x${window.screen.height}_${navigator.language}_${navigator.platform}` : 'unknown'
    });
    setIsSubmittingBooking(false);

    if (res.success) {
      setBookingResult(res);
      // Persist patient credentials in localStorage (Zero-Login: auto-saves appointments)
      try {
        localStorage.setItem('dawry_patient_phone', patientForm.phone);
        localStorage.setItem('dawry_patient_name', patientForm.name);
        localStorage.setItem('dawry_last_booking_code', res.booking_code);
      } catch (e) { }
      setMyBookingsPhone(patientForm.phone);
      setPatientProfile(prev => ({ ...prev, name: patientForm.name, phone: patientForm.phone }));
      setTrackQuery(res.booking_code);
      setPage('confirmed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      trackMetaEvent('Schedule', {
        content_name: selectedDoctor?.name || 'Clinic Appointment',
        content_category: selectedDoctor?.specialty || 'Medical'
      });
      showToast('تم تأكيد حجزك بنجاح!', 'success');
      loadData();
    } else {
      showToast(res.message || 'حدث خطأ أثناء الحجز', 'error');
    }
  };

  // Track patient booking

  // Load My Bookings from API
  const loadMyBookings = async (phone) => {
    setLoadingBookings(true);
    const res = await api.getMyBookings(phone);
    if (res.success && res.bookings) {
      setMyBookingsList(res.bookings);
    }
    setLoadingBookings(false);
  };

  // Cancel appointment handler
  const handleCancelAppointment = async (codeToCancel) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟')) return;
    const res = await api.cancelBooking(codeToCancel);
    if (res.success) {
      showToast('تم إلغاء الموعد بنجاح', 'success');
      loadMyBookings(myBookingsPhone);
      if (trackedBooking?.appointment?.booking_code === codeToCancel) {
        setTrackedBooking(null);
      }
    } else {
      showToast(res.message || 'تعذر إلغاء الحجز', 'error');
    }
  };

  // Direct track with code
  const handleTrackWithCode = async (c) => {
    if (!c) return;
    setTrackingLoading(true);
    setTrackQuery(c);
    setActiveTrackCode(c);
    const res = await api.trackBooking(c);
    setTrackingLoading(false);
    if (res.success && res.appointment) {
      prevTrackingRef.current = JSON.stringify({
        queue_number: res.queue?.queue_number,
        current_serving: res.queue?.current_serving,
        current_serving_number: res.queue?.current_serving_number,
        patients_ahead: res.queue?.patients_ahead,
        estimated_wait_minutes: res.queue?.estimated_wait_minutes,
        status: res.queue?.status || res.appointment?.status
      });
      setTrackedBooking(res);
      setPage('tracking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      showToast(res.message || 'تعذر العثور على الحجز', 'error');
    }
  };

  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    const query = trackQuery.trim();
    if (!query) return;
    setTrackingLoading(true);
    const res = await api.trackBooking(query);
    setTrackingLoading(false);
    if (res.success && res.appointment) {
      setActiveTrackCode(query);
      prevTrackingRef.current = JSON.stringify({
        queue_number: res.queue?.queue_number,
        current_serving: res.queue?.current_serving,
        current_serving_number: res.queue?.current_serving_number,
        patients_ahead: res.queue?.patients_ahead,
        estimated_wait_minutes: res.queue?.estimated_wait_minutes,
        status: res.queue?.status || res.appointment?.status
      });
      setTrackedBooking(res);
    } else {
      showToast(res.message || 'لم يتم العثور على الحجز', 'error');
      setTrackedBooking(null);
    }
  };

  // Cancel tracked appointment
  const handleCancelTracked = async (code) => {
    if (!window.confirm('هل أنت متأكد من إلغاء هذا الموعد؟')) return;
    const res = await api.cancelBooking(code);
    if (res.success) {
      showToast('تم إلغاء الموعد بنجاح', 'success');
      handleTrack();
    } else {
      showToast(res.message || 'تعذر الإلغاء', 'error');
    }
  };

  const navigateTo = (targetPage) => {
    setPage(targetPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calendar Helpers for interactive month calendar
  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const weekdaysArabic = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  const daysInCurrentMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = (new Date(calendarYear, calendarMonth, 1).getDay() + 1) % 7;

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="landing rtl" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* 1. TOP NAVBAR (UNIFIED NAVBAR WITH MOBILE DRAWER) */}
      <UnifiedNavbar
        activePage={page}
        onOpenPortal={onOpenApp}
        onNavigate={(target) => {
          if (target === 'bookings') {
            loadMyBookings(patientProfile.phone);
          }
          if (target === 'login' || target === 'signup' || target === 'doctor' || target === 'reception' || target === 'admin') {
            if (onOpenApp) onOpenApp(target);
            else window.location.hash = '#' + target;
          } else {
            navigateTo(target);
          }
        }}
        dark={dark}
        setDark={setDark}
        onOpenPatientModal={() => setShowPatientModal(true)}
        patientName={patientProfile.name}
      />

      {/* ------------------------------------------------------------------ */}
      {/* VIEW A: HOME PAGE (NO DOCTORS LIST HERE) */}
      {/* ------------------------------------------------------------------ */}
      {page === 'home' && (
        <>
          {/* HERO SECTION */}
          <header className="hero">
            <div className="hero-copy">
              <span className="eyebrow">
                <span /> منصة إدارة المواعيد والطوابير الطبية الذكية
              </span>
              <h1>
                طبيبك أقرب،<br />
                <em>ووقتك محفوظ.</em>
              </h1>
              <p>
                احجز موعدك واعرف دورك قبل ما تتحرك من البيت. من غير مكالمات، ومن غير انتظار طويل في العيادة.
              </p>

              {/* Integrated Clean Hero Search Bar */}
              <div className="hero-search">
                <label>
                  <Icon name="search" size={16} />
                  <input
                    type="text"
                    placeholder="ابحث باسم الطبيب أو التخصص..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </label>
                <label>
                  <Icon name="mapPin" size={16} />
                  <select
                    value={selectedGov}
                    onChange={(e) => setSelectedGov(e.target.value)}
                  >
                    <option value="">كل المناطق</option>
                    <option value="القاهرة">القاهرة</option>
                    <option value="الجيزة">الجيزة</option>
                    <option value="الإسكندرية">الإسكندرية</option>
                  </select>
                </label>
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => navigateTo('search')}
                >
                  ابحث الآن
                </button>
              </div>

              <div className="trust-line">
                <div className="faces">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=70&h=70&fit=crop" alt="مريض" />
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=70&h=70&fit=crop" alt="مريض" />
                  <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=70&h=70&fit=crop" alt="مريض" />
                </div>
                <span>
                  <b>+١٢ ألف</b> حجز ناجح الشهر ده عبر منصة دوري
                </span>
              </div>
            </div>

            {/* HERO VISUAL: OLD INTERACTIVE PHONE MOCKUP (WITHOUT DOCTOR NAMES) */}
            <div className="hero-visual">
              <div className="soft-shape" />
              <div className="phone">
                <div className="phone-top">
                  <span className="live-pill">
                    <span className="live-dot" style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', marginLeft: '4px' }} />
                    مباشر الآن
                  </span>
                  <small style={{ color: 'var(--muted)', fontWeight: 600 }}>نظام الطابور الذكي</small>
                </div>

                <div className="queue-head">
                  <h3 style={{ fontSize: '15px', margin: '4px 0 10px', color: 'var(--ink)' }}>متابعة دورك لحظيًا</h3>
                  <div className="queue-ring">
                    <svg viewBox="0 0 120 120" style={{ width: '130px', height: '130px', transform: 'rotate(-90deg)' }}>
                      <circle cx="60" cy="60" r="50" stroke="var(--surface-2)" strokeWidth="8" fill="none" />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        stroke="var(--primary)"
                        strokeWidth="8"
                        strokeDasharray="314"
                        strokeDashoffset="80"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <small style={{ color: 'var(--muted)', fontSize: '10px' }}>رقم دورك الحالي</small>
                      <strong style={{ fontSize: '36px', color: 'var(--primary)', lineHeight: 1.1 }}>١٢</strong>
                    </div>
                  </div>
                </div>

                <div className="phone-stats">
                  <div>
                    <small>يتم الكشف الآن على</small>
                    <b>رقم ٩</b>
                  </div>
                  <div>
                    <small>المرضى أمامك</small>
                    <b style={{ color: 'var(--primary)' }}>٣ مرضى</b>
                  </div>
                </div>

                <div style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '10px 12px', margin: '6px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                  <span style={{ color: 'var(--muted)' }}>الوقت المتوقع لدخولك:</span>
                  <b style={{ color: 'var(--teal)' }}>~ ١٥ دقيقة</b>
                </div>

                <div className="phone-notice">
                  <Icon name="spark" size={15} />
                  <span>اقترب دورك! استعد للدخول إلى غرفة الكشف.</span>
                </div>
              </div>
            </div>
          </header>

          {/* MEDICAL SPECIALTIES SECTION (6-Col Grid) */}
          <section className="section" id="specialties">
            <div className="section-heading">
              <div>
                <span className="kicker">ابدأ من هنا</span>
                <h2>اختار التخصص المناسب</h2>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setSelectedSpecialty('');
                  navigateTo('search');
                }}
              >
                عرض كل التخصصات والأطباء ←
              </button>
            </div>

            <div className="specialty-grid">
              {specialties.map((s) => {
                const meta = getSpecialtyMeta(s);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="specialty-card-btn"
                    style={{ '--spec-color': meta.color }}
                    onClick={() => {
                      setSelectedSpecialty(String(s.id));
                      navigateTo('search');
                    }}
                  >
                    <SpecialtyIcon specialty={s} size={24} tile={50} radius={15} />
                    <b>{s.name}</b>
                    <small style={{ color: s.doctors_count > 0 ? 'var(--primary)' : 'var(--muted)', fontWeight: s.doctors_count > 0 ? 700 : 500 }}>
                      {s.doctors_count > 0 ? `${s.doctors_count} طبيب متاح` : 'قريباً'}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>

          {/* HOW IT WORKS (3 Simple Steps) */}
          <section className="how" id="how">
            <div>
              <span className="kicker" style={{ color: '#82d7c9' }}>ببساطة</span>
              <h2>ميعادك في ٣ خطوات</h2>
              <p>
                صممنا دُوري علشان الحجز ومتابعة الدور يبقى أسرع من المكالمات ومن غير طوابير انتظار مملة في العيادة.
              </p>
            </div>
            <ol>
              <li>
                <span>١</span>
                <div>
                  <b>اختار طبيبك</b>
                  <small>ابحث بالتخصص أو المنطقة المناسبة</small>
                </div>
              </li>
              <li>
                <span>٢</span>
                <div>
                  <b>ثبّت الميعاد</b>
                  <small>اختار اليوم والوقت المناسب لجدولك</small>
                </div>
              </li>
              <li>
                <span>٣</span>
                <div>
                  <b>تابع دورك</b>
                  <small>هنقولك تتحرك إمتى للعيادة بالدقيقة</small>
                </div>
              </li>
            </ol>
          </section>

          {/* FAQ SECTION */}
          <section className="section" id="faq" style={{ maxWidth: '840px', margin: '40px auto 70px' }}>
            <div className="section-heading" style={{ textAlign: 'center', display: 'block', marginBottom: '28px' }}>
              <span className="kicker">استفسارات شائعة</span>
              <h2>الأسئلة الشائعة</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                {
                  q: 'كيف أعرف دوري المباشر في العيادة؟',
                  a: 'بمجرد تأكيد الحجز، يتم إصدار كود حجز خاص بك. اضغط على زر "متابعة الدور" في الموقع وأدخل الكود أو رقم موبايلك لمعرفة رقم الدور والمريض الجاري كشفه ووقت الدخول المقدر.'
                },
                {
                  q: 'هل يلزم دفع قيمة الكشف إلكترونياً؟',
                  a: 'لا، الدفع يتم في مقر العيادة عند الحضور كالمعتاد، إلا إذا حدد الطبيب غير ذلك.'
                },
                {
                  q: 'هل يمكنني إلغاء أو تغيير الموعد؟',
                  a: 'نعم بكل سهولة عبر صفحة تتبع الحجز، وفقاً لسياسة الإلغاء المحددة من العيادة وبضغطة زر واحدة.'
                },
                {
                  q: 'كيف يتم حساب وقت الانتظار المتوقع؟',
                  a: 'تعتمد المنصة على خوارزمية ذكية تحسب متوسط مدة كشف الطبيب وعدد المرضى الموجودين في قائمة الانتظار لتحديث الوقت لحظياً.'
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--surface)',
                    borderRadius: '14px',
                    border: '1px solid var(--line)',
                    overflow: 'hidden'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'right',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{item.q}</span>
                    <span style={{ fontSize: '18px', color: 'var(--muted)' }}>
                      {openFaq === idx ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === idx && (
                    <div style={{ padding: '0 20px 16px', color: 'var(--muted)', fontSize: '13px', lineHeight: '1.8' }}>
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW B: DOCTORS DIRECTORY (MATCHING SCREENSHOT 7 EXACTLY) */}
      {/* ------------------------------------------------------------------ */}
      {page === 'search' && (
        <main className="page-shell">
          <div className="breadcrumb">
            <span onClick={() => navigateTo('home')}>الرئيسية</span>
            <Icon name="chevronLeft" size={12} />
            <b>البحث عن طبيب</b>
          </div>

          {/* Top Search bar with Search button */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 18px rgba(0,0,0,0.03)' }}>
            <Icon name="search" size={20} style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="ابحث باسم الطبيب أو العيادة أو التخصص..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', flex: 1, color: 'var(--ink)' }}
            />
            <button
              className="btn primary small"
              type="button"
              style={{ padding: '8px 24px' }}
            >
              بحث
            </button>
          </div>

          {/* Filter Bar Row matching Screenshot 7 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 24px', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
              value={selectedGov}
              onChange={(e) => setSelectedGov(e.target.value)}
            >
              <option value="">كل المناطق</option>
              <option value="القاهرة">القاهرة</option>
              <option value="الجيزة">الجيزة</option>
              <option value="الإسكندرية">الإسكندرية</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="rating">أي سعر / الأعلى تقييماً</option>
              <option value="price_asc">الأقل سعراً</option>
              <option value="price_desc">الأعلى سعراً</option>
            </select>

            <select
              className="form-select"
              style={{ width: 'auto', padding: '8px 14px', fontSize: '12px', borderRadius: '10px' }}
            >
              <option value="">أقرب موعد</option>
              <option value="today">اليوم</option>
              <option value="tomorrow">غداً</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ink)', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
              />
              أطباء موثّقون فقط
            </label>

            {(searchName || selectedSpecialty || selectedGov || verifiedOnly) && (
              <button
                type="button"
                className="text-button"
                style={{ color: 'var(--muted)', fontSize: '12px', marginRight: 'auto' }}
                onClick={() => {
                  setSearchName('');
                  setSelectedSpecialty('');
                  setSelectedGov('');
                  setVerifiedOnly(false);
                }}
              >
                مسح ✕
              </button>
            )}
          </div>

          {/* Results Layout: Sidebar + Doctor Cards Grid matching Screenshot 7 */}
          <div className="results-layout">
            {/* Sidebar Specialty Filter on Right */}
            <aside className="search-aside">
              <b>التخصص</b>
              <label style={{ cursor: 'pointer', color: !selectedSpecialty ? 'var(--primary)' : 'var(--ink)', fontWeight: !selectedSpecialty ? 700 : 500 }}>
                <input
                  type="radio"
                  name="spec_filter"
                  checked={!selectedSpecialty}
                  onChange={() => setSelectedSpecialty('')}
                />
                كل التخصصات
                <small>{doctors.length}</small>
              </label>

              {specialties.map((s) => (
                <label
                  key={s.id}
                  style={{
                    cursor: 'pointer',
                    color: selectedSpecialty === String(s.id) ? 'var(--primary)' : 'var(--ink)',
                    fontWeight: selectedSpecialty === String(s.id) ? 700 : 500
                  }}
                >
                  <input
                    type="radio"
                    name="spec_filter"
                    checked={selectedSpecialty === String(s.id)}
                    onChange={() => setSelectedSpecialty(String(s.id))}
                  />
                  {s.name}
                  <small>{s.doctors_count || 0}</small>
                </label>
              ))}
            </aside>

            {/* Doctor Cards Grid */}
            <section>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
                  جاري تحميل قائمة الأطباء...
                </div>
              ) : doctors.length === 0 ? (
                <div className="empty-state" style={{ background: 'var(--surface)', padding: '42px 24px', borderRadius: '16px', border: '1px solid var(--line)', textAlign: 'center' }}>
                  <span style={{ fontSize: '44px', display: 'block', marginBottom: '12px' }}>🩺</span>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: 'var(--ink)' }}>لا يوجد أطباء متاحون في هذا التخصص حالياً</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '13.5px', margin: '0 auto 18px', maxWidth: '420px', lineHeight: 1.6 }}>
                    الطبيب التجريبي المتاح حالياً في النظام هو <b>د. طارق عبد العزيز</b> في تخصص <b>القلب والأوعية الدموية</b>.
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn primary"
                      style={{ fontWeight: 700 }}
                      onClick={() => {
                        setSearchName('');
                        setSelectedSpecialty('5'); // Heart specialty ID
                        setSelectedGov('');
                        setVerifiedOnly(false);
                      }}
                    >
                      عرض عيادة د. طارق عبد العزيز ←
                    </button>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        setSearchName('');
                        setSelectedSpecialty('');
                        setSelectedGov('');
                        setVerifiedOnly(false);
                      }}
                    >
                      إعادة ضبط الفلاتر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="result-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '18px' }}>
                  {doctors.map((doc) => (
                    <div className="doctor-card-figma" key={doc.id}>
                      <div
                        className="doctor-card-photo"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleViewProfile(doc)}
                      >
                        <img
                          src={doc.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400'}
                          alt={doc.full_name}
                        />
                        {doc.is_verified ? (
                          <span className="verified-badge" title="طبيب موثّق من دوري">
                            <Icon name="check" size={13} />
                          </span>
                        ) : null}
                      </div>

                      <div className="doctor-card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div
                            className="doctor-card-title"
                            style={{ cursor: 'pointer', flex: 1 }}
                            onClick={() => handleViewProfile(doc)}
                          >
                            <h3 style={{ margin: '0 0 3px', fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{doc.full_name}</h3>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>{doc.specialty_name} · {doc.title}</p>
                          </div>
                          <span className="doctor-card-rating">
                            ★ {doc.rating || 4.9}
                          </span>
                        </div>

                        <div className="doctor-card-meta">
                          <span>
                            <Icon name="mapPin" size={13} style={{ color: 'var(--muted)' }} />
                            {doc.city || doc.governorate || 'مصر الجديدة'}
                          </span>
                          <span>
                            <Icon name="briefcase" size={13} style={{ color: 'var(--muted)' }} />
                            الكشف {doc.consultation_fee} ج.م
                          </span>
                        </div>

                        <div className="doctor-card-slot">
                          <span>
                            <Icon name="clock" size={14} style={{ color: 'var(--teal)' }} />
                            اليوم، ٦:٣٠ م
                          </span>
                          <b>أقرب موعد</b>
                        </div>

                        {/* FULL WIDTH BUTTON: عرض المواعيد navigates to Doctor Profile */}
                        <button
                          className="btn-show-appointments"
                          type="button"
                          onClick={() => handleViewProfile(doc)}
                        >
                          <span>عرض المواعيد</span>
                          <span style={{ fontSize: '16px' }}>←</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW C: DOCTOR PUBLIC PROFILE (MATCHING SCREENSHOT 5) */}
      {/* ------------------------------------------------------------------ */}
      {page === 'profile' && selectedDoctor && (
        <main className="page-shell">
          <div className="breadcrumb" style={{ cursor: 'pointer', marginBottom: '18px' }}>
            <span onClick={() => navigateTo('search')} style={{ color: 'var(--muted)' }}>نتائج البحث</span>
            <span style={{ margin: '0 8px', color: 'var(--muted)' }}>›</span>
            <b style={{ color: 'var(--ink)' }}>الملف الشخصي</b>
          </div>

          {/* Profile Header matching Screenshot 5 */}
          <section className="profile-header">
            <div className="profile-main">
              <div className="doctor-photo xl" style={{ background: '#c93434', borderRadius: '18px' }}>
                <img
                  src={selectedDoctor.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=300'}
                  alt={selectedDoctor.full_name}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
              <div>
                <span className="verified">طبيبة موثقة من دوري</span>
                <h1 style={{ margin: '4px 0', fontSize: '26px', fontWeight: 800 }}>{selectedDoctor.full_name}</h1>
                <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: '13px' }}>
                  {selectedDoctor.specialty_name} · {selectedDoctor.title}
                </p>
                <div className="rating-line">
                  <span style={{ color: '#b37611', fontWeight: 700 }}>★ {selectedDoctor.rating || 4.9}</span>
                  <span>{selectedDoctor.reviews_count || 128} تقييماً</span>
                  <i />
                  <span>خبرة {selectedDoctor.experience_years || 14} عاماً</span>
                </div>
              </div>
            </div>

            <div className="profile-price">
              <small>سعر الكشف</small>
              <b style={{ fontSize: '26px' }}>{selectedDoctor.consultation_fee} <em style={{ fontSize: '14px', fontStyle: 'normal' }}>ج.م</em></b>
              <button
                className="btn primary"
                style={{ marginTop: '8px' }}
                onClick={() => handleStartBooking(selectedDoctor)}
              >
                احجز موعدك
              </button>
            </div>
          </section>

          {/* Profile Layout matching Screenshot 5 */}
          <div className="profile-layout" style={{ marginTop: '24px' }}>
            {/* Right Side Content */}
            <div className="profile-content">
              <div className="content-block">
                <h2>{selectedDoctor?.full_name ? `عن ${selectedDoctor.full_name}` : 'عن الطبيب'}</h2>
                <p>{selectedDoctor.bio || 'استشاري متخصص حاصل على دكتوراه معتمدة في الرعاية الصحية ومتابعة الحالات بدقة وخبرة واسعة.'}</p>
              </div>

              <div className="content-block">
                <h2>الخبرة والمؤهلات</h2>
                <ul className="check-list">
                  <li>
                    <Icon name="check" size={16} />
                    <span>{selectedDoctor.qualifications || 'دكتوراه من جامعة عين شمس'}</span>
                  </li>
                  <li>
                    <Icon name="check" size={16} />
                    <span>عضو الجمعية المصرية للتخصصات الطبية</span>
                  </li>
                  <li>
                    <Icon name="check" size={16} />
                    <span>استشاري بمستشفى كليوباترا · ترخيص نقابة: {selectedDoctor.license_number || 'معتمد'}</span>
                  </li>
                </ul>
              </div>

              <div className="content-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h2 style={{ margin: 0 }}>آراء المرضى</h2>
                  <button type="button" className="text-button" style={{ fontSize: '12px' }}>عرض الكل</button>
                </div>
                {doctorReviews.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: '13px' }}>لا توجد تقييمات مكتوبة حتى الآن.</p>
                ) : (
                  doctorReviews.map((r) => (
                    <div className="review" key={r.id}>
                      <span className="avatar">{r.patient_name ? r.patient_name.slice(0, 2) : 'نه'}</span>
                      <div>
                        <b>{r.patient_name}</b>
                        <div className="stars">⭐ {r.rating} / 5</div>
                        <p>{r.comment}</p>
                        <small style={{ color: 'var(--muted)', fontSize: '10px' }}>منذ ٥ أيام</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Left Side: اختر العيادة Sidebar matching Screenshot 5 */}
            <aside className="booking-panel">
              <h2 style={{ fontSize: '16px', marginBottom: '14px' }}>اختار العيادة</h2>

              {doctorBranches && doctorBranches.length > 0 ? (
                doctorBranches.map((branch, idx) => {
                  const isSelected = bookingBranchId === branch.id || (!bookingBranchId && idx === 0);
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      className={isSelected ? 'selected' : ''}
                      onClick={() => setBookingBranchId(branch.id)}
                      style={{
                        textAlign: 'right',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--line)',
                        background: isSelected ? 'var(--primary-soft)' : 'var(--surface)',
                        marginBottom: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <span className="radio-dot" style={isSelected ? {} : { border: '1px solid var(--line)', background: 'transparent' }} />
                      <div>
                        <b style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>{branch.branch_name || branch.clinic_name || branch.city}</b>
                        <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{branch.address || branch.city || 'العنوان متاح بالعيادة'}</small>
                      </div>
                    </button>
                  );
                })
              ) : (
                <button
                  type="button"
                  className="selected"
                  style={{
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid var(--primary)',
                    background: 'var(--primary-soft)',
                    marginBottom: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <span className="radio-dot" />
                  <div>
                    <b style={{ fontSize: '13px', display: 'block', color: 'var(--ink)' }}>{selectedDoctor.clinic_name || 'العيادة الرئيسية'}</b>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{selectedDoctor.city || '١٢ شارع الحجاز، الدور الثالث'}</small>
                  </div>
                </button>
              )}

              <div className="availability" style={{ background: 'var(--surface-2)', borderRadius: '12px', padding: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon name="clock" size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <small style={{ color: 'var(--muted)', fontSize: '10px', display: 'block' }}>أقرب موعد متاح</small>
                  <b style={{ fontSize: '12px', color: 'var(--ink)' }}>{selectedDoctor.next || 'اليوم، ٦:٣٠ مساءً'}</b>
                </div>
              </div>

              <button
                className="btn primary full"
                type="button"
                onClick={() => handleStartBooking(selectedDoctor)}
              >
                عرض المواعيد المتاحة
              </button>
            </aside>
          </div>
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW D: APPOINTMENT BOOKING FLOW (MATCHING SCREENSHOT 6, 4, 3) */}
      {/* ------------------------------------------------------------------ */}
      {page === 'booking' && selectedDoctor && (
        <main className="page-shell narrow" style={{ margin: '20px auto 60px' }}>
          {/* Back button */}
          <button
            className="back-link"
            type="button"
            onClick={() => {
              if (bookingStep > 1) {
                setBookingStep(bookingStep - 1);
              } else {
                setPage('profile');
              }
            }}
          >
            ← رجوع
          </button>

          {/* Stepper Card matching Screenshots 6, 4, 3 */}
          <div className="booking-modal-card">
            {/* Card Header matching Screenshot 6 */}
            <div className="booking-modal-header">
              <div className="doc-snippet">
                <img
                  src={selectedDoctor.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100'}
                  alt={selectedDoctor.full_name}
                />
                <div>
                  <b style={{ display: 'block', fontSize: '14px', color: 'var(--ink)' }}>{selectedDoctor.full_name}</b>
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{selectedDoctor.specialty_name || selectedDoctor.title}</small>
                </div>
              </div>
              <span className="branch-tag">• {selectedDoctor.city || 'مصر الجديدة'}</span>
            </div>

            {/* STEP 1: Choose Day & Available Slots matching Screenshot 6 */}
            {bookingStep === 1 && (
              <div className="booking-modal-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>اختار اليوم</h3>
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: '12px' }}
                    onClick={() => setShowFullCalendar(!showFullCalendar)}
                  >
                    📅 {showFullCalendar ? 'الأيام القريبة' : 'اختيار موعد بعيد من التقويم'}
                  </button>
                </div>

                {/* 4 Date Pills matching Screenshot 6 */}
                {!showFullCalendar ? (
                  <div className="date-pills-row">
                    {[0, 1, 2, 3].map((daysAhead) => {
                      const d = new Date();
                      d.setDate(d.getDate() + daysAhead);
                      const isoDate = d.toISOString().split('T')[0];
                      const dayName = daysAhead === 0 ? 'اليوم' : daysAhead === 1 ? 'غدًا' : d.toLocaleDateString('ar-EG', { weekday: 'short' });
                      const dayNum = d.getDate();
                      const monthName = d.toLocaleDateString('ar-EG', { month: 'short' });

                      return (
                        <button
                          key={isoDate}
                          type="button"
                          className={`date-pill-btn ${bookingDate === isoDate ? 'selected' : ''}`}
                          onClick={() => setBookingDate(isoDate)}
                        >
                          <small>{dayName}</small>
                          <b>{dayNum}</b>
                          <span>{monthName}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Interactive Clear Full Calendar */
                  <div className="calendar-widget">
                    <div className="calendar-header">
                      <h4>{monthNamesArabic[calendarMonth]} {calendarYear}</h4>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>‹ الشهر السابق</button>
                        <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>الشهر التالي ›</button>
                      </div>
                    </div>
                    <div className="calendar-weekdays">
                      {weekdaysArabic.map((w, idx) => (
                        <span key={idx}>{w}</span>
                      ))}
                    </div>
                    <div className="calendar-grid">
                      {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}
                      {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                        const dayNum = i + 1;
                        const mStr = String(calendarMonth + 1).padStart(2, '0');
                        const dStr = String(dayNum).padStart(2, '0');
                        const thisDateIso = `${calendarYear}-${mStr}-${dStr}`;
                        const isPast = thisDateIso < todayIso;
                        const isSelected = bookingDate === thisDateIso;

                        return (
                          <button
                            key={thisDateIso}
                            type="button"
                            disabled={isPast}
                            className={`calendar-day-btn ${isSelected ? 'selected' : ''}`}
                            onClick={() => setBookingDate(thisDateIso)}
                          >
                            <span>{dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Direct Date Picker input */}
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>أو أدخل تاريخاً محدداً:</span>
                      <input
                        type="date"
                        min={todayIso}
                        value={bookingDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            setBookingDate(e.target.value);
                            const parsed = new Date(e.target.value);
                            setCalendarYear(parsed.getFullYear());
                            setCalendarMonth(parsed.getMonth());
                          }
                        }}
                        style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', background: 'var(--surface-2)', color: 'var(--ink)' }}
                      />
                    </div>
                  </div>
                )}

                {/* Available Slots matching Screenshot 6 */}
                <h3 style={{ margin: '18px 0 8px', fontSize: '14px', fontWeight: 700 }}>المواعيد المتاحة</h3>
                {loadingSlots ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '13px' }}>
                    جاري تحميل المواعيد المتاحة...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', background: 'var(--surface-2)', borderRadius: '12px' }}>
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                      لا توجد مواعيد متاحة في هذا اليوم (عطلة العيادة أو تم اكتمال الحجوزات). اختر يوماً آخر من التقويم.
                    </p>
                  </div>
                ) : (
                  <div className="slots-time-grid">
                    {availableSlots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={!slot.available}
                        className={`slot-btn ${selectedSlot?.time === slot.time ? 'selected' : ''}`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Patient Form matching Screenshot 4 */}
            {bookingStep === 2 && (
              <div className="booking-modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700 }}>
                      اسم المريض كاملًا
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="اكتب الاسم"
                      value={patientForm.name}
                      onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700 }}>
                      رقم الموبايل
                    </label>
                    <div className="phone-input">
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="010 2345 6789"
                        value={patientForm.phone}
                        onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
                      />
                      <span style={{ borderLeft: '1px solid var(--line)' }}>+٢٠</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 700 }}>
                    ملاحظات للطبيب <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(اختياري)</small>
                  </label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="أي تفاصيل تحب يعرفها الطبيب قبل الزيارة"
                    value={patientForm.notes}
                    onChange={(e) => setPatientForm({ ...patientForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* STEP 3: Review Details matching Screenshot 3 */}
            {bookingStep === 3 && (
              <div className="booking-modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="calendar" size={18} />
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>التاريخ والوقت</small>
                      <b style={{ fontSize: '13px' }}>
                        {new Date(bookingDate).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })} — {selectedSlot?.label}
                      </b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="mapPin" size={18} />
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>العيادة</small>
                      <b style={{ fontSize: '13px' }}>{selectedDoctor.clinic_name} ({selectedDoctor.city || '١٢ شارع الحجاز'})</b>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="user" size={18} />
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>المريض</small>
                      <b style={{ fontSize: '13px' }}>{patientForm.name} ({patientForm.phone})</b>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '8px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>سعر الكشف</span>
                    <b style={{ fontSize: '16px', color: 'var(--primary)' }}>{selectedDoctor.consultation_fee} ج.م</b>
                  </div>
                </div>
              </div>
            )}

            {/* Card Footer matching Screenshot 6, 4, 3 */}
            <div className="booking-modal-footer">
              <div className="total-fee">
                <span>الإجمالي</span>
                <b>{selectedDoctor.consultation_fee} ج.م</b>
              </div>

              <div>
                {bookingStep === 1 && (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={!selectedSlot}
                    onClick={() => setBookingStep(2)}
                  >
                    <span>متابعة</span>
                    <span>←</span>
                  </button>
                )}

                {bookingStep === 2 && (
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      if (!patientForm.name.trim() || !patientForm.phone.trim()) {
                        showToast('يرجى إدخال اسم المريض ورقم الهاتف', 'error');
                        return;
                      }
                      if (!isValidEgyptianPhone(patientForm.phone)) {
                        showToast('يرجى إدخال رقم هاتف محمول مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015', 'error');
                        return;
                      }
                      setBookingStep(3);
                    }}
                  >
                    <span>متابعة</span>
                    <span>←</span>
                  </button>
                )}

                {bookingStep === 3 && (
                  <button
                    className="btn primary"
                    type="button"
                    disabled={isSubmittingBooking}
                    onClick={handleConfirmBooking}
                  >
                    <span>{isSubmittingBooking ? 'جاري التأكيد...' : 'تأكيد الحجز'}</span>
                    <span>←</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW E: CONFIRMED BOOKING (MATCHING SCREENSHOT 2) */}
      {/* ------------------------------------------------------------------ */}
      {page === 'confirmed' && bookingResult && (
        <main className="success-page" style={{ maxWidth: '600px', margin: '30px auto 60px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(22, 163, 106, 0.12)', color: 'var(--success)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Icon name="check" size={32} />
          </div>

          <span style={{ color: 'var(--teal)', fontWeight: 700, fontSize: '12px' }}>تم الحجز بنجاح</span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0 4px' }}>ميعادك اتأكد يا {patientForm.name}</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 auto 24px', maxWidth: '440px' }}>
            بعتنالك تفاصيل الحجز على رقم الموبايل. هنفكّرك قبل الموعد ونقولك أفضل وقت تتحرك فيه.
          </p>

          <section style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px', padding: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
            <div className="reference" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '10px' }}>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: '12px' }}
                onClick={() => {
                  navigator.clipboard?.writeText(bookingResult.booking_code);
                  showToast('تم نسخ كود الحجز', 'success');
                }}
              >
                نسخ
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>رقم الحجز:</span>
                <b style={{ fontSize: '16px', letterSpacing: '1px' }}>{bookingResult.booking_code}</b>
              </div>
            </div>

            <div className="confirmation-doctor" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0' }}>
              <span className="badge badge-primary" style={{ marginRight: 'auto' }}>
                • حجز مؤكد
              </span>
              <div style={{ textAlign: 'left' }}>
                <b style={{ display: 'block', fontSize: '14px' }}>{selectedDoctor?.full_name}</b>
                <small style={{ color: 'var(--muted)' }}>{selectedDoctor?.clinic_name}</small>
              </div>
              <img
                src={selectedDoctor?.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100'}
                alt={selectedDoctor?.full_name}
                style={{ width: '46px', height: '46px', borderRadius: '10px', objectFit: 'cover' }}
              />
            </div>

            <dl style={{ borderTop: '1px solid var(--line)', margin: 0, paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px' }}>
                <dd style={{ margin: 0, fontWeight: 700 }}>{new Date(bookingDate).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</dd>
                <dt style={{ color: 'var(--muted)' }}>التاريخ</dt>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px' }}>
                <dd style={{ margin: 0, fontWeight: 700 }}>{selectedSlot?.label || '٦:٣٠ مساءً'}</dd>
                <dt style={{ color: 'var(--muted)' }}>الوقت</dt>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px' }}>
                <dd style={{ margin: 0, fontWeight: 800, color: 'var(--primary)', fontSize: '15px' }}>
                  {bookingResult.queue_number || 12}
                </dd>
                <dt style={{ color: 'var(--muted)' }}>رقم الدور المتوقع</dt>
              </div>
            </dl>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
              <button
                className="btn secondary"
                type="button"
                onClick={() => navigateTo('my-bookings')}
              >
                عرض حجوزاتي
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  handleTrackWithCode(bookingResult.booking_code);
                }}
              >
                متابعة الدور لحظياً
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button
                type="button"
                className="text-button"
                style={{ color: 'var(--red)', fontSize: '12px' }}
                onClick={() => handleCancelTracked(bookingResult.booking_code)}
              >
                إلغاء الحجز
              </button>
            </div>
          </section>
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW F: LIVE QUEUE TRACKING (MATCHING SCREENSHOT 1) */}
      {/* ------------------------------------------------------------------ */}
      {/* ------------------------------------------------------------------ */}
      {/* VIEW: LIVE QUEUE TRACKING */}
      {/* ------------------------------------------------------------------ */}
      {page === 'tracking' && (() => {
        const queueData = trackedBooking?.queue;
        const dateInfo = trackedBooking?.date_info;
        const apptData = trackedBooking?.appointment;
        const todayStr = dateInfo?.today_date || new Date().toISOString().split('T')[0];
        const isFuture = dateInfo ? dateInfo.is_future : (apptData?.appointment_date && apptData.appointment_date > todayStr);
        const isPast = dateInfo ? dateInfo.is_past : (apptData?.appointment_date && apptData.appointment_date < todayStr);
        const isToday = !isFuture && !isPast;
        const daysRemaining = dateInfo?.days_remaining || 1;

        const formattedDate = apptData?.appointment_date
          ? new Date(apptData.appointment_date + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : '';

        const queueStatus = queueData?.status || apptData?.status || 'waiting';
        const queueNum = queueData?.queue_number ?? apptData?.queue_number ?? 0;
        const currentServing = queueData?.current_serving ?? queueData?.current_serving_number ?? 0;
        const patientsAhead = queueData?.patients_ahead ?? 0;
        const waitMinutes = queueData?.estimated_wait_minutes ?? (patientsAhead * 20);

        let heroBadge = 'اقترب دورك';
        let heroTitle = `قدامك ${patientsAhead} ${patientsAhead === 1 ? 'مريض' : patientsAhead === 2 ? 'مريضان' : 'مرضى'}`;
        let heroDesc = `الوقت المتوقع لدخولك حوالي ${waitMinutes} دقيقة. يفضل تكون في العيادة دلوقتي.`;

        if (isFuture) {
          heroBadge = `📅 موعد قادم (متبقي ${daysRemaining === 1 ? 'يوم واحد' : daysRemaining === 2 ? 'يومان' : `${daysRemaining} أيام`})`;
          heroTitle = `لسه معادك يوم ${formattedDate}`;
          heroDesc = `كشفك محجوز بتاريخ ${formattedDate} الساعة ${apptData?.appointment_time || ''}. رقم دورك المتوقع في هذا اليوم هو (دور رقم ${queueNum})، ومحجوز قبلك حتى الآن ${patientsAhead} ${patientsAhead === 1 ? 'مريض' : patientsAhead === 2 ? 'مريضان' : 'مرضى'}. سيتم فتح الطابور اللحظي المباشر في يوم كشفك لتتابع حركة العيادة ثانية بثانية.`;
        } else if (isPast) {
          heroBadge = '⌛ موعد سابق';
          heroTitle = `هذا الموعد كان بتاريخ ${formattedDate}`;
          heroDesc = 'انتهى تاريخ هذا الموعد. يمكنك حجز استشارة جديدة أو إعادة كشف في أي وقت عبر منصة دوري.';
        } else if (queueStatus === 'called') {
          heroBadge = '🔔 حان دورك الآن!';
          heroTitle = 'تفضل بالدخول للعيادة فوراً';
          heroDesc = `تم استدعاء رقم دورك (${queueNum}) للكشف مع ${apptData?.doctor_name || 'الطبيب'}. يرجى التوجه فوراً لغرفة الكشف.`;
        } else if (queueStatus === 'in_progress') {
          heroBadge = '🩺 جاري الكشف';
          heroTitle = 'أنت داخل غرفة الكشف حالياً';
          heroDesc = `جاري تقديم الرعاية الطبية لك الآن مع ${apptData?.doctor_name || 'الطبيب'}.`;
        } else if (queueStatus === 'completed') {
          heroBadge = '✅ اكتملت الزيارة';
          heroTitle = 'تم الانتهاء من الكشف بنجاح';
          heroDesc = 'نتمنى لك دوام الصحة والعافية! تم تسجيل الكشف بنجاح.';
        } else if (queueStatus === 'skipped') {
          heroBadge = '⚠️ تم تجاوز الدور';
          heroTitle = 'تم تخطي رقم دورك لعدم التواجد';
          heroDesc = 'يرجى مراجعة موظف الاستقبال في العيادة لإعادة ترتيب دورك.';
        } else if (queueStatus === 'cancelled') {
          heroBadge = '❌ الحجز ملغي';
          heroTitle = 'تم إلغاء هذا الموعد';
          heroDesc = 'هذا الموعد ملغي، يمكنك حجز موعد جديد في أي وقت يناسبك.';
        } else if (patientsAhead === 0) {
          heroBadge = '🟢 أنت التالي مباشرة';
          heroTitle = 'دورك القادم مباشرة!';
          heroDesc = 'أنت المريض التالي للدخول فور انتهاء الكشف الحالي. يرجى التواجد بقاعة الانتظار.';
        }

        return (
          <main className="tracking-page" style={{ maxWidth: '820px', margin: '20px auto 70px' }}>
            <div className="breadcrumb">
              <span onClick={() => navigateTo('home')}>الرئيسية</span>
              <Icon name="chevronLeft" size={12} />
              <b>متابعة الدور</b>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span className="live-pill" style={{ margin: '0 auto 8px' }}>
                <span className="live-dot" /> {isToday ? 'تحديث مباشر' : 'بيانات الحجز والموعد'}
              </span>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '6px 0 2px' }}>
                دورك عند {apptData?.doctor_name || selectedDoctor?.full_name || 'الطبيب'}
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                {isToday ? 'آخر تحديث لحظي من نظام العيادة' : `الموعد مجدول لتاريخ: ${formattedDate || apptData?.appointment_date}`}
              </p>
            </div>

            {/* Search by code or mobile form */}
            <form onSubmit={handleTrack} style={{ display: 'flex', gap: '8px', maxWidth: '480px', margin: '0 auto 24px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="ادخل كود الحجز (مثال: DWR-7001) أو رقم الموبايل"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn primary" type="submit" disabled={trackingLoading}>
                {trackingLoading ? 'جاري...' : 'تتبع'}
              </button>
            </form>

            {!trackedBooking ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '20px', maxWidth: '580px', margin: '0 auto' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: '28px' }}>
                  🔍
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>تتبع دورك في العيادة لحظياً</h3>
                <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7, margin: '0 0 24px', maxWidth: '440px', marginInline: 'auto' }}>
                  أدخل كود الحجز الخاص بك (مثال: DWR-7001) أو رقم هاتفك في الحقل أعلاه لمشاهدة رقم دورك المباشر، والدور الحالي بالعيادة، وموعد كشفك بدقة ثانية بثانية.
                </p>
                <button className="btn secondary" type="button" onClick={() => navigateTo('my-bookings')}>
                  عرض قائمة حجوزاتي السابقة ←
                </button>
              </div>
            ) : (
              <>
                {/* Big Hero Card */}
                <div className="live-queue-hero-figma" style={{
                  background: isFuture ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' : undefined
                }}>
                  <div>
                    <span style={{ opacity: 0.85, fontSize: '12px', display: 'block', marginBottom: '4px' }}>{heroBadge}</span>
                    <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 10px', lineHeight: 1.3 }}>
                      {heroTitle}
                    </h2>
                    <p style={{ opacity: 0.9, fontSize: '13px', lineHeight: 1.7, margin: '0 0 18px', maxWidth: '440px' }}>
                      {heroDesc}
                    </p>
                    <button
                      type="button"
                      className="btn white"
                      style={{ borderRadius: '12px', padding: '10px 20px', fontWeight: 700 }}
                      onClick={() => alert(`عنوان العيادة: ${apptData?.clinic_name || ''} - ${apptData?.city || ''} - ${apptData?.address || ''}`)}
                    >
                      <span>اتجاهات العيادة</span>
                      <span>📍</span>
                    </button>
                  </div>

                  {/* Circular queue ring on right */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '150px', height: '150px', borderRadius: '50%', border: '8px solid rgba(255,255,255,0.2)', borderTopColor: '#6ee1d3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 'auto' }}>
                      <small style={{ opacity: 0.8, fontSize: '11px' }}>{isFuture ? 'رقم دورك المحجوز' : 'رقم دورك'}</small>
                      <b style={{ fontSize: '46px', lineHeight: 1.1 }}>{queueNum > 0 ? queueNum : '-'}</b>
                    </div>
                  </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '16px' }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="clock" size={20} />
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', fontSize: '10px', display: 'block' }}>
                        {isFuture ? 'تاريخ الموعد' : 'الانتظار المتوقع'}
                      </small>
                      <b style={{ fontSize: '15px' }}>
                        {isFuture ? apptData?.appointment_date : `${waitMinutes} دقيقة`}
                      </b>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="users" size={20} />
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', fontSize: '10px', display: 'block' }}>
                        {isFuture ? 'محجوز قبلك بنفس اليوم' : 'المرضى قبلك'}
                      </small>
                      <b style={{ fontSize: '15px' }}>{patientsAhead} مرضى</b>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center' }}>
                      <Icon name="user" size={20} />
                    </div>
                    <div>
                      <small style={{ color: 'var(--muted)', fontSize: '10px', display: 'block' }}>
                        {isFuture ? 'وقت الكشف المحجوز' : 'الدور الحالي بالعيادة'}
                      </small>
                      <b style={{ fontSize: '15px' }}>
                        {isFuture ? (apptData?.appointment_time || 'حسب الترتيب') : (currentServing > 0 ? `رقم ${currentServing}` : 'لم يبدأ بعد')}
                      </b>
                    </div>
                  </div>
                </div>

                {/* Yellow Notification Notice */}
                <div style={{ background: '#fff9ed', border: '1px solid #f3e2ba', borderRadius: '14px', padding: '14px 18px', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', color: '#8a5c10' }}>
                  <Icon name="bell" size={20} />
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: '12px', display: 'block' }}>
                      {isFuture ? 'تنبيهات الموعد المجدول' : 'تنبيهات فورية عند اقتراب دورك'}
                    </b>
                    <small style={{ opacity: 0.85, fontSize: '11px' }}>
                      {isFuture
                        ? `سنقوم بتذكيرك تلقائياً في صباح يوم ${formattedDate} وتفعيل شاشة الطابور الحي لمتابعة كشفك.`
                        : (patientsAhead <= 1 ? 'أنت على وشك الدخول، يرجى التواجد أمام غرفة الطبيب.' : 'سنقوم بتنبيهك تلقائياً عند اقتراب موعد دخولك.')}
                    </small>
                  </div>
                </div>

                {/* Clinic state status bar */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 18px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${isToday ? 'badge-success' : 'badge-primary'}`}>
                    {isToday ? '• المواعيد منتظمة' : '• حجز مؤكد ومجدول'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <span className="live-dot" />
                    <b style={{ color: 'var(--ink)' }}>{apptData?.clinic_name || 'عيادة دوري'}</b>
                    <span style={{ color: 'var(--muted)' }}>
                      {isToday ? '– جاري استقبال المرضى وتحديث الطابور المباشر' : '– الحجوزات والمواعيد منتظمة'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </main>
        );
      })()}


      {/* ------------------------------------------------------------------ */}
      {/* VIEW: SPECIALTIES DIRECTORY */}
      {/* ------------------------------------------------------------------ */}
      {page === 'specialties' && (
        <main className="page-shell" style={{ margin: '20px auto 60px' }}>
          <div className="breadcrumb" style={{ marginBottom: '20px' }}>
            <span onClick={() => navigateTo('home')} style={{ cursor: 'pointer', color: 'var(--muted)' }}>الرئيسية</span>
            <span style={{ margin: '0 8px', color: 'var(--muted)' }}>›</span>
            <b style={{ color: 'var(--ink)' }}>دليل التخصصات الطبية</b>
          </div>

          <div className="simple-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 6px' }}>التخصصات الطبية المعتمدة</h1>
              <p style={{ color: 'var(--muted)', margin: 0, fontSize: '13px' }}>اكتشف نخبة من الأطباء والعيادات في جميع التخصصات واحجز موعدك فوراً</p>
            </div>
            <button className="btn primary" onClick={() => navigateTo('search')}>
              تصفح كل الأطباء ←
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {specialties.map((spec) => (
              <div
                key={spec.id}
                onClick={() => {
                  setSelectedSpecialty(spec.id);
                  navigateTo('search');
                }}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = 'var(--line)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <SpecialtyIcon specialty={spec} size={26} tile={52} radius={14} />
                  <div>
                    <h3 style={{ margin: '0 0 3px', fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{spec.name}</h3>
                    <span className="badge" style={{
                      background: spec.doctors_count > 0 ? 'var(--primary-soft)' : 'var(--surface-2)',
                      color: spec.doctors_count > 0 ? 'var(--primary)' : 'var(--muted)',
                      fontSize: '11px',
                      padding: '2px 8px',
                      fontWeight: 700
                    }}>
                      {spec.doctors_count > 0 ? `${spec.doctors_count} طبيب متاح` : 'قريباً (لا يوجد أطباء حالياً)'}
                    </span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6 }}>
                  {spec.description || 'فريق طبي متكامل من استشاريين وأخصائيين لتقديم أفضل رعاية.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>تصفح الأطباء</span>
                  <span style={{ fontSize: '16px', color: 'var(--primary)' }}>←</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW: MY BOOKINGS (حجوزاتي) */}
      {/* ------------------------------------------------------------------ */}
      {page === 'bookings' && (
        <main className="page-shell narrow" style={{ maxWidth: '840px', margin: '20px auto 70px' }}>
          <div className="breadcrumb" style={{ marginBottom: '18px' }}>
            <span onClick={() => navigateTo('home')} style={{ cursor: 'pointer', color: 'var(--muted)' }}>الرئيسية</span>
            <span style={{ margin: '0 8px', color: 'var(--muted)' }}>›</span>
            <b style={{ color: 'var(--ink)' }}>حجوزاتي</b>
          </div>

          <div className="simple-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px' }}>حجوزاتي</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>متابعة وإدارة كل مواعيدك الطبية السابقة والقادمة</p>
            </div>
            <button className="btn primary" onClick={() => navigateTo('search')} style={{ borderRadius: '12px' }}>
              <span>+</span> حجز موعد جديد
            </button>
          </div>

          {/* Quick Phone Search Bar */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>رقم الموبايل المسجل:</span>
            <input
              type="tel"
              dir="ltr"
              className="form-input"
              placeholder="010XXXXXXXX"
              value={myBookingsPhone}
              onChange={(e) => setMyBookingsPhone(e.target.value)}
              style={{ width: '180px', padding: '6px 10px', fontSize: '13px' }}
            />
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => loadMyBookings(myBookingsPhone)}
            >
              بحث بحجوزاتي
            </button>
          </div>

          {/* Tabs: القادمة / السابقة */}
          <div className="tabs" style={{ display: 'flex', borderBottom: '1px solid var(--line)', gap: '20px', marginBottom: '20px' }}>
            <button
              type="button"
              className={bookingsTab === 'upcoming' ? 'active' : ''}
              onClick={() => setBookingsTab('upcoming')}
              style={{ background: 'none', border: 'none', padding: '10px 4px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', borderBottom: bookingsTab === 'upcoming' ? '2px solid var(--primary)' : '2px solid transparent', color: bookingsTab === 'upcoming' ? 'var(--primary)' : 'var(--muted)' }}
            >
              المواعيد القادمة <span style={{ background: 'var(--primary-soft)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', marginRight: '6px' }}>{myBookingsList.filter(b => b.status !== 'cancelled').length}</span>
            </button>
            <button
              type="button"
              className={bookingsTab === 'past' ? 'active' : ''}
              onClick={() => setBookingsTab('past')}
              style={{ background: 'none', border: 'none', padding: '10px 4px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', borderBottom: bookingsTab === 'past' ? '2px solid var(--primary)' : '2px solid transparent', color: bookingsTab === 'past' ? 'var(--primary)' : 'var(--muted)' }}
            >
              المواعيد السابقة والملغاة ({myBookingsList.filter(b => b.status === 'cancelled').length})
            </button>
          </div>

          {/* Bookings List */}
          {loadingBookings ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>جاري تحميل الحجوزات...</div>
          ) : (bookingsTab === 'upcoming' ? myBookingsList.filter(b => b.status !== 'cancelled') : myBookingsList.filter(b => b.status === 'cancelled')).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '18px' }}>
              <span style={{ fontSize: '36px', display: 'block', marginBottom: '10px' }}>📅</span>
              <h3 style={{ margin: '0 0 6px', fontSize: '16px' }}>لا توجد حجوزات في هذا القسم</h3>
              <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0 0 16px' }}>يمكنك البحث عن طبيب وحجز موعدك بسهولة وفي ثوانٍ معدودة</p>
              <button className="btn primary" onClick={() => navigateTo('search')}>احجز الآن</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(bookingsTab === 'upcoming' ? myBookingsList.filter(b => b.status !== 'cancelled') : myBookingsList.filter(b => b.status === 'cancelled')).map((appt) => {
                const apptDate = new Date(appt.appointment_date);
                const dayNum = apptDate.getDate();
                const monthName = apptDate.toLocaleDateString('ar-EG', { month: 'short' });
                const dayName = apptDate.toLocaleDateString('ar-EG', { weekday: 'short' });
                const isCancelled = appt.status === 'cancelled';

                return (
                  <div
                    key={appt.id}
                    className="appointment-item"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRight: !isCancelled ? '3px solid var(--primary)' : '1px solid var(--line)',
                      borderRadius: '16px',
                      padding: '18px',
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr auto',
                      alignItems: 'center',
                      gap: '18px'
                    }}
                  >
                    {/* Date Block */}
                    <div style={{ borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingLeft: '12px' }}>
                      <b style={{ fontSize: '24px', lineHeight: 1.1, color: 'var(--primary)' }}>{dayNum}</b>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)' }}>{monthName}</span>
                      <small style={{ fontSize: '11px', color: 'var(--muted)' }}>{dayName}</small>
                    </div>

                    {/* Doctor Details */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <img
                        src={appt.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100'}
                        alt={appt.doctor_name}
                        style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{appt.doctor_name}</b>
                          <span className="badge" style={{ fontSize: '10px', background: isCancelled ? 'rgba(224,82,82,0.1)' : 'rgba(24,169,153,0.1)', color: isCancelled ? '#e05252' : 'var(--primary)' }}>
                            {isCancelled ? 'ملغي' : 'مؤكد'}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: 'var(--muted)' }}>
                          {appt.clinic_name || appt.branch_name || 'العيادة'} · {appt.city || 'القاهرة'} · الساعة {appt.appointment_time}
                        </p>
                        <span style={{ fontSize: '11px', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '6px', color: 'var(--ink)', fontFamily: 'monospace' }}>
                          كود الحجز: {appt.booking_code}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      {!isCancelled && (
                        <button
                          className="btn primary small"
                          type="button"
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                          onClick={() => handleTrackWithCode(appt.booking_code)}
                        >
                          متابعة الدور لحظياً
                        </button>
                      )}
                      {!isCancelled && (
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#e05252', fontSize: '12px', cursor: 'pointer', padding: '2px 6px' }}
                          onClick={() => handleCancelAppointment(appt.booking_code)}
                        >
                          إلغاء الحجز
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MINIMAL PATIENT PROFILE MODAL (REQUIREMENT 9) */}
      {/* ------------------------------------------------------------------ */}
      {showPatientModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'grid', placeItems: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>حساب المريض</h3>
              <button
                type="button"
                onClick={() => setShowPatientModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--surface-2)', borderRadius: '14px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '18px', fontWeight: 800 }}>
                {patientProfile.name.slice(0, 1)}
              </div>
              <div>
                <b style={{ display: 'block', fontSize: '15px' }}>{patientProfile.name}</b>
                <small style={{ color: 'var(--muted)', fontSize: '12px' }}>{patientProfile.phone}</small>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>الاسم بالكامل</label>
                <input
                  type="text"
                  className="form-input"
                  value={patientProfile.name}
                  onChange={(e) => setPatientProfile({ ...patientProfile, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>رقم الموبايل</label>
                <input
                  type="tel"
                  dir="ltr"
                  className="form-input"
                  value={patientProfile.phone}
                  onChange={(e) => setPatientProfile({ ...patientProfile, phone: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '5px' }}>المدينة / المنطقة</label>
                <input
                  type="text"
                  className="form-input"
                  value={patientProfile.city}
                  onChange={(e) => setPatientProfile({ ...patientProfile, city: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Quick Minimal Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '10px', textAlign: 'center' }}>
                <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>الحجوزات القادمة</small>
                <b style={{ fontSize: '16px', color: 'var(--primary)' }}>{myBookingsList.filter(b => b.status !== 'cancelled').length}</b>
              </div>
              <div style={{ background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '10px', textAlign: 'center' }}>
                <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block' }}>إجمالي الحجوزات</small>
                <b style={{ fontSize: '16px', color: 'var(--ink)' }}>{myBookingsList.length}</b>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn primary full"
                  type="button"
                  onClick={() => {
                    localStorage.setItem('dawry_patient_name', patientProfile.name);
                    localStorage.setItem('dawry_patient_phone', patientProfile.phone);
                    localStorage.setItem('dawry_patient_city', patientProfile.city);
                    setPatientForm(prev => ({ ...prev, name: patientProfile.name, phone: patientProfile.phone }));
                    setShowPatientModal(false);
                    showToast('تم حفظ بيانات الحساب بنجاح', 'success');
                  }}
                >
                  حفظ التعديلات
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setShowPatientModal(false)}
                >
                  إغلاق
                </button>
              </div>

              <button
                className="text-button"
                type="button"
                style={{ color: 'var(--danger)', fontSize: '13px', padding: '8px', textAlign: 'center', cursor: 'pointer', fontWeight: 700 }}
                onClick={() => {
                  localStorage.removeItem('dawry_patient_name');
                  localStorage.removeItem('dawry_patient_phone');
                  localStorage.removeItem('dawry_patient_city');
                  localStorage.removeItem('dawry_last_booking_code');
                  setPatientProfile({ name: '', phone: '', city: '' });
                  setPatientForm({ name: '', phone: '', email: '', notes: '' });
                  setMyBookingsPhone('');
                  setMyBookingsList([]);
                  setShowPatientModal(false);
                  showToast('تم تسجيل الخروج بنجاح. يمكنك الآن الحجز أو الدخول بمريض جديد كلياً.', 'info');
                }}
              >
                🚪 تسجيل الخروج (الدخول بمريض جديد)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER */}
      {/* ------------------------------------------------------------------ */}
      <footer>
        <Logo compact={false} />
        <p>© {new Date().getFullYear()} دوري – منصة إدارة المواعيد والطوابير الطبية الذكية في مصر.</p>
        <div className="footer-portals">
          {PORTALS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="footer-portal-pill"
              style={portalStyleVars(p)}
              onClick={() => onOpenApp(p.id)}
            >
              <Icon name={p.icon} size={15} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
