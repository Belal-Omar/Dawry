import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imgDir = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\81e70b50-3f7a-45bb-babd-59732a563f2b\\.user_uploaded';

function getImgBase64(filename) {
  try {
    const fullPath = path.join(imgDir, filename);
    if (!fs.existsSync(fullPath)) return '';
    const buf = fs.readFileSync(fullPath);
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error('Failed to read image:', filename, e.message);
    return '';
  }
}

const images = {
  login: getImgBase64('media_1795197200216_e88c334f.jpg'),
  signup: getImgBase64('media_1795197200225_29ba7265.jpg'),
  home: getImgBase64('media_1794940122660_fb4afb0d.png'),
  booking: getImgBase64('media_1795103324123_1b5ea43c.png'),
  tracking: getImgBase64('media_1795103324124_f763a2f2.png'),
  doctor: getImgBase64('media_1795103324141_7f7d1e28.png'),
  reception: getImgBase64('media_1795103324149_260247e8.png'),
  adminControls: getImgBase64('media_1795103324166_dc5bff9c.png'),
  auditLogs: getImgBase64('media_1795103324169_f93e42d8.png'),
  analytics: getImgBase64('media_1795103324209_1e8f5952.png'),
  wizard: getImgBase64('media_1795106260908_7b94d192.png'),
  doctorDetails: getImgBase64('media_1795116232635_14fb9135.png')
};

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير منصة دُوري الشامل - الدليل الفني والاستراتيجي الكامل</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    @page {
      size: A4;
      margin: 18mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
        font-family: 'Cairo', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
      @bottom-left {
        content: "منصة دُوري لإدارة العيادات والطوابير الذكية";
        font-family: 'Cairo', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 0;
      color: #1e293b;
      background-color: #ffffff;
      line-height: 1.6;
      font-size: 13px;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cover Page */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 60px 40px;
      background: radial-gradient(circle at 80% 20%, #1e2c7a 0%, #152261 45%, #0d1540 100%);
      color: #ffffff;
      border-radius: 12px;
      page-break-after: always;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cover-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 28px;
      font-weight: 900;
      color: #ffffff;
    }

    .cover-badge {
      background: rgba(45, 212, 191, 0.15);
      border: 1px solid rgba(45, 212, 191, 0.4);
      color: #2dd4bf;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
    }

    .cover-body {
      margin: 80px 0;
    }

    .cover-eyebrow {
      color: #2dd4bf;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 12px;
      display: block;
    }

    .cover-title {
      font-size: 44px;
      font-weight: 900;
      line-height: 1.25;
      margin: 0 0 20px 0;
      color: #ffffff;
    }

    .cover-title span {
      color: #2dd4bf;
    }

    .cover-desc {
      font-size: 17px;
      color: rgba(255, 255, 255, 0.85);
      max-width: 650px;
      line-height: 1.7;
    }

    .cover-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
    }

    /* Headings */
    h1, h2, h3, h4 {
      font-family: 'Cairo', sans-serif;
      font-weight: 800;
      color: #0f172a;
      margin-top: 24px;
      margin-bottom: 12px;
    }

    h1 {
      font-size: 24px;
      color: #1e3a8a;
      border-bottom: 2.5px solid #3b82f6;
      padding-bottom: 8px;
      margin-top: 32px;
    }

    h2 {
      font-size: 19px;
      color: #1e293b;
      border-right: 4px solid #3246b8;
      padding-right: 12px;
    }

    h3 {
      font-size: 15px;
      color: #334155;
    }

    p {
      margin: 0 0 12px 0;
      color: #334155;
      line-height: 1.65;
    }

    /* Badges & Pills */
    .pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
    }
    .pill-blue { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .pill-green { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .pill-cyan { background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }
    .pill-red { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

    /* Cards & Boxes */
    .feature-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .alert-box {
      background: #eff6ff;
      border-right: 4px solid #2563eb;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
      font-size: 12.5px;
      color: #1e40af;
    }

    .alert-box.green {
      background: #f0fdf4;
      border-color: #16a34a;
      color: #166534;
    }

    /* Images Container */
    .image-preview-container {
      margin: 18px 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid #cbd5e1;
      background: #f1f5f9;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
    }

    .image-preview-container img {
      width: 100%;
      height: auto;
      display: block;
      max-height: 380px;
      object-fit: contain;
      background: #ffffff;
    }

    .image-caption {
      background: #f8fafc;
      padding: 8px 14px;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 12px;
    }

    th, td {
      padding: 10px 12px;
      text-align: right;
      border: 1px solid #cbd5e1;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
    }

    tr:nth-child(even) {
      background: #f8fafc;
    }

    /* Grid Layouts */
    .two-col-grid {
      display: flex;
      gap: 16px;
      margin: 14px 0;
    }

    .two-col-grid > div {
      flex: 1;
    }

    /* Timeline */
    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #3246b8;
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      margin-left: 8px;
    }
  </style>
</head>
<body>

  <!-- ==================== COVER PAGE ==================== -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="cover-brand">
        <span style="background:#2dd4bf; color:#0d1540; width:38px; height:38px; border-radius:10px; display:grid; place-items:center; font-size:22px;">د</span>
        <span>دُوري • DAWRY</span>
      </div>
      <div class="cover-badge">وثيقة المواصفات الفنية والاستراتيجية المعتمدة</div>
    </div>

    <div class="cover-body">
      <span class="cover-eyebrow">المنظومة السحابية المتكاملة للعيادات والطوابير الطبية</span>
      <h1 class="cover-title">
        تقرير الإطلاق الشامل لمنصة <span>دُوري</span><br>
        ورحلة التحول الرقمي للعيادات
      </h1>
      <p class="cover-desc">
        توثيق معماري وهندسي متكامل لكل شاشات ومكونات المنصة، يتضمن الشاشات الحية المعتمدة، منظومة الدخول الموحد، تفاصيل إدارة الطابور الحي، صلاحيات السوبر أدمن، ومصفوفة الحماية السيبرانية وبصمة الأجهزة لمكافحة الاحتيال، مع دراسة مقارنة تنافسية كاسحة مع فيزيتا.
      </p>
    </div>

    <div class="cover-footer">
      <div><b>الجهة المعدة:</b> فريق التطوير والحلول السحابية - دُوري</div>
      <div><b>الإصدار:</b> Production Release V2.5</div>
      <div><b>تاريخ التوثيق:</b> نوفمبر 2026</div>
    </div>
  </div>

  <!-- ==================== TABLE OF CONTENTS ==================== -->
  <div class="page-break"></div>
  <h1>فهرس محتويات التقرير</h1>
  <div class="feature-card">
    <table style="border:none;">
      <tbody>
        <tr><td><b>1.</b></td><td><b>صفحات تسجيل الدخول وإنشاء الحساب الموحدة (التصميم المعتمد)</b></td><td>ص 3</td></tr>
        <tr><td><b>2.</b></td><td><b>رحلة المريض الكاملة (من الحجز المنزلي حتى انتهاء الكشف)</b></td><td>ص 5</td></tr>
        <tr><td><b>3.</b></td><td><b>شاشة المتابعة الحية وميزة "تحرك من بيتك الآن"</b></td><td>ص 7</td></tr>
        <tr><td><b>4.</b></td><td><b>لوحة تحكم مكتب الاستقبال وإدارة الطابور العادل</b></td><td>ص 8</td></tr>
        <tr><td><b>5.</b></td><td><b>لوحة تحكم الطبيب المستقلة وجدول المواعيد</b></td><td>ص 10</td></tr>
        <tr><td><b>6.</b></td><td><b>صلاحيات مدير المنصة (Super Admin Platform Owner) الكاملة</b></td><td>ص 11</td></tr>
        <tr><td><b>7.</b></td><td><b>منظومة الأمان السيبراني، بصمة الأجهزة، ومصيدة الروبوتات</b></td><td>ص 13</td></tr>
        <tr><td><b>8.</b></td><td><b>المقارنة الشاملة مع فيزيتا (Vezeeta) واستراتيجية اكتساح السوق</b></td><td>ص 15</td></tr>
      </tbody>
    </table>
  </div>

  <div class="alert-box green">
    <b>ملاحظة اعتماد:</b> جميع الشاشات والأنظمة والبيانات الموضحة في هذا التقرير حقيقية بنسبة 100% وتم ربطها بقواعد البيانات وسيرفرات المنصة وتعمل بتزامن مباشر.
  </div>

  <!-- ==================== SECTION 1: AUTHENTICATION ==================== -->
  <div class="page-break"></div>
  <h1>1. صفحات تسجيل الدخول وإنشاء الحساب الموحدة</h1>
  <p>
    تم تصميم وبناء شاشتي تسجيل الدخول وإنشاء الحساب وفق أعلى معايير الـ UI/UX بنظام الشاشة المنقسمة (Split-Screen) مع توحيد ألوان الأزرق الملكي والسيان، وتموضع كارت البيانات في <b>جهة اليمين</b> والبصريات التفاعلية في <b>جهة اليسار</b>.
  </p>

  <h2>أ. شاشة تسجيل الدخول الموحد لجميع المستخدمين</h2>
  <div class="image-preview-container">
    <img src="${images.login}" alt="شاشة تسجيل الدخول الموحد">
    <div class="image-caption">صورة 1: شاشة تسجيل الدخول الموحد بنظام التعرف التلقائي على الأدوار (دكتور / ريسبشن / مريض / أدمن)</div>
  </div>

  <div class="feature-card">
    <h3>مميزات شاشة الدخول الموحد:</h3>
    <ul>
      <li><b>الدخول الذكي بدون تحديد دور (Zero-Role Friction):</b> لا يُطلب من المستخدم اختيار تخصصه أو دوره؛ بمجرد كتابة الهاتف أو البريد وكلمة المرور يتعرف النظام فورياً على رتبته ويوجهه لوجهته المحددة (الأدمن إلى <code>#admin</code>، الطبيب إلى <code>#doctor</code>، الاستقبال إلى <code>#reception</code>، والمريض إلى <code>#home</code>).</li>
      <li><b>حلقة الطابور التفاعلية المباشرة:</b> عرض مباشر لحلقة الطابور الزجاجية مع الرقم الحي <code>دورك ٢٤</code> وتحديث دوري مباشر.</li>
      <li><b>الكروت الزجاجية العائمة:</b> كارت <code>👥 متبقي قبلك ٥ أدوار</code>، وكارت <code>⏱️ الوقت المتوقع ٢٠-٢٥ دقيقة</code>، وكارت تنبيه <code>دورك قرب 🔔</code>.</li>
    </ul>
  </div>

  <h2>ب. شاشة إنشاء حساب جديد للمريض لأول مرة</h2>
  <div class="image-preview-container">
    <img src="${images.signup}" alt="شاشة إنشاء الحساب للمريض">
    <div class="image-caption">صورة 2: شاشة إنشاء حساب مريض جديد مخصصة للجمهور لأول مرة مع شروط الاستخدام</div>
  </div>

  <div class="feature-card">
    <h3>تفاصيل إنشاء حساب المريض:</h3>
    <p>مخصصة بالكامل للمرضى الجدد للتسجيل في 3 خطوات بسيطة: إدخال الاسم بالكامل، رقم الموبايل أو الإيميل، وكلمة المرور، والموافقة على الشروط، مع حماية أوتوماتيكية من أرقام الهواتف المكررة والحسابات الوهمية.</p>
  </div>

  <!-- ==================== SECTION 2: PATIENT JOURNEY ==================== -->
  <div class="page-break"></div>
  <h1>2. رحلة المريض الكاملة (Patient Journey)</h1>
  <p>تبدأ رحلة المريض من الموقع العام وتمر بـ 4 مراحل مترابطة تضمن حفظ وقته وكرامته بدقة:</p>

  <h2>أ. تصفح الموقع والبحث عن الأطباء</h2>
  <div class="image-preview-container">
    <img src="${images.home}" alt="الرئيسية والبحث عن الأطباء">
    <div class="image-caption">صورة 3: واجهة الموقع العامة مع محرك البحث الذكي بحسب التخصص والمحافظة واسم الطبيب</div>
  </div>

  <div class="two-col-grid">
    <div class="feature-card">
      <h3>المرحلة الأولى: البحث والتصفية</h3>
      <p>محرك بحث فوري يدعم التصفية حسب المحافظة (القاهرة، الجيزة، الإسكندرية...) والتخصص (قلب، أطفال، عظام، جلدية، عيون...) وسعر الكشف والتقييمات المعتمدة.</p>
    </div>
    <div class="feature-card">
      <h3>المرحلة الثانية: بروفايل الطبيب وجدول المواعيد</h3>
      <p>صفحة الطبيب الشاملة تعرض مؤهلاته، فروع العيادة، صورة المكان، والتقييمات الحقيقية، مع جدول التقويم التفاعلي لحجز اليوم والوقت.</p>
    </div>
  </div>

  <h2>ب. اختيار الموعد وقفل الموعد فورياً (Slot Locking)</h2>
  <div class="image-preview-container">
    <img src="${images.booking}" alt="صفحة حجز موعد الطبيب">
    <div class="image-caption">صورة 4: شاشة حجز الموعد واختيار الفترة الزمنية المتاحة وبيانات المريض والباركود</div>
  </div>

  <div class="alert-box">
    <b>آلية قفل الموعد الصارمة:</b> بمجرد ضغط المريض على موعد محدد (مثلاً 06:20 م)، يتم قفله في السيرفر فوراَ ويصبح غير متاح (Unavailable) لأي زائر آخر، مع فحص الحماية من الحجز المزدوج (Double-booking Prevention).
  </div>

  <!-- ==================== SECTION 3: LIVE QUEUE TRACKING ==================== -->
  <div class="page-break"></div>
  <h1>3. شاشة المتابعة الحية وميزة "تحرك من بيتك الآن"</h1>
  <p>هذه هي الميزة الجوهرية التي تضع منصة "دُوري" في صدارة السوق الطبي:</p>

  <div class="image-preview-container">
    <img src="${images.tracking}" alt="شاشة تتبع الدور المباشر للمريض">
    <div class="image-caption">صورة 5: شاشة المتابعة الحية للمريض توضح كم مريض قبله ووقت الانتظار الفعلي وميعاد التحرك</div>
  </div>

  <div class="feature-card">
    <h2>كيف يعمل الطابور الحي؟</h2>
    <ul>
      <li><span class="step-badge">1</span> <b>حساب وقت الانتظار الديناميكي:</b> يحسب النظام متوسط كشف الطبيب (مثلاً 20 دقيقة لكل مريض) ويضربها في عدد المنتظرين الفعليين ليمنح المريض وقتاً تقريبياً فائق الدقة.</li>
      <li><span class="step-badge">2</span> <b>تزامن لحظي كل 3 ثوانٍ (Real-Time Auto Sync):</b> تتحدث شاشة المريض أوتوماتيكياً كل 3 ثوانٍ؛ بمجرد أن يضغط موظف الاستقبال أو الطبيب "التالي"، تنقص الأدوار أمامه على الشاشة فوراً دون عمل ريفريش.</li>
      <li><span class="step-badge">3</span> <b>تنبيه التحرك من البيت:</b> عندما يصبح أمامه مريضان فقط، يتحول لون الكارت إلى الأخضر مع تنبيه: <i>"دورك قرب، يمكنك التحرك الآن لتصل في موعدك تماماً دون انتظار في صالة العيادة"</i>.</li>
      <li><span class="step-badge">4</span> <b>باركود QR للدخول السريع:</b> كود رقمي خاص بكل حجز يمكن للمريض مسحه في صالة الاستقبال لإثبات حضوره بلمح البصر.</li>
    </ul>
  </div>

  <!-- ==================== SECTION 4: RECEPTIONIST WORKSPACE ==================== -->
  <div class="page-break"></div>
  <h1>4. لوحة تحكم مكتب الاستقبال وإدارة الطابور العادل</h1>
  <p>تم تصميم شاشة الاستقبال لتتحمل أعلى ضغط عمل يومي وتضمن العدالة التامة بين الحضور المسبق والحضور المباشر:</p>

  <div class="image-preview-container">
    <img src="${images.reception}" alt="شاشة مكتب الاستقبال">
    <div class="image-caption">صورة 6: لوحة تحكم الاستقبال - إدارة الطابور الفوري، تسجيل القادمين بدون حجز، وأزرار التحكم</div>
  </div>

  <div class="two-col-grid">
    <div class="feature-card">
      <h3>أزرار الإجراءات السريعة:</h3>
      <ul>
        <li><b>النداء على التالي (Call Next):</b> استدعاء المريض التالي في الطابور العادل ونقله لغرفة الكشف.</li>
        <li><b>تخطي المريض (Skip Patient):</b> إذا نودي على المريض ولم يكن موجوداً، يُنقل لآخر الطابور لحفظ حقوق المنتظرين الآخرين.</li>
        <li><b>حالة طارئة (Emergency Priority):</b> إدخال الحالات الحرجة فوراً بأولوية قصوى لغرفة الكشف مع تنبيه بقية المرضى.</li>
      </ul>
    </div>
    <div class="feature-card">
      <h3>تسجيل الـ Walk-in بالاستقبال:</h3>
      <ul>
        <li><b>إدخال سريع بدون تعقيد:</b> تسجيل اسم المريض ورقم هاتفه في ثانيتين.</li>
        <li><b>الدمج العادل في الطابور:</b> يمنح النظام المريض الحاضر رقماً تسلسلياً عادلاً يتكامل مع المرضى الحاجزين مسبقاً عبر الإنترنت.</li>
        <li><b>رابط متابعة على هاتفه:</b> يستلم المريض رابطاً حياً على هاتفه ليتابع دوره حتى لو خرج للتنزه بالخارج.</li>
      </ul>
    </div>
  </div>

  <!-- ==================== SECTION 5: DOCTOR DASHBOARD ==================== -->
  <div class="page-break"></div>
  <h1>5. لوحة تحكم الطبيب المستقلة (Doctor Clinic OS)</h1>
  <p>نظام تشغيل مبسط وخالٍ من التعقيد يتيح للطبيب إدارة كشوفاته والتركيز على علاج المرضى:</p>

  <div class="image-preview-container">
    <img src="${images.doctor}" alt="لوحة تحكم الطبيب">
    <div class="image-caption">صورة 7: شاشة الطبيب المباشرة - المريض الحالي، قائمة المنتظرين، ومفتاح إنهاء الكشف</div>
  </div>

  <div class="feature-card">
    <h3>وظائف لوحة الطبيب:</h3>
    <ul>
      <li><b>شاشة الكشف الحية:</b> رؤية من يجلس أمامه بالداخل، الملاحظات الطبية، كود الحجز، وتاريخ الحضور.</li>
      <li><b>إنهاء وبدء الكشف بضغطة زر:</b> بضغطة واحدة على زر "إنهاء الكشف"، يتحدث طابور الاستقبال وطابور المريض في نفس اللحظة.</li>
      <li><b>منشئ جداول العمل (Schedule Builder):</b> يحدد الطبيب لكل فرع: أيام وساعات العمل، وقت استراحة الغداء، ومدة الكشف المتوقعة لكل مريض.</li>
      <li><b>فريق العمل والفروع:</b> إنشاء وإدارة حسابات موظفي الاستقبال التابعين لعيادته والتحكم في صلاحياتهم وأرقام هواتفهم.</li>
    </ul>
  </div>

  <!-- ==================== SECTION 6: SUPER ADMIN ==================== -->
  <div class="page-break"></div>
  <h1>6. صلاحيات مدير المنصة (Super Admin Platform Owner)</h1>
  <p>يمتلك مالك المنصة لوحة قيادة استراتيجية ورقابية تتحكم في كامل مفاصل النظام:</p>

  <h2>أ. مفاتيح التحكم المركزية وإدارة الأطباء</h2>
  <div class="image-preview-container">
    <img src="${images.adminControls}" alt="لوحة تحكم السوبر أدمن">
    <div class="image-caption">صورة 8: لوحة إدارة المنصة العليا - المفتاح العام للحجوزات، إيقاف وتفعيل الأطباء، وإدارة الفروع</div>
  </div>

  <div class="two-col-grid">
    <div class="feature-card">
      <h3>المفتاح العام للحجوزات (Global Master Switch):</h3>
      <p>زر أمان رئيسي يتيح للسوبر أدمن إيقاف أو تفعيل استقبال الحجوزات على مستوى مصر بالكامل أو استئنافها بضغطة واحدة وقت الصيانة أو الطوارئ.</p>
    </div>
    <div class="feature-card">
      <h3>إيقاف وتفعيل الطبيب والفرع:</h3>
      <p>إمكانية تجميد حساب أي عيادة أو طبيب مؤقتاً (Suspend) مع إيقاف حجز مواعيده، وإعادة التفعيل فور تسوية الاشتراكات بضغطة زر.</p>
    </div>
  </div>

  <h2>ب. معالج إضافة الطبيب الشامل ورفع الصور الحية</h2>
  <div class="image-preview-container">
    <img src="${images.wizard}" alt="معالج إضافة الطبيب">
    <div class="image-caption">صورة 9: نافذة إضافة الطبيب الشاملة - رفع الصورة الشخصية، التخصص، الفروع، وبيانات الحساب</div>
  </div>

  <h2>ج. الملف الشامل واستعراض الحسابات والباسوردات</h2>
  <div class="image-preview-container">
    <img src="${images.doctorDetails}" alt="الملف الشامل للطبيب">
    <div class="image-caption">صورة 10: كارت الملف الشامل - استعراض تفاصيل العيادة، حسابات الريسبشن، وكلمات المرور وتعديلها</div>
  </div>

  <div class="page-break"></div>
  <h2>د. سجل التدقيق والأمان الشامل بالثانية (System Audit Trail)</h2>
  <div class="image-preview-container">
    <img src="${images.auditLogs}" alt="سجل النظام الشامل">
    <div class="image-caption">صورة 11: سجل التدقيق والأمان بالثانية - تسجيل كل عملية دخول، حجز، تعديل، أو حذف وهوية المنفذ</div>
  </div>

  <h2>هـ. إحصائيات التخصصات والنمو المالي</h2>
  <div class="image-preview-container">
    <img src="${images.analytics}" alt="إحصائيات المنصة والتخصصات">
    <div class="image-caption">صورة 12: لوحة الإحصائيات - عدد الأطباء بكل تخصص، المواعيد المنجزة، ومعدلات نمو المنصة</div>
  </div>

  <!-- ==================== SECTION 7: CYBER SECURITY ==================== -->
  <div class="page-break"></div>
  <h1>7. منظومة الأمان السيبراني، بصمة الأجهزة، ومصيدة الروبوتات</h1>
  <p>تم بناء درع حماية سيبراني متعدد الطبقات يمنع التلاعب بالمواعيد ويحفظ حقوق الأطباء والمرضى قانونياً:</p>

  <div class="feature-card">
    <h2>الركائز الست لمنظومة الأمان في دُوري:</h2>
    <table>
      <thead>
        <tr>
          <th>الطبقة الأمنية</th>
          <th>آلية العمل البرمجية</th>
          <th>الفائدة والحماية الميدانية</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><b>بصمة الجهاز الرقمية<br>(Device Fingerprinting)</b></td>
          <td>التقاط بصمة شاشة الجهاز والمتصفح ونظام التشغيل وتوليد هاش مشفر مع كل طلب وتخزينه في جدول <code>security_audit_logs</code>.</td>
          <td>معرفة الجهاز الحقيقي الذي يقوم بالحجز أو الدخول حتى لو قام المستخدم بتغيير رقمه أو اسمه.</td>
        </tr>
        <tr>
          <td><b>تتبع الـ IP والأدلة القانونية<br>(IP & Legal Evidence)</b></td>
          <td>تسجيل عنوان الـ IP الحقيقي وتوقيت الطلب بالثانية وحفظه كدليل رقمي جنائي.</td>
          <td>تقديم تقرير رقمي موثق للجهات القانونية في حال قيام أي شخص بمحاولة تخريب متعمدة لعيادة أو طبيب.</td>
        </tr>
        <tr>
          <td><b>مصيدة الروبوتات الخفية<br>(Honeypot Bot Trap)</b></td>
          <td>حقل وهمي مشفر <code>hp_website_trap</code> غير مرئي للمستخدم البشري لكن الروبوتات تقوم بملئه تلقائياً.</td>
          <td>بمجرد ملء الحقل، يتم رفض الطلب فوراً وحظر السيرفر المعتدي برتبة خطورة <code>Risk Score: 100</code>.</td>
        </tr>
        <tr>
          <td><b>منع هجمات التخمين<br>(Brute-Force Lockout)</b></td>
          <td>مراقبة محاولات الدخول الخاطئة؛ عند تكرار 5 محاولات فاشلة خلال 5 دقائق، يتم قفل الحساب فوراً.</td>
          <td>قفل الجهاز ورقم الحساب لمدة 15 دقيقة تلقائياً لمنع سرقة حسابات الأطباء أو موظفي الاستقبال.</td>
        </tr>
        <tr>
          <td><b>منع الحجز العشوائي<br>(Anti-Spam Limits)</b></td>
          <td>قاعدة صارمة: لا يمكن لأي رقم حجز أكثر من <b>حجزين نشطين</b>، ولا يمكن للجهاز حجز أكثر من <b>4 حجوزات يومياً</b>.</td>
          <td>منع الأشخاص أو المنافسين من ملء جداول الأطباء بمواعيد وهمية لإغلاقها أمام المرضى الحقيقيين.</td>
        </tr>
        <tr>
          <td><b>القائمة السوداء المركزية<br>(Blacklist System)</b></td>
          <td>جدول <code>blocked_identifiers</code> لحظر أي IP أو رقم أو بصمة جهاز بضغطة زر من السوبر أدمن.</td>
          <td>طرد نهائي وفوري لأي مخترق أو مسيء للاستخدام من كافة خدمات المنصة.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ==================== SECTION 8: VEZEETA COMPARISON ==================== -->
  <div class="page-break"></div>
  <h1>8. المقارنة الشاملة مع فيزيتا (Vezeeta) واستراتيجية اكتساح السوق</h1>
  <p>مقارنة فنية وتجارية توضح الفارق الجذري بين النموذج التقليدي والجيل الجديد من منصة دُوري:</p>

  <table>
    <thead>
      <tr>
        <th style="width:25%;">وجه المقارنة</th>
        <th style="width:37%;">منصة فيزيتا (Vezeeta)</th>
        <th style="width:38%;">منصة دُوري (Dawry)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>نموذج التسعير للأطباء</b></td>
        <td><b>عمولة باهظة ومستنزفة:</b> خصم من 40 إلى 80 جنيهاً عن كل كشف، مما يكلف الطبيب آلاف الجنيهات شهرياً.</td>
        <td><b>اشتراك شهري/سنوي ثابت:</b> صفر عمولة على الكشوفات مهما زاد عدد المرضى، مما يوفر أرباحاً هائلة للعيادة.</td>
      </tr>
      <tr>
        <td><b>إدارة الطابور وصالة الانتظار</b></td>
        <td><b>لا يوجد طابور حي:</b> مجرد حجز وقت نظري؛ يذهب المريض وينتظر بالساعات في العيادة وسط الزحام.</td>
        <td><b>طابور ذكي حي بالدقيقة:</b> متابعة حية لعدد المرضى ووقت الدخول مع تنبيه <i>"تحرك من بيتك الآن"</i>.</td>
      </tr>
      <tr>
        <td><b>استقلالية الطبيب والعلامة</b></td>
        <td>تحتكر المريض وتوجهه لأطباء منافسين يدفعون إعلانات أكثر في نفس الصفحة.</td>
        <td>نظام تشغيل عيادة خاص بالطبيب (Clinic OS) يبرز علامته وتاريخه ومكانته أمام مرضاه.</td>
      </tr>
      <tr>
        <td><b>المرضى بدون حجز مسبق (Walk-in)</b></td>
        <td>تتجاهلهم تماماً؛ تركز فقط على الحجز عبر التطبيق مما يحدث فوضى بالعيادة.</td>
        <td>دمج ذكي وعادل في الطابور عبر كود الـ QR عند باب العيادة أو شاشة الاستقبال.</td>
      </tr>
      <tr>
        <td><b>أجهزة الطابور والنداء الصوتي</b></td>
        <td>لا تقدم أي حلول للصالة؛ تتطلب شراء أجهزة طابور بآلاف الجنيهات.</td>
        <td>رابط تلفزيون ذكي مجاني للمركز الطبي <code>/tv</code> مع نداء صوتي آلي بدون أي هاردوير مكلف.</td>
      </tr>
    </tbody>
  </table>

  <h2>استراتيجية اكتساح السوق المصري (The Blue Ocean Strategy):</h2>
  <div class="two-col-grid">
    <div class="feature-card">
      <h3>1. إغراء الأطباء بإنهاء "جباية العمولة":</h3>
      <p>الحملة الموجهة للأطباء واضحة وحاسمة: <i>"لماذا تدفع 10,000 جنيه شهرياً عمولة لفيزيتا بينما يمكنك دفع اشتراك رمزي ثابت مع دُوري وتحصل على طابور عادل يمنع الفوضى في عيادتك؟"</i></p>
    </div>
    <div class="feature-card">
      <h3>2. تحويل كل عيادة لماكينة تسويق مجانية:</h3>
      <p>بوضع ستاند أكليريك أنيق بكود QR عند باب كل عيادة، فإن كل مريض يأتي بدون حجز مسبق يمسح الكود على هاتفه ليأخذ رقمه، مما يكسب منصة دُوري آلاف المستخدمين يومياً بتكلفة تسويقية صفرية!</p>
    </div>
  </div>

  <div class="feature-card" style="margin-top:20px; background:#f0fdf4; border-color:#86efac;">
    <h3 style="color:#166534;">خلاصة التقرير والرؤية المستقبلية:</h3>
    <p style="color:#14532d;">
      تمتلك منصة <b>دُوري</b> اليوم كل المقومات المعمارية، والأمنية، والتشغيلية لتكون المنظومة رقم 1 لإدارة العيادات في مصر والشرق الأوسط. المشروع جاهز للتشغيل والربط والتوسع التجاري فوراً.
    </p>
  </div>

</body>
</html>`;

const htmlFilePath = path.join(__dirname, 'dawry-master-report.html');
const pdfFilePath = path.join(__dirname, 'تقرير_منصة_دوري_الشامل.pdf');
const brainPdfPath = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\81e70b50-3f7a-45bb-babd-59732a563f2b\\تقرير_منصة_دوري_الشامل.pdf';

fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
console.log('HTML Report written to:', htmlFilePath);

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

console.log('Executing Edge headless PDF generator...');
try {
  const edgeCmd = `"${edgePath}" --headless=new --disable-gpu --print-to-pdf="${pdfFilePath}" --no-pdf-header-footer "file:///${htmlFilePath.replace(/\\/g, '/')}"`;
  execSync(edgeCmd, { stdio: 'inherit' });
  console.log('PDF generated successfully at:', pdfFilePath);
  fs.copyFileSync(pdfFilePath, brainPdfPath);
  console.log('PDF copied to Brain Artifacts directory at:', brainPdfPath);
} catch (err) {
  console.error('PDF Generation Error:', err.message);
}
