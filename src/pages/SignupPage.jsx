import React, { useState } from 'react';
import { api } from '../services/api';
import UnifiedNavbar from '../components/UnifiedNavbar';
import AuthQueueBanner from '../components/AuthQueueBanner';

export default function SignupPage({
  dark,
  setDark,
  onSignupSuccess,
  onNavigate,
  showToast
}) {
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('يرجى كتابة الاسم بالكامل');
      return;
    }
    if (!identifier.trim()) {
      setErrorMessage('يرجى كتابة رقم الموبايل أو البريد الإلكتروني');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('كلمة المرور يجب أن تكون ٦ أحرف على الأقل');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('يجب الموافقة على الشروط والأحكام للمتابعة');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.signupPatient({
        name: name.trim(),
        phoneOrEmail: identifier.trim(),
        password,
        hp_website_trap: honeypot,
        device_fingerprint: window.screen ? `${window.screen.width}x${window.screen.height}_${navigator.language}_${navigator.platform}` : 'unknown'
      });

      if (res && res.success) {
        if (showToast) {
          showToast(`أهلاً بك ${res.patient?.name || name}! تم إنشاء حسابك بنجاح`, 'success');
        }
        // Save patient local identity
        localStorage.setItem('dawry_patient_name', res.patient?.name || name);
        if (res.patient?.phone) localStorage.setItem('dawry_patient_phone', res.patient.phone);

        if (onSignupSuccess) {
          onSignupSuccess(res.patient);
        } else {
          window.location.hash = '';
        }
      } else {
        const err = res?.message || 'تعذر إنشاء الحساب، يرجى المحاولة مرة أخرى';
        setErrorMessage(err);
        if (showToast) showToast(err, 'error');
      }
    } catch (err) {
      const msg = err.message || 'حدث خطأ في الاتصال بالخادم';
      setErrorMessage(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Unified Global Navbar */}
      <UnifiedNavbar
        activePage="signup"
        onNavigate={onNavigate}
        dark={dark}
        setDark={setDark}
      />

      <div className="auth-page-main">
        <div className="auth-split-container">
          {/* Left Column: Visual Hero with Queue Art */}
          <AuthQueueBanner />

          {/* Right Column: Patient Signup Form */}
          <div className="auth-form-column">
            <div className="auth-form-card">
              {/* Card Header */}
              <div className="auth-form-header">
                <h2 className="auth-form-title">أنشئ حسابك مجانًا</h2>
                <p className="auth-form-subtitle">
                  خطوات بسيطة وبعدها مواعيدك ودورك يبقوا دايماً معاك.
                </p>
              </div>

              {/* Error Message Banner */}
              {errorMessage && (
                <div className="auth-error-banner">
                  <span>⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate>
                {/* Honeypot Anti-Bot Trap */}
                <input
                  type="text"
                  name="hp_website_trap"
                  style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  tabIndex="-1"
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />

                {/* Field 1: Full Name */}
                <div className="auth-form-group">
                  <label className="auth-label">الاسم بالكامل</label>
                  <div className="auth-input-wrapper">
                    <input
                      type="text"
                      className="auth-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>

                {/* Field 2: Mobile or Email */}
                <div className="auth-form-group">
                  <label className="auth-label">رقم الموبايل أو البريد الإلكتروني</label>
                  <div className="auth-input-wrapper">
                    <input
                      type="text"
                      className="auth-input"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="email tel"
                      required
                    />
                  </div>
                </div>

                {/* Field 3: Password */}
                <div className="auth-form-group">
                  <label className="auth-label">كلمة المرور</label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input has-eye"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? 'إخفاء' : 'عرض'}
                    </button>
                  </div>
                </div>

                {/* Checkbox: Terms & Privacy */}
                <div className="auth-options-row" style={{ marginTop: '8px' }}>
                  <label className="auth-checkbox-label" style={{ fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      required
                    />
                    <span>
                      أوافق على{' '}
                      <span style={{ color: '#3b50c4', fontWeight: 600 }}>الشروط والأحكام</span>{' '}
                      و<span style={{ color: '#3b50c4', fontWeight: 600 }}>سياسة الخصوصية</span>
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                  style={{ marginTop: '16px' }}
                >
                  {loading ? (
                    <span>جاري إنشاء الحساب...</span>
                  ) : (
                    <>
                      <span>إنشاء حساب</span>
                      <span style={{ fontSize: '18px', marginRight: '4px' }}>←</span>
                    </>
                  )}
                </button>

                {/* Switch to Login Link */}
                <div className="auth-switch-link-wrapper">
                  <span>لديك حساب بالفعل؟</span>
                  <a
                    href="#login"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onNavigate) onNavigate('login');
                      else window.location.hash = '#login';
                    }}
                    className="auth-switch-link"
                  >
                    تسجيل الدخول
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
