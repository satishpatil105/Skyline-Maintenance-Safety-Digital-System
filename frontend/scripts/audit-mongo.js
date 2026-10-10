const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

const srvUri = process.env.MONGODB_URI || "mongodb://localhost:27017/skyms";
const directShardUri = process.env.MONGODB_DIRECT_URI || "mongodb://localhost:27017/skyms";

async function auditCollections() {
    console.log(`[Audit] Connecting to MongoDB Atlas cluster...`);
    let client;
    const options = {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        tlsAllowInvalidCertificates: true,
    };

    try {
        client = new MongoClient(directShardUri, options);
        await client.connect();
        console.log("[Audit] Connected via directShardUri!");
    } catch (err1) {
        console.warn("[Audit] Direct Shard URI failed:", err1.message);
        try {
            client = new MongoClient(srvUri, options);
            await client.connect();
            console.log("[Audit] Connected via SRV URI!");
        } catch (err2) {
            console.error("[Audit] SRV URI failed:", err2.message);
            throw err2;
        }
    }
    try {
        const dbName = process.env.MONGODB_DB_NAME || "Skyline_Project_Engineers";
        const db = client.db(dbName);
        console.log(`[Audit] Connected successfully to '${dbName}' database.`);

        // List all collections in the database
        const collections = await db.listCollections().toArray();
        console.log(`\nFound ${collections.length} collections in database "${dbName}":\n`);

        const collectionCounts = {};
        for (const colInfo of collections) {
            const colName = colInfo.name;
            const count = await db.collection(colName).countDocuments();
            collectionCounts[colName] = count;
            console.log(`COLLECTION: ${colName} — ${count} records`);
        }

        // Write audit results to JSON
        const reportPath = path.join(__dirname, "audit-results.json");
        fs.writeFileSync(reportPath, JSON.stringify(collectionCounts, null, 2));
        console.log(`\nAudit counts saved to ${reportPath}`);

    } catch (err) {
        console.error("[Audit Error]:", err.message);
    } finally {
        if (client) await client.close();
    }
}

auditCollections();
