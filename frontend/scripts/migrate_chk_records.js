const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';

async function migrate() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Skyline_Project_Engineers');

  const allMnt = await db.collection('maintenance_records').find({}).toArray();
  console.log('Total maintenance_records initially:', allMnt.length);

  const chkRecords = allMnt.filter(r => {
    const id = r.recordId || r['Record ID'] || '';
    return id.startsWith('CHK-');
  });

  console.log('Found CHK records to migrate to checklist_records:', chkRecords.length);

  for (const r of chkRecords) {
    const isBad = r.result === 'Not OK' || r.status === 'Open' || (r.problem && r.problem.trim().length > 0);
    const recId = `CHK-REC-${(r.recordId || '').replace(/^CHK-/, '')}`;
    const chkDoc = {
      recordId: recId,
      submissionId: (r.recordId || '').substring(0, 19),
      date: r.date || '2026-10-14',
      shift: 'General (9 AM - 8 PM)',
      assetId: r.assetId || '',
      machineName: r.machineName || '',
      checklistId: r.checklistId || '',
      templateId: r.checklistId || '',
      checkPoint: r.checkPoint || '',
      category: 'Turret Punching Inspection',
      standardRequirement: 'Visual / Normal',
      frequency: 'Daily',
      response: r.result || (isBad ? 'Not OK' : 'OK'),
      status: isBad ? 'Not OK' : 'OK',
      remarks: r.problem || '',
      actionIfNotOk: isBad ? 'Report to Maintenance' : '',
      photoEvidence: r.photoEvidence || '',
      operator: r.userName || 'Satish Patil',
      userName: r.userName || 'Satish Patil',
      userId: r.userId || 'ADM-001',
      submittedBy: r.submittedBy || 'mrsatishpatil105@gmail.com',
      maintenanceTicketId: isBad ? (r.recordId || '').replace(/^CHK-/, 'BD-') : undefined,
      createdAt: r.createdAt || new Date().toISOString(),
      lastUpdated: r.lastUpdated || new Date().toISOString(),
    };

    await db.collection('checklist_records').updateOne(
      { recordId: recId },
      { $set: chkDoc },
      { upsert: true }
    );
  }

  console.log('✓ Migrated CHK records to checklist_records successfully.');

  // If there's a Not OK CHK record (like CHK-20261014-191711-06), make sure it has an entry in breakdowns too
  const notOkRecords = chkRecords.filter(r => r.result === 'Not OK' || (r.problem && r.problem.trim().length > 0));
  for (const nok of notOkRecords) {
    const bdId = (nok.recordId || '').replace(/^CHK-/, 'BD-');
    await db.collection('breakdowns').updateOne(
      { "Breakdown Ticket": bdId },
      {
        $set: {
          "Breakdown Ticket": bdId,
          "Asset ID": nok.assetId,
          "Machine Name": nok.machineName,
          "Reported By": nok.userName || nok.submittedBy,
          "Priority": "High",
          "Issue Description": nok.problem || `Checklist Issue: ${nok.checkPoint}`,
          "Status": "Open",
          "Reported Date": nok.date || '2026-10-14',
          "Source": "Checklist Inspection",
          "CreatedAt": nok.createdAt || new Date().toISOString(),
        }
      },
      { upsert: true }
    );
  }

  // Delete only OK / completed CHK inspection records from maintenance_records
  const delRes = await db.collection('maintenance_records').deleteMany({
    recordId: { $regex: '^CHK-' },
    result: 'OK',
    $or: [{ problem: '' }, { problem: { $exists: false } }]
  });

  console.log(`✓ Removed ${delRes.deletedCount} OK inspection records from maintenance_records.`);

  const remainingMnt = await db.collection('maintenance_records').find({}).toArray();
  console.log('Remaining maintenance_records count:', remainingMnt.length);
  remainingMnt.forEach(r => console.log(' ->', r.recordId, '| result:', r.result, '| problem:', r.problem, '| status:', r.status));

  const totalChkRecs = await db.collection('checklist_records').countDocuments();
  console.log('Total in checklist_records collection:', totalChkRecs);

  await client.close();
}

migrate().catch(console.error);
