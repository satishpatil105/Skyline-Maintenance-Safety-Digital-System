const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function clearMaintenanceData() {
  const uri = 'mongodb+srv://satishpatil_105:oI9RRwDtJgGpLNm8@cluster0.taadlwj.mongodb.net/Skyline_Project_Engineers?appName=Cluster0';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('Skyline_Project_Engineers');

  // 1. Fetch current data for backup
  const currentMnt = await db.collection('maintenance_records').find({}).toArray();
  const currentBd = await db.collection('breakdowns').find({}).toArray();
  const currentReq = await db.collection('maintenance_requests').find({}).toArray();

  const backupData = {
    backupDate: new Date().toISOString(),
    maintenance_records: currentMnt,
    breakdowns: currentBd,
    maintenance_requests: currentReq
  };

  const backupDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `maintenance_records_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[Backup] Saved ${currentMnt.length} maintenance records to ${backupFile}`);

  // 2. Remove maintenance record data from MongoDB Atlas
  const delMnt = await db.collection('maintenance_records').deleteMany({});
  const delBd = await db.collection('breakdowns').deleteMany({});
  const delReq = await db.collection('maintenance_requests').deleteMany({});
  console.log(`[MongoDB] Deleted ${delMnt.deletedCount} from maintenance_records`);
  console.log(`[MongoDB] Deleted ${delBd.deletedCount} from breakdowns`);
  console.log(`[MongoDB] Deleted ${delReq.deletedCount} from maintenance_requests`);

  await client.close();

  // 3. Clear maintenanceRecords array in local db.json files
  const localPaths = [
    path.join(__dirname, '..', 'data', 'db.json'),
    path.join(__dirname, '..', '..', 'backend', 'data', 'db.json'),
    path.join(__dirname, '..', '..', 'data', 'db.json'),
  ];

  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      try {
        const fileContent = fs.readFileSync(p, 'utf8');
        const json = JSON.parse(fileContent);
        json.maintenanceRecords = [];
        fs.writeFileSync(p, JSON.stringify(json, null, 2), 'utf8');
        console.log(`[Local JSON] Cleared maintenanceRecords in ${p}`);
      } catch (err) {
        console.error(`[Local JSON] Error updating ${p}:`, err.message);
      }
    }
  }

  console.log('\n✓ Maintenance record data successfully removed and safely backed up!');
}

clearMaintenanceData().catch(console.error);
