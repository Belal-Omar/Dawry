import React from 'react';

/* ==========================================================================
   DAWRY ICON SYSTEM
   - Pixel-aligned 24×24 line icons (consistent 1.8 stroke, round caps/joins)
   - Medical-specialty set: every specialty gets a dedicated, recognisable icon
   - Helpers: getSpecialtyMeta(), SpecialtyIcon
   ========================================================================== */

const icons = {
  /* ---------- Navigation / general ---------- */
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6a2 2 0 0 1 4 0v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  userCheck: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </>
  ),
  calendarCheck: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2.5" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </>
  ),
  trendingUp: (
    <>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </>
  ),
  sliders: (
    <>
      <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3" />
      <path d="M14 2v4M8 10v4M16 18v4" />
    </>
  ),
  creditCard: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2.5" />
      <path d="M2 10h20M6 15h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  spark: (
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  bars: <path d="M4 6h16M4 12h16M4 18h16" />,
  plus: <path d="M5 12h14M12 5v14" />,
  pause: (
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </>
  ),
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  more: (
    <>
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
      <circle cx="5" cy="12" r="1.4" />
    </>
  ),
  briefcase: (
    <>
      <rect width="20" height="14" x="2" y="7" rx="2.5" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  shieldCheck: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  building: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
      <path d="M2 22h20M10 6h4M10 10h4M10 14h4" />
      <path d="M10 22v-4h4v4" />
    </>
  ),
  star: (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  alertTriangle: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  arrowLeft: <path d="m12 19-7-7 7-7M19 12H5" />,
  arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  layers: (
    <>
      <path d="m12 2 10 5-10 5L2 7l10-5Z" />
      <path d="m2 12 10 5 10-5M2 17l10 5 10-5" />
    </>
  ),

  /* ---------- Role / portal icons ---------- */
  stethoscope: (
    <>
      <path d="M11 2v2M5 2v2M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
      <path d="M8 15a6 6 0 0 0 12 0v-3" />
      <circle cx="20" cy="10" r="2" />
    </>
  ),
  doctor: (
    <>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M4.5 21v-1.2A5.3 5.3 0 0 1 9.8 14.5h4.4a5.3 5.3 0 0 1 5.3 5.3V21" />
      <path d="M12 16.2v3.6M10.2 18h3.6" />
    </>
  ),
  clipboardCheck: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  clipboardList: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
    </>
  ),

  /* ---------- Medical specialties ---------- */
  tooth: (
    <path d="M12 5.8C10.8 4.6 9.2 3.8 7.6 4.1 5.2 4.5 3.5 6.5 3.7 9c.2 2.3 1.3 3.6 1.8 6 .4 2 .7 5.5 2.3 5.5s1.7-3.9 2.8-5.5c.4-.6.9-.8 1.4-.8s1 .2 1.4.8c1.1 1.6 1.2 5.5 2.8 5.5s1.9-3.5 2.3-5.5c.5-2.4 1.6-3.7 1.8-6 .2-2.5-1.5-4.5-3.9-4.9-1.6-.3-3.2.5-4.4 1.7Z" />
  ),
  sparkles: (
    <>
      <path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </>
  ),
  bone: (
    <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />
  ),
  baby: (
    <>
      <path d="M9 12h.01M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
    </>
  ),
  heartPulse: (
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l1-2 2 4.5 1.5-3.5h6.28" />
    </>
  ),
  womanHealth: (
    <>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M12 14v8M9 19h6" />
    </>
  ),
  ear: (
    <>
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.6 6.5a3 3 0 0 0 .4-1.375M6 5.125A3 3 0 0 0 6.4 6.5M3.48 10.9a4 4 0 0 1 .58-.4M19.94 10.5a4 4 0 0 1 .58.4M6 18a4 4 0 0 1-1.97-.52M19.97 17.48A4 4 0 0 1 18 18" />
    </>
  ),
  eye: (
    <>
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  rehab: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M5 8.5 12 10l7-1.5" />
      <path d="M12 10v5M12 15l-3 6.5M12 15l3 6.5" />
    </>
  ),
  kidney: (
    <path d="M9.5 3.2C6.2 3.2 4 6.4 4 10.5c0 3.2 1.1 5.6 2.4 7.6 1 1.5 2.1 2.7 3.8 2.7 2.2 0 3.3-1.8 3.3-3.7 0-1.5-.9-2.3-1.9-3.2-.8-.7-1.4-1.5-1.4-2.7s.6-2 1.4-2.7c1-.9 1.9-1.7 1.9-3.2 0-1.2-1.6-2.1-4-2.1Z" />
  )
};

