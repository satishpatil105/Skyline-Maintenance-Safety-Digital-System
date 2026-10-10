import { MongoClient, Db } from "mongodb";

const rawUri = process.env.MONGODB_URI;
if (!rawUri && process.env.NODE_ENV === "production") {
  throw new Error("[MongoDB Error] MONGODB_URI environment variable is required in production mode.");
}
let uri = (rawUri || "mongodb://localhost:27017/skyms").trim();
if (uri.includes("/Skyline Maintenance & Safety")) {
  uri = uri.replace("/Skyline Maintenance & Safety", "");
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect().catch((err) => {
      console.error("[MongoDB] Failed to connect to MongoDB Atlas cluster:", err);
      throw new Error(`MongoDB Connection Error: Unable to connect to MongoDB Atlas database 'skyms'. ${err?.message || err}`);
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect().catch((err) => {
    console.error("[MongoDB] Failed to connect to MongoDB Atlas cluster:", err);
    throw new Error(`MongoDB Connection Error: Unable to connect to MongoDB Atlas database 'skyms'. ${err?.message || err}`);
  });
}

/**
 * Get the active database instance connected to MongoDB Atlas (skyms).
 */
export async function getMongoDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db("skyms");
}

/**
 * Direct access to all core MongoDB collections in the skyms database.
 */
export async function getCollections() {
  const db = await getMongoDb();
  return {
    users: db.collection("users"),
    machines: db.collection("machines"),
    maintenanceRecords: db.collection("maintenance_records"),
    safetyRecords: db.collection("safety_records"),
    checklistMaster: db.collection("checklist_master"),
    checklistLogs: db.collection("checklist_logs"),
    safetyDept: db.collection("safety_dept"),
    notifications: db.collection("notifications"),
    employees: db.collection("employees"),
    breakdowns: db.collection("breakdowns"),
    spareParts: db.collection("spare_parts"),
    trainingRecords: db.collection("training_records"),
    documents: db.collection("documents"),
    auditLogs: db.collection("audit_logs"),
  };
}

export default clientPromise;
