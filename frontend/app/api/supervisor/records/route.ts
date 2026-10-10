import { NextRequest, NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tab, row, isNew } = body;

        if (!tab || !row) {
            return NextResponse.json({ success: false, message: "Missing tab or row data" }, { status: 400 });
        }

        const db = await readDb();
        const rawDb = db as any;

        if (tab === "maintenance") {
            db.maintenanceRecords = db.maintenanceRecords || [];
            if (isNew) {
                db.maintenanceRecords.unshift(row);
            } else {
                const id = row.recordId || row["recordId"] || row["Maintenance ID"] || row["Record ID"];
                const idx = db.maintenanceRecords.findIndex((m) => m.recordId === id || m["recordId"] === id);
                if (idx !== -1) db.maintenanceRecords[idx] = row;
                else db.maintenanceRecords.unshift(row);
            }
        } else if (tab === "safety") {
            db.safetyRecords = db.safetyRecords || [];
            if (isNew) {
                db.safetyRecords.unshift(row);
            } else {
                const id = row.recordId || row["recordId"] || row["Safety Record ID"] || row["Record ID"];
                const idx = db.safetyRecords.findIndex((s) => s.recordId === id || s["recordId"] === id);
                if (idx !== -1) db.safetyRecords[idx] = row;
                else db.safetyRecords.unshift(row);
            }
        } else if (tab === "checklist") {
            rawDb.checklists = rawDb.checklists || [];
            if (isNew) {
                rawDb.checklists.unshift(row);
            } else {
                const id = row["Asset ID / Machine"] || row["Check Point"] || row["Template ID"];
                const idx = rawDb.checklists.findIndex((c: any) => (c["Asset ID / Machine"] || c["Check Point"]) === id);
                if (idx !== -1) rawDb.checklists[idx] = row;
                else rawDb.checklists.unshift(row);
            }
        } else if (tab === "parts") {
            rawDb.pmParts = rawDb.pmParts || [];
            if (isNew) {
                rawDb.pmParts.unshift(row);
            } else {
                const id = row["Part Name / Code"] || row["partId"] || row["Part / AMC ID"];
                const idx = rawDb.pmParts.findIndex((p: any) => (p["Part Name / Code"] || p["partId"]) === id);
                if (idx !== -1) rawDb.pmParts[idx] = row;
                else rawDb.pmParts.unshift(row);
            }
        } else if (tab === "documents") {
            rawDb.documentRegister = rawDb.documentRegister || [];
            if (isNew) {
                rawDb.documentRegister.unshift(row);
            } else {
                const id = row["Doc ID"] || row["Document Title"] || row["docId"];
                const idx = rawDb.documentRegister.findIndex((d: any) => (d["Doc ID"] || d["Document Title"]) === id);
                if (idx !== -1) rawDb.documentRegister[idx] = row;
                else rawDb.documentRegister.unshift(row);
            }
        } else if (tab === "alerts") {
            rawDb.notifications = rawDb.notifications || [];
            if (isNew) {
                rawDb.notifications.unshift(row);
            } else {
                const id = row["Alert ID"] || row["alertId"] || row["Alert Title"];
                const idx = rawDb.notifications.findIndex((n: any) => (n["Alert ID"] || n["alertId"]) === id);
                if (idx !== -1) rawDb.notifications[idx] = row;
                else rawDb.notifications.unshift(row);
            }
        }

        await writeDb(db);
        return NextResponse.json({ success: true, message: `Successfully ${isNew ? "added" : "updated"} record in DB` });
    } catch (error: any) {
        console.error("[skyline supervisor save error]", error);
        return NextResponse.json({ success: false, message: error.message || "Failed to save record" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tab = searchParams.get("tab");
        const id = searchParams.get("id");

        if (!tab || !id) {
            return NextResponse.json({ success: false, message: "Missing tab or id" }, { status: 400 });
        }

        const { readDb, writeDb, deleteRecordFromDb } = await import("@/lib/db");
        const db = await readDb();
        const rawDb = db as any;

        const targetMap: Record<string, { col: string; fieldKey: string; filterFn: (item: any) => boolean }> = {
            maintenance: {
                col: "maintenance_records",
                fieldKey: "recordId",
                filterFn: (m: any) => (m.recordId || m["recordId"] || m["Record ID"]) !== id
            },
            safety: {
                col: "safety_records",
                fieldKey: "recordId",
                filterFn: (s: any) => (s.recordId || s["recordId"] || s["Safety Record ID"]) !== id
            },
            checklist: {
                col: "checklist_master",
                fieldKey: "Check Point",
                filterFn: (c: any) => (c["Asset ID / Machine"] || c["Check Point"] || c["Template ID"]) !== id
            },
            parts: {
                col: "spare_parts",
                fieldKey: "Part ID",
                filterFn: (p: any) => (p["Part Name / Code"] || p["partId"] || p["Part ID"]) !== id
            },
            documents: {
                col: "documents",
                fieldKey: "Doc ID",
                filterFn: (d: any) => (d["Doc ID"] || d["Document Title"] || d["docId"]) !== id
            },
            alerts: {
                col: "notifications",
                fieldKey: "Alert ID",
                filterFn: (n: any) => (n["Alert ID"] || n["alertId"] || n["Notification ID"]) !== id
            }
        };

        const config = targetMap[tab];
        if (config) {
            // Delete directly from MongoDB Atlas collection
            await deleteRecordFromDb(config.col, id);

            // Filter out from local memory
            if (tab === "maintenance") {
                db.maintenanceRecords = (db.maintenanceRecords || []).filter(config.filterFn);
            } else if (tab === "safety") {
                db.safetyRecords = (db.safetyRecords || []).filter(config.filterFn);
            } else if (tab === "checklist") {
                rawDb.checklists = (rawDb.checklists || []).filter(config.filterFn);
            } else if (tab === "parts") {
                rawDb.pmParts = (rawDb.pmParts || []).filter(config.filterFn);
            } else if (tab === "documents") {
                rawDb.documentRegister = (rawDb.documentRegister || []).filter(config.filterFn);
            } else if (tab === "alerts") {
                rawDb.notifications = (rawDb.notifications || []).filter(config.filterFn);
            }
        }

        await writeDb(db);
        return NextResponse.json({ success: true, message: "Successfully deleted record from MongoDB Atlas" });
    } catch (error: any) {
        console.error("[skyline supervisor delete error]", error);
        return NextResponse.json({ success: false, message: error.message || "Failed to delete record" }, { status: 500 });
    }
}