/* ==========================================================================
   Specialty → icon + accent colour
   Works from the specialty NAME (Arabic/English), so it stays correct even if
   the stored icon value in the database is generic or the admin adds new ones.
   ========================================================================== */
const normalise = (s = '') =>
  String(s)
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const SPECIALTY_RULES = [
  [/اسنان|dent|tooth|زراعه ال?اسنان/, 'tooth', '#0ea5e9'],
  [/جلد|تجميل|derm|skin|ليزر/, 'sparkles', '#ec4899'],
  [/عظام|مفاصل|ortho|bone/, 'bone', '#f59e0b'],
  [/اطفال|طفل|حديثي|pediat|child/, 'baby', '#14b8a6'],
  [/قلب|اوعيه|cardio|heart/, 'heartPulse', '#ef4444'],
  [/نساء|توليد|حمل|gyn|obst|women/, 'womanHealth', '#d946ef'],
  [/انف|اذن|حنجره|سمع|\bent\b|ear/, 'ear', '#8b5cf6'],
  [/(^|\s|ال)مخ|اعصاب|neuro|brain/, 'brain', '#a855f7'],
  [/عيون|عين|رمد|ابصار|ophth|eye/, 'eye', '#0284c7'],
  [/طبيعي|تاهيل|physio|rehab/, 'rehab', '#22c55e'],
  [/مسالك|بولي|كلي|كلى|ذكوره|uro|kidney/, 'kidney', '#f97316'],
  [/باطن|هضم|معده|كبد|سكر|gastro|internal|medicine/, 'stethoscope', '#6366f1']
];

export function getSpecialtyMeta(specialty) {
  const name = typeof specialty === 'string' ? specialty : specialty?.name;
  const stored = typeof specialty === 'object' ? specialty?.icon : null;
  const n = normalise(name);
  for (const [re, icon, color] of SPECIALTY_RULES) {
    if (re.test(n)) return { icon, color };
  }
  // Unknown (admin-added) specialty: honour the stored icon when it is a real one.
  const genericStored = ['smile', 'spark', 'shield', 'users', 'clock', 'briefcase', 'user', 'bell'];
  if (stored && icons[stored] && !genericStored.includes(stored)) {
    return { icon: stored, color: '#3246b8' };
  }
  return { icon: 'stethoscope', color: '#3246b8' };
}

export const SPECIALTY_ICON_CHOICES = [
  ['tooth', 'أسنان'], ['sparkles', 'جلدية وتجميل'], ['bone', 'عظام'], ['baby', 'أطفال'],
  ['heartPulse', 'قلب'], ['stethoscope', 'باطنة'], ['womanHealth', 'نساء وتوليد'], ['ear', 'أنف وأذن وحنجرة'],
  ['brain', 'مخ وأعصاب'], ['eye', 'عيون'], ['rehab', 'علاج طبيعي'], ['kidney', 'مسالك بولية']
];

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function SpecialtyIcon({ specialty, size = 22, tile = 44, radius = 14, className = '', style = {} }) {
  const { icon, color } = getSpecialtyMeta(specialty);
  return (
    <span
      className={`specialty-icon-tile ${className}`}
      style={{
        width: tile,
        height: tile,
        borderRadius: radius,
        display: 'inline-grid',
        placeItems: 'center',
        flexShrink: 0,
        color,
        background: `linear-gradient(145deg, ${hexToRgba(color, 0.16)}, ${hexToRgba(color, 0.07)})`,
        boxShadow: `inset 0 0 0 1px ${hexToRgba(color, 0.22)}`,
        ...style
      }}
    >
      <Icon name={icon} size={size} />
    </span>
  );
}

export default function Icon({ name, size = 20, className = '', style, strokeWidth = 1.8 }) {
  const content = icons[name] || icons.spark;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-icon ${className}`.trim()}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  );
}
