// Single source of truth for the three work portals (Doctor / Reception / Platform admin).
// Used by: home showcase, header menu, mobile drawer, dashboard sidebars and footer.

export const PORTALS = [
  {
    id: 'doctor',
    name: 'لوحة الطبيب',
    short: 'الطبيب',
    tagline: 'للأطباء وأصحاب العيادات',
    desc: 'تحكم كامل في عيادتك: الطابور الحي، المواعيد، المرضى، الفروع وفريق الاستقبال والتقارير.',
    features: ['طابور حي ومناداة المريض التالي', 'إدارة المواعيد وجدول العمل', 'تقارير وإحصائيات الأداء'],
    icon: 'doctor',
    color: '#2563eb',
    soft: 'rgba(37, 99, 235, 0.12)',
    glow: 'rgba(37, 99, 235, 0.35)',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #38bdf8 100%)'
  },
  {
    id: 'reception',
    name: 'موظف الاستقبال',
    short: 'الاستقبال',
    tagline: 'لفريق الاستقبال والحضور',
    desc: 'استقبال المرضى، تأكيد الحضور، تسجيل الحالات بدون حجز وتنظيم الدور لحظة بلحظة.',
    features: ['تأكيد الحضور (Check-in)', 'تسجيل مريض بدون حجز', 'تنظيم الدور والحالات الطارئة'],
    icon: 'clipboardCheck',
    color: '#0d9488',
    soft: 'rgba(13, 148, 136, 0.12)',
    glow: 'rgba(13, 148, 136, 0.35)',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 60%, #5eead4 100%)'
  },
  {
    id: 'admin',
    name: 'إدارة المنصة',
    short: 'الإدارة',
    tagline: 'لمالك المنصة (Super Admin)',
    desc: 'التحكم المركزي في الأطباء والعيادات والاشتراكات والتخصصات وسجلات الأمان.',
    features: ['إضافة وإدارة العيادات', 'الاشتراكات والمدفوعات', 'سجل الأمان والمراجعة'],
    icon: 'shieldCheck',
    color: '#7c3aed',
    soft: 'rgba(124, 58, 237, 0.12)',
    glow: 'rgba(124, 58, 237, 0.35)',
    gradient: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 55%, #a78bfa 100%)'
  }
];

export const portalStyleVars = (p) => ({
  '--p-color': p.color,
  '--p-soft': p.soft,
  '--p-glow': p.glow,
  '--p-grad': p.gradient
});

