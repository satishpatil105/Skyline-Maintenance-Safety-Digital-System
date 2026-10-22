"use client";

import { useEffect, useState } from "react";
import type { Machine } from "@/lib/types";
import type { SessionUser } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import PhotoInput from "./PhotoInput";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";

const MAINTENANCE_TYPES = [
  "Breakdown Maintenance",
  "Emergency Repair",
  "Corrective Maintenance",
  "Preventive Maintenance",
  "Lubrication",
  "Calibration",
  "Other",
];

const PRIORITIES = ["Low", "Medium", "High", "Critical"];

const STATUSES = [
  "Open",
  "In Progress",
  "Completed",
  "Pending Spare",
  "Pending Approval",
  "Cancelled",
];

interface MachineRef {
  assetId: string;
  machineName: string;
  category: string;
  department: string;
  location: string;
  responsiblePerson: string;
}

interface UserRef {
  userId: string;
  name: string;
  email: string;
  role: string;
  departmentMachine?: string;
}

interface MaintenanceRecordItem {
  id?: string;
  "Log ID"?: string;
  assetId?: string;
  "Asset ID"?: string;
  machineName?: string;
  "Machine Name"?: string;
  maintenanceType?: string;
  "Type"?: string;
  maintenanceDate?: string;
  "Date"?: string;
  userId?: string;
  "User ID"?: string;
  userName?: string;
  "User Name"?: string;
  priority?: string;
  "Priority"?: string;
  status?: string;
  "Status"?: string;
  problem?: string;
  "Problem / Request"?: string;
  correctiveAction?: string;
  "Action Taken"?: string;
  rootCause?: string;
  spareParts?: string;
  downtime?: string;
  photoEvidence?: string;
  remarks?: string;
}

