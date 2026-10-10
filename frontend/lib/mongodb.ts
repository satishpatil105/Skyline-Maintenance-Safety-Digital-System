import { MongoClient, Db } from "mongodb";

function getUri(): string {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    // Only warn or provide fallback during build phase if not provided
    console.warn("[MongoDB Warning] MONGODB_URI not found.");
  }
  let u = (rawUri || "mongodb://localhost:27017/Skyline_Project_Engineers").trim();
  if (u.includes("/Skyline Maintenance & Safety")) {
    u = u.replace("/Skyline Maintenance & Safety", "");
  }
  return u;
}

const mongoOptions = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  socketTimeoutMS: 30000,
  maxPoolSize: 10,
};

/**
 * Create a fresh MongoClient promise lazily when a request is made.
 */
function createClientPromise(): Promise<MongoClient> {
  const uri = getUri();
  const c = new MongoClient(uri, mongoOptions);
  const p = c.connect().catch((err) => {
    // Clear the cached rejected promise so next request retries
    if (typeof global !== "undefined") {
      (global as any)._mongoClientPromise = undefined;
    }
    console.error("[MongoDB] Failed to connect to MongoDB Atlas cluster:", err?.message ?? err);
    throw new Error(
      `MongoDB Connection Error: Unable to connect to MongoDB Atlas database 'Skyline_Project_Engineers'. ${err?.message || err}`
    );
  });
  return p;
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = createClientPromise();
    }
    return global._mongoClientPromise;
  }
  if (!clientPromise) {
    clientPromise = createClientPromise();
  }
  return clientPromise;
}

/**
 * Get the active database instance connected to MongoDB Atlas (Skyline_Project_Engineers).
 * Always creates a fresh connection attempt if the previous one failed.
 */
export async function getMongoDb(): Promise<Db> {
  const connectedClient = await getClientPromise();
  const dbName = process.env.MONGODB_DB_NAME || "Skyline_Project_Engineers";
  return connectedClient.db(dbName);
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
    fireSafety: db.collection("fire_safety"),
    employeeSafety: db.collection("employee_safety"),
    hira: db.collection("hira"),
    environmental: db.collection("environmental"),
    otherSafety: db.collection("other_safety"),
  };
}

export default getClientPromise;
