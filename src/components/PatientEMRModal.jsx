import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Icon from './Icons';

/* Crisp lightweight SVG Trend Chart for BP Systolic, Weight & Improvement Score */
function VitalsTrendChart({ visits }) {
  if (!visits || visits.length < 2) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: 'var(--surface-2)', borderRadius: '14px', color: 'var(--muted)', fontSize: '12.5px' }}>
        سجّل زيارتين على الأقل لعرض منحنى مقارنة التحسن عبر الزمن
      </div>
    );
  }

  const W = 540;
  const H = 175;
  const PAD = { t: 18, r: 24, b: 30, l: 24 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const points = visits.slice(-8);
  const xAt = (i) => PAD.l + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);

  const buildPath = (vals, minV, maxV) => {
    const span = Math.max(1, maxV - minV);
    return vals.map((v, i) => {
      const y = PAD.t + plotH - ((v - minV) / span) * plotH;
      return `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const impVals = points.map((v) => Number(v.improvement_score || 5));
  const bpVals = points.map((v) => Number(v.bp_systolic || 120));
  const bpMin = Math.min(...bpVals, 90) - 5;
  const bpMax = Math.max(...bpVals, 160) + 5;

  const impPath = buildPath(impVals, 0, 10);
  const bpPath = buildPath(bpVals, bpMin, bpMax);

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <b style={{ fontSize: '13px', color: 'var(--ink)' }}>منحنى مقارنة التحسن والمؤشرات الحيوية</b>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 700 }}>
          <span style={{ color: '#10b981' }}>● درجة التحسن (من ١٠)</span>
          <span style={{ color: '#2563eb' }}>● ضغط الدم الانقباضي</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + plotH * f}
            y2={PAD.t + plotH * f}
            stroke="var(--line)"
            strokeDasharray="4 4"
          />
        ))}
        <path d={bpPath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={impPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((v, i) => {
          const x = xAt(i);
          const impY = PAD.t + plotH - ((Number(v.improvement_score || 5) - 0) / 10) * plotH;
          const bpY = PAD.t + plotH - ((Number(v.bp_systolic || 120) - bpMin) / Math.max(1, bpMax - bpMin)) * plotH;
          return (
            <g key={v.id || i}>
              <circle cx={x} cy={bpY} r="4.5" fill="#2563eb" stroke="#fff" strokeWidth="1.5" />
              <circle cx={x} cy={impY} r="5" fill="#10b981" stroke="#fff" strokeWidth="1.5" />
              <text x={x} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {String(v.visit_date || '').slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function PatientEMRModal({
  isOpen,
  onClose,
  doctorId,
  doctorInfo,
  patientPhone,
  patientName,
  appointmentId,
  showToast
}) {
  const [tab, setTab] = useState('progress'); // progress | visits | labs | meds
  const [loading, setLoading] = useState(true);
  const [emr, setEmr] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    blood_type: 'غير محدد',
    allergies: '',
    chronic_conditions: '',
    past_surgeries: '',
    family_history: '',
    notes: ''
  });

  // New Visit + Prescription form
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [visitForm, setVisitForm] = useState({
    chief_complaint: '',
    diagnosis: '',
    clinical_notes: '',
    bp_systolic: '',
    bp_diastolic: '',
    heart_rate: '',
    temperature: '',
    blood_sugar: '',
    weight_kg: '',
    improvement_score: 8,
    follow_up_date: ''
  });
  const [rxList, setRxList] = useState([
    { medication_name: '', dosage: 'قرص', frequency: 'مرتين يومياً', duration: '٧ أيام', instructions: '' }
  ]);

  // New Lab Result form
  const [showNewLab, setShowNewLab] = useState(false);
  const [labForm, setLabForm] = useState({
    test_name: '',
    category: 'تحليل دم',
    numeric_value: '',
    unit: '',
    reference_range: '',
    status: 'normal',
    result_text: '',
    attachment_url: '',
    test_date: new Date().toISOString().split('T')[0]
  });

  const loadEMR = async () => {
    if (!doctorId || !patientPhone) return;
    setLoading(true);
    const res = await api.getDoctorPatientEMR(doctorId, patientPhone);
    if (res && res.success) {
      setEmr(res);
      if (res.profile) {
        setProfileForm({
          blood_type: res.profile.blood_type || 'غير محدد',
          allergies: res.profile.allergies || '',
          chronic_conditions: res.profile.chronic_conditions || '',
          past_surgeries: res.profile.past_surgeries || '',
          family_history: res.profile.family_history || '',
          notes: res.profile.notes || ''
        });
      }
    } else if (showToast) {
      showToast(res?.message || 'تعذر تحميل السجل الطبي', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen && patientPhone) {
      setTab('progress');
      setShowNewVisit(false);
      setShowNewLab(false);
      loadEMR();
    }
  }, [isOpen, patientPhone, doctorId]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const res = await api.updateDoctorPatientProfile(doctorId, patientPhone, {
      patient_name: patientName,
      ...profileForm
    });
    if (res && res.success) {
      setEmr(res);
      setEditingProfile(false);
      showToast?.('تم حفظ التاريخ المرضي الأساسي', 'success');
    } else {
      showToast?.(res?.message || 'تعذر الحفظ', 'error');
    }
  };

  const handleAddVisit = async (e) => {
    e.preventDefault();
    const res = await api.addDoctorMedicalVisit(doctorId, patientPhone, {
      patient_name: patientName,
      appointment_id: appointmentId || null,
      ...visitForm,
      prescriptions: rxList.filter((r) => r.medication_name.trim())
    });
    if (res && res.success) {
      setEmr(res);
      setShowNewVisit(false);
      setVisitForm({
        chief_complaint: '', diagnosis: '', clinical_notes: '',
        bp_systolic: '', bp_diastolic: '', heart_rate: '',
        temperature: '', blood_sugar: '', weight_kg: '',
        improvement_score: 8, follow_up_date: ''
      });
      setRxList([{ medication_name: '', dosage: 'قرص', frequency: 'مرتين يومياً', duration: '٧ أيام', instructions: '' }]);
      showToast?.('تم تسجيل الكشف والروشتة بنجاح', 'success');
    } else {
      showToast?.(res?.message || 'تعذر تسجيل الكشف', 'error');
    }
  };

  const handleLabFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const up = await api.uploadImage(reader.result);
      if (up && up.success) {
        setLabForm((prev) => ({ ...prev, attachment_url: up.url }));
        showToast?.('تم إرفاق صورة التحليل', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddLab = async (e) => {
    e.preventDefault();
    const res = await api.addDoctorLabResult(doctorId, patientPhone, labForm);
    if (res && res.success) {
      setEmr(res);
      setShowNewLab(false);
      setLabForm({
        test_name: '', category: 'تحليل دم', numeric_value: '', unit: '',
        reference_range: '', status: 'normal', result_text: '', attachment_url: '',
        test_date: new Date().toISOString().split('T')[0]
      });
      showToast?.('تمت إضافة نتيجة التحليل والمقارنة', 'success');
    } else {
      showToast?.(res?.message || 'تعذر إضافة التحليل', 'error');
    }
  };

  const handleToggleRx = async (prescId) => {
    const res = await api.toggleDoctorPrescription(doctorId, prescId);
    if (res && res.success) {
      setEmr(res);
      showToast?.('تم تحديث حالة الدواء', 'info');
    }
  };

  const handlePrintRx = (visit) => {
    const meds = (emr?.prescriptions || []).filter((p) => p.visit_id === visit.id);
    const w = window.open('', '_blank', 'width=760,height=900');
    if (!w) return;
    w.document.write(`
      <html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>روشتة طبية - ${patientName}</title>
      <style>body{font-family:'Cairo',Tahoma,sans-serif;padding:28px;color:#0f172a}h1{margin:0;color:#1e40af;font-size:22px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:14px;margin-bottom:18px}.meta{background:#f8fafc;padding:12px;border-radius:10px;margin-bottom:18px;font-size:13px}.rx-item{border-bottom:1px dashed #cbd5e1;padding:10px 0}.rx-item b{font-size:15px}</style></head><body>
      <div class="head"><div><h1>${doctorInfo?.clinic_name || 'عيادة دُوري'}</h1><div>${doctorInfo?.full_name || 'الطبيب المعالج'} · ${doctorInfo?.title || ''}</div></div><div>التاريخ: ${visit.visit_date}</div></div>
      <div class="meta"><b>المريض:</b> ${patientName} · <b>الهاتف:</b> ${patientPhone}<br/><b>التشخيص:</b> ${visit.diagnosis}</div>
      <h3>℞ الأدوية الموصوفة:</h3>
      ${meds.length ? meds.map((m) => `<div class="rx-item"><b>${m.medication_name}</b> (${m.dosage})<br/>${m.frequency} — لمدة ${m.duration} ${m.instructions ? `· ${m.instructions}` : ''}</div>`).join('') : '<p>لا توجد أدوية مضافة لهذه الزيارة</p>'}
      <script>window.print();</script></body></html>
    `);
    w.document.close();
  };

  const profile = emr?.profile || {};
  const progress = emr?.progress_summary || {};
  const hasAllergy = profile.allergies && !profile.allergies.includes('لا توجد');

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-box emr-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '880px', width: '96vw', maxHeight: '92vh', overflowY: 'auto', padding: '20px' }}
      >
        {/* Top Clinical Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid var(--line)', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'linear-gradient(135deg, #1e40af, #2563eb)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                <Icon name="stethoscope" size={20} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--ink)' }}>
                  الملف الطبي والتاريخ المرضي — {profile.patient_name || patientName}
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  <span dir="ltr">{patientPhone}</span> · فصيلة الدم: <b>{profile.blood_type || 'غير محدد'}</b> · سري للطبيب المعالج فقط 🔒
                </small>
              </div>
            </div>

            {hasAllergy && (
              <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '10px', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.35)', color: '#b91c1c', fontSize: '12.5px', fontWeight: 700 }}>
                ⚠️ تنبيه حساسية دوائية: {profile.allergies}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn secondary small" onClick={() => setEditingProfile((v) => !v)}>
              {editingProfile ? 'إلغاء' : 'تعديل الملف الأساسي'}
            </button>
            <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Edit Core Medical Profile Form */}
        {editingProfile && (
          <form onSubmit={handleSaveProfile} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>فصيلة الدم</label>
              <select className="form-input" value={profileForm.blood_type} onChange={(e) => setProfileForm({ ...profileForm, blood_type: e.target.value })}>
                {['غير محدد', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>الحساسية (أدوية / أطعمة)</label>
              <input className="form-input" value={profileForm.allergies} onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })} placeholder="مثال: حساسية من البنسلين" />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>الأمراض المزمنة</label>
              <input className="form-input" value={profileForm.chronic_conditions} onChange={(e) => setProfileForm({ ...profileForm, chronic_conditions: e.target.value })} placeholder="مثال: ضغط، سكر" />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>العمليات الجراحية السابقة</label>
              <input className="form-input" value={profileForm.past_surgeries} onChange={(e) => setProfileForm({ ...profileForm, past_surgeries: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="submit" className="btn primary small">حفظ البيانات الأساسية</button>
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="dash-tabs" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px', borderBottom: '1px solid var(--line)' }}>
          {[
            { id: 'progress', label: '📊 مقارنة التحسن والمؤشرات' },
            { id: 'visits', label: `🩺 الزيارات والكشف (${emr?.visits?.length || 0})` },
            { id: 'labs', label: `🧪 التحاليل والأشعة (${emr?.labs?.length || 0})` },
            { id: 'meds', label: `💊 الأدوية والعلاجات (${emr?.prescriptions?.length || 0})` }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: tab === t.id ? 'var(--primary)' : 'var(--line)',
                background: tab === t.id ? 'var(--primary)' : 'var(--surface-2)',
                color: tab === t.id ? '#fff' : 'var(--ink)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>جاري تحميل السجل الطبي...</div>
        ) : (
          <>
            {/* TAB 1: PROGRESS & VITALS COMPARISON */}
            {tab === 'progress' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '12px', padding: '12px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>ضغط الدم (أول زيارة ← الآن)</small>
                    <b style={{ display: 'block', fontSize: '17px', marginTop: '4px', color: 'var(--ink)' }}>
                      {progress.bp_first || '—'} ← <span style={{ color: '#10b981' }}>{progress.bp_latest || '—'}</span>
                    </b>
                  </div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '12px', padding: '12px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>السكر (أول زيارة ← الآن)</small>
                    <b style={{ display: 'block', fontSize: '17px', marginTop: '4px', color: 'var(--ink)' }}>
                      {progress.sugar_first ?? '—'} ← <span style={{ color: '#10b981' }}>{progress.sugar_latest ?? '—'}</span>
                    </b>
                  </div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '12px', padding: '12px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '11px' }}>الوزن كجم (الأول ← الآن)</small>
                    <b style={{ display: 'block', fontSize: '17px', marginTop: '4px', color: 'var(--ink)' }}>
                      {progress.weight_first ?? '—'} ← <span style={{ color: '#2563eb' }}>{progress.weight_latest ?? '—'}</span>
                    </b>
                  </div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '12px' }}>
                    <small style={{ color: '#047857', fontSize: '11px', fontWeight: 700 }}>مؤشر التحسن العام</small>
                    <b style={{ display: 'block', fontSize: '18px', marginTop: '4px', color: '#059669' }}>
                      {progress.improvement_first ?? '—'}/10 ← {progress.improvement_latest ?? '—'}/10
                    </b>
                  </div>
                </div>

                <VitalsTrendChart visits={emr?.chronological_visits || []} />

                {/* Quick chronic conditions summary */}
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '12px', padding: '12px 14px', fontSize: '12.5px' }}>
                  <b>الأمراض المزمنة:</b> {profile.chronic_conditions || 'لا توجد'} · <b>العمليات:</b> {profile.past_surgeries || 'لا توجد'}
                </div>
              </div>
            )}

            {/* TAB 2: VISITS & NEW CONSULTATION + PRINT RX */}
            {tab === 'visits' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '14px' }}>التاريخ المرضي والزيارات</b>
                  <button type="button" className="btn primary small" onClick={() => setShowNewVisit((v) => !v)}>
                    {showNewVisit ? 'إخفاء النموذج' : '+ تسجيل كشف جديد وروشتة'}
                  </button>
                </div>

                {showNewVisit && (
                  <form onSubmit={handleAddVisit} style={{ background: 'var(--surface-2)', border: '1.5px solid var(--primary)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <input className="form-input" required placeholder="الشكوى الرئيسية *" value={visitForm.chief_complaint} onChange={(e) => setVisitForm({ ...visitForm, chief_complaint: e.target.value })} />
                      <input className="form-input" required placeholder="التشخيص الطبي *" value={visitForm.diagnosis} onChange={(e) => setVisitForm({ ...visitForm, diagnosis: e.target.value })} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '8px' }}>
                      <input type="number" className="form-input" placeholder="الضغط العالي (120)" value={visitForm.bp_systolic} onChange={(e) => setVisitForm({ ...visitForm, bp_systolic: e.target.value })} />
                      <input type="number" className="form-input" placeholder="الضغط الواطي (80)" value={visitForm.bp_diastolic} onChange={(e) => setVisitForm({ ...visitForm, bp_diastolic: e.target.value })} />
                      <input type="number" className="form-input" placeholder="النبض (72)" value={visitForm.heart_rate} onChange={(e) => setVisitForm({ ...visitForm, heart_rate: e.target.value })} />
                      <input type="number" step="0.1" className="form-input" placeholder="السكر (100)" value={visitForm.blood_sugar} onChange={(e) => setVisitForm({ ...visitForm, blood_sugar: e.target.value })} />
                      <input type="number" step="0.1" className="form-input" placeholder="الوزن كجم" value={visitForm.weight_kg} onChange={(e) => setVisitForm({ ...visitForm, weight_kg: e.target.value })} />
                      <select className="form-input" value={visitForm.improvement_score} onChange={(e) => setVisitForm({ ...visitForm, improvement_score: Number(e.target.value) })}>
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>التحسن: {n}/10</option>)}
                      </select>
                    </div>
                    <textarea className="form-input" rows={2} placeholder="ملاحظات سريرية وخطة العلاج..." value={visitForm.clinical_notes} onChange={(e) => setVisitForm({ ...visitForm, clinical_notes: e.target.value })} />

                    <div style={{ borderTop: '1px dashed var(--line)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <b style={{ fontSize: '12.5px' }}>℞ الأدوية (الروشتة)</b>
                        <button type="button" className="text-button" onClick={() => setRxList([...rxList, { medication_name: '', dosage: 'قرص', frequency: 'يومياً', duration: 'أسبوع', instructions: '' }])}>
                          + إضافة دواء
                        </button>
                      </div>
                      {rxList.map((rx, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                          <input className="form-input" placeholder="اسم الدواء" value={rx.medication_name} onChange={(e) => { const next = [...rxList]; next[idx].medication_name = e.target.value; setRxList(next); }} />
                          <input className="form-input" placeholder="الجرعة" value={rx.dosage} onChange={(e) => { const next = [...rxList]; next[idx].dosage = e.target.value; setRxList(next); }} />
                          <input className="form-input" placeholder="التكرار" value={rx.frequency} onChange={(e) => { const next = [...rxList]; next[idx].frequency = e.target.value; setRxList(next); }} />
                          <input className="form-input" placeholder="المدة" value={rx.duration} onChange={(e) => { const next = [...rxList]; next[idx].duration = e.target.value; setRxList(next); }} />
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="submit" className="btn primary small">حفظ الكشف والروشتة</button>
                    </div>
                  </form>
                )}

                {(emr?.visits || []).map((v) => (
                  <div key={v.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                      <div>
                        <span className="badge badge-primary" style={{ marginLeft: '8px' }}>{v.visit_date}</span>
                        <b style={{ fontSize: '14px' }}>{v.diagnosis}</b>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-success">التحسن {v.improvement_score || '—'}/10</span>
                        <button type="button" className="btn secondary small" onClick={() => handlePrintRx(v)}>🖨️ طباعة الروشتة</button>
                      </div>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                      <b>الشكوى:</b> {v.chief_complaint} {v.clinical_notes ? `· ${v.clinical_notes}` : ''}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', marginTop: '8px', color: 'var(--ink)' }}>
                      {v.bp_systolic && <span>🩺 الضغط: <b>{v.bp_systolic}/{v.bp_diastolic}</b></span>}
                      {v.heart_rate && <span>💓 النبض: <b>{v.heart_rate}</b></span>}
                      {v.blood_sugar && <span>🩸 السكر: <b>{v.blood_sugar}</b></span>}
                      {v.weight_kg && <span>⚖️ الوزن: <b>{v.weight_kg} كجم</b></span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: LABS & RADIOLOGY COMPARISON */}
            {tab === 'labs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '14px' }}>مقارنة التحاليل والأشعة السابقة والحالية</b>
                  <button type="button" className="btn primary small" onClick={() => setShowNewLab((v) => !v)}>
                    {showNewLab ? 'إخفاء' : '+ إضافة تحليل / أشعة'}
                  </button>
                </div>

                {showNewLab && (
                  <form onSubmit={handleAddLab} style={{ background: 'var(--surface-2)', border: '1.5px solid var(--primary)', borderRadius: '14px', padding: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input className="form-input" required placeholder="اسم التحليل (مثل HbA1c) *" value={labForm.test_name} onChange={(e) => setLabForm({ ...labForm, test_name: e.target.value })} />
                    <select className="form-input" value={labForm.category} onChange={(e) => setLabForm({ ...labForm, category: e.target.value })}>
                      <option value="تحليل دم">تحليل دم</option>
                      <option value="أشعة">أشعة</option>
                      <option value="وظائف أعضاء">وظائف أعضاء</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                    <input type="number" step="0.01" className="form-input" placeholder="القيمة الرقمية" value={labForm.numeric_value} onChange={(e) => setLabForm({ ...labForm, numeric_value: e.target.value })} />
                    <input className="form-input" placeholder="الوحدة (mg/dL, %)" value={labForm.unit} onChange={(e) => setLabForm({ ...labForm, unit: e.target.value })} />
                    <input className="form-input" placeholder="المعدل الطبيعي" value={labForm.reference_range} onChange={(e) => setLabForm({ ...labForm, reference_range: e.target.value })} />
                    <select className="form-input" value={labForm.status} onChange={(e) => setLabForm({ ...labForm, status: e.target.value })}>
                      <option value="normal">طبيعي</option>
                      <option value="high">مرتفع</option>
                      <option value="low">منخفض</option>
                      <option value="critical">حرج</option>
                    </select>
                    <input className="form-input" placeholder="ملخص النتيجة" value={labForm.result_text} onChange={(e) => setLabForm({ ...labForm, result_text: e.target.value })} />
                    <input type="file" accept="image/*" className="form-input" onChange={handleLabFile} />
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn primary small">حفظ النتيجة</button>
                    </div>
                  </form>
                )}

                {/* Automatic Comparisons */}
                {(emr?.lab_comparisons || []).map((cmp) => (
                  <div key={cmp.test_name} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <b style={{ fontSize: '14px' }}>{cmp.test_name}</b>
                        <small style={{ color: 'var(--muted)', marginRight: '8px' }}>({cmp.category} · الطبيعي: {cmp.reference_range || '—'})</small>
                      </div>
                      <span className={`badge ${cmp.latest.status === 'normal' ? 'badge-success' : 'badge-warning'}`}>
                        {cmp.latest.status === 'normal' ? 'في المعدل الطبيعي' : cmp.latest.status === 'high' ? 'مرتفع' : 'منخفض'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', flexWrap: 'wrap', fontSize: '13px' }}>
                      {cmp.previous && (
                        <span>السابق ({cmp.previous.test_date}): <b>{cmp.previous.numeric_value ?? cmp.previous.result_text} {cmp.unit}</b></span>
                      )}
                      <span>الحالي ({cmp.latest.test_date}): <b style={{ color: 'var(--primary)', fontSize: '15px' }}>{cmp.latest.numeric_value ?? cmp.latest.result_text} {cmp.unit}</b></span>
                      {cmp.delta !== null && (
                        <span className={`badge ${cmp.delta <= 0 ? 'badge-success' : 'badge-warning'}`}>
                          التغير: {cmp.delta > 0 ? `+${cmp.delta}` : cmp.delta} {cmp.unit}
                        </span>
                      )}
                    </div>
                    {cmp.latest.attachment_url && (
                      <div style={{ marginTop: '8px' }}>
                        <a href={cmp.latest.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700 }}>
                          📎 عرض صورة التحليل/الأشعة
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: MEDICATIONS */}
            {tab === 'meds' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(emr?.prescriptions || []).length === 0 ? (
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px' }}>لا توجد علاجات مسجلة بعد</p>
                ) : (
                  (emr?.prescriptions || []).map((rx) => (
                    <div key={rx.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: '12px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div>
                        <b style={{ fontSize: '14px', color: 'var(--ink)' }}>{rx.medication_name}</b>
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: '12px' }}>
                          {rx.dosage} · {rx.frequency} · لمدة {rx.duration} {rx.visit_date ? `(بتاريخ ${rx.visit_date})` : ''}
                        </small>
                      </div>
                      <button
                        type="button"
                        className={`btn small ${rx.is_active ? 'primary' : 'secondary'}`}
                        onClick={() => handleToggleRx(rx.id)}
                      >
                        {rx.is_active ? '● علاج مستمر (إيقاف)' : 'متوقف (إعادة تفعيل)'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
