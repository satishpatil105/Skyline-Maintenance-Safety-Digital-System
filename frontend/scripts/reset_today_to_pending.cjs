/**
 * SKYMS - Reset 2026-10-23 Today's Scheduled Checklist Records to Pending / Not Started
 * 
 * Complies with Section 5 & 6:
 * - New records must start in the existing Pending / Not Started state.
 * - Do not automatically mark checklist items as OK, Pass, or Completed.
 * - Do not invent inspection readings, remarks, signatures, or actual completion timestamps.
 * - Today's Pending must show pending records scheduled for 23-10-2026 (120 pending).
 * - Earlier pending records (21-10-2026: 120, 22-10-2026: 122) remain under their scheduled dates as Overdue.
 */

const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';
const primaryDbName = 'Skyline_Project_Engineers';
const secondaryDbName = 'skyms';

async function resetTodayToPending() {
  console.log("=== RESET 2026-10-23 RECORDS TO PENDING ===");
  const client = new MongoClient(uri);
  await client.connect();

  for (const dbName of [primaryDbName, secondaryDbName]) {
    try {
      const db = client.db(dbName);
      const count = await db.collection('checklist_records').countDocuments({ date: '2026-10-23' });
      console.log(`Found ${count} records for 2026-10-23 in ${dbName}.checklist_records`);

      const result = await db.collection('checklist_records').updateMany(
        { date: '2026-10-23' },
        {
          $set: {
            status: 'Pending',
            response: '',
            remarks: '',
            submissionId: '',
            isHistoricalScheduled: false,
            requiresVerification: false,
            lastUpdated: new Date().toISOString()
          }
        }
      );
      console.log(`Updated in ${dbName}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    } catch (e) {
      console.warn(`Error updating ${dbName}:`, e.message);
    }
  }

  // Update local frontend/data/db.json if exists
  const localDbPath = path.join(__dirname, '..', 'data', 'db.json');
  if (fs.existsSync(localDbPath)) {
    try {
      const raw = fs.readFileSync(localDbPath, 'utf8');
      const dbData = JSON.parse(raw);
      if (Array.isArray(dbData.checklistRecords)) {
        let modified = 0;
        dbData.checklistRecords.forEach(r => {
          if (r.date === '2026-10-23') {
            r.status = 'Pending';
            r.response = '';
            r.remarks = '';
            r.submissionId = '';
            r.isHistoricalScheduled = false;
            r.requiresVerification = false;
            r.lastUpdated = new Date().toISOString();
            modified++;
          }
        });
        fs.writeFileSync(localDbPath, JSON.stringify(dbData, null, 2), 'utf8');
        console.log(`Updated ${modified} records in frontend/data/db.json`);
      }
    } catch (e) {
      console.warn('Error updating local db.json:', e.message);
    }
  }

  // Update backend/data/db.json if exists
  const backendDbPath = path.join(__dirname, '..', '..', 'backend', 'data', 'db.json');
  if (fs.existsSync(backendDbPath)) {
    try {
      const raw = fs.readFileSync(backendDbPath, 'utf8');
      const dbData = JSON.parse(raw);
      if (Array.isArray(dbData.checklistRecords)) {
        let modified = 0;
        dbData.checklistRecords.forEach(r => {
          if (r.date === '2026-10-23') {
            r.status = 'Pending';
            r.response = '';
            r.remarks = '';
            r.submissionId = '';
            r.isHistoricalScheduled = false;
            r.requiresVerification = false;
            r.lastUpdated = new Date().toISOString();
            modified++;
          }
        });
        fs.writeFileSync(backendDbPath, JSON.stringify(dbData, null, 2), 'utf8');
        console.log(`Updated ${modified} records in backend/data/db.json`);
      }
    } catch (e) {
      console.warn('Error updating backend db.json:', e.message);
    }
  }

  await client.close();
  console.log("=== RESET COMPLETED SUCCESSFULLY ===");
  process.exit(0);
}

resetTodayToPending().catch(err => {
  console.error(err);
  process.exit(1);
});
