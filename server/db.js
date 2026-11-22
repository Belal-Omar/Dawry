import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When deployed on Vercel Serverless, root is read-only so use /tmp
const isVercel = Boolean(process.env.VERCEL);
let DB_PATH = path.join(__dirname, 'dawry.db');
if (isVercel) {
  const tmpDbPath = path.join('/tmp', 'dawry.db');
  if (!fs.existsSync(tmpDbPath) && fs.existsSync(DB_PATH)) {
    try {
      fs.copyFileSync(DB_PATH, tmpDbPath);
    } catch (e) {}
  }
  DB_PATH = tmpDbPath;
}

export const db = new DatabaseSync(DB_PATH);

// Initialize Tables
export function initDB() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    -- 1. Specialties
    CREATE TABLE IF NOT EXISTS specialties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Subscription Plans
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      billing_period TEXT DEFAULT 'monthly',
      max_branches INTEGER DEFAULT 1,
      max_receptionists INTEGER DEFAULT 1,
      features TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Doctors (Tenants)
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      title TEXT NOT NULL,
      specialty_id INTEGER REFERENCES specialties(id),
      subspecialty TEXT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      bio TEXT,
      qualifications TEXT,
      experience_years INTEGER DEFAULT 5,
      license_number TEXT,
      profile_photo TEXT,
      consultation_fee REAL NOT NULL DEFAULT 400,
      appointment_duration INTEGER DEFAULT 20,
      daily_capacity INTEGER DEFAULT 30,
      cancellation_policy TEXT DEFAULT 'إلغاء مجاني حتى ساعتين قبل الموعد',
      status TEXT DEFAULT 'active', -- active, suspended, pending
      suspension_reason TEXT,
      is_verified INTEGER DEFAULT 1,
      rating REAL DEFAULT 4.9,
      reviews_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Clinics & Branches
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      clinic_name TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      governorate TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      is_main INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Doctor Schedules
    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
      day_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      break_start TEXT,
      break_end TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- 5b. Doctor Vacations & Off Days
    CREATE TABLE IF NOT EXISTS doctor_vacations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Receptionists
    CREATE TABLE IF NOT EXISTS receptionists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      password TEXT NOT NULL DEFAULT '123456',
      can_manage_queue INTEGER DEFAULT 1,
      can_register_walkins INTEGER DEFAULT 1,
      can_reschedule INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Doctor Subscriptions
    CREATE TABLE IF NOT EXISTS doctor_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'active', -- active, expiring, suspended, overdue
      auto_renew INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Payments
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES doctor_subscriptions(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      status TEXT DEFAULT 'completed',
      transaction_id TEXT UNIQUE NOT NULL,
      invoice_number TEXT UNIQUE NOT NULL,
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Appointments
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT UNIQUE NOT NULL,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      patient_name TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      patient_email TEXT,
      appointment_date DATE NOT NULL,
      appointment_time TEXT NOT NULL,
      type TEXT DEFAULT 'online', -- online, walkin, followup
      status TEXT DEFAULT 'confirmed', -- pending, confirmed, checked_in, waiting, in_progress, completed, cancelled, no_show
      notes TEXT,
      qr_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Queue Entries (Daily Queue)
    CREATE TABLE IF NOT EXISTS queue_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      patient_name TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      queue_date DATE NOT NULL,
      queue_number INTEGER NOT NULL,
      priority INTEGER DEFAULT 0, -- 0=Normal, 1=Emergency
      status TEXT DEFAULT 'waiting', -- waiting, calling, in_progress, completed, skipped, cancelled
      check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      called_time DATETIME,
      start_time DATETIME,
      completed_time DATETIME,
      estimated_wait_minutes INTEGER DEFAULT 20,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Doctor Live Queue State
    CREATE TABLE IF NOT EXISTS doctor_queue_states (
      doctor_id INTEGER PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
      is_active INTEGER DEFAULT 1,
      current_serving_number INTEGER DEFAULT 0,
      current_queue_id INTEGER,
      status TEXT DEFAULT 'active', -- active, paused, closed
      delay_minutes INTEGER DEFAULT 0,
      delay_reason TEXT,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Reviews
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id),
      patient_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_role TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 14. Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_role TEXT NOT NULL,
      recipient_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      channel TEXT DEFAULT 'whatsapp', -- whatsapp, sms, in_app, email
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Platform Settings
    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- 16. Registered Patients
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT DEFAULT '123456',
      city TEXT,
      gender TEXT,
      birth_year INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Security & Anti-Fraud Logs (Device Fingerprints & Cyber Tracking)
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL, -- booking_attempt, booking_blocked, login_attempt, login_failed, bot_trap, etc.
      ip_address TEXT,
      user_agent TEXT,
      device_fingerprint TEXT,
      identifier TEXT,
      status TEXT DEFAULT 'allowed', -- allowed, blocked, flagged
      risk_score INTEGER DEFAULT 0,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Blocked & Blacklisted Identifiers (Legal / System Bans)
    CREATE TABLE IF NOT EXISTS blocked_identifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'ip', 'phone', 'device', 'email'
      value TEXT NOT NULL UNIQUE,
      reason TEXT,
      blocked_by TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.prepare("INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('global_booking_enabled', '1')").run();
  } catch (e) {}

  try {
    db.prepare(`
      INSERT OR IGNORE INTO patients (id, name, phone, email, password, city)
      VALUES (1, 'محمد نبيل عبدالعزيز', '01023456789', 'patient@dawry.com', '123456', 'القاهرة - مصر الجديدة')
    `).run();
  } catch (e) {}

  seedDataIfEmpty();

  // Ensure every medical specialty has its dedicated medical icon
  const specialtyIconsMap = [
    ['الأسنان', 'tooth'],
    ['الجلدية والتجميل', 'sparkles'],
    ['العظام', 'bone'],
    ['الأطفال', 'baby'],
    ['القلب والأوعية الدموية', 'heartPulse'],
    ['الباطنة والجهاز الهضمي', 'stethoscope'],
    ['النساء والتوليد', 'womanHealth'],
    ['الأنف والأذن والحنجرة', 'ear'],
    ['المخ والأعصاب', 'brain'],
    ['العيون', 'eye'],
    ['العلاج الطبيعي والتأهيل', 'rehab'],
    ['المسالك البولية والذكورة', 'kidney']
  ];
  try {
    const updateSpecIcon = db.prepare('UPDATE specialties SET icon = ? WHERE name = ?');
    for (const [specName, specIcon] of specialtyIconsMap) {
      updateSpecIcon.run(specIcon, specName);
    }
  } catch (e) {}
}

