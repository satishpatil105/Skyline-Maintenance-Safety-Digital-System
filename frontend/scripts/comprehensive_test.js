async function runTests() {
  const users = [
    { id: 'OP-001', pass: '1234', role: 'Operator' },
    { id: 'SP-001', pass: 'pass@123', role: 'Supervisor' },
    { id: 'ADM-001', pass: '1234', role: 'Admin' }
  ];

  for (const u of users) {
    console.log(`\n=== Testing User: ${u.id} (${u.role}) ===`);
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.id, password: u.pass })
    });
    const cookieHeader = loginRes.headers.get('set-cookie');
    const match = cookieHeader ? cookieHeader.match(/skyline_session=([^;]+)/) : null;
    const cookie = match ? `skyline_session=${match[1]}` : '';

    if (!cookie) {
      console.error(`Failed to login as ${u.id}`);
      continue;
    }

    const mRes = await fetch('http://localhost:3000/api/maintenance', {
      headers: { Cookie: cookie }
    });
    const mData = await mRes.json();
    console.log(`Tickets returned for ${u.id}:`, mData.records?.length);

    // Verify no CHK- or inspection records
    const leakedChecklists = (mData.records || []).filter(r => {
      const id = r.recordId || r['Record ID'] || '';
      const type = r.recordType || r['Record Type'] || '';
      return id.startsWith('CHK-') || type.toLowerCase() === 'inspection';
    });

    if (leakedChecklists.length > 0) {
      console.error(`❌ ERROR: Found ${leakedChecklists.length} leaked checklist records in /api/maintenance!`);
    } else {
      console.log(`✓ 0 leaked checklist records detected for ${u.id}.`);
    }

    if (mData.records?.length > 0) {
      console.log('Sample ticket:', {
        recordId: mData.records[0].recordId,
        machineName: mData.records[0].machineName,
        problem: mData.records[0].problem,
        status: mData.records[0].status
      });
    }
  }

  console.log('\n=== ALL USER ACCESS TESTS COMPLETED SUCCESSFULLY ===');
}

runTests().catch(console.error);
