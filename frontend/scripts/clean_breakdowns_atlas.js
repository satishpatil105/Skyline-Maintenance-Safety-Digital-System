const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';

async function backupAndClean() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Skyline_Project_Engineers');

  console.log('Connecting to MongoDB Atlas Skyline_Project_Engineers...');

  // 1. Fetch current maintenance_records and breakdowns
  const mRecords = await db.collection('maintenance_records').find({}).toArray();
  const bRecords = await db.collection('breakdowns').find({}).toArray();

  const backupDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, 'backup_maintenance_pre_cleanup.json');

  const backupData = {
    timestamp: new Date().toISOString(),
    totalMaintenanceRecords: mRecords.length,
    totalBreakdowns: bRecords.length,
    maintenance_records: mRecords,
    breakdowns: bRecords
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`✓ Backup successfully saved to ${backupFile}`);

  // 2. Clear breakdown records from breakdowns collection
  const bDeleteResult = await db.collection('breakdowns').deleteMany({});
  console.log(`✓ Deleted ${bDeleteResult.deletedCount} records from breakdowns collection.`);

  // 3. Clear existing maintenance records from maintenance_records collection
  const mDeleteResult = await db.collection('maintenance_records').deleteMany({});
  console.log(`✓ Deleted ${mDeleteResult.deletedCount} records from maintenance_records collection.`);

  // Verify counts
  const finalBCount = await db.collection('breakdowns').countDocuments();
  const finalMCount = await db.collection('maintenance_records').countDocuments();
  console.log(`Final count in breakdowns collection: ${finalBCount}`);
  console.log(`Final count in maintenance_records collection: ${finalMCount}`);

  await client.close();
  console.log('Database cleanup completed successfully.');
}

backupAndClean().catch(console.error);
