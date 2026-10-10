import json
import os
import certifi
from pymongo import MongoClient

db_name = os.environ.get("MONGODB_DB_NAME", "Skyline_Project_Engineers")
uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/Skyline_Project_Engineers")

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_json_path = os.path.join(base_dir, "data", "db.json")

print("======================================================================")
print(f"   SKYLINE ERP — PYTHON MONGO ATLAS SEEDER FOR DB: {db_name}")
print("======================================================================\n")

if not os.path.exists(db_json_path):
    print(f"[Error] {db_json_path} not found!")
    exit(1)

with open(db_json_path, "r", encoding="utf-8") as f:
    raw_db = json.load(f)

collections_map = {
    "machines": raw_db.get("machines", []),
    "users": raw_db.get("users", []),
    "maintenance_records": raw_db.get("maintenanceRecords", []),
    "safety_records": raw_db.get("safetyRecords", []),
    "checklist_master": raw_db.get("checklists", raw_db.get("checklist_master", [])),
    "spare_parts": raw_db.get("pmParts", raw_db.get("spare_parts", [])),
    "documents": raw_db.get("documentRegister", raw_db.get("documents", [])),
    "notifications": raw_db.get("notifications", []),
    "monthly_compliance": raw_db.get("monthlyCompliance", raw_db.get("monthly_compliance", [])),
    "fire_safety": raw_db.get("fire_safety", []),
    "employee_safety": raw_db.get("employee_safety", []),
    "hira": raw_db.get("hira", []),
    "environmental": raw_db.get("environmental", []),
    "other_safety": raw_db.get("other_safety", []),
    "employees": raw_db.get("employees", []),
    "checklist_logs": raw_db.get("checklist_logs", []),
    "breakdowns": raw_db.get("breakdowns", []),
    "training_records": raw_db.get("training_records", []),
    "audit_logs": raw_db.get("audit_logs", [])
}

print(f"[Connecting] Connecting to MongoDB Atlas via PyMongo (TLS certifi)...")
client = MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=10000)

try:
    # Test connection
    client.admin.command('ping')
    print("[Success] Connected to MongoDB Atlas Cluster successfully!\n")
    
    db = client[db_name]
    
    total_docs = 0
    print(f"{'Collection Name':<22} | {'Records Inserted':<16} | Status")
    print("-" * 55)
    
    for col_name, docs in collections_map.items():
        collection = db[col_name]
        collection.delete_many({}) # Clear existing to avoid duplicate key errors
        
        clean_docs = []
        for d in docs:
            doc_copy = dict(d)
            if "_id" in doc_copy:
                del doc_copy["_id"]
            clean_docs.append(doc_copy)
            
        if clean_docs:
            collection.insert_many(clean_docs)
            
        count = collection.count_documents({})
        total_docs += count
        print(f"{col_name:<22} | {count:<16} | PASS")
        
    print("-" * 55)
    print(f"TOTAL DOCUMENTS IN ATLAS DB '{db_name}': {total_docs}")
    print("======================================================================\n")

except Exception as e:
    print(f"[Atlas Error] {type(e).__name__}: {e}")
finally:
    client.close()
