import React, { useState, useEffect } from 'react';
import Icon from './Icons';

export function normalizeEgyptianWhatsAppPhone(raw = '') {
  let digits = String(raw).replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '20' + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith('1')) {
    digits = '20' + digits;
  }
  return digits;
}

const buildTemplates = (rawCtx) => {
  const ctx = rawCtx || {};
  const name = ctx.patientName || 'المريض الكريم';
  const doctor = ctx.doctorName || 'الطبيب';
  const clinic = ctx.clinicName || 'العيادة';
  const qNum = ctx.queueNumber || '—';
  const serving = ctx.currentServing || '—';
  const ahead = ctx.patientsAhead ?? 1;
  const date = ctx.appointmentDate || 'اليوم';
  const time = ctx.appointmentTime || 'المحدد';
  const code = ctx.bookingCode || '';
  const delay = ctx.delayMinutes || 15;

  return [
    {
      id: 'approaching',
      title: 'اقتراب الدور',
      badge: 'الأكثر استخداماً',
      text: `أهلاً بك ${name}،\nدورك اقترب عند ${doctor} في ${clinic}.\nرقم دورك: #${qNum} (يُكشف الآن على رقم #${serving} وأمامك ${ahead} مرضى تقريباً).\nيرجى التواجد بالعيادة للاستعداد للدخول.`
    },
    {
      id: 'your_turn',
      title: 'دورك الآن (نداء)',
      badge: 'عاجل',
      text: `أهلاً ${name}،\nحان دورك الآن (رقم #${qNum}) عند ${doctor}.\nتفضل بالدخول إلى غرفة الكشف.`
    },
    {
      id: 'confirmed',
      title: 'تأكيد الحجز',
      badge: 'مواعيد',
      text: `مرحباً ${name}،\nتم تأكيد موعدك في ${clinic} مع ${doctor}\n📅 التاريخ: ${date}\n⏰ الساعة: ${time}${code ? `\n🔖 كود الحجز: ${code}` : ''}\nنتمنى لك دوام الصحة والعافية.`
    },
    {
      id: 'delay',
      title: 'تنبيه تأخير',
      badge: 'تحديث',
      text: `نعتذر لك ${name}،\nيوجد تأخير بسيط حوالي ${delay} دقيقة في مواعيد ${doctor} اليوم بعيادة ${clinic}.\nنقدّر تفهمك وسنبلغك فور اقتراب دورك.`
    },
    {
      id: 'reminder',
      title: 'تذكير بالموعد',
      badge: 'تذكير',
      text: `تذكير لطيف بموعدك اليوم يا ${name} في ${clinic} مع ${doctor} الساعة ${time}.\nفي حال تعذر الحضور يرجى إبلاغنا لتوفير الموعد لمريض آخر.`
    },
    {
      id: 'followup',
      title: 'متابعة بعد الكشف',
      badge: 'رعاية',
      text: `أهلاً ${name}،\nنطمئن على صحتك بعد زيارتك لـ ${doctor} في ${clinic}.\nلأي استفسار أو لحجز موعد متابعة يمكنك التواصل معنا هنا مباشرة.`
    }
  ];
};

export default function WhatsAppModal({ isOpen, onClose, context, onSent }) {
  const templates = buildTemplates(context);
  const [selectedId, setSelectedId] = useState('approaching');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const list = buildTemplates(context);
      setSelectedId(list[0].id);
      setMessage(list[0].text);
      setCopied(false);
    }
  }, [isOpen, context?.patientPhone, context?.queueNumber, context?.bookingCode]);

  if (!isOpen || !context) return null;

  const waDigits = normalizeEgyptianWhatsAppPhone(context.patientPhone);
  const selectedTemplate = templates.find((t) => t.id === selectedId) || templates[0];

  const handleSelectTemplate = (tpl) => {
    setSelectedId(tpl.id);
    setMessage(tpl.text);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {}
  };

  const handleSendWhatsApp = () => {
    if (!waDigits) return;
    const url = `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (onSent) {
      onSent({
        patient_name: context.patientName,
        patient_phone: context.patientPhone,
        template_title: selectedTemplate.title,
        message
      });
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-box wa-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', width: '94vw', padding: '22px' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #25D366, #128C7E)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '20px', boxShadow: '0 6px 14px rgba(37, 211, 102, 0.3)' }}>
              <Icon name="phone" size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                مراسلة المريض عبر واتساب
              </h3>
              <small style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {context.patientName} · <span dir="ltr">{context.patientPhone}</span>
              </small>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Ready-to-use Templates */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '8px' }}>
            اختر رسالة جاهزة (يمكنك التعديل عليها):
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
            {templates.map((tpl) => {
              const active = tpl.id === selectedId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  style={{
                    padding: '9px 10px',
                    borderRadius: '11px',
                    border: '1.5px solid',
                    borderColor: active ? '#128C7E' : 'var(--line)',
                    background: active ? 'rgba(37, 211, 102, 0.12)' : 'var(--surface-2)',
                    color: 'var(--ink)',
                    textAlign: 'right',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <b style={{ fontSize: '12px', color: active ? '#0d7a6c' : 'var(--ink)' }}>{tpl.title}</b>
                  <small style={{ fontSize: '10px', color: 'var(--muted)' }}>{tpl.badge}</small>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editable Message Box */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--muted)', marginBottom: '6px' }}>
            نص الرسالة:
          </label>
          <textarea
            className="form-input"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '13.5px', lineHeight: 1.65, borderRadius: '12px', resize: 'vertical' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn primary"
            onClick={handleSendWhatsApp}
            disabled={!waDigits || !message.trim()}
            style={{
              flex: 1,
              minWidth: '180px',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              border: 'none',
              justifyContent: 'center',
              fontWeight: 800,
              boxShadow: '0 6px 16px rgba(37, 211, 102, 0.3)'
            }}
          >
            فتح واتساب وإرسال الرسالة ←
          </button>
          <button type="button" className="btn secondary" onClick={handleCopy}>
            {copied ? '✓ تم النسخ' : 'نسخ النص'}
          </button>
          <button type="button" className="btn secondary" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

