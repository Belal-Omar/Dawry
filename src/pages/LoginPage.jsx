import React, { useState } from 'react';
import { api } from '../services/api';
import UnifiedNavbar from '../components/UnifiedNavbar';
import AuthQueueBanner from '../components/AuthQueueBanner';

export default function LoginPage({
  dark,
  setDark,
  onLoginSuccess,
  onNavigate,
  showToast
}) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage('يرجى كتابة رقم الموبايل أو البريد الإلكتروني');
      return;
    }
    if (!password) {
      setErrorMessage('يرجى كتابة كلمة المرور');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.login({
        identifier: identifier.trim(),
        password,
        hp_website_trap: honeypot,
        device_fingerprint: window.screen ? `${window.screen.width}x${window.screen.height}_${navigator.language}_${navigator.platform}` : 'unknown'
      });
      if (res && res.success) {
        if (showToast) {
          showToast(`أهلاً بك ${res.user?.name || res.user?.full_name || ''}! تم تسجيل الدخول بنجاح`, 'success');
        }
        if (onLoginSuccess) {
          onLoginSuccess(res.user, res.role);
        } else {
          window.location.hash = res.redirectUrl || (res.role === 'admin' ? '#admin' : res.role === 'doctor' ? '#doctor' : res.role === 'reception' ? '#reception' : '#home');
        }
      } else {
        const err = res?.message || 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى';
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

  const handleGoogleLogin = () => {
    if (showToast) {
      showToast('جاري تحضير تسجيل الدخول عبر Google...', 'info');
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    if (showToast) {
      showToast('يرجى التواصل مع إدارة العيادة أو الدعم لإعادة تعيين كلمة المرور', 'info');
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Unified Global Navbar */}
      <UnifiedNavbar
        activePage="login"
        onNavigate={onNavigate}
        dark={dark}
        setDark={setDark}
      />

      <div className="auth-page-main">
        <div className="auth-split-container">
          {/* Left Column: Visual Hero with Queue Art */}
          <AuthQueueBanner />

          {/* Right Column: Unified Login Form */}
          <div className="auth-form-column">
            <div className="auth-form-card">
              {/* Card Header */}
              <div className="auth-form-header">
                <span className="auth-welcome-pill">أهلاً بيك من جديد</span>
                <h2 className="auth-form-title">سجّل دخولك</h2>
                <p className="auth-form-subtitle">
                  ادخل بياناتك عشان تتابع مواعيدك ودورك.
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

                {/* Field 1: Mobile or Email */}
                <div className="auth-form-group">
                  <label className="auth-label">رقم الموبايل أو البريد الإلكتروني</label>
                  <div className="auth-input-wrapper">
                    <input
                      type="text"
                      className="auth-input"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Field 2: Password */}
                <div className="auth-form-group">
                  <label className="auth-label">كلمة المرور</label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="auth-input has-eye"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
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

                {/* Options Row: Remember Me */}
                <div className="auth-options-row">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>تذكرني على هذا الجهاز</span>
                  </label>
                  <a href="#forgot" onClick={handleForgotPassword} className="auth-forgot-link">
                    نسيت كلمة المرور؟
                  </a>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={loading}
                >
                  {loading ? (
                    <span>جاري تسجيل الدخول...</span>
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <span style={{ fontSize: '18px', marginRight: '4px' }}>←</span>
                    </>
                  )}
                </button>

                {/* Switch to Signup Link */}
                <div className="auth-switch-link-wrapper">
                  <span>مريض لأول مرة؟</span>
                  <a
                    href="#signup"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onNavigate) onNavigate('signup');
                      else window.location.hash = '#signup';
                    }}
                    className="auth-switch-link"
                  >
                    إنشاء حساب جديد
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
