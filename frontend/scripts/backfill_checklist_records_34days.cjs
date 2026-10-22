/**
 * SKYMS - Checklist Record Module: 34-Day Historical Records Backfill
 * Period: 18 September 2026 to 21 October 2026 (inclusive, 34 calendar days)
 * 
 * Rules:
 * - Sunday is official plant weekly off.
 * - Exclude Sundays from routine daily scheduling.
 * - Preserve all 49 existing records without modification.
 * - Idempotent execution (running multiple times creates 0 duplicates).
 * - No fabricated inspection results or answers for unperformed historical days.
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI || 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';
const primaryDbName = process.env.MONGODB_DB_NAME || 'Skyline_Project_Engineers';
const secondaryDbName = 'skyms';

// Date configuration
const START_DATE = '2026-09-18';
const END_DATE = '2026-10-21';
const TOTAL_CALENDAR_DAYS = 34;

// Weekly Off Sundays within the period
const SUNDAYS = [
  '2026-09-20',
  '2026-09-27',
  '2026-10-04',
  '2026-10-11',
  '2026-10-18',
];

// Scheduled weekly inspection days (Thursdays + Saturday Sep 19 for Week 1)
const WEEKLY_DAYS = [
  '2026-09-19', // Week 1 (Sat)
  '2026-09-24', // Week 2 (Thu)
  '2026-10-01', // Week 3 (Thu)
  '2026-10-08', // Week 4 (Thu)
  '2026-10-15', // Week 5 (Thu)
];

// Scheduled monthly inspection days
const MONTHLY_DAYS = [
  '2026-09-21', // September
  '2026-10-01', // October
];

async function runBackfill() {
  console.log('=====================================================');
  console.log('SKYMS - Checklist Record Module 34-Day Backfill');
  console.log(`Period: ${START_DATE} to ${END_DATE} (${TOTAL_CALENDAR_DAYS} calendar days)`);
  console.log(`Weekly Off: ${SUNDAYS.length} Sundays excluded from routine daily scheduling`);
  console.log('=====================================================\n');

  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB Atlas cluster.');

  const db = client.db(primaryDbName);

  // 1. Fetch Checklist Master
  const checklistMaster = await db.collection('checklist_master').find().toArray();
  console.log(`Checklist Master loaded: ${checklistMaster.length} items`);

  // 2. Fetch Machine Master for metadata
  const machines = await db.collection('machines').find().toArray();
  const machineMap = {};
  for (const m of machines) {
    const id = m['Asset ID'] || m.assetId || m['Machine ID'];
    if (id) {
      machineMap[id] = {
        name: m['Machine Name'] || m.machineName || m.name || id,
        dept: m['Department'] || m.department || 'Production',
        operator: m['Assigned Operator'] || m.operator || m['Responsible Person'] || 'Unassigned',
      };
    }
  }

  // 3. Fetch Existing Records
  const existingRecords = await db.collection('checklist_records').find().toArray();
  console.log(`Existing records before backfill: ${existingRecords.length}`);

  // Build index of existing records to preserve
  const existingKeySet = new Set();
  const existingRecordIdSet = new Set();

  for (const r of existingRecords) {
    if (r.recordId) existingRecordIdSet.add(r.recordId);
    const cid = (r.checklistId || r.templateId || '').trim();
    const aid = (r.assetId || '').trim();
    const d = (r.date || '').trim();
    if (cid && d) {
      existingKeySet.add(`${cid}|${aid}|${d}`);
      existingKeySet.add(`${cid}|ALL|${d}`);
    }
  }

  // 4. Generate the 34 days
  const calendarDays = [];
  for (let i = 0; i < TOTAL_CALENDAR_DAYS; i++) {
    const cur = new Date(2026, 8, 18 + i);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    const isSunday = cur.getDay() === 0;
    calendarDays.push({ dateStr, isSunday, dayOfWeek: cur.getDay() });
  }

  console.log(`Generated ${calendarDays.length} calendar days.`);
  const workingDays = calendarDays.filter((d) => !d.isSunday);
  console.log(`Working days (excluding Sundays): ${workingDays.length}`);

  // 5. Generate scheduled items
  const newScheduledEntries = [];
  let skippedExisting = 0;

  for (const day of calendarDays) {
    if (day.isSunday) {
      // Rule 1: Do not generate routine daily records for Sundays
      continue;
    }

    for (const item of checklistMaster) {
      const freq = (item.Frequency || item.frequency || 'Daily').trim();
      const templateId = (item['Template ID'] || item['Checklist ID'] || '').trim();
      const masterAssetId = (item['Asset ID'] || item['Asset ID / Machine'] || 'ALL').trim();
      const checkPoint = item['Check Point'] || item['Check Point / Task'] || '';
      const category = item['Category'] || 'General Inspection';
      const standardRequirement = item['Standard Requirement'] || item['Standard Parameter'] || 'Visual / Normal';
      const actionIfNotOk = item['If Not OK Action'] || item['Action if Not OK'] || '';

      // Check frequency applicability
      if (freq === 'Daily') {
        // applicable every working day
      } else if (freq === 'Weekly') {
        if (!WEEKLY_DAYS.includes(day.dateStr)) continue;
      } else if (freq === 'Monthly') {
        if (!MONTHLY_DAYS.includes(day.dateStr)) continue;
      } else {
        continue;
      }

      // Check if already covered by an existing verified inspection
      const key = `${templateId}|${masterAssetId}|${day.dateStr}`;
      if (existingKeySet.has(key)) {
        skippedExisting++;
        continue;
      }

      // Machine lookup
      const machineInfo = machineMap[masterAssetId] || {
        name: masterAssetId === 'ALL' ? 'All Factory Machinery' : masterAssetId,
        dept: 'Production',
        operator: 'Unassigned',
      };

      const cleanAsset = masterAssetId.replace(/[^a-zA-Z0-9]/g, '');
      const recordId = `CHK-SCHED-${day.dateStr.replace(/-/g, '')}-${templateId}-${cleanAsset}`;

      if (existingRecordIdSet.has(recordId)) {
        skippedExisting++;
        continue;
      }

      const isToday = day.dateStr === '2026-10-21';
      const status = isToday ? 'Pending' : 'Overdue';

      const scheduledDoc = {
        recordId,
        submissionId: '',
        date: day.dateStr,
        shift: 'General (9 AM - 8 PM)',
        assetId: masterAssetId,
        machineName: machineInfo.name,
        checklistId: templateId,
        templateId,
        checkPoint,
        category,
        standardRequirement,
        frequency: freq,
        status, // Pending or Overdue
        response: '', // Empty response: accurate maintenance traceability, not fabricated
        remarks: '',
        actionIfNotOk,
        photoEvidence: '',
        operator: machineInfo.operator,
        userName: machineInfo.operator,
        userId: '',
        submittedBy: '',
        maintenanceTicketId: '',
        isHistoricalScheduled: true,
        requiresVerification: true,
        isSunday: false,
        createdAt: new Date(`${day.dateStr}T09:00:00+05:30`).toISOString(),
        lastUpdated: new Date(`${day.dateStr}T09:00:00+05:30`).toISOString(),
      };

      newScheduledEntries.push(scheduledDoc);
    }
  }

  console.log(`\nNew scheduled entries generated: ${newScheduledEntries.length}`);
  console.log(`Existing records preserved and skipped: ${skippedExisting}`);

  // 6. Bulk upsert into MongoDB Atlas collection checklist_records
  if (newScheduledEntries.length > 0) {
    const ops = newScheduledEntries.map((doc) => ({
      updateOne: {
        filter: { recordId: doc.recordId },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    }));

    console.log(`Writing ${ops.length} entries to MongoDB Atlas (${primaryDbName}.checklist_records)...`);
    const chunkSize = 500;
    for (let i = 0; i < ops.length; i += chunkSize) {
      const chunk = ops.slice(i, i + chunkSize);
      await db.collection('checklist_records').bulkWrite(chunk, { ordered: false });
    }
    console.log('✓ Bulk write to primary database completed.');

    // Also mirror to secondary DB 'skyms' if exists or accessible
    try {
      const secondaryDb = client.db(secondaryDbName);
      for (let i = 0; i < ops.length; i += chunkSize) {
        const chunk = ops.slice(i, i + chunkSize);
        await secondaryDb.collection('checklist_records').bulkWrite(chunk, { ordered: false });
      }
      console.log(`✓ Mirrored scheduled entries to database '${secondaryDbName}'.`);
    } catch (secErr) {
      console.warn(`Note: Secondary DB sync skipped (${secErr.message})`);
    }
  }

  // 7. Verify count in MongoDB Atlas
  const finalCount = await db.collection('checklist_records').countDocuments();
  console.log(`\nFinal checklist_records count in Atlas: ${finalCount}`);

  // Status breakdown
  const statusCounts = await db.collection('checklist_records').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Final counts by status:', statusCounts);

  // Frequency breakdown
  const freqCounts = await db.collection('checklist_records').aggregate([
    { $group: { _id: '$frequency', count: { $sum: 1 } } }
  ]).toArray();
  console.log('Final counts by frequency:', freqCounts);

  // Sunday verification
  const sundayRecords = await db.collection('checklist_records').countDocuments({ date: { $in: SUNDAYS } });
  console.log(`Sunday records in database (should be 0): ${sundayRecords}`);

  // 8. Update local db.json files
  console.log('\nSyncing local db.json files...');
  const allDbRecords = await db.collection('checklist_records').find().toArray();
  const cleanDbRecords = allDbRecords.map(({ _id, ...rest }) => rest);

  const localPaths = [
    path.join(__dirname, '..', 'data', 'db.json'),
    path.join(__dirname, '..', '..', 'backend', 'data', 'db.json'),
  ];

  for (const lp of localPaths) {
    if (fs.existsSync(lp)) {
      try {
        const raw = JSON.parse(fs.readFileSync(lp, 'utf8'));
        raw.checklistRecords = cleanDbRecords;
        fs.writeFileSync(lp, JSON.stringify(raw, null, 2), 'utf8');
        console.log(`✓ Updated ${lp} with ${cleanDbRecords.length} records.`);
      } catch (err) {
        console.warn(`Could not update ${lp}:`, err.message);
      }
    }
  }

  await client.close();
  console.log('\nBackfill completed successfully.');
}

runBackfill().catch((err) => {
  console.error('Fatal error running backfill:', err);
  process.exit(1);
});
