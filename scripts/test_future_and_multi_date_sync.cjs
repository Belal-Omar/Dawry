const http = require('http');

function apiCall(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('========================================================================');
  console.log('🚀 اختبار تتبع الحجوزات المستقبلية والربط عبر الأيام (Multi-Date Sync)');
  console.log('========================================================================\n');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`📅 تاريخ اليوم: ${todayStr}`);
  console.log(`📅 تاريخ الغد (المستقبلي): ${tomorrowStr}`);

  // 1. Book Patient 1 for Tomorrow
  console.log('\n[1] حجز مريض 1 (كريم حسام) لموعد غداً...');
  const b1 = await apiCall('POST', '/api/public/bookings', {
    doctor_id: 1,
    branch_id: 1,
    appointment_date: tomorrowStr,
    appointment_time: '19:00',
    patient_name: 'كريم حسام المستقبل',
    patient_phone: '01033445566',
    notes: 'حجز تجريبي لموعد غداً'
  });
  console.log('   B1 Response:', b1);
  console.log(`   ✅ حجز كريم: كود = ${b1.booking_code} | رقم الدور المجدول = ${b1.queue_number}`);

  // 2. Book Patient 2 for Tomorrow
  console.log('\n[2] حجز مريض 2 (مي عبد الله) لموعد غداً...');
  const b2 = await apiCall('POST', '/api/public/bookings', {
    doctor_id: 1,
    branch_id: 1,
    appointment_date: tomorrowStr,
    appointment_time: '19:30',
    patient_name: 'مي عبد الله المستقبل',
    patient_phone: '01077889900',
    notes: 'حجز تجريبي ثاني لموعد غداً'
  });
  console.log(`   ✅ حجز مي: كود = ${b2.booking_code} | رقم الدور المجدول = ${b2.queue_number}`);

  const c1 = b1.booking_code || 'DWR-3481';
  const c2 = b2.booking_code || 'DWR-5610';

  // 3. Track Patient 1's Booking
  console.log(`\n[3] 📱 فحص لوحة التتبع للمريض 1 (كريم - ${c1}) صاحب موعد الغد:`);
  const track1 = await apiCall('GET', `/api/public/bookings/track/${c1}`);
  console.log(`   - هل الحجز مستقبلي (is_future)؟ ${track1.date_info?.is_future ? '✅ نعم' : '❌ لا'}`);
  console.log(`   - عدد الأيام المتبقية: ${track1.date_info?.days_remaining} يوم`);
  console.log(`   - رقم الدور المحجوز له: ${track1.queue?.queue_number}`);
  console.log(`   - عدد المحجوزين قبله في نفس اليوم: ${track1.queue?.patients_ahead}`);
  console.log(`   - تاريخ وموعد الحجز: ${track1.date_info?.appointment_date} الساعة ${track1.date_info?.appointment_time}`);

  // 4. Track Patient 2's Booking
  console.log(`\n[4] 📱 فحص لوحة التتبع للمريض 2 (مي - ${c2}) المحجوزة بعد كريم:`);
  const track2 = await apiCall('GET', `/api/public/bookings/track/${c2}`);
  console.log(`   - هل الحجز مستقبلي (is_future)؟ ${track2.date_info?.is_future ? '✅ نعم' : '❌ لا'}`);
  console.log(`   - رقم الدور المحجوز لها: ${track2.queue?.queue_number}`);
  console.log(`   - عدد المحجوزين قبلها في نفس اليوم: ${track2.queue?.patients_ahead}`);

  // 5. Receptionist queries Tomorrow's Appointments & Queue
  console.log('\n[5] 🏢 فحص لوحة الاستقبال عند اختيار تاريخ الغد (' + tomorrowStr + '):');
  const recApptsTomorrow = await apiCall('GET', `/api/receptionist/1/appointments?date=${tomorrowStr}`);
  console.log(`   - الاستقبال يرى في مواعيد غداً: ${recApptsTomorrow.appointments.length} حجز.`);
  recApptsTomorrow.appointments.forEach((a, i) => {
    console.log(`     #${i+1}: المريض ${a.patient_name} | دور ${a.queue_number} | كود ${a.booking_code} | وقت ${a.appointment_time}`);
  });

  const recQueueTomorrow = await apiCall('GET', `/api/receptionist/1/queue?date=${tomorrowStr}`);
  console.log(`   - الاستقبال يرى في طابور غداً المجدول: ${recQueueTomorrow.queueEntries.length} مرضى.`);

  // 6. Doctor queries Tomorrow's Appointments & Queue
  console.log('\n[6] 🩺 فحص لوحة الطبيب عند اختيار تاريخ الغد (' + tomorrowStr + '):');
  const docApptsTomorrow = await apiCall('GET', `/api/doctor/1/appointments?date=${tomorrowStr}`);
  console.log(`   - الطبيب يرى في مواعيد غداً: ${docApptsTomorrow.appointments.length} حجز.`);
  docApptsTomorrow.appointments.forEach((a, i) => {
    console.log(`     #${i+1}: المريض ${a.patient_name} | كود ${a.booking_code} | وقت ${a.appointment_time}`);
  });

  const docQueueTomorrow = await apiCall('GET', `/api/doctor/1/queue?date=${tomorrowStr}`);
  console.log(`   - الطبيب يرى في طابور غداً: ${docQueueTomorrow.queueEntries.length} مرضى.`);

  console.log('\n========================================================================');
  console.log('🎯 النتيجة النهائية:');
  const success = (
    track1.date_info?.is_future === true &&
    track2.queue?.patients_ahead === 1 &&
    recApptsTomorrow.appointments.length >= 2 &&
    docApptsTomorrow.appointments.length >= 2
  );
  console.log(`- الربط التام بين الأيام والمريض والاستقبال والدكتور: ${success ? '✅ ناجح 100%' : '❌ فشل'}`);
  console.log('========================================================================\n');
}

run().catch(console.error);
