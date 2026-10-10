"use client";

import { useEffect, useState } from "react";
import type { Machine } from "@/lib/types";
import type { SessionUser } from "@/lib/auth";
import { uploadPhoto } from "@/lib/uploadPhoto";
import PhotoInput from "./PhotoInput";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";

const SAFETY_TYPES = [
  "Daily Safety Inspection",
  "Unsafe Condition Report",
  "Near Miss Event",
  "Personal Protective Equipment (PPE) Audit",
  "Machine Guarding Inspection",
  "Fire & Chemical Safety Audit",
  "Emergency Stop Check",
  "Other EHS Observation",
];

const INSPECTION_RESULTS = [
  "Pass",
  "Conditional Pass",
  "Fail",
  "Requires Maintenance Action",
  "Immediate Hazard",
];

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

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
}

interface SafetyRecordItem {
  id?: string;
  "Compliance ID"?: string;
  assetId?: string;
  "Asset ID"?: string;
  machineName?: string;
  "Machine Name"?: string;
  inspectionType?: string;
  "Safety Type"?: string;
  result?: string;
  "Result"?: string;
  riskLevel?: string;
  "Risk Level"?: string;
  status?: string;
  "Status"?: string;
  observation?: string;
  "Observation / Issue"?: string;
  correctiveAction?: string;
  "Action Taken"?: string;
  userId?: string;
  "User ID"?: string;
  userName?: string;
  "User Name"?: string;
  inspector?: string;
  "Inspector"?: string;
  targetDate?: string;
  "Target Date"?: string;
}

