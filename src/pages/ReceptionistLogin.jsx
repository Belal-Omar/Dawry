import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Logo from '../components/Logo';
import Icon from '../components/Icons';
import ThemeToggle from '../components/ThemeToggle';

export default function ReceptionistLogin({ onLoginSuccess, onBackHome, dark, setDark, showToast }) {
  const [emailOrPhone, setEmailOrPhone] = useState('reception.tarek@dawry.com');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [receptionistsList, setReceptionistsList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    loadReceptionistsList();
  }, []);

  const loadReceptionistsList = async () => {
    setLoadingList(true);
    const res = await api.getReceptionistAuthList();
    if (res.success && res.receptionists) {
      setReceptionistsList(res.receptionists);
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
    const res = await api.loginReceptionist({ email: emailOrPhone.trim(), password });
    setLoading(false);
    if (res.success && res.receptionist) {
      showToast(`مرحباً بك ${res.receptionist.name}`, 'success');
      onLoginSuccess(res.receptionist);
    } else {
      showToast(res.message || 'بيانات الدخول غير صحيحة', 'error');
    }
  };

  const handleQuickSelect = async (rec) => {
    setLoading(true);
    const res = await api.loginReceptionist({ receptionist_id: rec.id });
    setLoading(false);
    if (res.success && res.receptionist) {
      showToast(`تم تسجيل الدخول بنجاح: ${res.receptionist.name}`, 'success');
      onLoginSuccess(res.receptionist);
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
            بوابة دخول موظفي الاستقبال
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
                <Icon name="users" size={26} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px', color: 'var(--text)' }}>
                تسجيل دخول مكتب الاستقبال
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
                التحكم الكامل والتشغيلي في طابور المرضى، نداء الأدوار، وتأكيد الحضور
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
                  placeholder="reception.tarek@dawry.com أو الهاتف"
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: 'var(--text)' }}>
                  كلمة المرور
                </label>
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
                  id="rememberRec"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="rememberRec" style={{ fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
                  تذكر تسجيل الدخول على هذا الجهاز
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
                {loading ? 'جاري التحقق والاتصال...' : 'دخول مكتب الاستقبال ←'}
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
              🔒 صلاحيات إدارة الطابور الكاملة مسندة حصرياً لمكتب الاستقبال
            </div>
          </div>

          {/* Card 2: Quick Receptionist Switcher */}
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
                  موظفو الاستقبال والفروع المعتمدة
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                  كل موظف استقبال مرتبط بطبيب وفرع محدد. اختر حساباً للتجربة السريعة:
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
                {receptionistsList.length} موظفين نشطين
              </span>
            </div>

            {loadingList ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                جاري تحميل موظفي الاستقبال...
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '12px',
                  maxHeight: '440px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}
              >
                {receptionistsList.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => handleQuickSelect(rec)}
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
                      <span
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'var(--primary-soft)',
                          color: 'var(--primary)',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          fontSize: '14px'
                        }}
                      >
                        <Icon name="users" size={18} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: '12px', display: 'block', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rec.name}
                        </b>
                        <small style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '11px', display: 'block' }}>
                          عيادة: {rec.doctor_name}
                        </small>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: '6px', fontSize: '11px', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{rec.clinic_name}</span>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>{rec.branch_name}</span>
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
                      دخول مساحة العمل ←
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
