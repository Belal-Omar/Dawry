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

async function run() {
  console.log('--- TEST 1: REJECT INVALID PHONE NUMBER IN BOOKING ---');
  const badBooking = await post('/api/public/bookings', {
    doctor_id: 1,
    patient_name: 'مريض تجريبي',
    patient_phone: '12345', // clearly invalid
    appointment_date: '2026-11-28',
    appointment_time: '20:00'
  });
  console.log('Bad Booking Result:', badBooking);
  if (badBooking.success !== false || !badBooking.message.includes('11')) {
    throw new Error('Server failed to reject invalid phone number in public booking');
  }

  console.log('\n--- TEST 2: REJECT INVALID PHONE NUMBER IN RECEPTION WALKIN ---');
  const badWalkin = await post('/api/receptionist/1/walkin', {
    patient_name: 'مريض تجريبي',
    patient_phone: '0223456789', // landline not mobile
    appointment_date: '2026-11-28',
    appointment_time: '20:00'
  });
  console.log('Bad Walkin Result:', badWalkin);
  if (badWalkin.success !== false || !badWalkin.message.includes('11')) {
    throw new Error('Server failed to reject invalid phone number in walk-in');
  }

  console.log('\n--- TEST 3: ACCEPT VALID EGYPTIAN MOBILE NUMBER IN WALKIN ---');
  const goodWalkin = await post('/api/receptionist/1/walkin', {
    patient_name: 'مريض جديد مؤكد',
    patient_phone: '01012345678', // valid Egyptian mobile
    appointment_date: '2026-11-28',
    appointment_time: '20:00'
  });
  console.log('Good Walkin Result:', goodWalkin);
  if (!goodWalkin.success || !goodWalkin.booking_code) {
    throw new Error('Server failed to accept valid Egyptian mobile number');
  }

  console.log('\nALL PHONE VALIDATION TESTS PASSED 100%!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
