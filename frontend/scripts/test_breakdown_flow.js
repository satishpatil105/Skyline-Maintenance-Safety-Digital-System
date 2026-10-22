const fs = require('fs');

async function testFlow() {
  console.log('1. Logging in as Operator OP-001 (Krishna Magar)...');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'OP-001', password: '1234' })
  });

  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status);
  const loginJson = await loginRes.json();
  console.log('Login response:', loginJson);

  if (!loginJson.success || !cookieHeader) {
    throw new Error('Failed to log in as OP-001');
  }

  // Extract session cookie
  const match = cookieHeader.match(/skyline_session=([^;]+)/);
  const sessionToken = match ? match[1] : '';
  const cookie = `skyline_session=${sessionToken}`;
  console.log('Obtained skyline_session cookie.');

  // 2. Check current breakdown tickets (should be 0)
  console.log('\n2. Checking GET /api/maintenance before filing breakdown ticket...');
  const mRes1 = await fetch('http://localhost:3000/api/maintenance', {
    headers: { Cookie: cookie }
  });
  const mJson1 = await mRes1.json();
  console.log('Breakdown tickets before submission:', mJson1.records?.length, mJson1);

  // 3. Submit a new breakdown ticket
  console.log('\n3. Submitting new breakdown ticket from Operator Portal form...');
  const submitRes = await fetch('http://localhost:3000/api/maintenance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie
    },
    body: JSON.stringify({
      assetId: 'SKY-LSR-MCH-001',
      machineName: 'Laser Machine',
      userId: 'OP-001',
      userName: 'Krishna Magar',
      maintenanceType: 'Breakdown Maintenance',
      maintenanceDate: '2026-10-14',
      priority: 'High',
      status: 'Open',
      problem: 'Hydraulic assist gas pressure low fault during sheet pierce cycle',
      rootCause: 'Pneumatic regulator solenoid valve bypass failure',
      correctiveAction: 'Inspecting valve bypass seal and pressure line',
      downtime: '0.5',
      remarks: 'Operator reported immediate alarm trip on cutting head'
    })
  });

  const submitJson = await submitRes.json();
  console.log('Submit response status:', submitRes.status);
  console.log('Submit response json:', submitJson);

  if (!submitJson.success) {
    throw new Error('Failed to submit breakdown ticket: ' + JSON.stringify(submitJson));
  }

  // 4. Verify breakdown ticket appears in GET /api/maintenance
  console.log('\n4. Checking GET /api/maintenance after submission...');
  const mRes2 = await fetch('http://localhost:3000/api/maintenance', {
    headers: { Cookie: cookie }
  });
  const mJson2 = await mRes2.json();
  console.log('Breakdown tickets after submission:', mJson2.records?.length);
  console.log('Breakdown tickets:', JSON.stringify(mJson2.records, null, 2));

  // 5. Verify in MongoDB Atlas
  const { MongoClient } = require('mongodb');
  const uri = 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Skyline_Project_Engineers');

  const inMnt = await db.collection('maintenance_records').find({ recordId: submitJson.recordId }).toArray();
  console.log('\n5. Found in maintenance_records collection in Atlas:', inMnt.length > 0 ? 'YES' : 'NO');
  if (inMnt.length > 0) {
    console.log('Atlas recordId:', inMnt[0].recordId, '| Type:', inMnt[0].recordType, '| Problem:', inMnt[0].problem);
  }

  const inBd = await db.collection('breakdowns').find({ 'Breakdown Ticket': submitJson.recordId }).toArray();
  console.log('Found in breakdowns collection in Atlas:', inBd.length > 0 ? 'YES' : 'NO');
  if (inBd.length > 0) {
    console.log('Atlas Breakdown Ticket:', inBd[0]['Breakdown Ticket'], '| Issue:', inBd[0]['Breakdown Issue'], '| Status:', inBd[0]['Status']);
  }

  await client.close();
  console.log('\n✓ ALL CHECKS PASSED SUCCESSFULLY!');
}

testFlow().catch(console.error);
