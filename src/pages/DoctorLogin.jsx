import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Logo from '../components/Logo';
import Icon from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';

export default function DoctorLogin({ onLoginSuccess, onBackHome, dark, setDark, showToast }) {
  const [emailOrPhone, setEmailOrPhone] = useState('dr.tarek@dawry.com');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [doctorsList, setDoctorsList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    loadDoctorsList();
  }, []);

  const loadDoctorsList = async () => {
    setLoadingList(true);
    const res = await api.getDoctorAuthList();
    if (res.success && res.doctors) {
      setDoctorsList(res.doctors);
    }
    setLoadingList(false);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!emailOrPhone.trim()) {
      showToast('يرجى إدخال البريد الإلكتروني أو رقم الهاتف', 'error');
      return;
    }
    setLoading(true);
    const res = await api.loginDoctor({ email: emailOrPhone.trim(), password });
    setLoading(false);
    if (res.success && res.doctor) {
      showToast(`مرحباً بك د. ${res.doctor.full_name}`, 'success');
      onLoginSuccess(res.doctor);
    } else {
      showToast(res.message || 'بيانات الدخول غير صحيحة', 'error');
    }
  };

  const handleQuickDoctorSelect = async (doc) => {
    setLoading(true);
    const res = await api.loginDoctor({ doctor_id: doc.id });
    setLoading(false);
    if (res.success && res.doctor) {
      showToast(`تم الدخول بنجاح بحساب د. ${res.doctor.full_name}`, 'success');
      onLoginSuccess(res.doctor);
    } else {
      showToast(res.message || 'تعذر تسجيل الدخول', 'error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }} className="rtl">
      {/* Top Bar */}
      <header
        style={{
          height: '70px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Logo onClick={onBackHome} />
          <span
            style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px'
            }}
          >
            بوابة تسجيل دخول الأطباء
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle dark={dark} setDark={setDark} />
          <button
            type="button"
            className="btn secondary small"
            onClick={onBackHome}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="arrowLeft" size={14} />
            <span>العودة للموقع العام</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          maxWidth: '1100px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 440px) 1fr',
            gap: '32px',
            width: '100%',
            alignItems: 'start'
          }}
        >
          {/* Card 1: Login Form */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: 'var(--primary-soft)',
                  color: 'var(--primary)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px'
                }}
              >
                <Icon name="briefcase" size={26} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
                تسجيل دخول مساحة العمل
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                أدخل بياناتك للوصول إلى لوحة العيادة وجدول المواعيد ومتابعة الدور
              </p>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                  البريد الإلكتروني أو رقم الهاتف
                </label>
                <input
                  type="text"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  placeholder="مثال: dr.tarek@dawry.com أو 01012345678"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                    كلمة المرور
                  </label>
                  <small style={{ color: 'var(--primary)', fontSize: '11px', cursor: 'pointer' }}>
                    نسيت كلمة المرور؟
                  </small>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '13px'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="rememberDoctor"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="rememberDoctor" style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
                  تذكر بيانات حسابي على هذا المتصفح
                </label>
              </div>

              <button
                type="submit"
                className="btn primary"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '14px',
                  marginTop: '4px'
                }}
              >
                {loading ? 'جاري التحقق والاتصال...' : 'تسجيل الدخول إلى العيادة'}
              </button>
            </form>

            <div
              style={{
                marginTop: '22px',
                paddingTop: '16px',
                borderTop: '1px solid var(--line)',
                fontSize: '11px',
                color: 'var(--muted)',
                textAlign: 'center'
              }}
            >
              🔒 بيئة محمية ومشفرة متوافقة مع متطلبات الخصوصية الصحية لمنصة دُوري
            </div>
          </div>

          {/* Card 2: Multi-Doctor Selector & Tenant Separation Demo */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: '20px',
              padding: '28px',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px', color: 'var(--text)' }}>
                  فصل الحسابات الطبية (Multi-Tenant Accounts)
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                  كل طبيب لديه مساحة عمل وعيادة ومواعيد وطابور منفصل تماماً. اختر حساباً للتجربة المباشرة:
                </p>
              </div>
              <span
                style={{
                  background: 'rgba(22, 163, 106, 0.1)',
                  color: '#16a36a',
                  border: '1px solid rgba(22, 163, 106, 0.25)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px'
                }}
              >
                {doctorsList.length} أطباء معتمدين
              </span>
            </div>

            {loadingList ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                جاري تحميل قائمة الأطباء المعتمدين...
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '12px',
                  maxHeight: '440px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}
              >
                {doctorsList.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleQuickDoctorSelect(doc)}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                      padding: '12px',
                      background: 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(57, 73, 171, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--line)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={doc.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=80'}
                        alt={doc.full_name}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          objectFit: 'cover',
                          border: '1px solid var(--line)'
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: '13px', display: 'block', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.full_name}
                        </b>
                        <small style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '11px', display: 'block' }}>
                          {doc.specialty_name}
                        </small>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', fontSize: '11px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{doc.clinic_name || 'عيادة دوري'}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>كشف: {doc.consultation_fee} ج.م</span>
                    </div>

                    <button
                      type="button"
                      className="btn secondary small"
                      style={{
                        width: '100%',
                        fontSize: '11px',
                        padding: '6px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        justifyContent: 'center'
                      }}
                    >
                      تسجيل الدخول للحساب ←
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
