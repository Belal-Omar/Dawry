const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { resolve(buf); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3001${path}`, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { resolve(buf); }
      });
    }).on('error', reject);
  });
}

function del(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path,
      method: 'DELETE'
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { resolve(buf); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  // Clean up any test vacations for doc 1
  const existingVacations = await get('/api/doctor/1/vacations');
  if (existingVacations.vacations) {
    for (const v of existingVacations.vacations) {
      await del(`/api/doctor/1/vacations/${v.id}`);
    }
  }

  console.log('--- TEST 1: RECEPTION WALK-IN FUTURE DATE ---');
  const futureDate = '2026-11-28';
  const walkinRes = await post('/api/receptionist/1/walkin', {
    patient_name: 'سارة خالد المنشاوي',
    patient_phone: '01099887766',
    notes: 'حجز مسبق من العيادة للأسبوع القادم',
    is_emergency: false,
    appointment_date: futureDate,
    appointment_time: '19:30'
  });
  console.log('Walkin Future Result:', walkinRes);
  if (!walkinRes.success || walkinRes.queue_number < 1) {
    throw new Error('Failed to register walk-in for future date');
  }

  console.log('\n--- TEST 2: CHECK TRACKING FOR FUTURE WALKIN ---');
  const trackRes = await get(`/api/public/bookings/track/${walkinRes.booking_code}`);
  console.log('Tracking Result:', {
    success: trackRes.success,
    is_future: trackRes.date_info?.is_future,
    days_remaining: trackRes.date_info?.days_remaining,
    appointment_date: trackRes.date_info?.appointment_date,
    queue_number: trackRes.queue?.queue_number,
    patients_ahead: trackRes.queue?.patients_ahead
  });
  if (!trackRes.date_info?.is_future || trackRes.date_info?.appointment_date !== futureDate) {
    throw new Error('Tracking does not correctly identify future walk-in appointment');
  }

  console.log('\n--- TEST 3: DOCTOR VACATIONS MANAGEMENT ---');
  const vacationStart = '2026-12-05';
  const vacationEnd = '2026-12-08';
  const addVacationRes = await post('/api/doctor/1/vacations', {
    start_date: vacationStart,
    end_date: vacationEnd,
    reason: 'المؤتمر الدولي لأمراض القلب'
  });
  console.log('Add Vacation Result:', addVacationRes);
  if (!addVacationRes.success || !addVacationRes.vacation_id) {
    throw new Error('Failed to add doctor vacation');
  }

  console.log('\n--- TEST 4: CHECK SLOTS DURING VACATION DATE ---');
  const slotVacationRes = await get(`/api/public/doctors/1/available-slots?date=${vacationStart}`);
  console.log('Slot Vacation Check:', slotVacationRes);
  if (slotVacationRes.available !== false || !slotVacationRes.is_vacation) {
    throw new Error('Slots were not blocked during doctor vacation');
  }

  console.log('\n--- TEST 5: DELETE VACATION & RE-ENABLE SLOTS ---');
  const delVacationRes = await del(`/api/doctor/1/vacations/${addVacationRes.vacation_id}`);
  console.log('Delete Vacation Result:', delVacationRes);

  const slotReopenRes = await get(`/api/public/doctors/1/available-slots?date=${vacationStart}`);
  console.log('Slot Reopen Check Available:', slotReopenRes.available, 'Slots count:', slotReopenRes.slots?.length);
  if (!slotReopenRes.available || slotReopenRes.slots?.length === 0) {
    throw new Error('Slots were not re-enabled after vacation cancellation');
  }

  console.log('\n ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
