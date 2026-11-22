import React from 'react';

export default function AuthQueueBanner() {
  return (
    <div className="auth-visual-hero">
      {/* Background Subtle Grid & Glow */}
      <div className="auth-hero-pattern" />
      <div className="auth-hero-glow" />

      {/* Top Typography */}
      <div className="auth-hero-content">
        <div className="auth-pill-badge">
          <span className="pulse-dot" />
          <span>طابور أهدى، يوم أسهل</span>
        </div>

        <h1 className="auth-hero-title">
          يومك ماشي على
          <span className="cyan-accent">وقتك أنت.</span>
        </h1>

        <p className="auth-hero-subtitle">
          كل مواعيدك ودورك وتحديثاتك في مكان واحد بسيط وواضح.
        </p>
      </div>

      {/* Interactive Live Queue Centerpiece */}
      <div className="auth-queue-centerpiece">
        {/* Orbit Rings */}
        <div className="auth-orbit-ring large" />
        <div className="auth-orbit-ring medium" />
        <div className="auth-orbit-planet" />

        {/* Center Live Dial */}
        <div className="auth-queue-dial">
          <span className="auth-queue-dial-label">دورك</span>
          <span className="auth-queue-dial-number">٢٤</span>
          <span className="auth-queue-dial-status">
            <span className="live-dot" />
            <span>تحديث مباشر</span>
          </span>
        </div>

        {/* Top-Right Floating Chip */}
        <div className="auth-floating-chip top-right">
          <span className="auth-chip-label">متبقي قبلك</span>
          <span className="auth-chip-value">
            <span style={{ fontSize: '14px' }}>👥</span>
            <span>٥ أدوار</span>
          </span>
        </div>

        {/* Middle-Left Floating Chip */}
        <div className="auth-floating-chip middle-left">
          <span className="auth-chip-label">الوقت المتوقع</span>
          <span className="auth-chip-value">
            <span style={{ fontSize: '14px' }}>⏱️</span>
            <span>٢٠-٢٥ دقيقة</span>
          </span>
        </div>

        {/* Bottom Alert Card */}
        <div className="auth-queue-alert-card">
          <div className="auth-alert-info">
            <span className="auth-alert-check">✓</span>
            <div className="auth-alert-text">
              <div className="auth-alert-title">دورك قرب</div>
              <div className="auth-alert-desc">متأخرك في الوقت المناسب</div>
            </div>
          </div>
          <div className="auth-alert-bell">
            <span>🔔</span>
          </div>
        </div>
      </div>

      {/* Bottom Trust Badge */}
      <div className="auth-hero-trust">
        <div className="auth-trust-avatars">
          <span className="auth-trust-avatar cyan">س</span>
          <span className="auth-trust-avatar gold">م</span>
          <span className="auth-trust-avatar purple">أ</span>
        </div>
        <div className="auth-trust-text">
          <div className="auth-trust-title">تجربة موثوقة وآمنة</div>
          <div className="auth-trust-desc">خصوصيتك وبياناتك دايماً في أمان</div>
        </div>
      </div>
    </div>
  );
}