export default function SafetyForm({
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
    inspector: user?.name || "",
    inspectionType: "Daily Safety Inspection",
    result: "Pass",
    riskLevel: "Medium",
    immediateAction: "",
    assignedTo: initialMachine["Responsible Person"] || user?.name || "",
    targetDate: today,
    status: "Open",
    observation: "",
    correctiveAction: "",
    remarks: "",
  });

  const [machinesList, setMachinesList] = useState<MachineRef[]>([]);
  const [usersList, setUsersList] = useState<UserRef[]>([]);
  const [myRecords, setMyRecords] = useState<SafetyRecordItem[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<SafetyRecordItem | null>(null);
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
  const [selectedRiskFilter, setSelectedRiskFilter] = useState("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadRecords = async () => {
    setLoadingRecords(true);
    try {
      const res = await fetch("/api/safety");
      const json = await res.json();
      if (json.success && Array.isArray(json.records)) {
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
          const filtered = json.records.filter((r: SafetyRecordItem) => {
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
          setMyRecords(json.records);
        }
      }
    } catch (e) {
      console.warn("Could not load safety audit records", e);
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
              inspector: prev.inspector || json.currentUser.name || "",
            }));
          }
        }
      } catch (e) {
        console.warn("Could not load reference data for safety form", e);
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
    const match = machinesList.find(
      (m) => m.assetId.trim().toLowerCase() === newAssetId.trim().toLowerCase()
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
    const match = usersList.find(
      (u) => u.userId.trim().toLowerCase() === newUserId.trim().toLowerCase()
    );
    if (match) {
      setForm((prev) => ({
        ...prev,
        userId: match.userId,
        userName: match.name,
        inspector: prev.inspector || match.name,
      }));
    }
  }

  async function saveSafety() {
    const finalAssetId = machineData.assetId.trim() || initialMachine["Asset ID"] || "";
    const finalUserId = form.userId.trim() || user?.userId || "";
    const finalUserName = form.userName.trim() || user?.name || user?.email || "";

    if (!finalAssetId) {
      setStatus({ type: "error", message: "Asset ID is required." });
      return;
    }
    if (!finalUserId || !finalUserName) {
      setStatus({ type: "error", message: "User ID and User Name are required." });
      return;
    }
    if (!form.observation.trim()) {
      setStatus({ type: "error", message: "Observation / Hazard detail is required." });
      return;
    }

    setSaving(true);
    setStatus({ type: "info", message: "Saving safety inspection record to MongoDB..." });

    try {
      let photoEvidence = "";
      if (photo) {
        setStatus({ type: "info", message: "Uploading safety photo evidence..." });
        photoEvidence = await uploadPhoto(photo);
        setStatus({ type: "info", message: "Saving safety inspection record to MongoDB..." });
      }

      const response = await fetch("/api/safety", {
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
          message: "✓ Safety inspection observation saved successfully to MongoDB.",
        });
        setForm({
          userId: user?.userId || "",
          userName: user?.name || "",
          inspector: user?.name || "",
          inspectionType: "Daily Safety Inspection",
          result: "Pass",
          riskLevel: "Medium",
          immediateAction: "",
          assignedTo: initialMachine["Responsible Person"] || user?.name || "",
          targetDate: today,
          status: "Open",
          observation: "",
          correctiveAction: "",
          remarks: "",
        });
        setPhoto(null);
        setShowForm(false);
        await loadRecords();
        onSaved?.();
      } else {
        setStatus({
          type: "error",
          message: result.message || "Safety observation save failed.",
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message:
          "Safety save error: " +
          (error instanceof Error ? error.message : String(error)),
      });
    } finally {
      setSaving(false);
    }
  }

  // Calculate filtered and paginated safety records
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
    const obs = (
      item.observation ||
      item["Observation / Hazard"] ||
      item["Observation"] ||
      item["Check Point"] ||
      item["Remarks"] ||
      ""
    ).toLowerCase();
    const risk = (
      item.riskLevel ||
      item["Risk Level"] ||
      item["Result"] ||
      ""
    ).toLowerCase();
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
      obs.includes(q) ||
      logId.includes(q) ||
      risk.includes(q) ||
      recStatus.includes(q);

    const matchesMachine =
      selectedMachineFilter === "All" ||
      asset.includes(selectedMachineFilter.toLowerCase()) ||
      name.includes(selectedMachineFilter.toLowerCase()) ||
      selectedMachineFilter.toLowerCase().includes(asset) ||
      selectedMachineFilter.toLowerCase().includes(name);

    const matchesRisk =
      selectedRiskFilter === "All" ||
      !selectedRiskFilter ||
      risk.includes(selectedRiskFilter.toLowerCase()) ||
      selectedRiskFilter.toLowerCase().includes(risk);

    const matchesStatus =
      selectedStatusFilter === "All" ||
      !selectedStatusFilter ||
      recStatus.includes(selectedStatusFilter.toLowerCase()) ||
      selectedStatusFilter.toLowerCase().includes(recStatus);

    return matchesQuery && matchesMachine && matchesRisk && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="space-y-6 font-sans">
      {/* --- TOGGLEABLE SAFETY FORM CARD --- */}

      {/* --- TOGGLEABLE SAFETY FORM CARD --- */}
      {showForm && (
        <section className="rounded-2xl bg-white p-6 sm:p-8 border-2 border-rose-600/20 shadow-md space-y-6 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center text-sm shrink-0">
                ⚠️
              </span>
              <span>Safety Inspection Entry</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Log unsafe conditions, near-miss events, or safety hazards for immediate supervisor review.
            </p>
          </div>

          <StatusBanner type={status.type} message={status.message} />

          {/* 1. MACHINE IDENTIFICATION */}
          <div className="space-y-4">
            <div className="text-xs font-black text-rose-800 uppercase tracking-wider bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 w-fit">
              1. Machine &amp; Location Identification
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="safety-asset-input">
                  Asset ID <span className="text-rose-600">*</span>
                </label>
                <input
                  id="safety-asset-input"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 uppercase focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  placeholder="e.g. SKY-LSR-MCH-001"
                  value={machineData.assetId}
                  onChange={(e) => handleAssetIdChange(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1" htmlFor="safety-machine-name">
                  Machine Name <span className="text-rose-600">*</span>
                </label>
                <input
                  id="safety-machine-name"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  placeholder="Auto-filled from Asset ID"
                  value={machineData.machineName}
                  onChange={(e) => setMachineData((prev) => ({ ...prev, machineName: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* 2. INSPECTION DETAILS */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-rose-800 uppercase tracking-wider bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 w-fit">
              2. Inspection &amp; Risk Parameters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  User ID <span className="text-rose-600">*</span>
                  {user?.userId && (
                    <span className="ml-2 font-semibold text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Logged in: {user.userId}
                    </span>
                  )}
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  placeholder="e.g. OP-001"
                  value={form.userId}
                  onChange={(e) => handleUserIdChange(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  User Name <span className="text-rose-600">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  placeholder="Enter inspector user name"
                  value={form.userName}
                  onChange={(e) => update("userName", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Safety Inspection Type</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  value={form.inspectionType}
                  onChange={(e) => update("inspectionType", e.target.value)}
                >
                  {SAFETY_TYPES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Inspection Result</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  value={form.result}
                  onChange={(e) => update("result", e.target.value)}
                >
                  {INSPECTION_RESULTS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Risk Level</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  value={form.riskLevel}
                  onChange={(e) => update("riskLevel", e.target.value)}
                >
                  {RISK_LEVELS.map((rl) => (
                    <option key={rl} value={rl}>
                      {rl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. OBSERVATION / HAZARD */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-rose-800 uppercase tracking-wider bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 w-fit">
              3. Safety Hazard &amp; Observation Detail
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observation / Hazard Description <span className="text-rose-600">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition min-h-[90px]"
                  placeholder="Describe the safety hazard, near-miss incident, or unsafe condition..."
                  value={form.observation}
                  onChange={(e) => update("observation", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Immediate Containment Action Taken</label>
                <textarea
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-semibold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition min-h-[70px]"
                  placeholder="Enter any immediate action taken on floor (e.g. stopped machine, cordoned area)..."
                  value={form.immediateAction}
                  onChange={(e) => update("immediateAction", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 4. PHOTO EVIDENCE */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-black text-rose-800 uppercase tracking-wider bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 w-fit">
              4. Photo / Hazard Evidence (Optional)
            </div>
            <PhotoInput
              id="safetyPhotoEvidence"
              label="Hazard Photo / Snapshot"
              required={false}
              helperText="Capture hazard snapshot or attach safety audit photo. (Optional — attach when available)"
              onFileSelected={setPhoto}
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              saveSafety();
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-700 to-red-800 hover:from-rose-800 hover:to-red-900 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Saving Safety Record to MongoDB...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Save Safety Observation Record</span>
              </>
            )}
          </button>
        </section>
      )}

      {/* --- DEFAULT MAIN VIEW: PERSONAL OPERATOR SAFETY LOGS TABLE --- */}
      {!showForm && (
        <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>🛡️</span>
              <span>My Safety Inspection Logs ({myRecords.length})</span>
            </h3>
          </div>

          <StatusBanner type={status.type} message={status.message} />

          {/* --- SEARCH & FILTER CONTROLS TOOLBAR --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by ID, machine, hazard..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pl-8 text-xs font-semibold text-slate-800 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition"
              />
              <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">🔍</span>
            </div>

            {/* Machine Filter */}
            <div>
              <select
                value={selectedMachineFilter}
                onChange={(e) => {
                  setSelectedMachineFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition cursor-pointer"
              >
                <option value="All">All Machines / Assets</option>
                {Array.from(
                  new Set(
                    myRecords.map((r: any) =>
                      r.machineName ||
                      r["Machine Name"] ||
                      r["Machine / Equipment"] ||
                      r.assetId ||
                      r["Asset ID"]
                    ).filter(Boolean)
                  )
                ).map((mAsset: any) => (
                  <option key={String(mAsset)} value={String(mAsset)}>
                    {String(mAsset)}
                  </option>
                ))}
              </select>
            </div>

            {/* Risk Level Filter */}
            <div>
              <select
                value={selectedRiskFilter}
                onChange={(e) => {
                  setSelectedRiskFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition cursor-pointer"
              >
                <option value="All">All Risk Levels</option>
                <option value="Low">Low Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="High">High Risk</option>
                <option value="Critical">Critical Risk</option>
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/20 outline-none transition cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          {loadingRecords ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold">Loading your live MongoDB safety logs...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 p-6 space-y-3">
              <p className="font-bold text-slate-600">No matching safety inspection records found.</p>
              <p className="text-slate-400">Try adjusting your search query or dropdown filter selections.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/90 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Asset ID</th>
                      <th className="p-3">Machine</th>
                      <th className="p-3">Safety Type</th>
                      <th className="p-3">Result</th>
                      <th className="p-3">Risk Level</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRecords.map((r, i) => {
                      const item = r as any;
                      const asset = item.assetId || item["Asset ID"] || "SKY-LSR-MCH-001";
                      const name = item.machineName || item["Machine Name"] || initialMachine["Machine Name"] || "Laser Machine";
                      const type = item.inspectionType || item["Safety Type"] || "Daily Inspection";
                      const res = item.result || item["Result"] || "Pass";
                      const risk = item.riskLevel || item["Risk Level"] || "Medium";
                      const st = item.status || item["Status"] || "Open";

                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-mono font-bold text-rose-800">{asset}</td>
                          <td className="p-3 font-bold text-slate-900">{name}</td>
                          <td className="p-3 text-slate-600">{type}</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${res.toLowerCase() === "pass"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                              }`}>
                              {res}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${risk.toLowerCase() === "high" || risk.toLowerCase() === "critical"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                              }`}>
                              {risk}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${st.toLowerCase() === "closed" || st.toLowerCase() === "resolved"
                              ? "bg-slate-100 text-slate-800"
                              : "bg-blue-100 text-blue-800"
                              }`}>
                              {st}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(r)}
                              className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-rose-700 text-slate-700 hover:text-white font-bold transition text-[11px] border border-slate-200 cursor-pointer shadow-2xs"
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
                        ? "bg-rose-700 text-white"
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

      {/* --- VIEW SAFETY RECORD MODAL --- */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>🛡️</span> Safety Inspection Details
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
                <div><span className="font-bold text-slate-400">Asset ID:</span> <span className="font-mono font-bold text-rose-800 block">{selectedRecord.assetId || selectedRecord["Asset ID"]}</span></div>
                <div><span className="font-bold text-slate-400">Machine:</span> <span className="font-bold text-slate-900 block">{selectedRecord.machineName || selectedRecord["Machine Name"] || "Laser Machine"}</span></div>
                <div><span className="font-bold text-slate-400">User ID:</span> <span className="font-mono block">{selectedRecord.userId || selectedRecord["User ID"]}</span></div>
                <div><span className="font-bold text-slate-400">Result:</span> <span className="font-bold text-emerald-800 block">{selectedRecord.result || selectedRecord["Result"] || "Pass"}</span></div>
              </div>

              <div>
                <span className="font-black text-slate-900 block mb-1">Hazard / Observation Detail:</span>
                <p className="bg-rose-50/50 border border-rose-200 p-3 rounded-xl text-slate-800 leading-relaxed">
                  {selectedRecord.observation || selectedRecord["Observation / Issue"] || "No hazard description specified."}
                </p>
              </div>

              <div>
                <span className="font-black text-slate-900 block mb-1">Corrective Action:</span>
                <p className="bg-emerald-50/50 border border-emerald-200 p-3 rounded-xl text-slate-800 leading-relaxed">
                  {selectedRecord.correctiveAction || selectedRecord["Action Taken"] || "Pending safety supervisor review."}
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
      )}
    </div>
  );
}