// Seed Initial Data
function seedDataIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as count FROM specialties').get();
  if (count.count > 0) return;

  console.log('Seeding initial SQLite database for Dawry...');

  // 1. Specialties
  const specialtiesList = [
    { name: 'الأسنان', icon: 'tooth', description: 'طب وجراحة وتجميل وزراعة الأسنان', order: 1 },
    { name: 'الجلدية والتجميل', icon: 'sparkles', description: 'علاج الأمراض الجلدية والعناية بالبشرة والليزر', order: 2 },
    { name: 'العظام', icon: 'bone', order: 3, description: 'جراحة العظام والمفاصل والعمود الفقري' },
    { name: 'الأطفال', icon: 'baby', order: 4, description: 'طب الأطفال وحديثي الولادة ورعاية النمو' },
    { name: 'القلب والأوعية الدموية', icon: 'heartPulse', order: 5, description: 'أمراض وقسطرة القلب واضطرابات النبض' },
    { name: 'الباطنة والجهاز الهضمي', icon: 'stethoscope', order: 6, description: 'أمراض الباطنة العامة والمناظير والسكر' },
    { name: 'النساء والتوليد', icon: 'womanHealth', order: 7, description: 'متابعة الحمل والولادة وجراحة النساء' },
    { name: 'الأنف والأذن والحنجرة', icon: 'ear', order: 8, description: 'أمراض السمع والتوازن وجراحات الأنف والأذن' },
    { name: 'المخ والأعصاب', icon: 'brain', order: 9, description: 'أمراض الجهاز العصبي والصداع والعمود الفقري' },
    { name: 'العيون', icon: 'eye', order: 10, description: 'طب وجراحة العيون وتصحيح الإبصار بالليزك' },
    { name: 'العلاج الطبيعي والتأهيل', icon: 'rehab', order: 11, description: 'إعادة التأهيل الحركي وعلاج آلام المفاصل' },
    { name: 'المسالك البولية والذكورة', icon: 'kidney', order: 12, description: 'علاج حصوات الكلى وجراحة المسالك' }
  ];

  const insertSpec = db.prepare('INSERT INTO specialties (name, icon, description, display_order) VALUES (?, ?, ?, ?)');
  for (const s of specialtiesList) {
    insertSpec.run(s.name, s.icon, s.description, s.order);
  }

  // 2. Subscription Plans
  const plans = [
    {
      name: 'الأساسية - Basic',
      code: 'basic',
      price: 850,
      billing_period: 'monthly',
      max_branches: 1,
      max_receptionists: 1,
      features: JSON.stringify(['طبيب واحد', 'فرع واحد', 'حجز مواعيد أونلاين', 'إدارة طابور أساسية', 'تتبع المريض للموعد'])
    },
    {
      name: 'الاحترافية - Professional',
      code: 'pro',
      price: 1600,
      billing_period: 'monthly',
      max_branches: 2,
      max_receptionists: 3,
      features: JSON.stringify(['طبيب واحد', 'حتى فرعين', 'حسابات استقبال متعددة', 'طابور ذكي وتنبيهات تأخير', 'توقعات وقت الانتظار الذكية', 'تحليلات وتقارير متقدمة', 'رسائل واتساب للمرضى'])
    },
    {
      name: 'المؤسسات - Enterprise',
      code: 'enterprise',
      price: 3200,
      billing_period: 'monthly',
      max_branches: 5,
      max_receptionists: 10,
      features: JSON.stringify(['فروع متعددة غير محدودة', 'طاقم استقبال غير محدود', 'تقارير مالية وتفصيلية', 'أولوية الحالات الطارئة', 'دعم فني مخصص 24/7', 'ربط مخصص API'])
    }
  ];

  const insertPlan = db.prepare('INSERT INTO subscription_plans (name, code, price, billing_period, max_branches, max_receptionists, features) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const p of plans) {
    insertPlan.run(p.name, p.code, p.price, p.billing_period, p.max_branches, p.max_receptionists, p.features);
  }

  // 3. Single Test Doctor (د. طارق عبد العزيز)
  const doctorsData = [
    {
      full_name: 'د. طارق عبد العزيز',
      title: 'استشاري أمراض القلب وقسطرة الشرايين',
      specialty_name: 'القلب والأوعية الدموية',
      subspecialty: 'قسطرة القلب والشرايين التاجية',
      email: 'dr.tarek@dawry.com',
      phone: '01012345678',
      bio: 'استشاري أمراض القلب والأوعية الدموية بمعهد القلب القومي، زميل الكلية الملكية للأطباء، خبرة أكثر من ١٨ عامًا في علاج وجراحة قسطرة القلب.',
      qualifications: 'دكتوراه أمراض القلب - قصر العيني، زمالة الكلية الأمريكية للقلب FACC',
      experience_years: 18,
      license_number: 'EGY-MED-44120',
      profile_photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=250&auto=format&fit=crop&q=80',
      consultation_fee: 650,
      appointment_duration: 25,
      daily_capacity: 25,
      rating: 4.9,
      reviews_count: 142,
      clinic_name: 'مركز الحياة لأمراض القلب',
      branch_name: 'فرع مصر الجديدة',
      governorate: 'القاهرة',
      city: 'مصر الجديدة',
      address: 'شارع الأهرام، روكسي، أمام سينما روكسي',
      plan_code: 'pro'
    }
  ];

  const insertDoctor = db.prepare(`
    INSERT INTO doctors (
      full_name, title, specialty_id, subspecialty, email, phone, bio, qualifications,
      experience_years, license_number, profile_photo, consultation_fee, appointment_duration,
      daily_capacity, rating, reviews_count, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const insertBranch = db.prepare(`
    INSERT INTO branches (doctor_id, clinic_name, branch_name, governorate, city, address, phone, is_main)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertSchedule = db.prepare(`
    INSERT INTO doctor_schedules (doctor_id, branch_id, day_of_week, day_name, start_time, end_time, break_start, break_end, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertReceptionist = db.prepare(`
    INSERT INTO receptionists (doctor_id, branch_id, name, email, phone)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertSub = db.prepare(`
    INSERT INTO doctor_subscriptions (doctor_id, plan_id, start_date, end_date, status)
    VALUES (?, ?, ?, ?, 'active')
  `);

  const insertPayment = db.prepare(`
    INSERT INTO payments (doctor_id, subscription_id, amount, payment_method, status, transaction_id, invoice_number)
    VALUES (?, ?, ?, ?, 'completed', ?, ?)
  `);

  const insertQueueState = db.prepare(`
    INSERT INTO doctor_queue_states (doctor_id, is_active, current_serving_number, status, delay_minutes)
    VALUES (?, 1, ?, 'active', 0)
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (doctor_id, patient_name, rating, comment)
    VALUES (?, ?, ?, ?)
  `);

  const todayStr = new Date().toISOString().split('T')[0];
  const startDateStr = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const endDateStr = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const daysWeek = [
    { day: 0, name: 'الأحد' },
    { day: 1, name: 'الإثنين' },
    { day: 2, name: 'الثلاثاء' },
    { day: 3, name: 'الأربعاء' },
    { day: 4, name: 'الخميس' },
    { day: 6, name: 'السبت' }
  ];

  doctorsData.forEach((d, idx) => {
    const spec = db.prepare('SELECT id FROM specialties WHERE name = ?').get(d.specialty_name);
    const plan = db.prepare('SELECT id, price FROM subscription_plans WHERE code = ?').get(d.plan_code);

    const docRes = insertDoctor.run(
      d.full_name, d.title, spec.id, d.subspecialty, d.email, d.phone, d.bio,
      d.qualifications, d.experience_years, d.license_number, d.profile_photo,
      d.consultation_fee, d.appointment_duration, d.daily_capacity, d.rating, d.reviews_count
    );
    const doctorId = Number(docRes.lastInsertRowid);

    const branchRes = insertBranch.run(
      doctorId, d.clinic_name, d.branch_name, d.governorate, d.city, d.address, d.phone
    );
    const branchId = Number(branchRes.lastInsertRowid);

    // Schedule for 6 days
    for (const dw of daysWeek) {
      insertSchedule.run(doctorId, branchId, dw.day, dw.name, '16:00', '22:00', '18:30', '19:00');
    }

    // Receptionist
    const recName = `استقبال ${d.clinic_name}`;
    const recEmail = `reception.${d.email.split('@')[0].replace('dr.', '')}@dawry.com`;
    insertReceptionist.run(doctorId, branchId, recName, recEmail, '01009988776');

    // Subscription & Payment
    const subRes = insertSub.run(doctorId, plan.id, startDateStr, endDateStr);
    const subId = Number(subRes.lastInsertRowid);

    insertPayment.run(
      doctorId, subId, plan.price, 'بطاقة بنكية', `TXN-DWR-${1000 + doctorId}`, `INV-2026-${1000 + doctorId}`
    );

    // Queue state
    const currentNumber = idx === 0 ? 8 : (idx === 1 ? 4 : 2);
    insertQueueState.run(doctorId, currentNumber);

    // Realistic Reviews
    insertReview.run(doctorId, 'محمد الشريف', 5, 'دكتور ممتاز وشرحه وافي ومحترم جداً، والعيادة منظمة ودوري سهل علينا كتير من غير انتظار.');
    insertReview.run(doctorId, 'سارة المنشاوي', 5, 'تجربة رائعة وتتبع الدور على الموبايل مريح جداً وصلت بالظبط على ميعادي.');
  });

  // Seed Realistic Today's Appointments & Queue for Doctor 1 (د. طارق عبد العزيز)
  const doc1 = db.prepare('SELECT id FROM doctors WHERE id = 1').get();
  const branch1 = db.prepare('SELECT id FROM branches WHERE doctor_id = 1').get();

  const samplePatients = [
    { name: 'محمود عبد الفتاح', phone: '01011122233', time: '16:00', qNum: 1, status: 'completed' },
    { name: 'هدى مصطفى الشامي', phone: '01122233344', time: '16:25', qNum: 2, status: 'completed' },
    { name: 'عصام كمال الدين', phone: '01233344455', time: '16:50', qNum: 3, status: 'completed' },
    { name: 'نجوى عبد الرحمن', phone: '01044455566', time: '17:15', qNum: 4, status: 'completed' },
    { name: 'خالد سليم الأنصاري', phone: '01155566677', time: '17:40', qNum: 5, status: 'completed' },
    { name: 'منى جمال الدين', phone: '01266677788', time: '18:05', qNum: 6, status: 'completed' },
    { name: 'حسام البدري', phone: '01077788899', time: '18:30', qNum: 7, status: 'completed' },
    { name: 'مريم أحمد عبد الله', phone: '01188899900', time: '19:00', qNum: 8, status: 'in_progress', priority: 0 },
    { name: 'كريم عادل مهران', phone: '01299900011', time: '19:25', qNum: 9, status: 'waiting', priority: 0 },
    { name: 'أميرة سعيد خليل', phone: '01000011122', time: '19:50', qNum: 10, status: 'waiting', priority: 0 },
    { name: 'إبراهيم توفيق السيد', phone: '01111122233', time: '20:15', qNum: 11, status: 'waiting', priority: 1 }, // Emergency
    { name: 'رانيا فهمي جودة', phone: '01222233344', time: '20:40', qNum: 12, status: 'waiting', priority: 0 },
    { name: 'يوسف شريف عبد العال', phone: '01033344455', time: '21:05', qNum: 13, status: 'waiting', priority: 0 }
  ];

  const insertAppt = db.prepare(`
    INSERT INTO appointments (booking_code, doctor_id, branch_id, patient_name, patient_phone, appointment_date, appointment_time, type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'online', ?)
  `);

  const insertQueueEntry = db.prepare(`
    INSERT INTO queue_entries (doctor_id, branch_id, appointment_id, patient_name, patient_phone, queue_date, queue_number, priority, status, estimated_wait_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  samplePatients.forEach((p, i) => {
    const code = `DWR-${7000 + i}`;
    const apptRes = insertAppt.run(
      code, doc1.id, branch1.id, p.name, p.phone, todayStr, p.time, p.status === 'in_progress' ? 'in_progress' : (p.status === 'completed' ? 'completed' : 'waiting')
    );
    const apptId = Number(apptRes.lastInsertRowid);

    const waitEst = p.qNum <= 8 ? 0 : (p.qNum - 8) * 20;
    insertQueueEntry.run(
      doc1.id, branch1.id, apptId, p.name, p.phone, todayStr, p.qNum, p.priority || 0, p.status, waitEst
    );
  });

  // Initial Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_role, user_name, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('superadmin', 'مدير المنصة الرئيسي', 'تهيئة النظام', 'platform', 1, 'تهيئة قاعدة بيانات دوري واشتراكات الأطباء التأسيسية.');
  insertAudit.run('doctor', 'د. طارق عبد العزيز', 'بدء الطابور اليومي', 'queue', 1, 'تم فتح الطابور وبدء استقبال المرضى لفرع مصر الجديدة.');

  // 12. Migrations for existing DB
  try {
    db.exec("ALTER TABLE doctors ADD COLUMN password TEXT DEFAULT '123456'");
  } catch (e) {
    // Column already exists
  }

  console.log('Database initialized successfully with multi-tenant structure and realistic healthcare data!');
}