export default function MaintenanceForm({
  machine: initialMachine,
  user,
  email,
  onSaved,
  showForm: externalShowForm,
  onToggleForm,
}: {
  machine: Machine;
  user?: SessionUser | null;
  email?: string;
  onSaved?: () => void;
  showForm?: boolean;
  onToggleForm?: (val: boolean) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [internalShowForm, setInternalShowForm] = useState(true);
  const showForm = externalShowForm !== undefined ? externalShowForm : internalShowForm;
  const setShowForm = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === "function" ? val(showForm) : val;
    if (onToggleForm) onToggleForm(nextVal);
    else setInternalShowForm(nextVal);
  };

  const [machineData, setMachineData] = useState<{
    assetId: string;
    machineName: string;
    category?: string;
    department?: string;
    location?: string;
    responsiblePerson?: string;
  }>({
    assetId: initialMachine["Asset ID"] || "",
    machineName: initialMachine["Machine Name"] || "",
    category: initialMachine.Category || "",
    department: initialMachine.Department || "",
    location: initialMachine.Location || "",
    responsiblePerson: initialMachine["Responsible Person"] || "",
  });

  const [form, setForm] = useState({
    userId: user?.userId || "",
    userName: user?.name || "",
    assignedTo: initialMachine["Responsible Person"] || user?.name || "",
    technicianName: user?.name || "",
    maintenanceType: "Breakdown Maintenance",
    maintenanceDate: today,
    priority: "Medium",
    status: "Open",
    checklistId: "",
    checkPoint: "",
    problem: "",
    rootCause: "",
    correctiveAction: "",
    spareParts: "",
    downtime: "",
    remarks: "",
  });

  const [machinesList, setMachinesList] = useState<MachineRef[]>([]);
  const [usersList, setUsersList] = useState<UserRef[]>([]);
  const [myRecords, setMyRecords] = useState<MaintenanceRecordItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecordItem | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({
    type: null,
    message: "",
  });

  // Table Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMachineFilter, setSelectedMachineFilter] = useState("All");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch reference lists & personal submitted records
  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/maintenance");
      const json = await res.json();
      if (json.success && Array.isArray(json.records)) {
        // Strictly exclude routine checklist inspection records (CHK-...) so only genuine breakdown tickets appear
        const cleanBreakdownRecords = json.records.filter((r: any) => {
          const id = String(r.recordId || r["Record ID"] || r.logId || r["Log ID"] || "");
          const type = String(r.recordType || r["Record Type"] || r.maintenanceType || "").toLowerCase();
          return !id.startsWith("CHK-") && type !== "inspection";
        });

        const roleLower = (user?.role || "").toLowerCase();
        const isSuperOrAdmin = roleLower === "admin" || roleLower === "supervisor";

        const assignedAsset = (
          initialMachine?.["Asset ID"] ||
          (initialMachine as any)?.assetId ||
          ""
        ).trim().toLowerCase();

        const assignedName = (
          initialMachine?.["Machine Name"] ||
          (initialMachine as any)?.machineName ||
          user?.departmentMachine ||
          ""
        ).trim().toLowerCase();

        if (!isSuperOrAdmin && (assignedAsset || assignedName)) {
          const filtered = cleanBreakdownRecords.filter((r: MaintenanceRecordItem) => {
            const item = r as any;
            const rAsset = (item.assetId || item["Asset ID"] || "").trim().toLowerCase();
            const rName = (
              item.machineName ||
              item["Machine Name"] ||
              item["Machine / Equipment"] ||
              item["Machine"] ||
              ""
            ).trim().toLowerCase();

            // Strict asset ID matching
            if (assignedAsset && rAsset && (rAsset === assignedAsset || rAsset.includes(assignedAsset) || assignedAsset.includes(rAsset))) {
              return true;
            }

            // Strict machine name matching
            if (assignedName && rName && (rName === assignedName || rName.includes(assignedName) || assignedName.includes(rName))) {
              return true;
            }

            return false;
          });

          setMyRecords(filtered);
        } else {
          setMyRecords(cleanBreakdownRecords);
        }
      }
    } catch (e) {
      console.warn("Could not load maintenance history records", e);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    async function loadRef() {
      try {
        const res = await fetch("/api/reference");
        const json = await res.json();
        if (json.success) {
          if (json.machines) setMachinesList(json.machines);
          if (json.users) setUsersList(json.users);
          if (json.currentUser) {
            setForm((prev) => ({
              ...prev,
              userId: prev.userId || json.currentUser.userId || "",
              userName: prev.userName || json.currentUser.name || "",
              technicianName: prev.technicianName || json.currentUser.name || "",
            }));
          }
        }
      } catch (e) {
        console.warn("Could not load reference data for auto-fill", e);
      }
    }
    loadRef();
    loadRecords();
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleAssetIdChange(newAssetId: string) {
    setMachineData((prev) => ({ ...prev, assetId: newAssetId }));
    const cleanId = newAssetId.trim().toLowerCase();
    const match = machinesList.find(
      (m) =>
        m.assetId.trim().toLowerCase() === cleanId ||
        cleanId.includes(m.assetId.trim().toLowerCase()) ||
        m.machineName.trim().toLowerCase() === cleanId
    );
    if (match) {
      setMachineData({
        assetId: match.assetId,
        machineName: match.machineName,
        category: match.category,
        department: match.department,
        location: match.location,
        responsiblePerson: match.responsiblePerson,
      });
      if (match.responsiblePerson && !form.assignedTo) {
        setForm((prev) => ({ ...prev, assignedTo: match.responsiblePerson }));
      }
    }
  }

  function handleUserIdChange(newUserId: string) {
    update("userId", newUserId);
    const cleanUid = newUserId.trim().toLowerCase();
    const match = usersList.find(
      (u) =>
        u.userId.trim().toLowerCase() === cleanUid ||
        cleanUid.includes(u.userId.trim().toLowerCase()) ||
        u.name.trim().toLowerCase() === cleanUid
    );
    if (match) {
      setForm((prev) => ({
        ...prev,
        userId: match.userId,
        userName: match.name,
        technicianName: prev.technicianName || match.name,
      }));
    }
  }

  function handleUserNameChange(newUserName: string) {
    update("userName", newUserName);
    const match = usersList.find(
      (u) => u.name.trim().toLowerCase() === newUserName.trim().toLowerCase()
    );
    if (match) {
      setForm((prev) => ({
        ...prev,
        userName: match.name,
        userId: match.userId || prev.userId,
      }));
    }
  }

  async function saveMaintenance() {
    const finalAssetId =
      machineData.assetId.trim() ||
      initialMachine["Asset ID"] ||
      (initialMachine as any)?.assetId ||
      "";
    const finalUserId =
      form.userId.trim() ||
      user?.userId ||
      (user?.email ? user.email.split("@")[0].toUpperCase() : "OP-001");
    const finalUserName =
      form.userName.trim() ||
      user?.name ||
      user?.email ||
      "Operator";

    if (!finalAssetId) {
      setStatus({ type: "error", message: "Please select or enter an Asset ID for the machine." });
      return;
    }
    if (!form.problem.trim()) {
      setStatus({ type: "error", message: "Please describe the maintenance problem or breakdown issue." });
      return;
    }

    setSaving(true);
    setStatus({ type: "info", message: "Saving maintenance record to MongoDB..." });

    try {
      let photoEvidence = "";
      if (photo) {
        setStatus({ type: "info", message: "Uploading photo evidence..." });
        photoEvidence = await uploadPhoto(photo);
        setStatus({ type: "info", message: "Saving maintenance record to MongoDB..." });
      }

      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || user?.email || "",
          assetId: finalAssetId,
          machineName: machineData.machineName || initialMachine["Machine Name"] || "",
          photoEvidence,
          ...form,
          userId: finalUserId,
          userName: finalUserName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          type: "success",
          message: "✓ Breakdown maintenance record saved successfully to MongoDB.",
        });
        setForm({
          userId: user?.userId || "",
          userName: user?.name || "",
          assignedTo: initialMachine["Responsible Person"] || user?.name || "",
          technicianName: user?.name || "",
          maintenanceType: "Breakdown Maintenance",
          maintenanceDate: today,
          priority: "Medium",
          status: "Open",
          checklistId: "",
          checkPoint: "",
          problem: "",
          rootCause: "",
          correctiveAction: "",
          spareParts: "",
          downtime: "",
          remarks: "",
        });
        setPhoto(null);
        setShowForm(false);
        await loadRecords();
        onSaved?.();
      } else {
        setStatus({
          type: "error",
          message: result.message || "Maintenance record save failed.",
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message:
          "Maintenance save error: " +
          (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSaving(false);
    }
  }

  // Calculate filtered and paginated records
  const filteredRecords = myRecords.filter((r) => {
    const item = r as any;
    const asset = (item.assetId || item["Asset ID"] || "").toLowerCase();
    const name = (
      item.machineName ||
      item["Machine Name"] ||
      item["Machine / Equipment"] ||
      item["Machine"] ||
      ""
    ).toLowerCase();
    const problem = (
      item.problem ||
      item["Problem / Breakdown"] ||
      item["Problem / Request"] ||
      item["Breakdown Issue"] ||
      item["Problem"] ||
      item["Remarks"] ||
      ""
    ).toLowerCase();
    const prio = (item.priority || item["Priority"] || "").toLowerCase();
    const recStatus = (item.status || item["Status"] || "").toLowerCase();
    const logId = (
      item.logId ||
      item["Log ID"] ||
      item["Record ID"] ||
      item.id ||
      ""
    ).toLowerCase();

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      asset.includes(q) ||
      name.includes(q) ||
      problem.includes(q) ||
      logId.includes(q) ||
      prio.includes(q) ||
      recStatus.includes(q);

    const matchesMachine =
      selectedMachineFilter === "All" ||
      asset.includes(selectedMachineFilter.toLowerCase()) ||
      name.includes(selectedMachineFilter.toLowerCase()) ||
      selectedMachineFilter.toLowerCase().includes(asset) ||
      selectedMachineFilter.toLowerCase().includes(name);

    const matchesPriority =
      selectedPriorityFilter === "All" ||
      !selectedPriorityFilter ||
      prio.includes(selectedPriorityFilter.toLowerCase()) ||
      selectedPriorityFilter.toLowerCase().includes(prio);

    const matchesStatus =
      selectedStatusFilter === "All" ||
      !selectedStatusFilter ||
      recStatus.includes(selectedStatusFilter.toLowerCase()) ||
      selectedStatusFilter.toLowerCase().includes(recStatus);

    return matchesQuery && matchesMachine && matchesPriority && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="space-y-6 font-sans">
      {/* --- TOGGLEABLE BREAKDOWN FORM CARD --- */}

      {/* --- TOGGLEABLE BREAKDOWN FORM CARD --- */}
      {showForm && (
        <section className="rounded-2xl bg-white p-6 sm:p-8 border-2 border-[#880b13]/20 shadow-md space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center text-sm shrink-0">
                🛠️
              </span>
              <span>Maintenance Record Entry</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auto-fills machine &amp; operator credentials instantly from your logged-in session.
            </p>
          </div>

          <StatusBanner type={status.type} message={status.message} />

          {/* 1. MACHINE IDENTIFICATION */}
          <div className="space-y-4">
            <div className="text-xs font-black text-[#880b13] uppercase tracking-wider bg-rose-50/60 px-3 py-1.5 rounded-lg border border-rose-100/80 w-fit">
              1. Machine &amp; Asset Identification
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="maint-asset-input">
                  Asset ID <span className="text-rose-600">*</span>
                </label>
                <input
                  id="maint-asset-input"
                  list="asset-list-suggestions"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 uppercase focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="e.g. SKY-LSR-MCH-001"
                  value={machineData.assetId}
                  onChange={(e) => handleAssetIdChange(e.target.value)}
                />
                <datalist id="asset-list-suggestions">
                  {machinesList.map((m) => (
                    <option key={m.assetId} value={m.assetId}>
                      {m.assetId} - {m.machineName}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="maint-machine-name">
                  Machine Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="maint-machine-name"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="Auto-filled from Asset ID"
                  value={machineData.machineName}
                  onChange={(e) => setMachineData((prev) => ({ ...prev, machineName: e.target.value }))}
                />
              </div>
            </div>

            {(machineData.category || machineData.department || machineData.location) && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200 text-xs">
                <span className="font-extrabold text-slate-400 text-[10px] uppercase tracking-wider">Asset Info:</span>
                {machineData.category && (
                  <span className="rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-extrabold px-2.5 py-0.5 text-[11px]">
                    Category: {machineData.category}
                  </span>
                )}
                {machineData.department && (
                  <span className="rounded-lg bg-blue-50 border border-blue-200 text-blue-800 font-extrabold px-2.5 py-0.5 text-[11px]">
                    Dept: {machineData.department}
                  </span>
                )}
                {machineData.location && (
                  <span className="rounded-lg bg-slate-200 text-slate-800 font-bold px-2.5 py-0.5 text-[11px]">
                    Location: {machineData.location}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 2. PERSONNEL & SCHEDULE */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-[#880b13] uppercase tracking-wider bg-rose-50/60 px-3 py-1.5 rounded-lg border border-rose-100/80 w-fit">
              2. Personnel &amp; Schedule Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="maint-user-id">
                  User ID <span className="text-rose-600">*</span>
                  {user?.userId && (
                    <span className="ml-2 font-semibold text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Logged in: {user.userId}
                    </span>
                  )}
                </label>
                <input
                  id="maint-user-id"
                  list="user-list-suggestions"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="e.g. OP-001"
                  value={form.userId}
                  onChange={(e) => handleUserIdChange(e.target.value)}
                />
                <datalist id="user-list-suggestions">
                  {usersList.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.userId} - {u.name}
                    </option>
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="maint-user-name">
                  User Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="maint-user-name"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="Enter user name"
                  value={form.userName}
                  onChange={(e) => handleUserNameChange(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned To</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="Responsible person's name"
                  value={form.assignedTo}
                  onChange={(e) => update("assignedTo", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Technician Name</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="Enter technician name"
                  value={form.technicianName}
                  onChange={(e) => update("technicianName", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Maintenance Type</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  value={form.maintenanceType}
                  onChange={(e) => update("maintenanceType", e.target.value)}
                >
                  <option value="">Select Maintenance Type</option>
                  {MAINTENANCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Maintenance Date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  value={form.maintenanceDate}
                  onChange={(e) => update("maintenanceDate", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  value={form.priority}
                  onChange={(e) => update("priority", e.target.value)}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. PROBLEM STATEMENT */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-[#880b13] uppercase tracking-wider bg-rose-50/60 px-3 py-1.5 rounded-lg border border-rose-100/80 w-fit">
              3. Maintenance Problem &amp; Action Taken
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Problem / Work Request <span className="text-rose-600">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition min-h-[90px]"
                  placeholder="Describe the problem or maintenance requirement in detail..."
                  value={form.problem}
                  onChange={(e) => update("problem", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Root Cause Analysis</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition min-h-[70px]"
                  placeholder="Enter root cause analysis if known..."
                  value={form.rootCause}
                  onChange={(e) => update("rootCause", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Corrective Action / Action Taken</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition min-h-[80px]"
                  placeholder="Describe corrective action taken or work done..."
                  value={form.correctiveAction}
                  onChange={(e) => update("correctiveAction", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 4. SPARE PARTS & DOWNTIME */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-[#880b13] uppercase tracking-wider bg-rose-50/60 px-3 py-1.5 rounded-lg border border-rose-100/80 w-fit">
              4. Spare Parts and Downtime
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Spare Parts Used</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="e.g. Bearing 6204, Hydraulic Oil ISO 46"
                  value={form.spareParts}
                  onChange={(e) => update("spareParts", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Downtime in Hours</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition"
                  placeholder="Example: 2.5"
                  value={form.downtime}
                  onChange={(e) => update("downtime", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 5. PHOTO EVIDENCE */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-[#880b13] uppercase tracking-wider bg-rose-50/60 px-3 py-1.5 rounded-lg border border-rose-100/80 w-fit">
              5. Photo / Evidence (Optional)
            </div>
            <PhotoInput
              id="maintenancePhotoEvidence"
              label="Photo / Evidence"
              required={false}
              helperText="Open camera for a live snapshot or upload an image/document from your device. (Optional — submit whenever available)"
              onFileSelected={setPhoto}
            />
          </div>

          {/* 6. REMARKS & SUBMIT */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-[#880b13] uppercase tracking-wider bg-rose-50/60 px-3 py-1.5 rounded-lg border border-rose-100/80 w-fit">
              6. Additional Remarks
            </div>
            <div>
              <textarea
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-900 focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/20 outline-none transition min-h-[60px]"
                placeholder="Enter additional remarks or observations..."
                value={form.remarks}
                onChange={(e) => update("remarks", e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              saveMaintenance();
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#880b13] to-[#b71520] hover:from-[#70090f] hover:to-[#991019] text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Saving Maintenance Record to MongoDB...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Maintenance Record</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* --- DEFAULT MAIN VIEW: PERSONAL OPERATOR MAINTENANCE RECORDS TABLE --- */}
      {!showForm && (
        <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>🛠️</span>
              <span>Breakdown Tickets ({myRecords.length})</span>
            </h3>
          </div>

          <StatusBanner type={status.type} message={status.message} />

          {/* --- SEARCH & FILTER CONTROLS TOOLBAR --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by ticket ID, machine, breakdown issue..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#880b13] focus:ring-1 focus:ring-[#880b13] transition shadow-2xs"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Machine Filter */}
            <div>
              <select
                value={selectedMachineFilter}
                onChange={(e) => {
                  setSelectedMachineFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs cursor-pointer"
              >
                <option value="All">All Machine / Assets</option>
                {Array.from(
                  new Set(
                    myRecords.map((r: any) =>
                      r.machineName ||
                      r["Machine Name"] ||
                      r["Machine / Equipment"] ||
                      r.assetId ||
                      r["Asset ID"]
                    )
                  )
                )
                  .filter(Boolean)
                  .map((m: any) => (
                    <option key={String(m)} value={String(m)}>
                      {String(m)}
                    </option>
                  ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={selectedPriorityFilter}
                onChange={(e) => {
                  setSelectedPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs cursor-pointer"
              >
                <option value="All">All Priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#880b13] shadow-2xs cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* --- TABLE CONTENT --- */}
          {loadingRecords ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold">
              Loading your live records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-8 space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl shadow-xs border border-amber-200">
                🛠️
              </div>
              <div className="space-y-1">
                <p className="font-black text-sm text-slate-800">No Breakdown Tickets Reported</p>
                <p className="text-slate-500 max-w-md mx-auto">
                  All machines and workstations are running normally. When a machine fault occurs, click &quot;Raise Breakdown Ticket&quot; to log the issue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#880b13] to-[#b71520] hover:from-[#70090f] hover:to-[#991019] text-white text-xs font-black rounded-xl shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>➕ Raise Breakdown Ticket</span>
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/90 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Ticket ID</th>
                      <th className="p-3">Machine / Asset</th>
                      <th className="p-3">Breakdown Issue</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Reported Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRecords.map((r, i) => {
                      const item = r as any;
                      const logId = item.recordId || item["Record ID"] || item["Breakdown Ticket"] || item.logId || item["Log ID"] || item.id || `BD-${i + 1}`;
                      const asset = item.assetId || item["Asset ID"] || "SKY-LSR-MCH-001";
                      const name =
                        item.machineName ||
                        item["Machine Name"] ||
                        item["Machine / Equipment"] ||
                        item["Machine"] ||
                        initialMachine["Machine Name"] ||
                        "Laser Machine";
                      const prob =
                        item.problem || item["Problem / Breakdown"] || item["Problem / Request"] || item["Breakdown Issue"] || item["Problem"] || "Breakdown Ticket";
                      const date = item.maintenanceDate || item.date || item["Date"] || "Today";
                      const prio = item.priority || item["Priority"] || "Medium";
                      const st = item.status || item["Status"] || "Open";

                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-mono font-bold text-[#880b13]">{logId}</td>
                          <td className="p-3 font-bold text-slate-900">
                            <div>{name}</div>
                            <div className="text-[10px] text-slate-400 font-mono font-semibold">
                              ({asset})
                            </div>
                          </td>
                          <td className="p-3 font-medium text-slate-700 max-w-xs truncate" title={prob}>
                            {prob}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${prio.toLowerCase() === "high" || prio.toLowerCase() === "critical"
                                ? "bg-rose-100 text-rose-800"
                                : prio.toLowerCase() === "medium"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                                }`}
                            >
                              {prio}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${st.toLowerCase() === "completed" || st.toLowerCase() === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                                }`}
                            >
                              {st}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-medium">{date}</td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(r)}
                              className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-[#880b13] text-slate-700 hover:text-white font-bold transition text-[11px] border border-slate-200 cursor-pointer shadow-2xs"
                            >
                              👁️ View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* --- PAGINATION FOOTER --- */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    Showing{" "}
                    <span className="font-bold text-slate-800">
                      {filteredRecords.length === 0 ? 0 : startIndex + 1}
                    </span>{" "}
                    –{" "}
                    <span className="font-bold text-slate-800">
                      {Math.min(startIndex + rowsPerPage, filteredRecords.length)}
                    </span>{" "}
                    of <span className="font-bold text-slate-800">{filteredRecords.length}</span> items
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer shadow-2xs"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer"
                  >
                    ← Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      onClick={() => setCurrentPage(pg)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${currentPage === pg
                        ? "bg-[#880b13] text-white"
                        : "border border-slate-200 hover:bg-slate-100 text-slate-700"
                        }`}
                    >
                      {pg}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition cursor-pointer"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* --- VIEW RECORD MODAL --- */}
      {
        selectedRecord && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-scaleUp">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🛠️</span> Maintenance Ticket Details
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div><span className="font-bold text-slate-400">Asset ID:</span> <span className="font-mono font-bold text-[#880b13] block">{selectedRecord.assetId || selectedRecord["Asset ID"]}</span></div>
                  <div><span className="font-bold text-slate-400">Machine:</span> <span className="font-bold text-slate-900 block">{selectedRecord.machineName || selectedRecord["Machine Name"] || "Laser Machine"}</span></div>
                  <div><span className="font-bold text-slate-400">User ID:</span> <span className="font-mono block">{selectedRecord.userId || selectedRecord["User ID"]}</span></div>
                  <div><span className="font-bold text-slate-400">Date:</span> <span className="block">{selectedRecord.maintenanceDate || selectedRecord["Date"]}</span></div>
                </div>

                <div>
                  <span className="font-black text-slate-900 block mb-1">Problem Description:</span>
                  <p className="bg-amber-50/50 border border-amber-200 p-3 rounded-xl text-slate-800 leading-relaxed">
                    {selectedRecord.problem || selectedRecord["Problem / Request"] || "No details specified."}
                  </p>
                </div>

                <div>
                  <span className="font-black text-slate-900 block mb-1">Corrective Action Taken:</span>
                  <p className="bg-emerald-50/50 border border-emerald-200 p-3 rounded-xl text-slate-800 leading-relaxed">
                    {selectedRecord.correctiveAction || selectedRecord["Action Taken"] || "Pending maintenance review."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
