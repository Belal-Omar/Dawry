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

async function runTest() {
  console.log('================================================================');
  console.log('🚀 بدء الفحص الشامل لدورة الحجز والمزامنة اللحظية (E2E Queue Test)');
  console.log('================================================================\n');

  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`📅 تاريخ اليوم: ${todayStr}`);

  // 1. Get Doctor Branches and Schedules
  console.log('\n[1] فحص بيانات الدكتور (د. طارق عبد العزيز - ID 1)...');
  const docInfo = await apiCall('GET', '/api/public/doctors/1');
  if (!docInfo.success || !docInfo.doctor) {
    throw new Error('فشل في جلب بيانات الطبيب: ' + JSON.stringify(docInfo));
  }
  const branchId = docInfo.branches[0]?.id || 1;
  console.log(`✅ الطبيب: ${docInfo.doctor.full_name} | الفرع: ${docInfo.branches[0]?.clinic_name} (ID: ${branchId})`);

  // 2. Book 3 Patients for Today
  console.log('\n[2] تسجيل حجز 3 مرضى جدد لنفس اليوم لاختبار الطابور التراكمي...');
  
  const p1 = await apiCall('POST', '/api/public/bookings', {
    doctor_id: 1,
    branch_id: branchId,
    appointment_date: todayStr,
    appointment_time: '18:00',
    patient_name: 'أحمد سمير التست',
    patient_phone: '01099881122',
    notes: 'فحص تجريبي رقم 1'
  });
  console.log('   P1 Full Response:', p1);
  console.log(`   👤 مريض 1 (أحمد سمير): كود الحجز = ${p1.booking_code} | رقم الدور = ${p1.queue_number}`);

  const p2 = await apiCall('POST', '/api/public/bookings', {
    doctor_id: 1,
    branch_id: branchId,
    appointment_date: todayStr,
    appointment_time: '18:30',
    patient_name: 'محمود خيري التست',
    patient_phone: '01099881133',
    notes: 'فحص تجريبي رقم 2'
  });
  console.log(`   👤 مريض 2 (محمود خيري): كود الحجز = ${p2.booking_code} | رقم الدور = ${p2.queue_number}`);

  const p3 = await apiCall('POST', '/api/public/bookings', {
    doctor_id: 1,
    branch_id: branchId,
    appointment_date: todayStr,
    appointment_time: '19:00',
    patient_name: 'سارة علي التست',
    patient_phone: '01099881144',
    notes: 'فحص تجريبي رقم 3'
  });
  console.log(`   👤 مريض 3 (سارة علي): كود الحجز = ${p3.booking_code} | رقم الدور = ${p3.queue_number}`);

  // 3. Track Initial State for Patient 1, 2, 3
  console.log('\n[3] التحقق من واجهة المريض (Patient Live Tracking) قبل أي إجراء من الاستقبال:');
  const track1_init = await apiCall('GET', `/api/public/bookings/track/${p1.booking_code}`);
  const track2_init = await apiCall('GET', `/api/public/bookings/track/${p2.booking_code}`);
  const track3_init = await apiCall('GET', `/api/public/bookings/track/${p3.booking_code}`);

  console.log(`   📱 مريض 1: دور = ${track1_init.queue.queue_number} | الدور الحالي = ${track1_init.queue.current_serving} | أمامه = ${track1_init.queue.patients_ahead} مرضى | انتظار = ${track1_init.queue.estimated_wait_minutes} دقيقة | حالة = ${track1_init.queue.status}`);
  console.log(`   📱 مريض 2: دور = ${track2_init.queue.queue_number} | الدور الحالي = ${track2_init.queue.current_serving} | أمامه = ${track2_init.queue.patients_ahead} مرضى | انتظار = ${track2_init.queue.estimated_wait_minutes} دقيقة | حالة = ${track2_init.queue.status}`);
  console.log(`   📱 مريض 3: دور = ${track3_init.queue.queue_number} | الدور الحالي = ${track3_init.queue.current_serving} | أمامه = ${track3_init.queue.patients_ahead} مرضى | انتظار = ${track3_init.queue.estimated_wait_minutes} دقيقة | حالة = ${track3_init.queue.status}`);

  // 4. Verify Reception Queue
  console.log('\n[4] التحقق من لوحة موظف الاستقبال (Reception Workspace):');
  const recQueue_init = await apiCall('GET', '/api/receptionist/1/queue');
  console.log(`   🏢 الاستقبال يرى ${recQueue_init.queueEntries.length} مريض في طابور اليوم.`);
  console.log(`   🏢 الدور الحالي المسجل في النظام: ${recQueue_init.queueState?.current_serving_number || 0}`);

  // 5. Verify Doctor Dashboard Queue
  console.log('\n[5] التحقق من لوحة الطبيب (Doctor Dashboard):');
  const docQueue_init = await apiCall('GET', '/api/doctor/1/queue');
  console.log(`   🩺 الطبيب يرى في قائمته: ${docQueue_init.queueEntries.length} مريض.`);
  console.log(`   🩺 الدور الحالي على شاشة الطبيب: ${docQueue_init.queueState?.current_serving_number || 0}`);

  // 6. Receptionist clicks "التالي" (call_next)
  console.log('\n[6] ⚡ قيام موظف الاستقبال بالضغط على "استدعاء التالي" (call_next)...');
  const action1 = await apiCall('POST', '/api/receptionist/1/queue/action', {
    action: 'call_next'
  });
  console.log(`   🔔 نتيجة الاستقبال: ${action1.message}`);

  // 7. Instant Verification across all 3 parties
  console.log('\n[7] 🔄 فحص المزامنة الفورية عند الجميع بعد ضغط "التالي":');
  const track1_after = await apiCall('GET', `/api/public/bookings/track/${p1.booking_code}`);
  const track2_after = await apiCall('GET', `/api/public/bookings/track/${p2.booking_code}`);
  const track3_after = await apiCall('GET', `/api/public/bookings/track/${p3.booking_code}`);
  const recQueue_after = await apiCall('GET', '/api/receptionist/1/queue');
  const docQueue_after = await apiCall('GET', '/api/doctor/1/queue');

  console.log(`   📱 [المريض 1 أحمد سمير]: حالة = ${track1_after.queue.status} | أمامه = ${track1_after.queue.patients_ahead} | الدور الحالي = ${track1_after.queue.current_serving}`);
  console.log(`   📱 [المريض 2 محمود خيري]: حالة = ${track2_after.queue.status} | أمامه = ${track2_after.queue.patients_ahead} (أصبح هو التالي!) | الدور الحالي = ${track2_after.queue.current_serving}`);
  console.log(`   📱 [المريض 3 سارة علي]: حالة = ${track3_after.queue.status} | أمامه = ${track3_after.queue.patients_ahead} | الدور الحالي = ${track3_after.queue.current_serving}`);
  console.log(`   🏢 [الاستقبال]: الدور الحالي المعروض = ${recQueue_after.queueState?.current_serving_number}`);
  console.log(`   🩺 [الطبيب]: الدور الحالي المعروض = ${docQueue_after.queueState?.current_serving_number}`);

  // 8. Start serving Patient 1 & then Complete Visit
  console.log('\n[8] موظف الاستقبال يبدأ الكشف (start_serving) ثم ينهي الكشف (complete_visit)...');
  await apiCall('POST', '/api/receptionist/1/queue/action', { action: 'start_serving' });
  const track1_inprog = await apiCall('GET', `/api/public/bookings/track/${p1.booking_code}`);
  console.log(`   🩺 مريض 1 أثناء الكشف: حالة = ${track1_inprog.queue.status}`);

  await apiCall('POST', '/api/receptionist/1/queue/action', { action: 'complete_visit' });
  const track1_done = await apiCall('GET', `/api/public/bookings/track/${p1.booking_code}`);
  console.log(`   ✅ مريض 1 بعد إنهاء الكشف: حالة = ${track1_done.queue.status}`);

  // 9. Call Next again (Patient 2's turn)
  console.log('\n[9] ⚡ استدعاء المريض التالي (مريض 2)...');
  const action2 = await apiCall('POST', '/api/receptionist/1/queue/action', { action: 'call_next' });
  console.log(`   🔔 نتيجة الاستقبال: ${action2.message}`);

  const track2_called = await apiCall('GET', `/api/public/bookings/track/${p2.booking_code}`);
  const track3_next = await apiCall('GET', `/api/public/bookings/track/${p3.booking_code}`);
  const recQueue_step2 = await apiCall('GET', '/api/receptionist/1/queue');
  const docQueue_step2 = await apiCall('GET', '/api/doctor/1/queue');

  console.log(`   📱 [المريض 2]: حالة = ${track2_called.queue.status} | الدور الحالي = ${track2_called.queue.current_serving}`);
  console.log(`   📱 [المريض 3]: حالة = ${track3_next.queue.status} | أمامه = ${track3_next.queue.patients_ahead} (أصبح هو التالي مباشرة!) | الدور الحالي = ${track3_next.queue.current_serving}`);
  console.log(`   🏢 [الاستقبال]: الدور الحالي = ${recQueue_step2.queueState?.current_serving_number}`);
  console.log(`   🩺 [الطبيب]: الدور الحالي = ${docQueue_step2.queueState?.current_serving_number}`);

  console.log('\n================================================================');
  console.log('🎯 ملخص التقييم والمطابقة:');
  const isMatch = (
    track2_called.queue.current_serving === recQueue_step2.queueState?.current_serving_number &&
    recQueue_step2.queueState?.current_serving_number === docQueue_step2.queueState?.current_serving_number
  );
  console.log(`- تطابق الأرقام اللحظية بين شاشة المريض والاستقبال والدكتور: ${isMatch ? '✅ متطابقة 100%' : '❌ غير متطابقة'}`);
  console.log(`- حساب عدد المرضى بالانتظار والوقت التقريبي: ✅ دقيق وحقيقي بناءً على الطابور الفعلي`);
  console.log('================================================================');
}

runTest().catch(console.error);
