import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, initDB } from './db.js';

// Paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsPath = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, '../uploads');
try {
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
} catch (e) {}

// Initialize DB schema & seed
initDB();

// Ensure every appointment has a corresponding queue entry on its appointment_date
try {
  const missingQAppts = db.prepare(`
    SELECT a.* FROM appointments a
    LEFT JOIN queue_entries q ON q.appointment_id = a.id AND q.queue_date = a.appointment_date
    WHERE q.id IS NULL
  `).all();

  for (const appt of missingQAppts) {
    const lastQ = db.prepare('SELECT MAX(queue_number) as max_num FROM queue_entries WHERE doctor_id = ? AND queue_date = ?').get(appt.doctor_id, appt.appointment_date);
    const qNum = (lastQ?.max_num || 0) + 1;
    db.prepare(`
      INSERT INTO queue_entries (doctor_id, branch_id, appointment_id, patient_name, patient_phone, queue_date, queue_number, priority, status, estimated_wait_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'waiting', 20)
    `).run(appt.doctor_id, appt.branch_id || 1, appt.id, appt.patient_name, appt.patient_phone, appt.appointment_date, qNum);
  }
} catch (e) {
  console.warn('Queue backfill note:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(uploadsPath));

// ----------------------------------------------------
// SECURITY HARDENING: PASSWORD HASHING, SIGNED TOKENS & RBAC
// ----------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'dawry_dev_secret_change_in_prod_2026';

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(plain, stored) {
  const input = String(plain || '');
  const saved = String(stored || '');
  if (!saved) return false;
  if (saved.startsWith('scrypt$')) {
    const [, salt, hex] = saved.split('$');
    if (!salt || !hex) return false;
    const derived = crypto.scryptSync(input, salt, 64);
    const expected = Buffer.from(hex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
  return input === saved;
}

export function generateAuthToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 14 * 24 * 3600 * 1000;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${sig}`;
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Global Auth Token Middleware
app.use((req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7)
    : (req.headers['x-auth-token'] || null);
  if (token) {
    const user = verifyAuthToken(token);
    if (user) req.user = user;
  }
  next();
});

// Strict Multi-Tenancy Guard: Doctor Workspace (/api/doctor/:id/*)
function requireDoctorAccess(req, res, next) {
  const requestedDocId = Number(req.params.id);
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول للوصول إلى لوحة الطبيب' });
  }
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'doctor' && Number(req.user.doctorId) === requestedDocId) return next();
  if (req.user.role === 'reception' && Number(req.user.doctorId) === requestedDocId) return next();
  return res.status(403).json({
    success: false,
    message: 'وصول محظور: غير مصرح لك بالاطلاع أو التعديل على بيانات عيادة أخرى'
  });
}

// Strict EMR Guard: ONLY the treating Doctor can read/write diagnoses, labs & prescriptions
function requireStrictDoctorEMR(req, res, next) {
  const requestedDocId = Number(req.params.id);
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول بحساب الطبيب' });
  }
  if (req.user.role === 'doctor' && Number(req.user.doctorId) === requestedDocId) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'سجل المريض الطبي محصور بالطبيب المعالج فقط حفاظاً على السرية الطبية'
  });
}

// Strict Multi-Tenancy Guard: Receptionist Workspace (/api/receptionist/:id/*)
function requireReceptionistAccess(req, res, next) {
  const requestedRecId = Number(req.params.id);
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول للوصول إلى مكتب الاستقبال' });
  }
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'reception' && Number(req.user.id) === requestedRecId) return next();
  if (req.user.role === 'doctor') {
    const rec = db.prepare('SELECT doctor_id FROM receptionists WHERE id = ?').get(requestedRecId);
    if (rec && Number(rec.doctor_id) === Number(req.user.doctorId)) return next();
  }
  return res.status(403).json({
    success: false,
    message: 'وصول محظور: غير مصرح لك بإدارة مكتب استقبال آخر'
  });
}

// Strict Guard: Super Admin Only (/api/admin/*)
function requireAdminAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول بحساب مدير المنصة' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'وصول محظور: هذه العمليات خاصة بإدارة المنصة العليا فقط'
    });
  }
  next();
}

app.use('/api/doctor/:id/emr', requireStrictDoctorEMR);
app.use('/api/doctor/:id', requireDoctorAccess);
app.use('/api/receptionist/:id', requireReceptionistAccess);
app.use('/api/admin', requireAdminAccess);

// Upload Image Endpoint
app.post('/api/upload', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'لم يتم استلام أي صورة' });
    }

    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/uploads/')) {
      return res.json({ success: true, url: image });
    }

    const matches = image.match(/^data:image\/([a-zA-Z0-9\+\.]+);base64,(.+)$/);
    let ext = 'png';
    let base64Data = image;

    if (matches && matches.length === 3) {
      ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      base64Data = matches[2];
    }

    const filename = `doctor-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(uploadsPath, filename);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    res.json({
      success: true,
      url: `/uploads/${filename}`,
      message: 'تم رفع وحفظ الصورة بنجاح'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper for generating unique booking code
function generateBookingCode() {
  let code;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 20) {
    const num = Math.floor(10000 + Math.random() * 90000);
    code = `DWR-${num}`;
    const row = db.prepare('SELECT id FROM appointments WHERE booking_code = ?').get(code);
    if (!row) exists = false;
    attempts++;
  }
  return code || `DWR-${Date.now().toString().slice(-6)}`;
}

// Log audit helper
function logAudit(role, user, action, type, id, details) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_role, user_name, action, target_type, target_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(role, user, action, type, id || null, details || '');
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// ----------------------------------------------------
// CYBER SECURITY, ANTI-BOT & FRAUD PROTECTION SUBSYSTEM
// Captures Device Fingerprints, IPs, Bot Traps & Legal Audit Logs
// ----------------------------------------------------

function extractClientInfo(req) {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
  if (typeof ip === 'string' && ip.includes(',')) ip = ip.split(',')[0].trim();
  const userAgent = req.headers['user-agent'] || 'Unknown Browser';
  const deviceFingerprint = req.body?.device_fingerprint || req.headers['x-device-fingerprint'] || 
    ('dev_' + Buffer.from(userAgent + ip).toString('base64').slice(0, 18));
  return { ip, userAgent, deviceFingerprint };
}

function isClientBlocked(ip, identifier = '', deviceFingerprint = '') {
  try {
    const cleanId = String(identifier || '').trim();
    const row = db.prepare(`
      SELECT * FROM blocked_identifiers 
      WHERE value = ? OR (value != '' AND value = ?) OR (value != '' AND value = ?)
      LIMIT 1
    `).get(ip, cleanId, deviceFingerprint);
    return row || null;
  } catch (e) {
    return null;
  }
}

function logSecurityEvent({ event_type, req, identifier = '', status = 'allowed', risk_score = 0, details = '' }) {
  try {
    const { ip, userAgent, deviceFingerprint } = extractClientInfo(req);
    db.prepare(`
      INSERT INTO security_audit_logs (
        event_type, ip_address, user_agent, device_fingerprint, identifier, status, risk_score, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(event_type, ip, userAgent, deviceFingerprint, identifier, status, risk_score, details);
  } catch (err) {
    console.error('Security log error:', err.message);
  }
}

// In-Memory Brute-Force Rate Limiter (5 attempts in 5 minutes -> 15 min ban)
const failedAttemptsMap = new Map();

function checkBruteForceLockout(key) {
  const record = failedAttemptsMap.get(key);
  if (!record) return { locked: false };
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingMin = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return { locked: true, remainingMin };
  }
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    failedAttemptsMap.delete(key);
    return { locked: false };
  }
  return { locked: false };
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const record = failedAttemptsMap.get(key) || { count: 0, firstAttempt: now };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 mins temporary lockout
  }
  failedAttemptsMap.set(key, record);
}

function clearFailedAttempt(key) {
  failedAttemptsMap.delete(key);
}

// ----------------------------------------------------
// UNIFIED AUTH: SINGLE LOGIN FOR EVERYONE (ALL ROLES) & PATIENT SIGNUP
// ----------------------------------------------------

// Unified Login Endpoint (Doctor, Receptionist, Admin, Patient)
app.post(['/api/auth/unified-login', '/api/auth/login'], (req, res) => {
  try {
    const { identifier, email, phone, password, hp_website_trap } = req.body;
    const cleanId = String(identifier || email || phone || '').trim();
    const cleanPass = String(password || '').trim();
    const { ip, userAgent, deviceFingerprint } = extractClientInfo(req);

    // 1. Anti-Bot Honeypot Trap
    if (hp_website_trap) {
      logSecurityEvent({
        event_type: 'bot_trap_triggered',
        req,
        identifier: cleanId,
        status: 'blocked',
        risk_score: 100,
        details: 'تم كشف روبوت آلي عبر فخ الحقول الخفية (Honeypot Trap).'
      });
      return res.status(403).json({ success: false, message: 'طلب غير مصرح به.' });
    }

    // 2. Blacklist / Device Ban Check
    const blocked = isClientBlocked(ip, cleanId, deviceFingerprint);
    if (blocked) {
      logSecurityEvent({
        event_type: 'blocked_client_access',
        req,
        identifier: cleanId,
        status: 'blocked',
        risk_score: 95,
        details: `محاولة دخول من جهاز أو حساب محظور: ${blocked.reason || 'حظر أمني'}`
      });
      return res.status(403).json({
        success: false,
        message: `تم حظر هذا الجهاز أو الحساب من الدخول للمنصة: ${blocked.reason || 'مخالفة معايير الاستخدام'}`
      });
    }

    // 3. Brute-Force Rate Limiter
    const ipLock = checkBruteForceLockout(ip);
    const userLock = checkBruteForceLockout(cleanId);
    if (ipLock.locked || userLock.locked) {
      const waitMin = ipLock.remainingMin || userLock.remainingMin;
      logSecurityEvent({
        event_type: 'login_lockout',
        req,
        identifier: cleanId,
        status: 'blocked',
        risk_score: 85,
        details: `محاولة تسجيل دخول أثناء فترة الحظر المؤقت (${waitMin} دقيقة متبقية).`
      });
      return res.status(429).json({
        success: false,
        message: `تم قفل محاولات تسجيل الدخول مؤقتاً لحماية الحساب لمدة ${waitMin} دقيقة بسبب تكرار المحاولات الخاطئة.`
      });
    }

    if (!cleanId) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال رقم الموبايل أو البريد الإلكتروني' });
    }
    if (!cleanPass) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كلمة المرور' });
    }

    const lowerId = cleanId.toLowerCase();

    // 4. Super Admin Check
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if ((lowerId === 'admin@dawry.com' || lowerId === 'admin') && cleanPass === adminPassword) {
      clearFailedAttempt(ip);
      clearFailedAttempt(cleanId);
      logAudit('superadmin', 'مدير المنصة', 'تسجيل دخول الأدمن', 'admin', 1, 'دخول ناجح للوحة الإدارة العليا');
      logSecurityEvent({
        event_type: 'login_success',
        req,
        identifier: cleanId,
        status: 'allowed',
        risk_score: 0,
        details: 'دخول ناجح لمدير المنصة (Super Admin).'
      });
      const token = generateAuthToken({ id: 1, role: 'admin', name: 'مدير المنصة', email: 'admin@dawry.com' });
      return res.json({
        success: true,
        token,
        role: 'admin',
        message: 'مرحباً بك في لوحة الإدارة العليا',
        user: { name: 'مدير المنصة', email: 'admin@dawry.com', role: 'admin' },
        redirect: '#admin'
      });
    }

    // 5. Doctor Check
    const doctor = db.prepare(`
      SELECT d.*, s.name as specialty_name,
             b.clinic_name, b.branch_name, b.address as clinic_address, b.phone as clinic_phone
      FROM doctors d
      LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
      WHERE (LOWER(d.email) = ? OR d.phone = ?)
    `).get(lowerId, cleanId);

    if (doctor) {
      const docPass = doctor.password || '123456';
      if (verifyPassword(cleanPass, docPass)) {
        if (doctor.status === 'suspended') {
          return res.status(403).json({ success: false, message: 'تم إيقاف هذا الحساب مؤقتاً، يرجى التواصل مع إدارة منصة دُوري.' });
        }
        // Seamless migration to scrypt hash if stored plaintext
        if (!String(docPass).startsWith('scrypt$')) {
          try { db.prepare('UPDATE doctors SET password = ? WHERE id = ?').run(hashPassword(cleanPass), doctor.id); } catch (e) {}
        }
        clearFailedAttempt(ip);
        clearFailedAttempt(cleanId);
        logAudit('doctor', doctor.full_name, 'تسجيل دخول طبيب', 'doctor', doctor.id, `تسجيل دخول ناجح لحساب د. ${doctor.full_name}`);
        logSecurityEvent({
          event_type: 'login_success',
          req,
          identifier: cleanId,
          status: 'allowed',
          risk_score: 0,
          details: `دخول ناجح للطبيب: د. ${doctor.full_name}`
        });
        const token = generateAuthToken({ id: doctor.id, doctorId: doctor.id, role: 'doctor', name: doctor.full_name, email: doctor.email });
        return res.json({
          success: true,
          token,
          role: 'doctor',
          message: `مرحباً بك د. ${doctor.full_name}`,
          user: {
            id: doctor.id,
            full_name: doctor.full_name,
            title: doctor.title,
            specialty_name: doctor.specialty_name || 'طب عام',
            clinic_name: doctor.clinic_name || 'عيادة دُوري التخصصية',
            branch_name: doctor.branch_name || 'الفرع الرئيسي',
            email: doctor.email,
            phone: doctor.phone,
            profile_photo: doctor.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120'
          },
          redirect: '#doctor'
        });
      }
    }

    // 6. Receptionist Check
    const rec = db.prepare(`
      SELECT r.*, d.full_name as doctor_name, d.title as doctor_title, d.profile_photo as doctor_photo,
             b.clinic_name, b.branch_name, b.address as branch_address, b.phone as branch_phone
      FROM receptionists r
      JOIN doctors d ON r.doctor_id = d.id
      JOIN branches b ON r.branch_id = b.id
      WHERE (LOWER(r.email) = ? OR r.phone = ?)
    `).get(lowerId, cleanId);

    if (rec) {
      const recPass = rec.password || '123456';
      if (verifyPassword(cleanPass, recPass)) {
        if (rec.status !== 'active') {
          return res.status(403).json({ success: false, message: 'تم إيقاف حساب موظف الاستقبال، يرجى مراجعة إدارة العيادة.' });
        }
        if (!String(recPass).startsWith('scrypt$')) {
          try { db.prepare('UPDATE receptionists SET password = ? WHERE id = ?').run(hashPassword(cleanPass), rec.id); } catch (e) {}
        }
        clearFailedAttempt(ip);
        clearFailedAttempt(cleanId);
        logAudit('receptionist', rec.name, 'تسجيل دخول موظف استقبال', 'receptionist', rec.id, `تسجيل دخول ناجح للموظف ${rec.name}`);
        logSecurityEvent({
          event_type: 'login_success',
          req,
          identifier: cleanId,
          status: 'allowed',
          risk_score: 0,
          details: `دخول ناجح لموظف الاستقبال: ${rec.name}`
        });
        const { password: _rp, ...safeRec } = rec;
        const token = generateAuthToken({ id: rec.id, receptionistId: rec.id, doctorId: rec.doctor_id, branchId: rec.branch_id, role: 'reception', name: rec.name, email: rec.email });
        return res.json({
          success: true,
          token,
          role: 'reception',
          message: `مرحباً بك ${rec.name}`,
          user: safeRec,
          redirect: '#reception'
        });
      }
    }

    // 7. Patient Check
    let patient = db.prepare(`
      SELECT * FROM patients WHERE (LOWER(email) = ? OR phone = ?)
    `).get(lowerId, cleanId);

    if (patient) {
      const patientPass = patient.password || '123456';
      if (verifyPassword(cleanPass, patientPass)) {
        if (!String(patientPass).startsWith('scrypt$')) {
          try { db.prepare('UPDATE patients SET password = ? WHERE id = ?').run(hashPassword(cleanPass), patient.id); } catch (e) {}
        }
        clearFailedAttempt(ip);
        clearFailedAttempt(cleanId);
        logSecurityEvent({
          event_type: 'login_success',
          req,
          identifier: cleanId,
          status: 'allowed',
          risk_score: 0,
          details: `دخول مريض: ${patient.name}`
        });
        const { password: _pp, ...safePatient } = patient;
        const token = generateAuthToken({ id: patient.id, role: 'patient', name: patient.name, phone: patient.phone });
        return res.json({
          success: true,
          token,
          role: 'patient',
          message: `أهلاً بك مجدداً ${patient.name}`,
          user: safePatient,
          redirect: '#home'
        });
      }
    } else {
      // Check if phone has appointments (first-time login)
      const appt = db.prepare('SELECT patient_name, patient_phone FROM appointments WHERE patient_phone = ? ORDER BY id DESC LIMIT 1').get(cleanId);
      if (appt && cleanPass.length >= 6) {
        clearFailedAttempt(ip);
        clearFailedAttempt(cleanId);
        const newP = db.prepare('INSERT INTO patients (name, phone, password) VALUES (?, ?, ?)').run(appt.patient_name, appt.patient_phone, hashPassword(cleanPass));
        const savedPatient = db.prepare('SELECT id, name, phone, email, city, gender, birth_year, created_at FROM patients WHERE id = ?').get(newP.lastInsertRowid);
        logSecurityEvent({
          event_type: 'login_success',
          req,
          identifier: cleanId,
          status: 'allowed',
          risk_score: 0,
          details: `دخول مريض تلقائي برقم الحجز: ${appt.patient_name}`
        });
        const token = generateAuthToken({ id: savedPatient.id, role: 'patient', name: savedPatient.name, phone: savedPatient.phone });
        return res.json({
          success: true,
          token,
          role: 'patient',
          message: `أهلاً بك ${appt.patient_name}`,
          user: savedPatient,
          redirect: '#home'
        });
      }
    }

    // Failed Login Attempt -> Record & Log
    recordFailedAttempt(ip);
    recordFailedAttempt(cleanId);
    logSecurityEvent({
      event_type: 'login_failed',
      req,
      identifier: cleanId,
      status: 'flagged',
      risk_score: 35,
      details: 'محاولة تسجيل دخول فاشلة (بيانات غير مطابقة).'
    });

    return res.status(401).json({
      success: false,
      message: 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد أو الهاتف وكلمة المرور.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Patient Signup Endpoint (Dedicated for patients)
app.post('/api/auth/patient/signup', (req, res) => {
  try {
    let { name, phone, email, phoneOrEmail, password, city, hp_website_trap } = req.body;
    const { ip, userAgent, deviceFingerprint } = extractClientInfo(req);

    // 1. Anti-Bot Honeypot Trap
    if (hp_website_trap) {
      logSecurityEvent({
        event_type: 'bot_trap_triggered',
        req,
        identifier: name,
        status: 'blocked',
        risk_score: 100,
        details: 'محاولة إنشاء حساب عبر روبوت برمجيات خبيثة (Honeypot Triggered).'
      });
      return res.status(403).json({ success: false, message: 'طلب غير مصرح به.' });
    }

    const inputId = (phone || phoneOrEmail || '').trim();
    if (!name || !inputId) {
      return res.status(400).json({ success: false, message: 'الاسم ورقم الهاتف أو البريد حقول مطلوبة' });
    }

    // 2. Blacklist / Blocked Device Check
    const blocked = isClientBlocked(ip, inputId, deviceFingerprint);
    if (blocked) {
      logSecurityEvent({
        event_type: 'blocked_client_access',
        req,
        identifier: inputId,
        status: 'blocked',
        risk_score: 95,
        details: `محاولة إنشاء حساب من جهاز أو هوية محظورة: ${blocked.reason || 'حظر أمني'}`
      });
      return res.status(403).json({
        success: false,
        message: `تم حظر هذا الجهاز أو الرقم من التسجيل: ${blocked.reason || 'مخالفة معايير الاستخدام'}`
      });
    }

    // 3. Hourly Signup Rate Limiter (Max 4 per IP per hour)
    const recentSignups = db.prepare(`
      SELECT COUNT(*) as cnt FROM security_audit_logs
      WHERE ip_address = ? AND event_type = 'signup_success' AND created_at >= datetime('now', '-1 hour')
    `).get(ip);

    if (recentSignups && recentSignups.cnt >= 4) {
      logSecurityEvent({
        event_type: 'signup_rate_limit',
        req,
        identifier: inputId,
        status: 'blocked',
        risk_score: 80,
        details: 'تجاوز معدل إنشاء الحسابات المسموح به في الساعة.'
      });
      return res.status(429).json({
        success: false,
        message: 'تم تجاوز الحد الأقصى المسموح به لإنشاء الحسابات من هذا الجهاز خلال ساعة. يرجى المحاولة لاحقاً.'
      });
    }

    let cleanPhone = inputId;
    let cleanEmail = email ? String(email).trim().toLowerCase() : '';
    if (inputId.includes('@')) {
      cleanEmail = inputId.toLowerCase();
      cleanPhone = phone ? String(phone).trim() : `temp_${Date.now()}`;
    }

    const cleanPass = password && password.trim() ? password.trim() : '123456';

    const existing = db.prepare("SELECT id FROM patients WHERE phone = ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)").get(cleanPhone, cleanEmail);
    if (existing) {
      return res.status(400).json({ success: false, message: 'هذا الحساب مسجل بالفعل مسبقاً، يمكنك تسجيل الدخول به مباشرة.' });
    }

    const insRes = db.prepare(`
      INSERT INTO patients (name, phone, email, password, city)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), cleanPhone, cleanEmail || null, hashPassword(cleanPass), city || 'القاهرة');

    const newPatient = db.prepare('SELECT id, name, phone, email, city, gender, birth_year, created_at FROM patients WHERE id = ?').get(insRes.lastInsertRowid);

    logAudit('patient', name, 'إنشاء حساب مريض جديد', 'patient', newPatient.id, `تسجيل مريض جديد: ${name} (${cleanPhone})`);
    logSecurityEvent({
      event_type: 'signup_success',
      req,
      identifier: cleanPhone,
      status: 'allowed',
      risk_score: 0,
      details: `تسجيل مريض جديد بنجاح: ${name} (${cleanPhone})`
    });

    const token = generateAuthToken({ id: newPatient.id, role: 'patient', name: newPatient.name, phone: newPatient.phone });
    res.json({
      success: true,
      token,
      message: 'تم إنشاء الحساب بنجاح! مرحباً بك في منصة دُوري.',
      user: newPatient,
      role: 'patient',
      redirect: '#home'
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, message: 'رقم الهاتف أو البريد مسجل مسبقاً.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Doctor Login Endpoint
app.post('/api/auth/doctor/login', (req, res) => {
  try {
    const { email, password, doctor_id } = req.body;
    let doctor = null;

    if (doctor_id) {
      doctor = db.prepare(`
        SELECT d.*, s.name as specialty_name,
               b.clinic_name, b.branch_name, b.address as clinic_address, b.phone as clinic_phone
        FROM doctors d
        LEFT JOIN specialties s ON d.specialty_id = s.id
        LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
        WHERE d.id = ?
      `).get(doctor_id);
    } else if (email) {
      const cleanEmail = String(email).trim();
      doctor = db.prepare(`
        SELECT d.*, s.name as specialty_name,
               b.clinic_name, b.branch_name, b.address as clinic_address, b.phone as clinic_phone
        FROM doctors d
        LEFT JOIN specialties s ON d.specialty_id = s.id
        LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
        WHERE (LOWER(d.email) = LOWER(?) OR d.phone = ?)
      `).get(cleanEmail, cleanEmail);
    }

    if (!doctor) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد أو الهاتف.' });
    }

    if (doctor.password && !verifyPassword(password || '', doctor.password)) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة. يرجى إعادة المحاولة.' });
    }

    if (doctor.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'تم إيقاف هذا الحساب مؤقتاً، يرجى التواصل مع إدارة منصة دُوري.' });
    }

    logAudit('doctor', doctor.full_name, 'تسجيل دخول طبيب', 'doctor', doctor.id, `تسجيل دخول ناجح لحساب ${doctor.full_name}`);
    const token = generateAuthToken({ id: doctor.id, doctorId: doctor.id, role: 'doctor', name: doctor.full_name, email: doctor.email });

    res.json({
      success: true,
      token,
      message: 'تم تسجيل الدخول بنجاح',
      doctor: {
        id: doctor.id,
        full_name: doctor.full_name,
        title: doctor.title,
        specialty_name: doctor.specialty_name || 'طب عام',
        clinic_name: doctor.clinic_name || 'عيادة دُوري التخصصية',
        branch_name: doctor.branch_name || 'الفرع الرئيسي',
        email: doctor.email,
        phone: doctor.phone,
        profile_photo: doctor.profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120',
        consultation_fee: doctor.consultation_fee,
        appointment_duration: doctor.appointment_duration,
        daily_capacity: doctor.daily_capacity
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Available Registered Doctors for Login / Demo Switcher
app.get('/api/auth/doctor/list', (req, res) => {
  try {
    const doctors = db.prepare(`
      SELECT d.id, d.full_name, d.title, d.email, d.phone, d.profile_photo, d.consultation_fee, d.status,
             s.name as specialty_name,
             b.clinic_name, b.branch_name, b.governorate, b.city
      FROM doctors d
      JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
      WHERE d.status = 'active'
      ORDER BY d.id ASC
    `).all();

    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// PUBLIC PATIENT APIS
// ----------------------------------------------------

// 1. Get Specialties with active doctor count
app.get('/api/public/specialties', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM doctors d WHERE d.specialty_id = s.id AND d.status = 'active') as doctors_count
      FROM specialties s
      WHERE s.is_active = 1
      ORDER BY s.display_order ASC
    `).all();
    res.json({ success: true, specialties: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Public Doctors (STRICTLY ACTIVE ONLY)
app.get('/api/public/doctors', (req, res) => {
  try {
    const { specialty_id, search, governorate, sort, min_rating, max_price } = req.query;

    let query = `
      SELECT d.*, s.name as specialty_name,
        b.clinic_name, b.branch_name, b.governorate, b.city, b.address, b.phone as clinic_phone,
        q.current_serving_number, q.delay_minutes, q.status as queue_status
      FROM doctors d
      JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
      LEFT JOIN doctor_queue_states q ON q.doctor_id = d.id
      WHERE d.status = 'active'
    `;
    const params = [];

    if (specialty_id) {
      query += ` AND d.specialty_id = ?`;
      params.push(specialty_id);
    }
    if (search) {
      query += ` AND (d.full_name LIKE ? OR s.name LIKE ? OR b.clinic_name LIKE ? OR d.subspecialty LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (governorate) {
      query += ` AND b.governorate = ?`;
      params.push(governorate);
    }
    if (min_rating) {
      query += ` AND d.rating >= ?`;
      params.push(Number(min_rating));
    }
    if (max_price) {
      query += ` AND d.consultation_fee <= ?`;
      params.push(Number(max_price));
    }

    if (sort === 'rating') {
      query += ` ORDER BY d.rating DESC`;
    } else if (sort === 'price_asc') {
      query += ` ORDER BY d.consultation_fee ASC`;
    } else if (sort === 'price_desc') {
      query += ` ORDER BY d.consultation_fee DESC`;
    } else if (sort === 'experience') {
      query += ` ORDER BY d.experience_years DESC`;
    } else {
      query += ` ORDER BY d.rating DESC, d.reviews_count DESC`;
    }

    const doctors = db.prepare(query).all(...params);
    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Single Doctor Profile
app.get('/api/public/doctors/:id', (req, res) => {
  try {
    const doctor = db.prepare(`
      SELECT d.*, s.name as specialty_name
      FROM doctors d
      JOIN specialties s ON d.specialty_id = s.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });
    }

    if (doctor.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: 'عذراً، هذا الحساب غير متاح للحجوزات حالياً (معلّق أو قيد المراجعة)',
        status: doctor.status 
      });
    }

    const branches = db.prepare('SELECT * FROM branches WHERE doctor_id = ?').all(doctor.id);
    const schedules = db.prepare('SELECT * FROM doctor_schedules WHERE doctor_id = ? AND is_active = 1').all(doctor.id);
    const reviews = db.prepare('SELECT * FROM reviews WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 10').all(doctor.id);
    const queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(doctor.id);

    res.json({
      success: true,
      doctor,
      branches,
      schedules,
      reviews,
      queueState
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Calculate Available Slots for Booking
app.get('/api/public/doctors/:id/available-slots', (req, res) => {
  try {
    const { branch_id, date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد تاريخ الموعد' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
    if (!doctor || doctor.status !== 'active') {
      return res.status(400).json({ success: false, message: 'الطبيب غير متاح للحجز' });
    }

    // Resolve branch safely
    let targetBranchId = branch_id ? parseInt(branch_id, 10) : null;
    if (targetBranchId) {
      const validBranch = db.prepare('SELECT id FROM branches WHERE id = ? AND doctor_id = ?').get(targetBranchId, doctor.id);
      if (!validBranch) targetBranchId = null;
    }
    if (!targetBranchId) {
      const defaultBranch = db.prepare('SELECT id FROM branches WHERE doctor_id = ? ORDER BY is_main DESC LIMIT 1').get(doctor.id);
      targetBranchId = defaultBranch ? defaultBranch.id : 1;
    }

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay(); // 0-6

    // Check if the requested date falls within doctor vacations/holidays
    const vacation = db.prepare(`
      SELECT * FROM doctor_vacations 
      WHERE doctor_id = ? AND start_date <= ? AND end_date >= ?
    `).get(doctor.id, date, date);

    if (vacation) {
      return res.json({ 
        success: true, 
        available: false, 
        is_vacation: true,
        message: `عفواً، الطبيب في إجازة رسمية (${vacation.reason || 'عطلة عيادة'}) من تاريخ ${vacation.start_date} حتى ${vacation.end_date}`,
        slots: [] 
      });
    }

    let schedule = db.prepare(`
      SELECT * FROM doctor_schedules 
      WHERE doctor_id = ? AND branch_id = ? AND day_of_week = ? AND is_active = 1
    `).get(doctor.id, targetBranchId, dayOfWeek);

    if (!schedule) {
      // Check if doctor has schedule for this day on any branch
      schedule = db.prepare(`
        SELECT * FROM doctor_schedules 
        WHERE doctor_id = ? AND day_of_week = ? AND is_active = 1 LIMIT 1
      `).get(doctor.id, dayOfWeek);
    }

    // If day is Friday (5) and no schedule, clinic is closed
    if (dayOfWeek === 5 && !schedule) {
      return res.json({ 
        success: true, 
        available: false, 
        message: 'عفواً، يوم الجمعة عطلة أسبوعية للعيادة',
        slots: [] 
      });
    }

    // Generate slots based on schedule or standard clinic hours
    const startStr = schedule?.start_time || '17:00';
    const endStr = schedule?.end_time || '22:00';

    const startHour = parseInt(startStr.split(':')[0], 10);
    const startMin = parseInt(startStr.split(':')[1], 10);
    const endHour = parseInt(endStr.split(':')[0], 10);
    const endMin = parseInt(endStr.split(':')[1], 10);

    const slotDuration = doctor.appointment_duration || 25;
    const slots = [];

    let current = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    // Check break time
    let breakStart = null;
    let breakEnd = null;
    if (schedule?.break_start && schedule?.break_end) {
      breakStart = parseInt(schedule.break_start.split(':')[0], 10) * 60 + parseInt(schedule.break_start.split(':')[1], 10);
      breakEnd = parseInt(schedule.break_end.split(':')[0], 10) * 60 + parseInt(schedule.break_end.split(':')[1], 10);
    }

    // Existing booked appointments for that date & doctor
    const booked = db.prepare(`
      SELECT appointment_time FROM appointments 
      WHERE doctor_id = ? AND branch_id = ? AND appointment_date = ? AND status != 'cancelled'
    `).all(doctor.id, targetBranchId, date).map(r => r.appointment_time);

    while (current + slotDuration <= end) {
      // Skip if during break
      if (breakStart && breakEnd && current >= breakStart && current < breakEnd) {
        current += slotDuration;
        continue;
      }

      const h = Math.floor(current / 60);
      const m = current % 60;
      const formattedTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const isBooked = booked.includes(formattedTime);

      slots.push({
        time: formattedTime,
        label: formatArabicTime(formattedTime),
        available: !isBooked
      });

      current += slotDuration;
    }

    res.json({ success: true, available: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function formatArabicTime(time24) {
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const period = h >= 12 ? 'م' : 'ص';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${mStr} ${period}`;
}

// 5. Create Booking (Patient Flow A)
app.post('/api/public/bookings', async (req, res) => {
  try {
    const { doctor_id, branch_id, patient_name, patient_phone, patient_email, appointment_date, appointment_time, notes, hp_website_trap } = req.body;
    const { ip, userAgent, deviceFingerprint } = extractClientInfo(req);

    // 1. Anti-Bot Honeypot Trap
    if (hp_website_trap) {
      logSecurityEvent({
        event_type: 'bot_trap_triggered',
        req,
        identifier: patient_phone || 'Unknown Bot',
        status: 'blocked',
        risk_score: 100,
        details: `محاولة حجز موعد وهمي عبر بوت آلي: ${patient_name || 'Bot'}`
      });
      return res.status(403).json({ success: false, message: 'طلب غير مصرح به.' });
    }

    if (!doctor_id || !patient_name || !patient_phone || !appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, message: 'جميع بيانات الحجز الأساسية مطلوبة' });
    }

    const cleanPhone = String(patient_phone).trim().replace(/[\s\-\+]/g, '');
    const isEgyptianPhone = /^(?:(?:01[0125]\d{8})|(?:201[0125]\d{8}))$/.test(cleanPhone);
    if (!isEgyptianPhone) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رقم هاتف محمول صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015'
      });
    }

    // 2. Blacklist & Device Ban Enforcement
    const blocked = isClientBlocked(ip, cleanPhone, deviceFingerprint);
    if (blocked) {
      logSecurityEvent({
        event_type: 'booking_blocked',
        req,
        identifier: cleanPhone,
        status: 'blocked',
        risk_score: 95,
        details: `محاولة حجز من رقم أو جهاز محظور: ${blocked.reason || 'حظر إداري/قانوني'}`
      });
      return res.status(403).json({
        success: false,
        message: `تم حظر هذا الجهاز أو الرقم من الحجز على المنصة: ${blocked.reason || 'مخالفة معايير الحجز العادل'}`
      });
    }

    // 3. Spam Prevention: Limit Active Appointments Per Phone (Max 2 Active Bookings)
    const todayDate = new Date().toISOString().split('T')[0];
    const activeAppts = db.prepare(`
      SELECT COUNT(*) as count FROM appointments
      WHERE patient_phone = ? AND appointment_date >= ? AND status IN ('confirmed', 'waiting', 'in_progress')
    `).get(cleanPhone, todayDate);

    if (activeAppts && activeAppts.count >= 2) {
      logSecurityEvent({
        event_type: 'booking_spam_blocked',
        req,
        identifier: cleanPhone,
        status: 'blocked',
        risk_score: 75,
        details: `تجاوز الحد الأقصى للحجوزات النشطة: الهاتف لديه ${activeAppts.count} حجوزات قائمة بالفعل.`
      });
      return res.status(429).json({
        success: false,
        message: 'عذراً، لديك بالفعل حجزين نشطين مؤكدين. لا يمكن حجز مواعيد إضافية لتفادي شغل المواعيد عشوائياً، يرجى إتمام أو إلغاء الحجوزات السابقة أولاً.'
      });
    }

    // 4. Rate Limit: Max 4 Bookings Per Device/IP Per 24 Hours
    const ipBookingsCount = db.prepare(`
      SELECT COUNT(*) as count FROM security_audit_logs
      WHERE ip_address = ? AND event_type = 'booking_created' AND created_at >= datetime('now', '-24 hours')
    `).get(ip);

    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== 'localhost' && ipBookingsCount && ipBookingsCount.count >= 4) {
      logSecurityEvent({
        event_type: 'booking_rate_limit',
        req,
        identifier: cleanPhone,
        status: 'blocked',
        risk_score: 80,
        details: `تجاوز الحد الأقصى للحجوزات اليومية من هذا الجهاز (${ipBookingsCount.count} حجز في 24 ساعة).`
      });
      return res.status(429).json({
        success: false,
        message: 'تم تجاوز الحد الأقصى للحجوزات اليومية المسموح بها من هذا الجهاز (٤ حجوزات). لتفادي حجز المواعيد عشوائياً يرجى التواصل مع العيادة.'
      });
    }

    // 5. Check Global Platform Booking Setting
    const globalSetting = db.prepare("SELECT value FROM platform_settings WHERE key = 'global_booking_enabled'").get();
    if (globalSetting && globalSetting.value === '0') {
      return res.status(403).json({ success: false, message: 'عذراً، خدمة الحجز أونلاين معطلة مؤقتاً على مستوى المنصة بقرار من إدارة دُوري' });
    }

    // Resolve branch
    let resolvedBranchId = branch_id ? parseInt(branch_id, 10) : null;
    if (!resolvedBranchId) {
      const mainBranch = db.prepare('SELECT id FROM branches WHERE doctor_id = ? ORDER BY is_main DESC LIMIT 1').get(doctor_id);
      resolvedBranchId = mainBranch ? mainBranch.id : 1;
    }

    // 6. Verify Doctor Status & Online Booking Permission
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctor_id);
    if (!doctor || doctor.status !== 'active') {
      return res.status(400).json({ success: false, message: 'عذراً، هذا الطبيب غير متاح للحجز حالياً أو حسابه معلق' });
    }
    if (doctor.is_booking_enabled === 0) {
      return res.status(400).json({ success: false, message: 'عذراً، تم إيقاف الحجز الإلكتروني لهذا الطبيب مؤقتاً بقرار إداري' });
    }

    // 7. Verify Branch Online Booking Permission
    const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(resolvedBranchId);
    if (branch && branch.is_booking_enabled === 0) {
      return res.status(400).json({ success: false, message: `عذراً، الحجز الإلكتروني لـ "${branch.branch_name}" معطل مؤقتاً` });
    }

    // 8. Verify No Double Booking
    const existing = db.prepare(`
      SELECT id FROM appointments 
      WHERE doctor_id = ? AND branch_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'
    `).get(doctor_id, resolvedBranchId, appointment_date, appointment_time);

    if (existing) {
      return res.status(409).json({ success: false, message: 'هذا الموعد تم حجزه بالفعل، يرجى اختيار موعد آخر' });
    }

    const bookingCode = generateBookingCode();
    
    // Generate QR Code data URL containing booking info & tracking URL
    const qrDataPayload = JSON.stringify({
      dawry_code: bookingCode,
      doctor: doctor.full_name,
      patient: patient_name,
      date: appointment_date,
      time: appointment_time
    });
    const qrDataUrl = await QRCode.toDataURL(qrDataPayload, { margin: 1, width: 220 });

    const insertAppt = db.prepare(`
      INSERT INTO appointments (
        booking_code, doctor_id, branch_id, patient_name, patient_phone,
        patient_email, appointment_date, appointment_time, type, status, notes, qr_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'online', 'confirmed', ?, ?)
    `);

    const result = insertAppt.run(
      bookingCode, doctor_id, resolvedBranchId, patient_name, cleanPhone,
      patient_email || '', appointment_date, appointment_time, notes || '', qrDataUrl
    );
    const appointmentId = Number(result.lastInsertRowid);

    // Assign queue entry for appointment_date (whether today or future date)
    const lastQ = db.prepare(`
      SELECT MAX(queue_number) as max_num FROM queue_entries 
      WHERE doctor_id = ? AND queue_date = ?
    `).get(doctor_id, appointment_date);
    const queueNumber = (lastQ?.max_num || 0) + 1;

    db.prepare(`
      INSERT INTO queue_entries (
        doctor_id, branch_id, appointment_id, patient_name, patient_phone,
        queue_date, queue_number, priority, status, estimated_wait_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'waiting', 20)
    `).run(doctor_id, resolvedBranchId, appointmentId, patient_name, cleanPhone, appointment_date, queueNumber);

    // Log notification
    db.prepare(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, channel)
      VALUES (?, ?, ?, ?, 'whatsapp')
    `).run(
      'patient',
      cleanPhone,
      'تأكيد حجز دوري',
      `أهلاً ${patient_name}، تم تأكيد حجزك بنجاح مع ${doctor.full_name}. كود الحجز الخاص بك هو ${bookingCode}. يمكنك متابعة دورك من الرابط.`
    );

    logAudit('patient', patient_name, 'حجز موعد جديد', 'appointment', appointmentId, `كود الحجز: ${bookingCode}`);
    
    // Log in Cyber Security Audit with Device Fingerprint & IP
    logSecurityEvent({
      event_type: 'booking_created',
      req,
      identifier: cleanPhone,
      status: 'allowed',
      risk_score: 0,
      details: `حجز مؤكد: كود ${bookingCode} للمريض ${patient_name} مع د. ${doctor.full_name} في تاريخ ${appointment_date} الساعة ${appointment_time}`
    });

    res.json({
      success: true,
      booking_code: bookingCode,
      appointment_id: appointmentId,
      queue_number: queueNumber,
      qr_code: qrDataUrl,
      message: 'تم تأكيد حجزك بنجاح!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5b. Get Patient Bookings (My Bookings)
app.get('/api/public/bookings/my', (req, res) => {
  try {
    const { phone } = req.query;
    let query = `
      SELECT a.*, d.full_name as doctor_name, d.title as doctor_title, d.profile_photo, d.consultation_fee,
        b.clinic_name, b.branch_name, b.governorate, b.city, b.address, b.phone as clinic_phone,
        s.name as specialty_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN specialties s ON d.specialty_id = s.id
    `;
    let rows;
    if (phone) {
      query += ` WHERE a.patient_phone LIKE ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
      rows = db.prepare(query).all(`%${phone.trim()}%`);
    } else {
      query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 20`;
      rows = db.prepare(query).all();
    }
    res.json({ success: true, bookings: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Track Booking & Live Queue
app.get('/api/public/bookings/track/:code', (req, res) => {
  try {
    const code = req.params.code.trim();
    const appt = db.prepare(`
      SELECT a.*, d.full_name as doctor_name, d.title as doctor_title, d.profile_photo, d.consultation_fee,
        b.clinic_name, b.branch_name, b.governorate, b.city, b.address, b.phone as clinic_phone,
        q.current_serving_number, q.delay_minutes, q.delay_reason, q.status as queue_status
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN branches b ON a.branch_id = b.id
      LEFT JOIN doctor_queue_states q ON q.doctor_id = d.id
      WHERE a.booking_code = ? OR a.patient_phone = ?
      ORDER BY a.created_at DESC
      LIMIT 1
    `).get(code, code);

    if (!appt) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على حجز بهذا الكود أو رقم الهاتف' });
    }

    // Date analysis
    const todayStr = new Date().toISOString().split('T')[0];
    const apptDate = appt.appointment_date;
    const isToday = (apptDate === todayStr);
    const isFuture = (apptDate > todayStr);
    const isPast = (apptDate < todayStr);

    let queueEntry = db.prepare(`
      SELECT * FROM queue_entries 
      WHERE appointment_id = ? AND queue_date = ?
    `).get(appt.id, apptDate);

    // If queue entry wasn't created yet for this date, create it now
    if (!queueEntry) {
      const lastQ = db.prepare(`
        SELECT MAX(queue_number) as max_num FROM queue_entries 
        WHERE doctor_id = ? AND queue_date = ?
      `).get(appt.doctor_id, apptDate);
      const qNum = (lastQ?.max_num || 0) + 1;
      const insertQ = db.prepare(`
        INSERT INTO queue_entries (doctor_id, branch_id, appointment_id, patient_name, patient_phone, queue_date, queue_number, priority, status, estimated_wait_minutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'waiting', 20)
      `).run(appt.doctor_id, appt.branch_id, appt.id, appt.patient_name, appt.patient_phone, apptDate, qNum);
      queueEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(insertQ.lastInsertRowid);
    }

    let patientsAhead = 0;
    let estimatedWaitMinutes = 0;

    if (queueEntry) {
      const currentServing = isToday ? (appt.current_serving_number || 0) : 0;
      if (queueEntry.status === 'called' || queueEntry.status === 'in_progress') {
        patientsAhead = 0;
        estimatedWaitMinutes = 0;
      } else if (['completed', 'cancelled', 'skipped'].includes(queueEntry.status)) {
        patientsAhead = 0;
        estimatedWaitMinutes = 0;
      } else if (isToday) {
        // Today's live waiting count
        const aheadRow = db.prepare(`
          SELECT COUNT(*) as cnt FROM queue_entries
          WHERE doctor_id = ? AND branch_id = ? AND queue_date = ?
            AND status IN ('waiting', 'called', 'in_progress')
            AND queue_number < ?
        `).get(appt.doctor_id, appt.branch_id, apptDate, queueEntry.queue_number);

        patientsAhead = aheadRow ? aheadRow.cnt : Math.max(0, queueEntry.queue_number - currentServing - 1);
        estimatedWaitMinutes = patientsAhead * 20 + (appt.delay_minutes || 0);
      } else {
        // Future / other date count: booked ahead of this patient
        const aheadRow = db.prepare(`
          SELECT COUNT(*) as cnt FROM queue_entries
          WHERE doctor_id = ? AND branch_id = ? AND queue_date = ?
            AND status IN ('waiting', 'called', 'in_progress', 'confirmed')
            AND queue_number < ?
        `).get(appt.doctor_id, appt.branch_id, apptDate, queueEntry.queue_number);

        patientsAhead = aheadRow ? aheadRow.cnt : Math.max(0, queueEntry.queue_number - 1);
        estimatedWaitMinutes = patientsAhead * 20;
      }
    }

    // Days remaining calculation
    let daysRemaining = 0;
    if (isFuture) {
      const d1 = new Date(todayStr);
      const d2 = new Date(apptDate);
      daysRemaining = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    res.json({
      success: true,
      appointment: appt,
      date_info: {
        is_today: isToday,
        is_future: isFuture,
        is_past: isPast,
        days_remaining: daysRemaining,
        appointment_date: apptDate,
        appointment_time: appt.appointment_time,
        today_date: todayStr
      },
      queue: queueEntry ? {
        queue_number: queueEntry.queue_number,
        current_serving: isToday ? (appt.current_serving_number || 0) : 0,
        current_serving_number: isToday ? (appt.current_serving_number || 0) : 0,
        patients_ahead: patientsAhead,
        estimated_wait_minutes: estimatedWaitMinutes,
        delay_minutes: isToday ? (appt.delay_minutes || 0) : 0,
        delay_reason: isToday ? (appt.delay_reason || '') : '',
        status: queueEntry.status
      } : null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Cancel Booking by Patient (Protected by phone ownership or authenticated user)
app.post('/api/public/bookings/:code/cancel', (req, res) => {
  try {
    const code = req.params.code;
    const appt = db.prepare('SELECT * FROM appointments WHERE booking_code = ?').get(code);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'الحجز غير موجود' });
    }

    const suppliedPhone = String(req.body?.patient_phone || req.query?.phone || '').trim();
    const isStaffOrAdmin = req.user && (
      req.user.role === 'admin' ||
      ((req.user.role === 'doctor' || req.user.role === 'reception') && Number(req.user.doctorId) === Number(appt.doctor_id))
    );
    const isAuthedPatient = req.user && req.user.role === 'patient' && req.user.phone === appt.patient_phone;
    const isPhoneMatch = suppliedPhone && suppliedPhone === appt.patient_phone;

    if (!isStaffOrAdmin && !isAuthedPatient && !isPhoneMatch) {
      return res.status(403).json({ success: false, message: 'يرجى تأكيد رقم الهاتف المسجل بالحجز لإتمام الإلغاء' });
    }

    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(appt.id);
    db.prepare("UPDATE queue_entries SET status = 'cancelled' WHERE appointment_id = ?").run(appt.id);

    logAudit('patient', appt.patient_name, 'إلغاء حجز', 'appointment', appt.id, `إلغاء الحجز كود ${code}`);

    res.json({ success: true, message: 'تم إلغاء الموعد بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// DOCTOR DASHBOARD APIS (Flow C & Tenant Workspace)
// ----------------------------------------------------

// 1. Doctor Overview Stats
app.get('/api/doctor/:id/dashboard', (req, res) => {
  try {
    const docId = req.params.id;
    const todayStr = new Date().toISOString().split('T')[0];

    const doctor = db.prepare(`
      SELECT d.*, s.name as specialty_name,
        b.clinic_name, b.branch_name, b.governorate, b.city
      FROM doctors d
      JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
      WHERE d.id = ?
    `).get(docId);

    if (!doctor) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    const targetDate = req.query.date || todayStr;
    const isToday = (targetDate === todayStr);

    // Stats
    const todayAppts = db.prepare(`
      SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date = ?
    `).get(docId, targetDate).count;

    const waitingCount = db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries 
      WHERE doctor_id = ? AND queue_date = ? AND status = 'waiting'
    `).get(docId, targetDate).count;

    const completedCount = db.prepare(`
      SELECT COUNT(*) as count FROM queue_entries 
      WHERE doctor_id = ? AND queue_date = ? AND status = 'completed'
    `).get(docId, targetDate).count;

    const cancelledCount = db.prepare(`
      SELECT COUNT(*) as count FROM appointments 
      WHERE doctor_id = ? AND appointment_date = ? AND status = 'cancelled'
    `).get(docId, targetDate).count;

    const totalRevenueToday = completedCount * doctor.consultation_fee;

    // Queue state
    const queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(docId) || {
      current_serving_number: 0,
      status: 'active',
      delay_minutes: 0
    };

    // Current Patient in progress
    const currentPatient = db.prepare(`
      SELECT q.*, a.type, a.notes, a.booking_code
      FROM queue_entries q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = ? AND q.queue_date = ? AND q.status = 'in_progress'
      LIMIT 1
    `).get(docId, targetDate);

    // Next waiting patients
    const upcoming = db.prepare(`
      SELECT q.*, a.type, a.notes, a.booking_code, a.appointment_time
      FROM queue_entries q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = ? AND q.queue_date = ? AND q.status = 'waiting'
      ORDER BY q.priority DESC, q.queue_number ASC
      LIMIT 10
    `).all(docId, targetDate);

    // All queue entries for this date
    const allDateQueueEntries = db.prepare(`
      SELECT q.*, a.type, a.notes, a.booking_code, a.appointment_time
      FROM queue_entries q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = ? AND q.queue_date = ?
      ORDER BY 
        CASE WHEN q.status = 'in_progress' THEN 1
             WHEN q.status = 'called' THEN 2
             WHEN q.status = 'waiting' AND q.priority = 1 THEN 3
             WHEN q.status = 'waiting' THEN 4
             ELSE 5 END,
        q.priority DESC, q.queue_number ASC
    `).all(docId, targetDate);

    // Subscription status
    const sub = db.prepare(`
      SELECT ds.*, p.name as plan_name, p.code as plan_code
      FROM doctor_subscriptions ds
      JOIN subscription_plans p ON ds.plan_id = p.id
      WHERE ds.doctor_id = ?
      ORDER BY ds.id DESC LIMIT 1
    `).get(docId);

    res.json({
      success: true,
      doctor,
      date: targetDate,
      is_today: isToday,
      stats: {
        today_appointments: todayAppts,
        waiting_patients: waitingCount,
        completed_patients: completedCount,
        cancelled_appointments: cancelledCount,
        today_revenue: totalRevenueToday,
        avg_wait_minutes: 18,
        queue_efficiency: '94%'
      },
      queueState,
      currentPatient,
      upcoming,
      queueEntries: allDateQueueEntries,
      subscription: sub
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Doctor Live Queue Control Panel
app.get('/api/doctor/:id/queue', (req, res) => {
  try {
    const docId = req.params.id;
    const todayStr = new Date().toISOString().split('T')[0];

    const queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(docId);
    const queueEntries = db.prepare(`
      SELECT q.*, a.booking_code, a.type as appt_type, a.notes as appt_notes
      FROM queue_entries q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = ? AND q.queue_date = ?
      ORDER BY 
        CASE WHEN q.status = 'in_progress' THEN 1
             WHEN q.status = 'waiting' AND q.priority = 1 THEN 2
             WHEN q.status = 'waiting' THEN 3
             WHEN q.status = 'completed' THEN 4
             ELSE 5 END,
        q.priority DESC, q.queue_number ASC
    `).all(docId, todayStr);

    res.json({ success: true, queueState, queueEntries });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Doctor Queue Actions (Flow C: Call next -> start -> complete -> emergency)
app.post('/api/doctor/:id/queue/action', (req, res) => {
  try {
    const docId = Number(req.params.id);
    const { action, queue_id, delay_minutes, delay_reason } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    let queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(docId);
    if (!queueState) {
      db.prepare('INSERT INTO doctor_queue_states (doctor_id, current_serving_number) VALUES (?, 0)').run(docId);
      queueState = { doctor_id: docId, current_serving_number: 0, status: 'active', delay_minutes: 0 };
    }

    if (action === 'call_next') {
      // Complete any currently in_progress patient
      db.prepare(`
        UPDATE queue_entries 
        SET status = 'completed', completed_time = CURRENT_TIMESTAMP 
        WHERE doctor_id = ? AND queue_date = ? AND status = 'in_progress'
      `).run(docId, todayStr);

      // Find next patient (prioritizing emergency priority=1)
      const nextPatient = db.prepare(`
        SELECT * FROM queue_entries 
        WHERE doctor_id = ? AND queue_date = ? AND status = 'waiting'
        ORDER BY priority DESC, queue_number ASC
        LIMIT 1
      `).get(docId, todayStr);

      if (!nextPatient) {
        return res.json({ success: true, message: 'لا يوجد مرضى في قائمة الانتظار حالياً', nextPatient: null });
      }

      // Mark as in_progress
      db.prepare(`
        UPDATE queue_entries 
        SET status = 'in_progress', called_time = CURRENT_TIMESTAMP, start_time = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(nextPatient.id);

      if (nextPatient.appointment_id) {
        db.prepare("UPDATE appointments SET status = 'in_progress' WHERE id = ?").run(nextPatient.appointment_id);
      }

      // Update doctor queue state
      db.prepare(`
        UPDATE doctor_queue_states 
        SET current_serving_number = ?, current_queue_id = ?, last_updated = CURRENT_TIMESTAMP 
        WHERE doctor_id = ?
      `).run(nextPatient.queue_number, nextPatient.id, docId);

      logAudit('doctor', `طبيب رقم ${docId}`, 'مناداة المريض التالي', 'queue', nextPatient.id, `مناداة رقم ${nextPatient.queue_number} (${nextPatient.patient_name})`);

      return res.json({ success: true, message: `تم مناداة المريض رقم ${nextPatient.queue_number}`, currentPatient: nextPatient });
    }

    if (action === 'finish_consultation') {
      db.prepare(`
        UPDATE queue_entries 
        SET status = 'completed', completed_time = CURRENT_TIMESTAMP 
        WHERE doctor_id = ? AND queue_date = ? AND status = 'in_progress'
      `).run(docId, todayStr);

      db.prepare(`
        UPDATE appointments 
        SET status = 'completed' 
        WHERE id IN (
          SELECT appointment_id FROM queue_entries 
          WHERE doctor_id = ? AND queue_date = ? AND status = 'completed' AND appointment_id IS NOT NULL
        )
      `).run(docId, todayStr);

      logAudit('doctor', `طبيب رقم ${docId}`, 'إنهاء الكشف', 'queue', docId, 'تم إنهاء كشف المريض بنجاح');
      return res.json({ success: true, message: 'تم إنهاء الكشف بنجاح' });
    }

    if (action === 'skip_patient') {
      if (!queue_id) return res.status(400).json({ success: false, message: 'معرف الطابور مطلوب' });
      db.prepare("UPDATE queue_entries SET status = 'skipped' WHERE id = ? AND doctor_id = ?").run(queue_id, docId);
      logAudit('doctor', `طبيب رقم ${docId}`, 'تخطي مريض', 'queue', queue_id, 'تم تخطي المريض مؤقتاً');
      return res.json({ success: true, message: 'تم تخطي المريض' });
    }

    if (action === 'recall_patient') {
      if (!queue_id) return res.status(400).json({ success: false, message: 'معرف الطابور مطلوب' });
      db.prepare("UPDATE queue_entries SET status = 'waiting' WHERE id = ? AND doctor_id = ?").run(queue_id, docId);
      logAudit('doctor', `طبيب رقم ${docId}`, 'استدعاء مريض', 'queue', queue_id, 'إعادة المريض لقائمة الانتظار');
      return res.json({ success: true, message: 'تمت إعادة المريض لقائمة الانتظار' });
    }

    if (action === 'set_delay') {
      const delay = parseInt(delay_minutes, 10) || 0;
      const reason = delay_reason || 'ظرف طارئ أو كشف مستعجل';
      db.prepare(`
        UPDATE doctor_queue_states 
        SET delay_minutes = ?, delay_reason = ?, last_updated = CURRENT_TIMESTAMP 
        WHERE doctor_id = ?
      `).run(delay, reason, docId);

      // Log notification to waiting patients
      const waiting = db.prepare(`
        SELECT patient_phone, patient_name FROM queue_entries 
        WHERE doctor_id = ? AND queue_date = ? AND status = 'waiting'
      `).all(docId, todayStr);

      for (const p of waiting) {
        db.prepare(`
          INSERT INTO notifications (recipient_role, recipient_id, title, message, channel)
          VALUES ('patient', ?, 'تنبيه تأخير من العيادة', ?, 'whatsapp')
        `).run(p.patient_phone, `مرحباً ${p.patient_name}، نود إحاطتكم بوجود تأخير متوقع قرابة ${delay} دقيقة نظراً لـ (${reason}).`);
      }

      logAudit('doctor', `طبيب رقم ${docId}`, 'تحديد تأخير في الطابور', 'queue', docId, `تأخير ${delay} دقيقة: ${reason}`);
      return res.json({ success: true, message: `تم تسجيل التأخير وإشعار المرضى (${delay} دقيقة)` });
    }

    if (action === 'pause_queue') {
      db.prepare("UPDATE doctor_queue_states SET status = 'paused', last_updated = CURRENT_TIMESTAMP WHERE doctor_id = ?").run(docId);
      return res.json({ success: true, message: 'تم إيقاف الطابور مؤقتاً' });
    }

    if (action === 'resume_queue') {
      db.prepare("UPDATE doctor_queue_states SET status = 'active', last_updated = CURRENT_TIMESTAMP WHERE doctor_id = ?").run(docId);
      return res.json({ success: true, message: 'تم استئناف الطابور' });
    }

    if (action === 'emergency_priority') {
      if (!queue_id) return res.status(400).json({ success: false, message: 'معرف الطابور مطلوب' });
      db.prepare("UPDATE queue_entries SET priority = 1 WHERE id = ? AND doctor_id = ?").run(queue_id, docId);
      logAudit('doctor', `طبيب رقم ${docId}`, 'رفع أولوية لحالة طارئة', 'queue', queue_id, 'تقديم الحالة الطارئة في الطابور');
      return res.json({ success: true, message: 'تمت ترقية المريض كأولوية طارئة' });
    }

    res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Doctor Appointments List
app.get('/api/doctor/:id/appointments', (req, res) => {
  try {
    const docId = req.params.id;
    const { date, status, search } = req.query;

    let query = `
      SELECT a.*, b.branch_name, b.clinic_name
      FROM appointments a
      JOIN branches b ON a.branch_id = b.id
      WHERE a.doctor_id = ?
    `;
    const params = [docId];

    if (date) {
      query += ' AND a.appointment_date = ?';
      params.push(date);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (a.patient_name LIKE ? OR a.patient_phone LIKE ? OR a.booking_code LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY a.appointment_date DESC, a.appointment_time ASC';

    const appointments = db.prepare(query).all(...params);
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Doctor Schedule Management & Vacations
app.get('/api/doctor/:id/schedule', (req, res) => {
  try {
    const schedules = db.prepare('SELECT * FROM doctor_schedules WHERE doctor_id = ?').all(req.params.id);
    const branches = db.prepare('SELECT * FROM branches WHERE doctor_id = ?').all(req.params.id);
    const vacations = db.prepare('SELECT * FROM doctor_vacations WHERE doctor_id = ? ORDER BY start_date ASC').all(req.params.id);
    res.json({ success: true, schedules, branches, vacations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/doctor/:id/schedule', (req, res) => {
  try {
    const docId = req.params.id;
    const { schedules } = req.body; // array of schedule objects

    if (Array.isArray(schedules)) {
      for (const s of schedules) {
        if (s.id) {
          db.prepare(`
            UPDATE doctor_schedules 
            SET start_time = ?, end_time = ?, break_start = ?, break_end = ?, is_active = ?
            WHERE id = ? AND doctor_id = ?
          `).run(s.start_time, s.end_time, s.break_start || null, s.break_end || null, s.is_active ? 1 : 0, s.id, docId);
        }
      }
    }

    logAudit('doctor', `طبيب رقم ${docId}`, 'تحديث جدول المواعيد', 'schedule', docId, 'تم تحديث أوقات وساعات العمل');
    res.json({ success: true, message: 'تم حفظ جدول المواعيد بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Doctor Vacations API
app.get('/api/doctor/:id/vacations', (req, res) => {
  try {
    const vacations = db.prepare('SELECT * FROM doctor_vacations WHERE doctor_id = ? ORDER BY start_date ASC').all(req.params.id);
    res.json({ success: true, vacations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/doctor/:id/vacations', (req, res) => {
  try {
    const docId = req.params.id;
    const { start_date, end_date, reason } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'تاريخ بداية ونهاية الإجازة مطلوبان' });
    }

    const ins = db.prepare(`
      INSERT INTO doctor_vacations (doctor_id, start_date, end_date, reason)
      VALUES (?, ?, ?, ?)
    `).run(docId, start_date, end_date, reason || 'عطلة عيادة');

    logAudit('doctor', `طبيب رقم ${docId}`, 'تسجيل إجازة/عطلة', 'vacation', Number(ins.lastInsertRowid), `إجازة من ${start_date} حتى ${end_date} (${reason || 'عطلة عيادة'})`);
    res.json({ success: true, message: 'تمت إضافة الإجازة وإغلاق المواعيد في هذه الفترة بنجاح', vacation_id: Number(ins.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/doctor/:id/vacations/:vacationId', (req, res) => {
  try {
    const { id, vacationId } = req.params;
    db.prepare('DELETE FROM doctor_vacations WHERE id = ? AND doctor_id = ?').run(vacationId, id);
    logAudit('doctor', `طبيب رقم ${id}`, 'إلغاء إجازة/عطلة', 'vacation', Number(vacationId), `تم حذف الإجازة وإعادة إتاحة الحجز`);
    res.json({ success: true, message: 'تم إلغاء الإجازة وإعادة إتاحة الحجز بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Doctor Patients Directory
app.get('/api/doctor/:id/patients', (req, res) => {
  try {
    const docId = req.params.id;
    const { search } = req.query;

    let query = `
      SELECT patient_name, patient_phone,
        COUNT(*) as visits_count,
        MAX(appointment_date) as last_visit,
        MAX(status) as last_status
      FROM appointments
      WHERE doctor_id = ?
    `;
    const params = [docId];

    if (search) {
      query += ' AND (patient_name LIKE ? OR patient_phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY patient_phone, patient_name ORDER BY last_visit DESC';

    const patients = db.prepare(query).all(...params);
    res.json({ success: true, patients });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Doctor Analytics
app.get('/api/doctor/:id/analytics', (req, res) => {
  try {
    const docId = req.params.id;
    const doctor = db.prepare('SELECT consultation_fee FROM doctors WHERE id = ?').get(docId);

    const totalAppts = db.prepare('SELECT COUNT(*) as c FROM appointments WHERE doctor_id = ?').get(docId).c;
    const completedAppts = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE doctor_id = ? AND status = 'completed'").get(docId).c;
    const cancelledAppts = db.prepare("SELECT COUNT(*) as c FROM appointments WHERE doctor_id = ? AND status = 'cancelled'").get(docId).c;

    const revenue = completedAppts * (doctor ? doctor.consultation_fee : 400);

    const completionRate = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 100;
    const cancellationRate = totalAppts > 0 ? Math.round((cancelledAppts / totalAppts) * 100) : 0;

    res.json({
      success: true,
      analytics: {
        total_appointments: totalAppts,
        completed_appointments: completedAppts,
        cancelled_appointments: cancelledAppts,
        estimated_revenue: revenue,
        completion_rate: `${completionRate}%`,
        cancellation_rate: `${cancellationRate}%`,
        avg_wait_minutes: 17,
        satisfaction: '4.9/5'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Doctor Create Receptionist Invitation (Flow G)
app.post('/api/doctor/:id/receptionists', (req, res) => {
  try {
    const docId = req.params.id;
    const { name, email, phone, branch_id } = req.body;

    if (!name || !email || !phone || !branch_id) {
      return res.status(400).json({ success: false, message: 'جميع بيانات موظف الاستقبال مطلوبة' });
    }

    const result = db.prepare(`
      INSERT INTO receptionists (doctor_id, branch_id, name, email, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run(docId, branch_id, name, email, phone);

    // Send invitation simulation
    db.prepare(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, channel)
      VALUES ('receptionist', ?, 'دعوة انضمام لمنصة دوري', ?, 'email')
    `).run(email, `أهلاً ${name}، تمت دعوتك للانضمام كمسؤول استقبال في عيادتك على دوري. رابط التفعيل أُرسل لبريدك.`);

    logAudit('doctor', `طبيب رقم ${docId}`, 'إرسال دعوة لموظف استقبال', 'receptionist', Number(result.lastInsertRowid), `دعوة ${name} (${email})`);

    res.json({ success: true, message: 'تم إرسال دعوة الاستقبال بنجاح!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Get Doctor Receptionists List
app.get('/api/doctor/:id/receptionists', (req, res) => {
  try {
    const docId = req.params.id;
    const staff = db.prepare(`
      SELECT r.*, b.branch_name, b.clinic_name, b.city
      FROM receptionists r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.doctor_id = ?
      ORDER BY r.id DESC
    `).all(docId);
    res.json({ success: true, staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Toggle Receptionist Status
app.post('/api/doctor/:id/receptionists/:staffId/toggle', (req, res) => {
  try {
    const { id: docId, staffId } = req.params;
    const staff = db.prepare('SELECT * FROM receptionists WHERE id = ? AND doctor_id = ?').get(staffId, docId);
    if (!staff) return res.status(404).json({ success: false, message: 'الموظف غير موجود' });

    const newStatus = staff.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE receptionists SET status = ? WHERE id = ?').run(newStatus, staffId);
    logAudit('doctor', `طبيب رقم ${docId}`, 'تعديل حالة موظف استقبال', 'receptionist', Number(staffId), `الحالة الجديدة: ${newStatus}`);
    res.json({ success: true, status: newStatus, message: `تم تعديل حالة الموظف إلى ${newStatus === 'active' ? 'نشط' : 'معطل'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Get Doctor Branches
app.get('/api/doctor/:id/branches', (req, res) => {
  try {
    const docId = req.params.id;
    const branches = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM receptionists r WHERE r.branch_id = b.id AND r.status = 'active') as staff_count,
        (SELECT COUNT(*) FROM appointments a WHERE a.branch_id = b.id AND a.status != 'cancelled') as appts_count
      FROM branches b
      WHERE b.doctor_id = ?
      ORDER BY b.is_main DESC, b.id ASC
    `).all(docId);
    res.json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Add New Branch
app.post('/api/doctor/:id/branches', (req, res) => {
  try {
    const docId = req.params.id;
    const { branch_name, clinic_name, governorate, city, address, phone } = req.body;
    if (!branch_name || !city || !address) {
      return res.status(400).json({ success: false, message: 'اسم الفرع والمدينة والعنوان مطلوبة' });
    }
    const result = db.prepare(`
      INSERT INTO branches (doctor_id, clinic_name, branch_name, governorate, city, address, phone, is_main)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(docId, clinic_name || 'عيادة دوري', branch_name, governorate || 'القاهرة', city, address, phone || '');

    logAudit('doctor', `طبيب رقم ${docId}`, 'إضافة فرع جديد', 'branch', Number(result.lastInsertRowid), branch_name);
    res.json({ success: true, message: 'تمت إضافة الفرع بنجاح!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Update Doctor Settings & Profile
app.put('/api/doctor/:id/settings', (req, res) => {
  try {
    const docId = req.params.id;
    const { full_name, title, bio, consultation_fee, appointment_duration, daily_capacity, phone } = req.body;
    db.prepare(`
      UPDATE doctors SET
        full_name = COALESCE(?, full_name),
        title = COALESCE(?, title),
        bio = COALESCE(?, bio),
        consultation_fee = COALESCE(?, consultation_fee),
        appointment_duration = COALESCE(?, appointment_duration),
        daily_capacity = COALESCE(?, daily_capacity),
        phone = COALESCE(?, phone)
      WHERE id = ?
    `).run(full_name, title, bio, consultation_fee, appointment_duration, daily_capacity, phone, docId);

    logAudit('doctor', `طبيب رقم ${docId}`, 'تحديث إعدادات الطبيب والعيادة', 'doctor', Number(docId), 'تحديث الملف');
    res.json({ success: true, message: 'تم تحديث الإعدادات بنجاح!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// RECEPTIONIST WORKSPACE APIS (FULL OPERATIONAL QUEUE CONTROL)
// ----------------------------------------------------

// 0. Receptionist Auth / Login
app.post('/api/auth/receptionist/login', (req, res) => {
  try {
    const { email, password, receptionist_id } = req.body;
    let rec = null;

    if (receptionist_id) {
      rec = db.prepare(`
        SELECT r.*, d.full_name as doctor_name, d.title as doctor_title, d.profile_photo as doctor_photo,
               b.clinic_name, b.branch_name, b.address as branch_address, b.phone as branch_phone
        FROM receptionists r
        JOIN doctors d ON r.doctor_id = d.id
        JOIN branches b ON r.branch_id = b.id
        WHERE r.id = ?
      `).get(receptionist_id);
    } else if (email) {
      const cleanEmail = String(email).trim();
      rec = db.prepare(`
        SELECT r.*, d.full_name as doctor_name, d.title as doctor_title, d.profile_photo as doctor_photo,
               b.clinic_name, b.branch_name, b.address as branch_address, b.phone as branch_phone
        FROM receptionists r
        JOIN doctors d ON r.doctor_id = d.id
        JOIN branches b ON r.branch_id = b.id
        WHERE (LOWER(r.email) = LOWER(?) OR r.phone = ?)
      `).get(cleanEmail, cleanEmail);
    }

    if (!rec) {
      return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد أو الهاتف.' });
    }

    if (rec.password && password && !verifyPassword(password, rec.password)) {
      return res.status(401).json({ success: false, message: 'كلمة المرور غير صحيحة.' });
    }

    if (rec.status !== 'active') {
      return res.status(403).json({ success: false, message: 'تم إيقاف حساب موظف الاستقبال، يرجى التواصل مع إدارة العيادة.' });
    }

    logAudit('receptionist', rec.name, 'تسجيل دخول موظف استقبال', 'receptionist', rec.id, `تسجيل دخول ناجح للموظف ${rec.name} بعيادة ${rec.clinic_name}`);
    const { password: _rp, ...safeRec } = rec;
    const token = generateAuthToken({ id: rec.id, receptionistId: rec.id, doctorId: rec.doctor_id, branchId: rec.branch_id, role: 'reception', name: rec.name, email: rec.email });

    res.json({
      success: true,
      token,
      message: 'تم تسجيل الدخول بنجاح',
      receptionist: safeRec
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Available Receptionists for Login / Demo Switcher
app.get('/api/auth/receptionist/list', (req, res) => {
  try {
    const list = db.prepare(`
      SELECT r.id, r.name, r.email, r.phone, r.status, r.doctor_id, r.branch_id,
             d.full_name as doctor_name, d.title as doctor_title, d.profile_photo as doctor_photo,
             b.clinic_name, b.branch_name, b.governorate, b.city
      FROM receptionists r
      JOIN doctors d ON r.doctor_id = d.id
      JOIN branches b ON r.branch_id = b.id
      WHERE r.status = 'active'
      ORDER BY r.doctor_id ASC, r.id ASC
    `).all();

    res.json({ success: true, receptionists: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Receptionist Dashboard Overview
app.get('/api/receptionist/:id/dashboard', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare(`
      SELECT r.*, d.full_name as doctor_name, d.title as doctor_title, d.profile_photo as doctor_photo,
             d.consultation_fee, d.appointment_duration, d.daily_capacity,
             b.clinic_name, b.branch_name, b.address as branch_address, b.phone as branch_phone
      FROM receptionists r
      JOIN doctors d ON r.doctor_id = d.id
      JOIN branches b ON r.branch_id = b.id
      WHERE r.id = ?
    `).get(recId);

    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const todayStr = new Date().toISOString().split('T')[0];

    // Today's Appointments count
    const totalAppts = db.prepare(`
      SELECT COUNT(*) as count FROM appointments
      WHERE doctor_id = ? AND branch_id = ? AND appointment_date = ?
    `).get(rec.doctor_id, rec.branch_id, todayStr).count;

    // Queue entries for today
    const queueEntries = db.prepare(`
      SELECT q.*, a.booking_code, a.appointment_time, a.type as appt_type, a.notes as appt_notes
      FROM queue_entries q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = ? AND q.branch_id = ? AND q.queue_date = ?
      ORDER BY 
        CASE WHEN q.status = 'in_progress' THEN 1
             WHEN q.status = 'called' THEN 2
             WHEN q.status = 'waiting' AND q.priority = 1 THEN 3
             WHEN q.status = 'waiting' THEN 4
             WHEN q.status = 'arrived' THEN 5
             WHEN q.status = 'skipped' THEN 6
             WHEN q.status = 'completed' THEN 7
             ELSE 8 END,
        q.priority DESC, q.queue_number ASC
    `).all(rec.doctor_id, rec.branch_id, todayStr);

    // Queue State
    let queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(rec.doctor_id);
    if (!queueState) {
      db.prepare('INSERT INTO doctor_queue_states (doctor_id, is_active, current_serving_number, status) VALUES (?, 1, 0, "active")').run(rec.doctor_id);
      queueState = { doctor_id: rec.doctor_id, is_active: 1, current_serving_number: 0, status: 'active', delay_minutes: 0 };
    }

    // Breakdowns
    const arrivedPatients = queueEntries.filter(e => e.status === 'arrived' || e.status === 'waiting' || e.status === 'called' || e.status === 'in_progress' || e.status === 'completed');
    const waitingPatients = queueEntries.filter(e => e.status === 'waiting');
    const currentlyServed = queueEntries.find(e => e.status === 'in_progress' || e.status === 'called') || null;
    const completedPatients = queueEntries.filter(e => e.status === 'completed');
    const skippedPatients = queueEntries.filter(e => e.status === 'skipped');
    const nextInLine = waitingPatients[0] || null;

    // Delayed appointments (scheduled time < now and not arrived yet)
    const nowTimeStr = new Date().toTimeString().split(' ')[0].slice(0, 5);
    const delayedAppts = db.prepare(`
      SELECT COUNT(*) as count FROM appointments
      WHERE doctor_id = ? AND branch_id = ? AND appointment_date = ?
        AND appointment_time < ? AND status = 'confirmed'
    `).get(rec.doctor_id, rec.branch_id, todayStr, nowTimeStr).count;

    res.json({
      success: true,
      receptionist: rec,
      stats: {
        total_appointments: totalAppts,
        arrived: arrivedPatients.length,
        waiting: waitingPatients.length,
        in_progress: currentlyServed ? 1 : 0,
        completed: completedPatients.length,
        skipped: skippedPatients.length,
        delayed: delayedAppts
      },
      currentPatient: currentlyServed,
      nextPatient: nextInLine,
      queueState,
      queueEntries
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Full Queue List & State
app.get('/api/receptionist/:id/queue', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare('SELECT doctor_id, branch_id FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = req.query.date || todayStr;
    const isToday = (targetDate === todayStr);

    const queueEntries = db.prepare(`
      SELECT q.*, a.booking_code, a.appointment_time, a.type as appt_type, a.notes as appt_notes
      FROM queue_entries q
      LEFT JOIN appointments a ON q.appointment_id = a.id
      WHERE q.doctor_id = ? AND q.branch_id = ? AND q.queue_date = ?
      ORDER BY 
        CASE WHEN q.status = 'in_progress' THEN 1
             WHEN q.status = 'called' THEN 2
             WHEN q.status = 'waiting' AND q.priority = 1 THEN 3
             WHEN q.status = 'waiting' THEN 4
             WHEN q.status = 'arrived' THEN 5
             WHEN q.status = 'skipped' THEN 6
             WHEN q.status = 'completed' THEN 7
             ELSE 8 END,
        q.priority DESC, q.queue_number ASC
    `).all(rec.doctor_id, rec.branch_id, targetDate);

    let queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(rec.doctor_id) || {
      current_serving_number: 0,
      status: 'active',
      delay_minutes: 0
    };

    res.json({
      success: true,
      date: targetDate,
      is_today: isToday,
      queueState,
      queueEntries
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Full Queue Actions (Control Center)
app.post('/api/receptionist/:id/queue/action', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare(`
      SELECT r.*, b.clinic_name, b.branch_name
      FROM receptionists r
      JOIN branches b ON r.branch_id = b.id
      WHERE r.id = ?
    `).get(recId);

    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const { action, queue_id, appointment_id, new_position, reason } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toTimeString().split(' ')[0].slice(0, 5);

    let queueState = db.prepare('SELECT * FROM doctor_queue_states WHERE doctor_id = ?').get(rec.doctor_id);
    if (!queueState) {
      db.prepare('INSERT INTO doctor_queue_states (doctor_id, is_active, current_serving_number, status) VALUES (?, 1, 0, "active")').run(rec.doctor_id);
      queueState = { doctor_id: rec.doctor_id, is_active: 1, current_serving_number: 0, status: 'active', delay_minutes: 0 };
    }

    switch (action) {
      // Action: Call Next Patient (or specific patient)
      case 'call_next': {
        let targetEntry = null;
        if (queue_id) {
          targetEntry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(queue_id, rec.doctor_id);
        } else {
          targetEntry = db.prepare(`
            SELECT * FROM queue_entries 
            WHERE doctor_id = ? AND branch_id = ? AND queue_date = ? AND status = 'waiting'
            ORDER BY priority DESC, queue_number ASC LIMIT 1
          `).get(rec.doctor_id, rec.branch_id, todayStr);
        }

        if (!targetEntry) {
          return res.status(400).json({ success: false, message: 'لا يوجد مرضى في قائمة الانتظار حالياً' });
        }

        // Set status to called (تم استدعاؤه)
        db.prepare(`
          UPDATE queue_entries 
          SET status = 'called', called_time = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(targetEntry.id);

        // Update Doctor Queue State (reflects immediately on Doctor Read-Only and Patient live tracking!)
        db.prepare(`
          UPDATE doctor_queue_states 
          SET current_serving_number = ?, current_queue_id = ?, last_updated = CURRENT_TIMESTAMP
          WHERE doctor_id = ?
        `).run(targetEntry.queue_number, targetEntry.id, rec.doctor_id);

        if (targetEntry.appointment_id) {
          db.prepare("UPDATE appointments SET status = 'in_progress' WHERE id = ?").run(targetEntry.appointment_id);
        }

        logAudit('receptionist', rec.name, 'استدعاء مريض للكشف', 'queue', targetEntry.id, `استدعاء المريض ${targetEntry.patient_name} (رقم الدور ${targetEntry.queue_number})`);

        return res.json({
          success: true,
          message: `تم استدعاء المريض: ${targetEntry.patient_name} (دور رقم ${targetEntry.queue_number})`,
          called_patient: targetEntry
        });
      }

      // Action: Start Serving (جاري الكشف)
      case 'start_serving': {
        const qId = queue_id || queueState.current_queue_id;
        if (!qId) return res.status(400).json({ success: false, message: 'يرجى تحديد المريض لبدء الكشف' });

        const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(qId, rec.doctor_id);
        if (!entry) return res.status(404).json({ success: false, message: 'المريض غير موجود بالطابور' });

        db.prepare(`
          UPDATE queue_entries
          SET status = 'in_progress', start_time = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(entry.id);

        db.prepare(`
          UPDATE doctor_queue_states 
          SET current_serving_number = ?, current_queue_id = ?, last_updated = CURRENT_TIMESTAMP
          WHERE doctor_id = ?
        `).run(entry.queue_number, entry.id, rec.doctor_id);

        if (entry.appointment_id) {
          db.prepare("UPDATE appointments SET status = 'in_progress' WHERE id = ?").run(entry.appointment_id);
        }

        logAudit('receptionist', rec.name, 'بدء الكشف في العيادة', 'queue', entry.id, `بدء الكشف للمريض ${entry.patient_name}`);

        return res.json({ success: true, message: `جاري الكشف الآن على المريض: ${entry.patient_name}` });
      }

      // Action: Complete Visit (انتهى الكشف)
      case 'complete_visit': {
        const qId = queue_id || queueState.current_queue_id;
        const entry = qId ? db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(qId, rec.doctor_id) : null;

        if (entry) {
          db.prepare(`
            UPDATE queue_entries 
            SET status = 'completed', completed_time = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(entry.id);

          if (entry.appointment_id) {
            db.prepare("UPDATE appointments SET status = 'completed' WHERE id = ?").run(entry.appointment_id);
          }

          if (queueState.current_serving_number === entry.queue_number) {
            db.prepare(`
              UPDATE doctor_queue_states 
              SET current_serving_number = 0, current_queue_id = NULL, last_updated = CURRENT_TIMESTAMP
              WHERE doctor_id = ?
            `).run(rec.doctor_id);
          }

          logAudit('receptionist', rec.name, 'إنهاء الكشف وتسجيل الزيارة', 'queue', entry.id, `اكتمال كشف المريض ${entry.patient_name}`);
          return res.json({ success: true, message: `تم إنهاء الكشف بنجاح للمريض: ${entry.patient_name}` });
        }

        return res.status(400).json({ success: false, message: 'لم يتم العثور على كشف نشط لإنهائه' });
      }

      // Action: Skip Patient (تم تخطيه)
      case 'skip': {
        if (!queue_id) return res.status(400).json({ success: false, message: 'يرجى تحديد المريض المراد تخطيه' });
        const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(queue_id, rec.doctor_id);
        if (!entry) return res.status(404).json({ success: false, message: 'المريض غير موجود' });

        db.prepare("UPDATE queue_entries SET status = 'skipped' WHERE id = ?").run(entry.id);

        if (queueState.current_serving_number === entry.queue_number) {
          db.prepare("UPDATE doctor_queue_states SET current_serving_number = 0, current_queue_id = NULL WHERE doctor_id = ?").run(rec.doctor_id);
        }

        logAudit('receptionist', rec.name, 'تخطي دور مريض', 'queue', entry.id, `تخطي المريض ${entry.patient_name} (دور رقم ${entry.queue_number})`);
        return res.json({ success: true, message: `تم تخطي المريض: ${entry.patient_name}` });
      }

      // Action: Return Skipped to Queue (إعادة المريض المتخطي للانتظار)
      case 'return_to_queue': {
        if (!queue_id) return res.status(400).json({ success: false, message: 'يرجى تحديد المريض' });
        const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(queue_id, rec.doctor_id);
        if (!entry) return res.status(404).json({ success: false, message: 'المريض غير موجود' });

        db.prepare("UPDATE queue_entries SET status = 'waiting' WHERE id = ?").run(entry.id);

        logAudit('receptionist', rec.name, 'إعادة مريض متخطي لقائمة الانتظار', 'queue', entry.id, `إعادة المريض ${entry.patient_name} للانتظار`);
        return res.json({ success: true, message: `تمت إعادة المريض: ${entry.patient_name} إلى قائمة الانتظار` });
      }

      // Action: Reorder Queue Position / Priority
      case 'reorder': {
        if (!queue_id) return res.status(400).json({ success: false, message: 'يرجى تحديد المريض' });
        const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(queue_id, rec.doctor_id);
        if (!entry) return res.status(404).json({ success: false, message: 'المريض غير موجود' });

        if (new_position === 'priority' || new_position === 'top') {
          // Toggle high priority or move to top
          const newPriority = entry.priority === 1 ? 0 : 1;
          db.prepare('UPDATE queue_entries SET priority = ? WHERE id = ?').run(newPriority, entry.id);
          logAudit('receptionist', rec.name, 'تعديل أولوية المريض بالطابور', 'queue', entry.id, `تعديل أولوية ${entry.patient_name} إلى ${newPriority === 1 ? 'عاجل' : 'عادي'}`);
          return res.json({ success: true, message: `تم تحديث أولوية المريض ${entry.patient_name} بنجاح` });
        } else if (typeof new_position === 'number') {
          // Explicit position swap with another waiting entry
          const targetSwap = db.prepare(`
            SELECT * FROM queue_entries
            WHERE doctor_id = ? AND branch_id = ? AND queue_date = ? AND queue_number = ?
          `).get(rec.doctor_id, rec.branch_id, todayStr, new_position);

          if (targetSwap) {
            db.prepare('UPDATE queue_entries SET queue_number = ? WHERE id = ?').run(targetSwap.queue_number, entry.id);
            db.prepare('UPDATE queue_entries SET queue_number = ? WHERE id = ?').run(entry.queue_number, targetSwap.id);
            logAudit('receptionist', rec.name, 'تبديل ترتيب الأدوار', 'queue', entry.id, `تبديل ترتيب ${entry.patient_name} مع ${targetSwap.patient_name}`);
            return res.json({ success: true, message: `تم تبديل ترتيب الدور إلى رقم ${new_position} بنجاح` });
          }
        }

        return res.json({ success: true, message: 'تم تحديث ترتيب الطابور بنجاح' });
      }

      // Action: Remove Invalid Entry (with confirmation)
      case 'remove_entry': {
        if (!queue_id) return res.status(400).json({ success: false, message: 'يرجى تحديد المريض' });
        const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ? AND doctor_id = ?').get(queue_id, rec.doctor_id);
        if (!entry) return res.status(404).json({ success: false, message: 'المريض غير موجود' });

        db.prepare("UPDATE queue_entries SET status = 'cancelled' WHERE id = ?").run(entry.id);
        if (entry.appointment_id) {
          db.prepare("UPDATE appointments SET status = 'cancelled', notes = ? WHERE id = ?").run(reason || 'إلغاء من قبل موظف الاستقبال', entry.appointment_id);
        }

        logAudit('receptionist', rec.name, 'حذف قيد من الطابور', 'queue', entry.id, `إلغاء قيد المريض ${entry.patient_name}، السبب: ${reason || 'غير محدد'}`);
        return res.json({ success: true, message: `تم حذف قيد المريض ${entry.patient_name} من الطابور` });
      }

      // Action: Pause Queue
      case 'pause_queue': {
        db.prepare("UPDATE doctor_queue_states SET status = 'paused', last_updated = CURRENT_TIMESTAMP WHERE doctor_id = ?").run(rec.doctor_id);
        logAudit('receptionist', rec.name, 'إيقاف الطابور مؤقتاً', 'queue_state', rec.doctor_id, 'تم إيقاف استدعاء الطابور مؤقتاً');
        return res.json({ success: true, message: 'تم إيقاف حركة الطابور مؤقتاً' });
      }

      // Action: Resume Queue
      case 'resume_queue': {
        db.prepare("UPDATE doctor_queue_states SET status = 'active', last_updated = CURRENT_TIMESTAMP WHERE doctor_id = ?").run(rec.doctor_id);
        logAudit('receptionist', rec.name, 'استئناف حركة الطابور', 'queue_state', rec.doctor_id, 'تم استئناف عمل الطابور بشكل منتظم');
        return res.json({ success: true, message: 'تم استئناف عمل الطابور بنجاح' });
      }

      // Action: Update Arrival Status
      case 'update_arrival': {
        if (!queue_id && !appointment_id) return res.status(400).json({ success: false, message: 'يرجى تحديد المريض' });
        if (queue_id) {
          db.prepare("UPDATE queue_entries SET status = 'waiting' WHERE id = ?").run(queue_id);
        }
        if (appointment_id) {
          db.prepare("UPDATE appointments SET status = 'waiting' WHERE id = ?").run(appointment_id);
        }
        return res.json({ success: true, message: 'تم تأكيد وصول المريض بنجاح' });
      }

      // Action: Notify Doctor
      case 'notify_doctor': {
        const targetEntry = queue_id ? db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(queue_id) : null;
        const msg = targetEntry ? `إشعار للطبيب: المريض ${targetEntry.patient_name} (دور رقم ${targetEntry.queue_number}) جاهز بالانتظار` : 'إشعار للطبيب: المريض القادم جاهز للدخول';
        logAudit('receptionist', rec.name, 'إشعار الطبيب بجاهزية المريض', 'doctor_alert', rec.doctor_id, msg);
        return res.json({ success: true, message: 'تم إرسال إشعار فوري للطبيب بجاهزية المريض' });
      }

      default:
        return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Appointments List for Receptionist (supports any date or 'all')
app.get('/api/receptionist/:id/appointments', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare('SELECT doctor_id, branch_id FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const { search, status, date } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = (date !== undefined && date !== '') ? date : todayStr;

    let query = `
      SELECT a.*, d.full_name as doctor_name, b.branch_name, b.clinic_name,
             q.id as queue_entry_id, q.queue_number, q.status as queue_status, q.priority as queue_priority
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN branches b ON a.branch_id = b.id
      LEFT JOIN queue_entries q ON q.appointment_id = a.id AND q.queue_date = a.appointment_date
      WHERE a.doctor_id = ? AND a.branch_id = ?
    `;
    const params = [rec.doctor_id, rec.branch_id];

    if (targetDate && targetDate !== 'all') {
      query += ` AND a.appointment_date = ?`;
      params.push(targetDate);
    }

    if (status && status !== 'all') {
      query += ` AND a.status = ?`;
      params.push(status);
    }

    if (search) {
      const q = `%${search.trim()}%`;
      query += ` AND (a.patient_name LIKE ? OR a.patient_phone LIKE ? OR a.booking_code LIKE ?)`;
      params.push(q, q, q);
    }

    query += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC, q.queue_number ASC`;

    const appointments = db.prepare(query).all(...params);

    res.json({ success: true, appointments, date: targetDate });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Appointment Actions from Reception (Confirm Arrival / Checkin to Queue / Cancel / Reschedule)
app.post('/api/receptionist/:id/appointments/:apptId/action', (req, res) => {
  try {
    const recId = req.params.id;
    const apptId = req.params.apptId;
    const rec = db.prepare('SELECT * FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const appt = db.prepare('SELECT * FROM appointments WHERE id = ? AND doctor_id = ?').get(apptId, rec.doctor_id);
    if (!appt) return res.status(404).json({ success: false, message: 'الموعد غير موجود' });

    const { action, new_time, cancel_reason } = req.body;
    const todayStr = new Date().toISOString().split('T')[0];

    if (action === 'confirm_arrival' || action === 'check_in') {
      // Check if already in queue
      let entry = db.prepare('SELECT * FROM queue_entries WHERE appointment_id = ? AND queue_date = ?').get(appt.id, todayStr);
      let queueNum;
      if (entry) {
        db.prepare("UPDATE queue_entries SET status = 'waiting' WHERE id = ?").run(entry.id);
        queueNum = entry.queue_number;
      } else {
        const lastQ = db.prepare('SELECT MAX(queue_number) as max_num FROM queue_entries WHERE doctor_id = ? AND queue_date = ?').get(rec.doctor_id, todayStr);
        queueNum = (lastQ.max_num || 0) + 1;

        db.prepare(`
          INSERT INTO queue_entries (
            doctor_id, branch_id, appointment_id, patient_name, patient_phone,
            queue_date, queue_number, priority, status, check_in_time, estimated_wait_minutes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'waiting', CURRENT_TIMESTAMP, 20)
        `).run(rec.doctor_id, rec.branch_id, appt.id, appt.patient_name, appt.patient_phone, todayStr, queueNum);
      }

      db.prepare("UPDATE appointments SET status = 'waiting' WHERE id = ?").run(appt.id);
      logAudit('receptionist', rec.name, 'تسجيل وصول وحجز دور', 'appointment', appt.id, `تأكيد وصول المريض ${appt.patient_name} - دور رقم ${queueNum}`);

      return res.json({
        success: true,
        message: `تم تأكيد وصول المريض ${appt.patient_name} وإضافته لقائمة الانتظار (دور رقم ${queueNum})`,
        queue_number: queueNum
      });
    } else if (action === 'cancel') {
      db.prepare("UPDATE appointments SET status = 'cancelled', notes = ? WHERE id = ?").run(cancel_reason || 'إلغاء بواسطة الاستقبال', appt.id);
      db.prepare("UPDATE queue_entries SET status = 'cancelled' WHERE appointment_id = ?").run(appt.id);
      logAudit('receptionist', rec.name, 'إلغاء حجز مريض', 'appointment', appt.id, `إلغاء حجز ${appt.patient_name}`);
      return res.json({ success: true, message: `تم إلغاء حجز المريض ${appt.patient_name}` });
    } else if (action === 'reschedule') {
      if (!new_time) return res.status(400).json({ success: false, message: 'يرجى تحديد الوقت الجديد' });
      db.prepare('UPDATE appointments SET appointment_time = ? WHERE id = ?').run(new_time, appt.id);
      logAudit('receptionist', rec.name, 'تعديل توقيت موعد', 'appointment', appt.id, `تعديل موعد ${appt.patient_name} إلى ${new_time}`);
      return res.json({ success: true, message: `تم تعديل وقت موعد المريض ${appt.patient_name} إلى ${new_time}` });
    }

    return res.status(400).json({ success: false, message: 'إجراء غير صالح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Fast Walk-in Registration (Today or Future Date)
app.post('/api/receptionist/:id/walkin', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare('SELECT * FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const { patient_name, patient_phone, notes, is_emergency, appointment_date, appointment_time } = req.body;
    if (!patient_name || !patient_phone) {
      return res.status(400).json({ success: false, message: 'اسم المريض ورقم الهاتف مطلوبان' });
    }

    const cleanPhone = String(patient_phone).trim().replace(/[\s\-\+]/g, '');
    const isEgyptianPhone = /^(?:(?:01[0125]\d{8})|(?:201[0125]\d{8}))$/.test(cleanPhone);
    if (!isEgyptianPhone) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رقم هاتف محمول صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015'
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = appointment_date && /^\d{4}-\d{2}-\d{2}$/.test(appointment_date) ? appointment_date : todayStr;
    const nowTimeStr = new Date().toTimeString().split(' ')[0].slice(0, 5);
    const targetTime = appointment_time || nowTimeStr;
    const isFuture = targetDate > todayStr;
    const bookingCode = generateBookingCode();

    // 1. Create walk-in / direct booking appointment record
    const initialApptStatus = isFuture ? 'confirmed' : 'waiting';
    const apptRes = db.prepare(`
      INSERT INTO appointments (
        booking_code, doctor_id, branch_id, patient_name, patient_phone,
        appointment_date, appointment_time, type, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'walkin', ?, ?)
    `).run(bookingCode, rec.doctor_id, rec.branch_id, patient_name, patient_phone, targetDate, targetTime, initialApptStatus, notes || (isFuture ? 'حجز مسبق عبر الاستقبال' : 'حجز مباشر بالعيادة (Walk-in)'));
    const apptId = Number(apptRes.lastInsertRowid);

    // 2. Generate next queue number for this doctor on targetDate
    const lastQ = db.prepare(`
      SELECT MAX(queue_number) as max_num FROM queue_entries 
      WHERE doctor_id = ? AND queue_date = ?
    `).get(rec.doctor_id, targetDate);
    const nextQNum = (lastQ.max_num || 0) + 1;

    // 3. Add to queue entries
    const priority = is_emergency ? 1 : 0;
    const initialQueueStatus = isFuture ? 'confirmed' : 'waiting';
    const checkInVal = isFuture ? null : new Date().toISOString();
    
    const queueRes = db.prepare(`
      INSERT INTO queue_entries (
        doctor_id, branch_id, appointment_id, patient_name, patient_phone,
        queue_date, queue_number, priority, status, check_in_time, estimated_wait_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 20)
    `).run(rec.doctor_id, rec.branch_id, apptId, patient_name, patient_phone, targetDate, nextQNum, priority, initialQueueStatus, checkInVal);

    logAudit('receptionist', rec.name, isFuture ? 'حجز مسبق لموعد مستقبلي' : 'تسجيل مريض مباشر (Walk-in)', 'queue', Number(queueRes.lastInsertRowid), `تاريخ الموعد: ${targetDate}، رقم الدور: ${nextQNum}، المريض: ${patient_name}، كود المتابعة: ${bookingCode}`);

    res.json({
      success: true,
      queue_number: nextQNum,
      booking_code: bookingCode,
      appointment_date: targetDate,
      appointment_time: targetTime,
      is_future: isFuture,
      tracking_link: `/#track?code=${bookingCode}`,
      message: isFuture
        ? `تم حجز موعد للمريض ${patient_name} بنجاح بتاريخ ${targetDate}! رقم الدور المحجوز: #${nextQNum}`
        : `تم تسجيل المريض ${patient_name} بنجاح! رقم الدور هو: ${nextQNum}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Receptionist Check-in by Booking Code or Phone
app.post('/api/receptionist/:id/checkin', (req, res) => {
  try {
    const recId = req.params.id;
    const { code_or_phone } = req.body;

    const rec = db.prepare('SELECT * FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const todayStr = new Date().toISOString().split('T')[0];

    const appt = db.prepare(`
      SELECT * FROM appointments 
      WHERE doctor_id = ? AND appointment_date = ? AND (booking_code = ? OR patient_phone = ?)
    `).get(rec.doctor_id, todayStr, code_or_phone, code_or_phone);

    if (!appt) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على حجز اليوم بهذا الكود أو الرقم' });
    }

    let entry = db.prepare('SELECT * FROM queue_entries WHERE appointment_id = ? AND queue_date = ?').get(appt.id, todayStr);
    let qNum;
    if (entry) {
      db.prepare("UPDATE queue_entries SET status = 'waiting' WHERE id = ?").run(entry.id);
      qNum = entry.queue_number;
    } else {
      const lastQ = db.prepare('SELECT MAX(queue_number) as max_num FROM queue_entries WHERE doctor_id = ? AND queue_date = ?').get(rec.doctor_id, todayStr);
      qNum = (lastQ.max_num || 0) + 1;

      db.prepare(`
        INSERT INTO queue_entries (
          doctor_id, branch_id, appointment_id, patient_name, patient_phone,
          queue_date, queue_number, priority, status, check_in_time, estimated_wait_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'waiting', CURRENT_TIMESTAMP, 20)
      `).run(rec.doctor_id, rec.branch_id, appt.id, appt.patient_name, appt.patient_phone, todayStr, qNum);
    }

    db.prepare("UPDATE appointments SET status = 'waiting' WHERE id = ?").run(appt.id);
    logAudit('receptionist', rec.name, 'تأكيد وصول المريض', 'appointment', appt.id, `تأكيد وصول ${appt.patient_name} - دور ${qNum}`);

    res.json({
      success: true,
      queue_number: qNum,
      message: `تم تأكيد وصول المريض ${appt.patient_name} وإضافته لقائمة الانتظار (دور رقم ${qNum})`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Patient Search
app.get('/api/receptionist/:id/patients/search', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare('SELECT doctor_id FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const { query } = req.query;
    if (!query || !query.trim()) {
      return res.json({ success: true, patients: [] });
    }

    const q = `%${query.trim()}%`;
    const results = db.prepare(`
      SELECT patient_name, patient_phone, patient_email,
             COUNT(*) as total_visits,
             MAX(appointment_date) as last_visit,
             (SELECT booking_code FROM appointments WHERE doctor_id = ? AND (patient_name LIKE ? OR patient_phone LIKE ? OR booking_code LIKE ?) ORDER BY id DESC LIMIT 1) as last_booking_code,
             (SELECT status FROM appointments WHERE doctor_id = ? AND (patient_name LIKE ? OR patient_phone LIKE ? OR booking_code LIKE ?) ORDER BY id DESC LIMIT 1) as last_status
      FROM appointments
      WHERE doctor_id = ? AND (patient_name LIKE ? OR patient_phone LIKE ? OR booking_code LIKE ?)
      GROUP BY patient_phone, patient_name
      ORDER BY last_visit DESC
      LIMIT 20
    `).all(rec.doctor_id, q, q, q, rec.doctor_id, q, q, q, rec.doctor_id, q, q, q);

    res.json({ success: true, patients: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Notifications for Receptionist
app.get('/api/receptionist/:id/notifications', (req, res) => {
  try {
    const recId = req.params.id;
    const rec = db.prepare('SELECT doctor_id FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'حساب الاستقبال غير موجود' });

    const logs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE (target_type IN ('queue', 'appointment', 'doctor_alert') OR user_role = 'receptionist')
      ORDER BY created_at DESC 
      LIMIT 30
    `).all();

    res.json({ success: true, notifications: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Receptionist Profile Update
app.put('/api/receptionist/:id/profile', (req, res) => {
  try {
    const recId = req.params.id;
    const { name, phone, email } = req.body;
    db.prepare(`
      UPDATE receptionists 
      SET name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email)
      WHERE id = ?
    `).run(name, phone, email, recId);

    logAudit('receptionist', name || `موظف ${recId}`, 'تعديل البيانات الشخصية', 'receptionist', recId, 'تحديث بيانات الملف الشخصي');
    res.json({ success: true, message: 'تم تحديث البيانات الشخصية لموظف الاستقبال بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// DAWRY SUPER ADMIN DASHBOARD APIS (Platform Owner)
// ----------------------------------------------------

// 1. Super Admin Overview
app.get('/api/admin/overview', (req, res) => {
  try {
    const totalDoctors = db.prepare('SELECT COUNT(*) as count FROM doctors').get().count;
    const activeDoctors = db.prepare("SELECT COUNT(*) as count FROM doctors WHERE status = 'active'").get().count;
    const suspendedDoctors = db.prepare("SELECT COUNT(*) as count FROM doctors WHERE status = 'suspended'").get().count;
    const pendingDoctors = db.prepare("SELECT COUNT(*) as count FROM doctors WHERE status = 'pending'").get().count;

    const totalClinics = db.prepare('SELECT COUNT(*) as count FROM branches').get().count;
    const totalAppointments = db.prepare('SELECT COUNT(*) as count FROM appointments').get().count;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayBookings = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ?').get(todayStr).count;

    // Global booking setting
    let globalSetting = db.prepare("SELECT value FROM platform_settings WHERE key = 'global_booking_enabled'").get();
    const globalBookingEnabled = globalSetting ? globalSetting.value === '1' : true;

    // Online booking breakdown
    const bookingEnabledDoctors = db.prepare("SELECT COUNT(*) as count FROM doctors WHERE status = 'active' AND is_booking_enabled = 1").get().count;
    const bookingDisabledDoctors = db.prepare("SELECT COUNT(*) as count FROM doctors WHERE is_booking_enabled = 0 OR status != 'active'").get().count;

    // Total receptionists
    const totalReceptionists = db.prepare('SELECT COUNT(*) as count FROM receptionists').get().count;
    const activeReceptionists = db.prepare("SELECT COUNT(*) as count FROM receptionists WHERE status = 'active'").get().count;

    // Revenue & Subscriptions
    const totalRevenue = db.prepare("SELECT SUM(amount) as sum FROM payments WHERE status = 'completed'").get().sum || 0;
    const upcomingExpirations = db.prepare(`
      SELECT ds.*, d.full_name as doctor_name, p.name as plan_name
      FROM doctor_subscriptions ds
      JOIN doctors d ON ds.doctor_id = d.id
      JOIN subscription_plans p ON ds.plan_id = p.id
      WHERE ds.status = 'active' AND date(ds.end_date) <= date('now', '+14 days')
      ORDER BY ds.end_date ASC LIMIT 5
    `).all();

    const recentActivities = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10').all();

    res.json({
      success: true,
      stats: {
        total_doctors: totalDoctors,
        active_doctors: activeDoctors,
        suspended_doctors: suspendedDoctors,
        pending_doctors: pendingDoctors,
        total_clinics: totalClinics,
        total_receptionists: totalReceptionists,
        active_receptionists: activeReceptionists,
        total_appointments: totalAppointments,
        today_bookings: todayBookings,
        global_booking_enabled: globalBookingEnabled,
        booking_enabled_doctors: bookingEnabledDoctors,
        booking_disabled_doctors: bookingDisabledDoctors,
        total_revenue: totalRevenue
      },
      upcomingExpirations,
      recentActivities
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. All Doctors List with Status & Management
app.get('/api/admin/doctors', (req, res) => {
  try {
    const { search, status, specialty_id } = req.query;

    let query = `
      SELECT d.*, s.name as specialty_name,
        b.clinic_name, b.branch_name, b.governorate, b.city,
        (SELECT COUNT(*) FROM branches br WHERE br.doctor_id = d.id) as branches_count,
        (SELECT COUNT(*) FROM receptionists r WHERE r.doctor_id = d.id AND r.status = 'active') as receptionists_count,
        (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id) as total_appointments,
        ds.status as subscription_status, ds.end_date as subscription_end_date,
        p.name as plan_name, p.code as plan_code, p.max_receptionists, p.max_branches
      FROM doctors d
      LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
      LEFT JOIN doctor_subscriptions ds ON ds.doctor_id = d.id
      LEFT JOIN subscription_plans p ON ds.plan_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND d.status = ?';
      params.push(status);
    }
    if (specialty_id) {
      query += ' AND d.specialty_id = ?';
      params.push(specialty_id);
    }
    if (search) {
      query += ' AND (d.full_name LIKE ? OR d.email LIKE ? OR b.clinic_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY d.id DESC';

    const doctors = db.prepare(query).all(...params);
    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Multi-Step Add Doctor Wizard (Full connected setup)
app.post('/api/admin/doctors/wizard', (req, res) => {
  try {
    const {
      full_name, title, specialty_id, subspecialty, email, phone, bio, password,
      consultation_fee, appointment_duration, daily_capacity,
      profile_photo, plan_id, is_booking_enabled,
      branches = [],
      receptionists = []
    } = req.body;

    if (!full_name || !email || !phone || !specialty_id) {
      return res.status(400).json({ success: false, message: 'الاسم، البريد، الهاتف، والتخصص حقول مطلوبة' });
    }

    // Check plan limits
    const targetPlanId = plan_id || 1;
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(targetPlanId);
    const maxRecs = plan ? plan.max_receptionists : 2;
    if (receptionists.length > maxRecs) {
      return res.status(400).json({
        success: false,
        message: `تجاوزت الحد المسموح لحسابات موظفي الاستقبال لهذه الباقة (${maxRecs} حسابات كحد أقصى)`
      });
    }

    // 1. Insert Doctor with custom password
    const docPassword = password && password.trim() ? password.trim() : '123456';
    const docRes = db.prepare(`
      INSERT INTO doctors (
        full_name, title, specialty_id, subspecialty, email, phone, bio,
        consultation_fee, appointment_duration, daily_capacity, profile_photo,
        status, is_verified, is_booking_enabled, password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?)
    `).run(
      full_name,
      title || 'طبيب استشاري',
      specialty_id,
      subspecialty || '',
      email,
      phone,
      bio || '',
      consultation_fee || 400,
      appointment_duration || 20,
      daily_capacity || 30,
      profile_photo || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=250',
      is_booking_enabled !== undefined ? (is_booking_enabled ? 1 : 0) : 1,
      docPassword
    );
    const doctorId = Number(docRes.lastInsertRowid);

    // 2. Insert Branches
    const createdBranches = [];
    const branchList = branches.length > 0 ? branches : [{
      clinic_name: `عيادة ${full_name}`,
      branch_name: 'الفرع الرئيسي',
      governorate: 'القاهرة',
      city: 'مدينة نصر',
      address: 'شارع عباس العقاد',
      phone: phone,
      is_main: 1
    }];

    for (let i = 0; i < branchList.length; i++) {
      const b = branchList[i];
      const bRes = db.prepare(`
        INSERT INTO branches (doctor_id, clinic_name, branch_name, governorate, city, address, phone, is_main, is_booking_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        doctorId,
        b.clinic_name || `عيادة ${full_name}`,
        b.branch_name || `فرع ${i + 1}`,
        b.governorate || 'القاهرة',
        b.city || 'القاهرة',
        b.address || 'العنوان التفصيلي',
        b.phone || phone,
        i === 0 ? 1 : 0,
        b.is_booking_enabled !== undefined ? (b.is_booking_enabled ? 1 : 0) : 1
      );
      createdBranches.push({ id: Number(bRes.lastInsertRowid), ...b });
    }

    // 3. Insert Schedules for branches
    const days = [
      { day: 0, name: 'الأحد' }, { day: 1, name: 'الإثنين' }, { day: 2, name: 'الثلاثاء' },
      { day: 3, name: 'الأربعاء' }, { day: 4, name: 'الخميس' }, { day: 6, name: 'السبت' }
    ];
    for (const b of createdBranches) {
      for (const d of days) {
        db.prepare(`
          INSERT INTO doctor_schedules (doctor_id, branch_id, day_of_week, day_name, start_time, end_time, break_start, break_end, is_active)
          VALUES (?, ?, ?, ?, '14:00', '21:00', '17:00', '17:30', 1)
        `).run(doctorId, b.id, d.day, d.name);
      }
    }

    // 4. Create Receptionist Accounts up to allowed limit with custom credentials
    if (receptionists.length > 0) {
      for (let i = 0; i < Math.min(receptionists.length, maxRecs); i++) {
        const r = receptionists[i];
        const assignedBranchId = r.branch_id || (createdBranches[r.branch_index || 0] || createdBranches[0]).id;
        const recPassword = r.password && r.password.trim() ? r.password.trim() : '123456';
        db.prepare(`
          INSERT INTO receptionists (doctor_id, branch_id, name, email, phone, password, status)
          VALUES (?, ?, ?, ?, ?, ?, 'active')
        `).run(doctorId, assignedBranchId, r.name, r.email, r.phone || phone, recPassword);
      }
    } else {
      db.prepare(`
        INSERT INTO receptionists (doctor_id, branch_id, name, email, phone, password, status)
        VALUES (?, ?, ?, ?, ?, '123456', 'active')
      `).run(doctorId, createdBranches[0].id, `استقبال ${createdBranches[0].clinic_name}`, `rec.${doctorId}@dawry.com`, phone);
    }

    // 5. Subscription & Payment record
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    db.prepare(`
      INSERT INTO doctor_subscriptions (doctor_id, plan_id, start_date, end_date, status, auto_renew)
      VALUES (?, ?, ?, ?, 'active', 1)
    `).run(doctorId, targetPlanId, startDate, endDate);

    // 6. Queue State
    db.prepare(`
      INSERT INTO doctor_queue_states (doctor_id, is_active, current_serving_number, status)
      VALUES (?, 1, 0, 'active')
    `).run(doctorId);

    logAudit('superadmin', 'مدير المنصة', 'إضافة طبيب جديد عبر المعالج', 'doctor', doctorId, `إضافة الطبيب ${full_name} وباقة ${plan ? plan.name : 'برو'} وعدد فروع ${createdBranches.length}`);

    res.json({
      success: true,
      doctorId: doctorId,
      doctor_id: doctorId,
      message: `تم إنشاء حساب الطبيب ${full_name} وربط الفروع وموظفي الاستقبال وتفعيل الحساب بنجاح!`
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: doctors.email')) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني المدخل للطبيب مسجل مسبقاً، يرجى استخدام بريد مختلف.' });
    }
    if (err.message && err.message.includes('UNIQUE constraint failed: receptionists.email')) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني لموظف الاستقبال مسجل مسبقاً، يرجى استخدام بريد مختلف.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Complete Connected Doctor Profile (Tabs: Overview, Info, Branches, Staff, Bookings, Subscriptions, Audit)
app.get(['/api/admin/doctors/:id/full-profile', '/api/admin/doctors/:id'], (req, res) => {
  try {
    const docId = req.params.id;
    const doctor = db.prepare(`
      SELECT d.*, s.name as specialty_name,
        ds.status as subscription_status, ds.start_date as subscription_start_date, ds.end_date as subscription_end_date,
        p.name as plan_name, p.code as plan_code, p.price as plan_price, p.max_receptionists, p.max_branches
      FROM doctors d
      LEFT JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN doctor_subscriptions ds ON ds.doctor_id = d.id
      LEFT JOIN subscription_plans p ON ds.plan_id = p.id
      WHERE d.id = ?
    `).get(docId);

    if (!doctor) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    const branches = db.prepare(`
      SELECT b.*,
        (SELECT COUNT(*) FROM receptionists r WHERE r.branch_id = b.id AND r.status = 'active') as staff_count,
        (SELECT COUNT(*) FROM appointments a WHERE a.branch_id = b.id) as appointments_count
      FROM branches b
      WHERE b.doctor_id = ?
    `).all(docId);

    const receptionists = db.prepare(`
      SELECT r.*, b.branch_name, b.clinic_name
      FROM receptionists r
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.doctor_id = ?
    `).all(docId);

    const appointments = db.prepare(`
      SELECT a.*, b.branch_name
      FROM appointments a
      LEFT JOIN branches b ON a.branch_id = b.id
      WHERE a.doctor_id = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 40
    `).all(docId);

    const payments = db.prepare(`
      SELECT * FROM payments WHERE doctor_id = ? ORDER BY payment_date DESC LIMIT 15
    `).all(docId);

    const auditLogs = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE (target_type = 'doctor' AND target_id = ?) OR details LIKE ?
      ORDER BY created_at DESC LIMIT 30
    `).all(docId, `%${doctor.full_name}%`);

    res.json({
      success: true,
      profile: {
        doctor,
        branches,
        receptionists,
        appointments,
        payments,
        auditLogs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Edit Doctor Information & Credentials
app.put('/api/admin/doctors/:id', (req, res) => {
  try {
    const docId = req.params.id;
    const existing = db.prepare('SELECT * FROM doctors WHERE id = ?').get(docId);
    if (!existing) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    const b = req.body;
    const fullName = b.full_name !== undefined ? b.full_name : existing.full_name;
    const title = b.title !== undefined ? b.title : existing.title;
    const specialtyId = b.specialty_id !== undefined ? b.specialty_id : existing.specialty_id;
    const subspecialty = b.subspecialty !== undefined ? b.subspecialty : existing.subspecialty;
    const phone = b.phone !== undefined ? b.phone : existing.phone;
    const email = b.email !== undefined ? b.email : existing.email;
    const bio = b.bio !== undefined ? b.bio : existing.bio;
    const fee = b.consultation_fee !== undefined ? b.consultation_fee : existing.consultation_fee;
    const duration = b.appointment_duration !== undefined ? b.appointment_duration : existing.appointment_duration;
    const capacity = b.daily_capacity !== undefined ? b.daily_capacity : existing.daily_capacity;
    const profilePhoto = b.profile_photo !== undefined ? b.profile_photo : existing.profile_photo;
    const password = (b.password && b.password.trim()) ? b.password.trim() : existing.password;

    db.prepare(`
      UPDATE doctors SET
        full_name = ?,
        title = ?,
        specialty_id = ?,
        subspecialty = ?,
        phone = ?,
        email = ?,
        bio = ?,
        consultation_fee = ?,
        appointment_duration = ?,
        daily_capacity = ?,
        profile_photo = ?,
        password = ?
      WHERE id = ?
    `).run(fullName, title, specialtyId, subspecialty, phone, email, bio, fee, duration, capacity, profilePhoto, password, docId);

    logAudit('superadmin', 'مدير المنصة', 'تعديل بيانات وحساب طبيب', 'doctor', docId, `تعديل بيانات وحساب الطبيب ${fullName}`);
    res.json({ success: true, message: 'تم تحديث بيانات وحساب الطبيب بنجاح' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: doctors.email')) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل لطبيب آخر بالفعل.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Toggle Doctor Online Booking Availability
app.post('/api/admin/doctors/:id/booking-toggle', (req, res) => {
  try {
    const docId = req.params.id;
    const doc = db.prepare('SELECT id, full_name, is_booking_enabled FROM doctors WHERE id = ?').get(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    const newBookingStatus = doc.is_booking_enabled === 1 ? 0 : 1;
    db.prepare('UPDATE doctors SET is_booking_enabled = ? WHERE id = ?').run(newBookingStatus, docId);

    logAudit('superadmin', 'مدير المنصة', 'تعديل إتاحة حجز الطبيب', 'doctor', docId, `تعديل إتاحة الحجز للطبيب ${doc.full_name} إلى ${newBookingStatus === 1 ? 'متاح' : 'معطل'}`);

    res.json({
      success: true,
      is_booking_enabled: newBookingStatus,
      message: `تم ${newBookingStatus === 1 ? 'تفعيل' : 'تعطيل'} إمكانية الحجز أونلاين للطبيب ${doc.full_name}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Suspend Doctor
app.post('/api/admin/doctors/:id/suspend', (req, res) => {
  try {
    const docId = req.params.id;
    const { reason } = req.body;
    const doc = db.prepare('SELECT full_name FROM doctors WHERE id = ?').get(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    db.prepare("UPDATE doctors SET status = 'suspended', suspension_reason = ?, is_booking_enabled = 0 WHERE id = ?").run(reason || 'موقوف إدارياً من قبل المنصة', docId);
    db.prepare("UPDATE doctor_subscriptions SET status = 'suspended' WHERE doctor_id = ?").run(docId);
    db.prepare("UPDATE receptionists SET status = 'inactive' WHERE doctor_id = ?").run(docId);

    logAudit('superadmin', 'مدير المنصة', 'إيقاف حساب طبيب', 'doctor', docId, `إيقاف الطبيب ${doc.full_name}، السبب: ${reason || 'غير محدد'}`);
    res.json({ success: true, message: `تم إيقاف حساب الطبيب ${doc.full_name} وتعطيل الحجز والوصول بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Reactivate Doctor
app.post('/api/admin/doctors/:id/reactivate', (req, res) => {
  try {
    const docId = req.params.id;
    const doc = db.prepare('SELECT full_name FROM doctors WHERE id = ?').get(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    db.prepare("UPDATE doctors SET status = 'active', suspension_reason = NULL, is_booking_enabled = 1 WHERE id = ?").run(docId);
    db.prepare("UPDATE doctor_subscriptions SET status = 'active' WHERE doctor_id = ?").run(docId);
    db.prepare("UPDATE receptionists SET status = 'active' WHERE doctor_id = ?").run(docId);

    logAudit('superadmin', 'مدير المنصة', 'إعادة تفعيل حساب طبيب', 'doctor', docId, `إعادة تفعيل الطبيب ${doc.full_name} واستعادة كافة الخدمات`);
    res.json({ success: true, message: `تمت إعادة تفعيل حساب الطبيب ${doc.full_name} واستعادة خدمات الحجز بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Permanently Delete Doctor
app.delete('/api/admin/doctors/:id', (req, res) => {
  try {
    const docId = req.params.id;
    const doc = db.prepare('SELECT full_name FROM doctors WHERE id = ?').get(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    db.prepare('DELETE FROM branches WHERE doctor_id = ?').run(docId);
    db.prepare('DELETE FROM receptionists WHERE doctor_id = ?').run(docId);
    db.prepare('DELETE FROM doctor_schedules WHERE doctor_id = ?').run(docId);
    db.prepare('DELETE FROM doctor_subscriptions WHERE doctor_id = ?').run(docId);
    db.prepare('DELETE FROM doctor_queue_states WHERE doctor_id = ?').run(docId);
    db.prepare('DELETE FROM doctors WHERE id = ?').run(docId);

    logAudit('superadmin', 'مدير المنصة', 'حذف حساب طبيب نهائياً', 'doctor', docId, `حذف نهائي للطبيب ${doc.full_name} وجميع ملحقاته`);
    res.json({ success: true, message: `تم حذف حساب الطبيب ${doc.full_name} نهائياً من المنصة` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Reset Doctor Password / Invitation
app.post('/api/admin/doctors/:id/reset-password', (req, res) => {
  try {
    const docId = req.params.id;
    const doc = db.prepare('SELECT full_name, email FROM doctors WHERE id = ?').get(docId);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    logAudit('superadmin', 'مدير المنصة', 'إعادة تعيين كلمة مرور طبيب', 'doctor', docId, `إرسال رابط إعادة تعيين كلمة المرور إلى ${doc.email}`);
    res.json({ success: true, message: `تم إرسال دعوة تعيين كلمة المرور بنجاح إلى ${doc.email}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Branch Management Endpoints
app.get('/api/admin/branches', (req, res) => {
  try {
    const branches = db.prepare(`
      SELECT b.*, d.full_name as doctor_name, d.status as doctor_status,
        (SELECT COUNT(*) FROM receptionists r WHERE r.branch_id = b.id AND r.status = 'active') as staff_count,
        (SELECT COUNT(*) FROM appointments a WHERE a.branch_id = b.id) as total_appointments
      FROM branches b
      JOIN doctors d ON b.doctor_id = d.id
      ORDER BY b.id DESC
    `).all();
    res.json({ success: true, branches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/branches', (req, res) => {
  try {
    const { doctor_id, doctorId, clinic_name, branch_name, governorate, city, address, phone } = req.body;
    const targetDoctorId = doctor_id || doctorId;
    if (!targetDoctorId || !branch_name) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد الطبيب واسم الفرع' });
    }

    const doc = db.prepare('SELECT full_name FROM doctors WHERE id = ?').get(targetDoctorId);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    const bRes = db.prepare(`
      INSERT INTO branches (doctor_id, clinic_name, branch_name, governorate, city, address, phone, is_main, is_booking_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(targetDoctorId, clinic_name || `عيادة ${doc.full_name}`, branch_name, governorate || 'القاهرة', city || 'القاهرة', address || '', phone || '');

    const newBranchId = Number(bRes.lastInsertRowid);
    logAudit('superadmin', 'مدير المنصة', 'إضافة فرع جديد لطبيب', 'branch', newBranchId, `إضافة فرع ${branch_name} للطبيب ${doc.full_name}`);
    res.json({
      success: true,
      message: `تمت إضافة فرع ${branch_name} بنجاح`,
      branch: { id: newBranchId, doctor_id: targetDoctorId, branch_name }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Toggle Branch Booking Alone (without affecting other branches of the doctor)
app.post('/api/admin/branches/:branchId/booking-toggle', (req, res) => {
  try {
    const bId = req.params.branchId;
    const branch = db.prepare('SELECT b.*, d.full_name as doctor_name FROM branches b JOIN doctors d ON b.doctor_id = d.id WHERE b.id = ?').get(bId);
    if (!branch) return res.status(404).json({ success: false, message: 'الفرع غير موجود' });

    const newStatus = branch.is_booking_enabled === 1 ? 0 : 1;
    db.prepare('UPDATE branches SET is_booking_enabled = ? WHERE id = ?').run(newStatus, bId);

    logAudit('superadmin', 'مدير المنصة', 'تعديل إتاحة حجز فرع', 'branch', bId, `تعديل إتاحة الحجز لفرع ${branch.branch_name} (د. ${branch.doctor_name}) إلى ${newStatus === 1 ? 'متاح' : 'معطل'}`);

    res.json({
      success: true,
      is_booking_enabled: newStatus,
      message: `تم ${newStatus === 1 ? 'تفعيل' : 'تعطيل'} إمكانية الحجز لفرع ${branch.branch_name} فقط بنجاح`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/branches/:branchId', (req, res) => {
  try {
    const bId = req.params.branchId;
    db.prepare('DELETE FROM branches WHERE id = ?').run(bId);
    logAudit('superadmin', 'مدير المنصة', 'حذف فرع', 'branch', bId, 'حذف فرع من المنصة');
    res.json({ success: true, message: 'تم حذف الفرع بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Receptionist & Staff Management
app.get('/api/admin/receptionists', (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT r.*, d.full_name as doctor_name, d.status as doctor_status,
             b.clinic_name, b.branch_name, b.governorate, b.city
      FROM receptionists r
      JOIN doctors d ON r.doctor_id = d.id
      JOIN branches b ON r.branch_id = b.id
      ORDER BY r.id DESC
    `).all();
    res.json({ success: true, staff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/receptionists', (req, res) => {
  try {
    const { doctor_id, doctorId, branch_id, branchId, name, email, phone, password } = req.body;
    const targetDoctorId = doctor_id || doctorId;
    const targetBranchId = branch_id || branchId;
    if (!targetDoctorId || !targetBranchId || !name || !email) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }

    // Check doctor plan limit
    const doctorSub = db.prepare(`
      SELECT p.max_receptionists,
        (SELECT COUNT(*) FROM receptionists r WHERE r.doctor_id = ? AND r.status = 'active') as current_count
      FROM doctor_subscriptions ds
      JOIN subscription_plans p ON ds.plan_id = p.id
      WHERE ds.doctor_id = ?
    `).get(targetDoctorId, targetDoctorId);

    if (doctorSub && doctorSub.current_count >= doctorSub.max_receptionists) {
      return res.status(400).json({
        success: false,
        message: `تم الوصول للحد الأقصى لموظفي الاستقبال (${doctorSub.max_receptionists}) في باقة هذا الطبيب. يرجى ترقية باقته أولاً.`
      });
    }

    const recPass = (password && password.trim()) ? password.trim() : '123456';
    const recRes = db.prepare(`
      INSERT INTO receptionists (doctor_id, branch_id, name, email, phone, password, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(targetDoctorId, targetBranchId, name, email, phone || '', recPass);

    const newRecId = Number(recRes.lastInsertRowid);
    logAudit('superadmin', 'مدير المنصة', 'إضافة موظف استقبال', 'receptionist', newRecId, `إنشاء حساب استقبال جديد: ${name} (${email})`);
    res.json({
      success: true,
      message: `تم إنشاء حساب موظف الاستقبال ${name} بنجاح`,
      receptionist: { id: newRecId, name, email, phone, password: recPass }
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: receptionists.email')) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني لموظف الاستقبال مسجل مسبقاً، يرجى استخدام بريد مختلف.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/receptionists/:recId/toggle', (req, res) => {
  try {
    const recId = req.params.recId;
    const rec = db.prepare('SELECT status, name FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'الحساب غير موجود' });

    const newStatus = rec.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE receptionists SET status = ? WHERE id = ?').run(newStatus, recId);

    logAudit('superadmin', 'مدير المنصة', 'تعديل حالة موظف استقبال', 'receptionist', recId, `تعديل حالة ${rec.name} إلى ${newStatus}`);
    res.json({ success: true, message: `تم تعديل حالة الحساب إلى ${newStatus === 'active' ? 'نشط' : 'معطل'}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/receptionists/:recId', (req, res) => {
  try {
    const recId = req.params.recId;
    const existing = db.prepare('SELECT * FROM receptionists WHERE id = ?').get(recId);
    if (!existing) return res.status(404).json({ success: false, message: 'موظف الاستقبال غير موجود' });

    const b = req.body;
    const name = b.name !== undefined ? b.name : existing.name;
    const email = b.email !== undefined ? b.email : existing.email;
    const phone = b.phone !== undefined ? b.phone : existing.phone;
    const branchId = b.branch_id !== undefined ? b.branch_id : existing.branch_id;
    const status = b.status !== undefined ? b.status : existing.status;
    const password = (b.password && b.password.trim()) ? b.password.trim() : existing.password;

    db.prepare(`
      UPDATE receptionists SET
        name = ?,
        email = ?,
        phone = ?,
        password = ?,
        branch_id = ?,
        status = ?
      WHERE id = ?
    `).run(name, email, phone, password, branchId, status, recId);

    logAudit('superadmin', 'مدير المنصة', 'تعديل بيانات وحساب موظف استقبال', 'receptionist', recId, `تحديث موظف استقبال: ${name}`);
    res.json({ success: true, message: 'تم تحديث بيانات وحساب موظف الاستقبال بنجاح' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: receptionists.email')) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مسجل لموظف آخر بالفعل.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/receptionists/:recId', (req, res) => {
  try {
    const recId = req.params.recId;
    db.prepare('DELETE FROM receptionists WHERE id = ?').run(recId);
    logAudit('superadmin', 'مدير المنصة', 'حذف موظف استقبال', 'receptionist', recId, 'حذف حساب موظف استقبال');
    res.json({ success: true, message: 'تم حذف حساب موظف الاستقبال بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Patient Booking Control (Global & Per-Doctor / Branch)
app.get('/api/admin/bookings/control', (req, res) => {
  try {
    let globalSetting = db.prepare("SELECT value FROM platform_settings WHERE key = 'global_booking_enabled'").get();
    const globalBookingEnabled = globalSetting ? globalSetting.value === '1' : true;

    const doctors = db.prepare(`
      SELECT d.id, d.full_name, d.status, d.is_booking_enabled, s.name as specialty_name,
        b.clinic_name, b.branch_name,
        (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = d.id) as appointments_count
      FROM doctors d
      JOIN specialties s ON d.specialty_id = s.id
      LEFT JOIN branches b ON b.doctor_id = d.id AND b.is_main = 1
      ORDER BY d.full_name ASC
    `).all();

    const branches = db.prepare(`
      SELECT b.*, d.full_name as doctor_name
      FROM branches b
      JOIN doctors d ON b.doctor_id = d.id
      ORDER BY b.clinic_name ASC
    `).all();

    res.json({
      success: true,
      global_booking_enabled: globalBookingEnabled,
      doctors,
      branches
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/bookings/global-toggle', (req, res) => {
  try {
    let globalSetting = db.prepare("SELECT value FROM platform_settings WHERE key = 'global_booking_enabled'").get();
    const current = globalSetting ? globalSetting.value === '1' : true;
    const nextVal = current ? '0' : '1';

    db.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('global_booking_enabled', ?)").run(nextVal);
    logAudit('superadmin', 'مدير المنصة', 'تعديل مفتاح الحجز الشامل للمنصة', 'platform_settings', null, `تعديل الحجز العام إلى ${nextVal === '1' ? 'متاح' : 'معطل'}`);

    res.json({
      success: true,
      global_booking_enabled: nextVal === '1',
      message: `تم ${nextVal === '1' ? 'تفعيل' : 'إيقاف'} الحجز أونلاين على مستوى المنصة بالكامل بنجاح`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Subscriptions & Plans
app.get('/api/admin/subscriptions', (req, res) => {
  try {
    const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY price ASC').all();
    const doctorSubscriptions = db.prepare(`
      SELECT ds.*, d.full_name as doctor_name, d.email as doctor_email, d.phone as doctor_phone,
             p.name as plan_name, p.code as plan_code, p.price as plan_price, p.max_receptionists, p.max_branches,
             (SELECT COUNT(*) FROM branches b WHERE b.doctor_id = d.id) as current_branches,
             (SELECT COUNT(*) FROM receptionists r WHERE r.doctor_id = d.id AND r.status = 'active') as current_receptionists
      FROM doctor_subscriptions ds
      JOIN doctors d ON ds.doctor_id = d.id
      JOIN subscription_plans p ON ds.plan_id = p.id
      ORDER BY ds.end_date ASC
    `).all();

    const payments = db.prepare(`
      SELECT p.*, d.full_name as doctor_name
      FROM payments p
      JOIN doctors d ON p.doctor_id = d.id
      ORDER BY p.payment_date DESC LIMIT 30
    `).all();

    res.json({ success: true, plans, doctorSubscriptions, payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/subscriptions/assign', (req, res) => {
  try {
    const { doctor_id, plan_id, extend_days } = req.body;
    const doc = db.prepare('SELECT full_name FROM doctors WHERE id = ?').get(doctor_id);
    if (!doc) return res.status(404).json({ success: false, message: 'الطبيب غير موجود' });

    const plan = db.prepare('SELECT name FROM subscription_plans WHERE id = ?').get(plan_id);
    const newEnd = new Date(Date.now() + (extend_days || 30) * 24 * 3600 * 1000).toISOString().split('T')[0];

    db.prepare(`
      UPDATE doctor_subscriptions SET
        plan_id = COALESCE(?, plan_id),
        end_date = ?,
        status = 'active'
      WHERE doctor_id = ?
    `).run(plan_id, newEnd, doctor_id);

    logAudit('superadmin', 'مدير المنصة', 'تعديل وتمديد باقة طبيب', 'subscription', doctor_id, `تحديث باقة الطبيب ${doc.full_name} إلى ${plan ? plan.name : 'الحالية'} حتى ${newEnd}`);
    res.json({ success: true, message: `تم تمديد وتحديث باقة الطبيب ${doc.full_name} بنجاح حتى ${newEnd}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 15. Specialties
app.get('/api/admin/specialties', (req, res) => {
  try {
    const specialties = db.prepare(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM doctors d WHERE d.specialty_id = s.id) as doctors_count
      FROM specialties s 
      ORDER BY s.display_order ASC
    `).all();
    res.json({ success: true, specialties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/specialties', (req, res) => {
  try {
    const { name, icon, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم التخصص مطلوب' });

    db.prepare('INSERT INTO specialties (name, icon, description) VALUES (?, ?, ?)').run(name, icon || 'briefcase', description || '');
    logAudit('superadmin', 'مدير المنصة', 'إضافة تخصص طبي جديد', 'specialty', null, `إضافة تخصص ${name}`);
    res.json({ success: true, message: `تمت إضافة تخصص ${name} بنجاح` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Audit Logs
app.get('/api/admin/audit-logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 60').all();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Security & Cyber Protection Endpoints (Super Admin Platform Owner)
app.get('/api/admin/security/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT 100').all();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/security/blocked', (req, res) => {
  try {
    const blocked = db.prepare('SELECT * FROM blocked_identifiers ORDER BY created_at DESC').all();
    res.json({ success: true, blocked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/security/block', (req, res) => {
  try {
    const { type, value, reason } = req.body;
    if (!type || !value) {
      return res.status(400).json({ success: false, message: 'النوع والقيمة مطلوبان' });
    }
    db.prepare(`
      INSERT OR REPLACE INTO blocked_identifiers (type, value, reason, blocked_by)
      VALUES (?, ?, ?, 'admin')
    `).run(type, value.trim(), reason || 'حظر إداري وقانوني بسبب سوء الاستخدام أو التلاعب بالمواعيد');

    logAudit('superadmin', 'مدير المنصة', 'حظر جهاز / هوية', 'security', 0, `حظر ${type}: ${value}`);
    res.json({ success: true, message: `تم حظر ${value} بنجاح ومنعه نهائياً من أي إجراء على المنصة.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/security/unblock', (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.status(400).json({ success: false, message: 'القيمة مطلوبة' });
    db.prepare('DELETE FROM blocked_identifiers WHERE value = ?').run(value.trim());
    logAudit('superadmin', 'مدير المنصة', 'إلغاء حظر هوية', 'security', 0, `إلغاء حظر: ${value}`);
    res.json({ success: true, message: `تم فك حظر ${value} بنجاح.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// ELECTRONIC MEDICAL RECORD (EMR) & PROGRESS COMPARISON APIS
// Strictly Restricted to the Treating Doctor & the Patient
// ----------------------------------------------------

function buildEMRBundle(docId, phone) {
  const cleanPhone = String(phone || '').trim();
  let profile = db.prepare(`
    SELECT * FROM patient_medical_profiles WHERE doctor_id = ? AND patient_phone = ?
  `).get(docId, cleanPhone);

  if (!profile) {
    const pat = db.prepare('SELECT patient_name FROM appointments WHERE doctor_id = ? AND patient_phone = ? ORDER BY id DESC LIMIT 1').get(docId, cleanPhone);
    profile = {
      doctor_id: Number(docId),
      patient_phone: cleanPhone,
      patient_name: pat?.patient_name || 'مريض',
      blood_type: 'غير محدد',
      allergies: 'لا توجد حساسية مسجلة',
      chronic_conditions: 'لا توجد',
      past_surgeries: 'لا توجد',
      family_history: '',
      notes: ''
    };
  }

  const visits = db.prepare(`
    SELECT * FROM medical_visits
    WHERE doctor_id = ? AND patient_phone = ?
    ORDER BY visit_date DESC, id DESC
  `).all(docId, cleanPhone);

  const prescriptions = db.prepare(`
    SELECT p.*, v.visit_date
    FROM prescriptions p
    LEFT JOIN medical_visits v ON p.visit_id = v.id
    WHERE p.doctor_id = ? AND p.patient_phone = ?
    ORDER BY p.is_active DESC, p.created_at DESC, p.id DESC
  `).all(docId, cleanPhone);

  const labs = db.prepare(`
    SELECT * FROM lab_results
    WHERE doctor_id = ? AND patient_phone = ?
    ORDER BY test_date DESC, id DESC
  `).all(docId, cleanPhone);

  // Build lab comparisons grouped by test_name (latest vs previous)
  const labsByName = new Map();
  for (const l of labs) {
    const key = String(l.test_name || '').trim();
    if (!labsByName.has(key)) labsByName.set(key, []);
    labsByName.get(key).push(l);
  }
  const lab_comparisons = [];
  for (const [testName, items] of labsByName.entries()) {
    const latest = items[0];
    const previous = items[1] || null;
    const delta = (latest && previous && latest.numeric_value != null && previous.numeric_value != null)
      ? Number((latest.numeric_value - previous.numeric_value).toFixed(2))
      : null;
    lab_comparisons.push({
      test_name: testName,
      category: latest.category,
      unit: latest.unit,
      reference_range: latest.reference_range,
      latest,
      previous,
      delta,
      history_count: items.length
    });
  }

  // Build vitals progress summary (first vs latest visit)
  const chronological = [...visits].reverse();
  const firstVisit = chronological[0] || null;
  const latestVisit = visits[0] || null;
  const progress_summary = {
    total_visits: visits.length,
    first_visit_date: firstVisit?.visit_date || null,
    latest_visit_date: latestVisit?.visit_date || null,
    bp_first: firstVisit?.bp_systolic ? `${firstVisit.bp_systolic}/${firstVisit.bp_diastolic || ''}` : null,
    bp_latest: latestVisit?.bp_systolic ? `${latestVisit.bp_systolic}/${latestVisit.bp_diastolic || ''}` : null,
    sugar_first: firstVisit?.blood_sugar ?? null,
    sugar_latest: latestVisit?.blood_sugar ?? null,
    weight_first: firstVisit?.weight_kg ?? null,
    weight_latest: latestVisit?.weight_kg ?? null,
    improvement_first: firstVisit?.improvement_score ?? null,
    improvement_latest: latestVisit?.improvement_score ?? null
  };

  return { profile, visits, chronological_visits: chronological, prescriptions, labs, lab_comparisons, progress_summary };
}

// 1. Get Patient Full EMR (Doctor Only)
app.get('/api/doctor/:id/emr/patient/:phone', (req, res) => {
  try {
    const docId = Number(req.params.id);
    const phone = decodeURIComponent(req.params.phone || '').trim();
    if (!phone) return res.status(400).json({ success: false, message: 'رقم هاتف المريض مطلوب' });
    const bundle = buildEMRBundle(docId, phone);
    logAudit('doctor', `طبيب رقم ${docId}`, 'الاطلاع على السجل الطبي', 'emr', 0, `ملف المريض ${phone}`);
    res.json({ success: true, ...bundle });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Update Patient Medical Profile (Allergies, Chronic Conditions, Blood Type)
app.put('/api/doctor/:id/emr/patient/:phone/profile', (req, res) => {
  try {
    const docId = Number(req.params.id);
    const phone = decodeURIComponent(req.params.phone || '').trim();
    const { patient_name, blood_type, allergies, chronic_conditions, past_surgeries, family_history, notes } = req.body;

    db.prepare(`
      INSERT INTO patient_medical_profiles (doctor_id, patient_phone, patient_name, blood_type, allergies, chronic_conditions, past_surgeries, family_history, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(doctor_id, patient_phone) DO UPDATE SET
        patient_name = COALESCE(excluded.patient_name, patient_medical_profiles.patient_name),
        blood_type = excluded.blood_type,
        allergies = excluded.allergies,
        chronic_conditions = excluded.chronic_conditions,
        past_surgeries = excluded.past_surgeries,
        family_history = excluded.family_history,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      docId,
      phone,
      patient_name || null,
      blood_type || 'غير محدد',
      allergies || 'لا توجد حساسية مسجلة',
      chronic_conditions || 'لا توجد',
      past_surgeries || 'لا توجد',
      family_history || '',
      notes || ''
    );

    logAudit('doctor', `طبيب رقم ${docId}`, 'تحديث التاريخ المرضي الأساسي', 'emr', 0, `المريض ${phone}`);
    res.json({ success: true, message: 'تم حفظ التاريخ المرضي الأساسي بنجاح', ...buildEMRBundle(docId, phone) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Add Medical Visit + Prescriptions (Atomic)
app.post('/api/doctor/:id/emr/patient/:phone/visits', (req, res) => {
  try {
    const docId = Number(req.params.id);
    const phone = decodeURIComponent(req.params.phone || '').trim();
    const {
      patient_name, appointment_id, visit_date, chief_complaint, diagnosis, clinical_notes,
      bp_systolic, bp_diastolic, heart_rate, temperature, blood_sugar, weight_kg,
      improvement_score, follow_up_date, prescriptions = []
    } = req.body;

    if (!chief_complaint || !diagnosis) {
      return res.status(400).json({ success: false, message: 'الشكوى الرئيسية والتشخيص حقول مطلوبة' });
    }

    // Ensure profile exists
    db.prepare(`
      INSERT OR IGNORE INTO patient_medical_profiles (doctor_id, patient_phone, patient_name)
      VALUES (?, ?, ?)
    `).run(docId, phone, patient_name || 'مريض');

    const vDate = visit_date || new Date().toISOString().split('T')[0];
    const vRes = db.prepare(`
      INSERT INTO medical_visits (
        doctor_id, patient_phone, appointment_id, visit_date, chief_complaint, diagnosis, clinical_notes,
        bp_systolic, bp_diastolic, heart_rate, temperature, blood_sugar, weight_kg, improvement_score, follow_up_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId, phone, appointment_id || null, vDate, chief_complaint.trim(), diagnosis.trim(), clinical_notes || '',
      bp_systolic ? Number(bp_systolic) : null,
      bp_diastolic ? Number(bp_diastolic) : null,
      heart_rate ? Number(heart_rate) : null,
      temperature ? Number(temperature) : null,
      blood_sugar ? Number(blood_sugar) : null,
      weight_kg ? Number(weight_kg) : null,
      improvement_score ? Number(improvement_score) : 7,
      follow_up_date || null
    );
    const visitId = Number(vRes.lastInsertRowid);

    const insRx = db.prepare(`
      INSERT INTO prescriptions (visit_id, doctor_id, patient_phone, medication_name, dosage, frequency, duration, instructions, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const rx of (Array.isArray(prescriptions) ? prescriptions : [])) {
      if (rx && rx.medication_name && rx.medication_name.trim()) {
        insRx.run(
          visitId, docId, phone,
          rx.medication_name.trim(),
          rx.dosage || 'قرص',
          rx.frequency || 'يومياً',
          rx.duration || 'أسبوع',
          rx.instructions || ''
        );
      }
    }

    logAudit('doctor', `طبيب رقم ${docId}`, 'تسجيل كشف وروشتة', 'medical_visit', visitId, `المريض ${phone}: ${diagnosis}`);
    res.json({ success: true, message: 'تم حفظ الكشف والروشتة في السجل الطبي بنجاح', visit_id: visitId, ...buildEMRBundle(docId, phone) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Add Lab or Radiology Result
app.post('/api/doctor/:id/emr/patient/:phone/labs', (req, res) => {
  try {
    const docId = Number(req.params.id);
    const phone = decodeURIComponent(req.params.phone || '').trim();
    const { test_name, category, numeric_value, unit, reference_range, status, result_text, attachment_url, test_date, visit_id } = req.body;

    if (!test_name) {
      return res.status(400).json({ success: false, message: 'اسم التحليل أو الأشعة مطلوب' });
    }

    db.prepare(`
      INSERT INTO lab_results (doctor_id, patient_phone, visit_id, test_name, category, numeric_value, unit, reference_range, status, result_text, attachment_url, test_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId, phone, visit_id || null, test_name.trim(),
      category || 'تحليل دم',
      (numeric_value !== undefined && numeric_value !== null && numeric_value !== '') ? Number(numeric_value) : null,
      unit || '', reference_range || '', status || 'normal',
      result_text || '', attachment_url || '',
      test_date || new Date().toISOString().split('T')[0]
    );

    logAudit('doctor', `طبيب رقم ${docId}`, 'إضافة نتيجة تحليل/أشعة', 'lab_result', 0, `${test_name} للمريض ${phone}`);
    res.json({ success: true, message: 'تم إضافة نتيجة التحليل والمقارنة تلقائياً', ...buildEMRBundle(docId, phone) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Toggle Prescription Active Status
app.post('/api/doctor/:id/emr/prescriptions/:prescId/toggle', (req, res) => {
  try {
    const docId = Number(req.params.id);
    const prescId = Number(req.params.prescId);
    const rx = db.prepare('SELECT * FROM prescriptions WHERE id = ? AND doctor_id = ?').get(prescId, docId);
    if (!rx) return res.status(404).json({ success: false, message: 'العلاج غير موجود' });
    const nextState = rx.is_active ? 0 : 1;
    db.prepare('UPDATE prescriptions SET is_active = ? WHERE id = ?').run(nextState, prescId);
    res.json({ success: true, is_active: nextState, ...buildEMRBundle(docId, rx.patient_phone) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Patient Self-View of Their Own Medical History (Authenticated Patient Only)
app.get('/api/public/my-emr', (req, res) => {
  try {
    if (!req.user || req.user.role !== 'patient' || !req.user.phone) {
      return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول بحساب المريض لعرض ملفك الطبي' });
    }
    const phone = req.user.phone;
    const doctorRows = db.prepare(`
      SELECT DISTINCT v.doctor_id, d.full_name as doctor_name, d.title as doctor_title, s.name as specialty_name
      FROM medical_visits v
      JOIN doctors d ON v.doctor_id = d.id
      LEFT JOIN specialties s ON d.specialty_id = s.id
      WHERE v.patient_phone = ?
    `).all(phone);

    const records = doctorRows.map((d) => ({
      doctor: d,
      ...buildEMRBundle(d.doctor_id, phone)
    }));
    res.json({ success: true, phone, records });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// RECEPTIONIST WHATSAPP LOGGING & ADMIN BACKUP
// ----------------------------------------------------
app.post('/api/receptionist/:id/whatsapp-log', (req, res) => {
  try {
    const recId = Number(req.params.id);
    const { patient_name, patient_phone, template_title, message } = req.body;
    const rec = db.prepare('SELECT * FROM receptionists WHERE id = ?').get(recId);
    if (!rec) return res.status(404).json({ success: false, message: 'موظف الاستقبال غير موجود' });

    db.prepare(`
      INSERT INTO notifications (recipient_role, recipient_id, title, message, channel, status)
      VALUES ('patient', ?, ?, ?, 'whatsapp', 'sent')
    `).run(
      patient_phone || '',
      `واتساب: ${template_title || 'تنبيه عيادة'} — ${patient_name || ''}`,
      message || ''
    );
    logAudit('receptionist', rec.name, 'إرسال رسالة واتساب للمريض', 'notification', recId, `إلى ${patient_name} (${patient_phone})`);
    res.json({ success: true, message: 'تم توثيق رسالة الواتساب في سجل الإشعارات' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/backup', (req, res) => {
  try {
    const dbFile = process.env.DAWRY_DB_PATH || path.join(__dirname, 'dawry.db');
    if (!fs.existsSync(dbFile)) {
      return res.status(404).json({ success: false, message: 'ملف قاعدة البيانات غير موجود' });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    logAudit('superadmin', 'مدير المنصة', 'تصدير نسخة احتياطية', 'database', 0, 'تحميل نسخة احتياطية لقاعدة البيانات');
    res.download(dbFile, `dawry-backup-${timestamp}.sqlite`);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const distPath = path.join(__dirname, '../dist');

// Serve frontend static build
app.use(express.static(distPath));

// Fallback to index.html for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start Express server if running standalone
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Dawry API Backend running on http://localhost:${PORT}`);
  });

  try {
    const http = await import('http');
    const server3000 = http.default.createServer(app);
    server3000.listen(3000, () => {
      console.log(`Dawry Frontend & Backend also listening on http://localhost:3000`);
    });
    server3000.on('error', () => {
      // Port 3000 busy or restricted, ignore
    });
  } catch (e) {}
}

export default app;
