const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI || 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';
const primaryDbName = process.env.MONGODB_DB_NAME || 'Skyline_Project_Engineers';
const secondaryDbName = 'skyms';

const SUNDAYS = ['2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'];
const WEEKLY_DAYS = ['2026-09-19', '2026-09-24', '2026-10-01', '2026-10-08', '2026-10-15'];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(primaryDbName);

  // 1. Add Daily Checklist Item for SKY-ELE-MSCB-001 to checklist_master if not exists
  const dailyElecMasterDoc = {
    'Asset ID': 'SKY-ELE-MSCB-001',
    'Asset ID / Machine': 'SKY-ELE-MSCB-001',
    'Category': 'Electrical & Control',
    'Check Point': 'Changeover & Control Panel Phase Indication, Voltage (415V ± 1%) & ACB/MCCB Status',
    'Check Point / Task': 'Changeover & Control Panel Phase Indication, Voltage (415V ± 1%) & ACB/MCCB Status',
    'Standard Requirement': 'All R-Y-B phase indicating lamps glowing steady, busbar chamber temperature < 55°C, ACB/MCCB trip indicators clear, neutral isolation intact',
    'Standard Parameter': 'All R-Y-B phase indicating lamps glowing steady, busbar chamber temperature < 55°C, ACB/MCCB trip indicators clear, neutral isolation intact',
    'Frequency': 'Daily',
    'Response': 'OK / Not OK / NA',
    'Required Photo': 'No',
    'If Not OK Action': 'Inspect phase voltage imbalance immediately. Check ACB trip relay codes. Call senior electrical engineer if thermal sensor alerts.',
    'Active': 'Yes',
    'Status': 'Yes',
    'Template ID': 'CHK-DET-143',
    'Created Date': '2026-09-18',
    'createdAt': new Date('2026-09-18T08:00:00.000Z').toISOString(),
    'Shift / Date': 'General'
  };

  await db.collection('checklist_master').updateOne(
    { 'Template ID': 'CHK-DET-143' },
    { $setOnInsert: dailyElecMasterDoc },
    { upsert: true }
  );

  // 2. Generate 34-day schedule for SKY-ELE-MSCB-001 (29 working days + 5 weekly days)
  const calendarDays = [];
  for (let i = 0; i < 34; i++) {
    const cur = new Date(2026, 8, 18 + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    calendarDays.push({ dateStr, isSunday: cur.getDay() === 0 });
  }

  const newRecords = [];

  for (const day of calendarDays) {
    if (day.isSunday) continue; // Sunday weekly off rule

    const isToday = day.dateStr === '2026-10-21';
    const status = isToday ? 'Pending' : 'Overdue';

    // Daily record
    const dailyRecId = `CHK-SCHED-${day.dateStr.replace(/-/g, '')}-CHK-DET-143-SKYELEMSCB001`;
    newRecords.push({
      recordId: dailyRecId,
      submissionId: '',
      date: day.dateStr,
      shift: 'General (9 AM - 8 PM)',
      assetId: 'SKY-ELE-MSCB-001',
      machineName: 'Changeover & Control panel',
      checklistId: 'CHK-DET-143',
      templateId: 'CHK-DET-143',
      checkPoint: 'Changeover & Control Panel Phase Indication, Voltage (415V ± 1%) & ACB/MCCB Status',
      category: 'Electrical & Control',
      standardRequirement: 'All R-Y-B phase indicating lamps glowing steady, busbar chamber temperature < 55°C, ACB/MCCB trip indicators clear, neutral isolation intact',
      frequency: 'Daily',
      status: status,
      response: '',
      remarks: '',
      actionIfNotOk: 'Inspect phase voltage imbalance immediately. Check ACB trip relay codes. Call senior electrical engineer if thermal sensor alerts.',
      photoEvidence: '',
      operator: 'Satish Patil',
      userName: 'Satish Patil',
      userId: '',
      submittedBy: '',
      maintenanceTicketId: '',
      isHistoricalScheduled: true,
      requiresVerification: true,
      isSunday: false,
      createdAt: new Date(`${day.dateStr}T09:00:00+05:30`).toISOString(),
      lastUpdated: new Date(`${day.dateStr}T09:00:00+05:30`).toISOString(),
    });

    // Weekly record (CHK-DET-135)
    if (WEEKLY_DAYS.includes(day.dateStr)) {
      const weeklyRecId = `CHK-SCHED-${day.dateStr.replace(/-/g, '')}-CHK-DET-135-SKYELEMSCB001`;
      newRecords.push({
        recordId: weeklyRecId,
        submissionId: '',
        date: day.dateStr,
        shift: 'General (9 AM - 8 PM)',
        assetId: 'SKY-ELE-MSCB-001',
        machineName: 'Changeover & Control panel',
        checklistId: 'CHK-DET-135',
        templateId: 'CHK-DET-135',
        checkPoint: 'Main Electrical Switchgear Panel Earthing, Door Locks & Rubber Mats',
        category: 'Electrical & Safety',
        standardRequirement: 'Earth pit loop resistance < 2.0 Ohms, double earth body connections tight, panel doors locked shut with keys, Class-A electrical rubber mat clean',
        frequency: 'Weekly',
        status: status,
        response: '',
        remarks: '',
        actionIfNotOk: 'Water earth pit with salt/water if resistance is high. Tighten copper busbar earth lugs. Replace cracked insulation mat.',
        photoEvidence: '',
        operator: 'Satish Patil',
        userName: 'Satish Patil',
        userId: '',
        submittedBy: '',
        maintenanceTicketId: '',
        isHistoricalScheduled: true,
        requiresVerification: true,
        isSunday: false,
        createdAt: new Date(`${day.dateStr}T09:00:00+05:30`).toISOString(),
        lastUpdated: new Date(`${day.dateStr}T09:00:00+05:30`).toISOString(),
      });
    }
  }

  console.log('New records for SKY-ELE-MSCB-001 to upsert:', newRecords.length);

  // Bulk upsert into checklist_records
  const ops = newRecords.map(doc => ({
    updateOne: {
      filter: { recordId: doc.recordId },
      update: { $setOnInsert: doc },
      upsert: true
    }
  }));

  await db.collection('checklist_records').bulkWrite(ops, { ordered: false });
  console.log('✓ Upserted to primary DB ' + primaryDbName);

  // Secondary DB
  try {
    const secDb = client.db(secondaryDbName);
    await secDb.collection('checklist_master').updateOne(
      { 'Template ID': 'CHK-DET-143' },
      { $setOnInsert: dailyElecMasterDoc },
      { upsert: true }
    );
    await secDb.collection('checklist_records').bulkWrite(ops, { ordered: false });
    console.log('✓ Upserted to secondary DB ' + secondaryDbName);
  } catch (e) {
    console.warn('Secondary DB update skipped:', e.message);
  }

  // Update local db.json
  const allDbRecords = await db.collection('checklist_records').find().toArray();
  const cleanDbRecords = allDbRecords.map(({ _id, ...rest }) => rest);
  const allMasterItems = await db.collection('checklist_master').find().toArray();
  const cleanMasterItems = allMasterItems.map(({ _id, ...rest }) => rest);

  const localPaths = [
    path.join(__dirname, '..', 'data', 'db.json'),
    path.join(__dirname, '..', '..', 'backend', 'data', 'db.json'),
  ];

  for (const lp of localPaths) {
    if (fs.existsSync(lp)) {
      try {
        const raw = JSON.parse(fs.readFileSync(lp, 'utf8'));
        raw.checklistRecords = cleanDbRecords;
        raw.checklists = cleanMasterItems;
        fs.writeFileSync(lp, JSON.stringify(raw, null, 2), 'utf8');
        console.log('✓ Updated ' + lp);
      } catch (err) {
        console.warn('Could not update ' + lp + ':', err.message);
      }
    }
  }

  await client.close();
  console.log('Done.');
}
run().catch(console.error);
