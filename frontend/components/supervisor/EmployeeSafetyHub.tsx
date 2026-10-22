"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import PhotoInput from "@/components/operator/PhotoInput";
import StatusBanner, { StatusType } from "@/components/shared/StatusBanner";
import { uploadPhoto } from "@/lib/uploadPhoto";

type FileTab = "master" | "ppe" | "training" | "accident";

interface Employee {
  userId: string;
  name: string;
  role: string;
  departmentMachine: string;
  mobile: string;
  active: string;
  email: string;
}

interface SafetyRecord {
  row: number;
  recordId: string;
  date: string;
  status: string;
  title: string;
  overdue: boolean;
  daysToTarget: number | null;
  values: Record<string, string>;
  employeeSignStatus?: "Accepted (Digitally Signed)" | "Rejected (Not Received)" | "Pending Signature";
  employeeSignDate?: string;
  digitalSignId?: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const PPE_OPTIONS = [
  "Safety Shoes (Steel Toe)",
  "Safety Helmet (Hard Hat)",
  "Safety Goggles / Glasses",
  "Ear Plugs / Noise Muffs",
  "Hand Gloves (Cut Resistant / Nitrile)",
  "High-Visibility Vest",
  "Dust Mask / Respirator",
  "Face Shield / Welding Apron",
];

const TRAINING_TOPICS = [
  "Fire Safety & Extinguisher Drill",
  "Machine Safety & Guarding Protocols",
  "5S Workplace Organization & Housekeeping",
  "First Aid & Emergency Medical Response",
  "Chemical Handling & MSDS Compliance",
  "Working at Height & Fall Protection",
  "Lockout / Tagout (LOTO) Procedures",
  "Electrical Safety & Arc Flash Awareness",
  "Ergonomics & Safe Material Handling",
  "General Plant Safety Induction",
];

const ACCIDENT_TYPES = [
  "Near Miss (No Injury / Property Damage Only)",
  "First Aid Case (FAC)",
  "Minor Injury (Medical Treatment Required)",
  "Lost Time Injury (LTI / Reportable Accident)",
  "Dangerous Occurrence (Equipment Failure)",
];

const BODY_PARTS = [
  "Eyes / Face",
  "Hands / Fingers",
  "Feet / Toes",
  "Head / Neck",
  "Back / Spine",
  "Arms / Shoulders",
  "Legs / Knees",
  "Skin / Chemical Contact",
  "Respiratory / Inhalation",
  "None (Near Miss)",
];

export default function EmployeeSafetyHub({
  canSubmit,
  canClose,
  initialFile = "master",
}: {
  canSubmit: boolean;
  canClose: boolean;
  initialFile?: FileTab;
}) {
  const [activeFile, setActiveFile] = useState<FileTab>(initialFile);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<SafetyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "overdue" | "closed">("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: StatusType; message: string }>({ type: null, message: "" });

  // Dispatch Modal for Mobile Digital Signature
  const [dispatchModal, setDispatchModal] = useState<{
    open: boolean;
    recordId: string;
    recordType: string;
    employeeName: string;
    employeeId: string;
    mobile: string;
    qrCodeUrl: string;
  }>({
    open: false,
    recordId: "",
    recordType: "",
    employeeName: "",
    employeeId: "",
    mobile: "",
    qrCodeUrl: "",
  });
  const [copiedLink, setCopiedLink] = useState(false);

  const openDispatchModal = async (rec: {
    recordId: string;
    recordType?: string;
    employeeName?: string;
    employeeId?: string;
    mobile?: string;
  }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ackUrl = `${origin}/safety/ack/${encodeURIComponent(rec.recordId)}`;
    let qrCodeDataUrl = "";
    try {
      qrCodeDataUrl = await QRCode.toDataURL(ackUrl, { width: 200, margin: 1 });
    } catch (err) {
      console.error("Failed to generate QR Code:", err);
    }

    let mobile = rec.mobile || "";
    if (!mobile && rec.employeeId) {
      const emp = employees.find((e) => e.userId.toLowerCase() === rec.employeeId?.toLowerCase());
      if (emp?.mobile) mobile = emp.mobile;
    }

    setDispatchModal({
      open: true,
      recordId: rec.recordId,
      recordType: rec.recordType || "Safety Record",
      employeeName: rec.employeeName || "Employee",
      employeeId: rec.employeeId || "",
      mobile,
      qrCodeUrl: qrCodeDataUrl,
    });
  };

  const sendWhatsApp = () => {
    const cleanMobile = dispatchModal.mobile.replace(/[^0-9]/g, "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ackUrl = `${origin}/safety/ack/${encodeURIComponent(dispatchModal.recordId)}`;
    const text = `🛡️ *SKYLINE SAFETY VERIFICATION*\nHello ${dispatchModal.employeeName},\nYour safety record (${dispatchModal.recordType} - Ref: ${dispatchModal.recordId}) has been logged.\n\nPlease open this link on your phone to confirm receipt and provide your digital signature (Yes/No):\n👉 ${ackUrl}\n\nThank you,\nSkyline EHS & Safety Management`;
    const phoneParam = cleanMobile ? `phone=${cleanMobile}&` : "";
    const waUrl = `https://api.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const sendSms = () => {
    const cleanMobile = dispatchModal.mobile.replace(/[^0-9]/g, "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ackUrl = `${origin}/safety/ack/${encodeURIComponent(dispatchModal.recordId)}`;
    const text = `Skyline Safety Alert: A ${dispatchModal.recordType} (${dispatchModal.recordId}) was logged for you. Please tap to confirm receipt (Yes/No): ${ackUrl}`;
    const smsUrl = `sms:${cleanMobile}?body=${encodeURIComponent(text)}`;
    window.open(smsUrl, "_blank");
  };

  const copyLink = async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ackUrl = `${origin}/safety/ack/${encodeURIComponent(dispatchModal.recordId)}`;
    try {
      await navigator.clipboard.writeText(ackUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      prompt("Copy acknowledgment link:", ackUrl);
    }
  };

  const openOnSite = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ackUrl = `${origin}/safety/ack/${encodeURIComponent(dispatchModal.recordId)}`;
    window.open(ackUrl, "_blank");
  };

  // Read URL query parameter if present
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const f = params.get("file");
      if (f === "master" || f === "ppe" || f === "training" || f === "accident") {
        setActiveFile(f);
      }
    }
  }, []);

  const switchTab = (tab: FileTab) => {
    setActiveFile(tab);
    setShowForm(false);
    setSearch("");
    setStatus({ type: null, message: "" });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("file", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Load Employee Master
  const loadEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/safety-dept/employee-master");
      const data = await res.json();
      if (data.success && Array.isArray(data.employees)) {
        setEmployees(data.employees);
      }
    } catch (err) {
      console.error("Failed to load employee master:", err);
    }
  }, []);

  // Load Safety Department Employee records
  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/safety-dept/employee");
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setRecords(data.records);
      }
    } catch (err) {
      console.error("Failed to load employee safety records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadRecords();
  }, [loadEmployees, loadRecords]);

  // Form states tailored for each file
  // 1. Employee Master Form
  const [empForm, setEmpForm] = useState({
    userId: "",
    name: "",
    department: "",
    role: "Operator",
    mobile: "",
    active: "Yes",
    email: "",
  });

  // 2. PPE Issue Form
  const [ppeForm, setPpeForm] = useState({
    date: todayIso(),
    employeeId: "",
    employeeName: "",
    department: "",
    location: "",
    ppeItems: [] as string[],
    condition: "Satisfactory",
    reviewStatus: "Compliant",
    nextDueDate: "",
    responsiblePerson: "",
    remarks: "",
  });

  // 3. Training Form
  const [trnForm, setTrnForm] = useState({
    date: todayIso(),
    employeeId: "",
    employeeName: "",
    department: "",
    topic: TRAINING_TOPICS[0],
    trainingType: "Safety Training",
    trainer: "",
    duration: "1.0 Hour",
    result: "Pass / Competent",
    nextDueDate: "",
    responsiblePerson: "",
    remarks: "",
  });

  // 4. Accident / Incident Form
  const [accForm, setAccForm] = useState({
    date: todayIso(),
    time: "10:00",
    employeeId: "",
    employeeName: "",
    department: "",
    location: "",
    recordType: ACCIDENT_TYPES[0],
    severity: "Medium",
    injuryType: "First Aid",
    bodyPart: "Hands / Fingers",
    ppeUsed: "Yes",
    description: "",
    rootCause: "",
    correctiveAction: "",
    lostDays: "0",
    responsiblePerson: "",
    targetDate: "",
    status: "Open",
    remarks: "",
  });

  // Auto-fill logic when selecting Employee ID in any form
  const handleEmployeeIdSelect = (empId: string, formType: "ppe" | "trn" | "acc") => {
    const match = employees.find((e) => e.userId.toLowerCase() === empId.toLowerCase());
    const name = match ? match.name : "";
    const dept = match ? match.departmentMachine : "";

    if (formType === "ppe") {
      setPpeForm((prev) => ({ ...prev, employeeId: empId, employeeName: name || prev.employeeName, department: dept || prev.department }));
    } else if (formType === "trn") {
      setTrnForm((prev) => ({ ...prev, employeeId: empId, employeeName: name || prev.employeeName, department: dept || prev.department }));
    } else if (formType === "acc") {
      setAccForm((prev) => ({ ...prev, employeeId: empId, employeeName: name || prev.employeeName, department: dept || prev.department }));
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFile, search]);

  // Filtered records per file with robust broad field checking
  const ppeRecords = useMemo(() => {
    return records.filter((r) => {
      const full = `${r.title} ${r.values["Record Type"] || ""} ${r.values["Description"] || ""} ${r.values["Observation / Issue"] || ""} ${Object.values(r.values).join(" ")}`.toLowerCase();
      if (/training|toolbox|induction|drill|course/i.test(full)) return false;
      if (/accident|incident|near miss|first aid|injury/i.test(full)) return false;
      return true;
    });
  }, [records]);

  const trainingRecords = useMemo(() => {
    return records.filter((r) => {
      const full = `${r.title} ${r.values["Record Type"] || ""} ${r.values["Description"] || ""} ${r.values["Training Topic"] || ""} ${Object.values(r.values).join(" ")}`.toLowerCase();
      return /training|toolbox|induction|drill|refresher|session|course/i.test(full);
    });
  }, [records]);

  const accidentRecords = useMemo(() => {
    return records.filter((r) => {
      const full = `${r.title} ${r.values["Record Type"] || ""} ${r.values["Description"] || ""} ${Object.values(r.values).join(" ")}`.toLowerCase();
      return /accident|incident|near miss|first aid|injury|unsafe/i.test(full);
    });
  }, [records]);

  // Search-filtered lists for each tab
  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter((emp) =>
      [emp.userId, emp.name, emp.departmentMachine, emp.role, emp.mobile].join(" ").toLowerCase().includes(q)
    );
  }, [employees, search]);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEmployees.slice(start, start + rowsPerPage);
  }, [filteredEmployees, currentPage, rowsPerPage]);

  const filteredPpeRecords = useMemo(() => {
    if (!search) return ppeRecords;
    const q = search.toLowerCase();
    return ppeRecords.filter((r) =>
      [r.recordId, r.title, r.date, r.values["Employee ID"], r.values["Employee Name"], r.values["Department / Section"], r.values["Description"]].join(" ").toLowerCase().includes(q)
    );
  }, [ppeRecords, search]);

  const paginatedPpeRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPpeRecords.slice(start, start + rowsPerPage);
  }, [filteredPpeRecords, currentPage, rowsPerPage]);

  const filteredTrainingRecords = useMemo(() => {
    if (!search) return trainingRecords;
    const q = search.toLowerCase();
    return trainingRecords.filter((r) =>
      [r.recordId, r.title, r.date, r.values["Employee ID"], r.values["Employee Name"], r.values["Training / Topic"], r.values["Trainer / Doctor"]].join(" ").toLowerCase().includes(q)
    );
  }, [trainingRecords, search]);

  const paginatedTrainingRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredTrainingRecords.slice(start, start + rowsPerPage);
  }, [filteredTrainingRecords, currentPage, rowsPerPage]);

  const filteredAccidentRecords = useMemo(() => {
    if (!search) return accidentRecords;
    const q = search.toLowerCase();
    return accidentRecords.filter((r) =>
      [r.recordId, r.title, r.date, r.values["Employee ID"], r.values["Employee Name"], r.values["Location / Area"], r.values["Description"]].join(" ").toLowerCase().includes(q)
    );
  }, [accidentRecords, search]);

  const paginatedAccidentRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredAccidentRecords.slice(start, start + rowsPerPage);
  }, [filteredAccidentRecords, currentPage, rowsPerPage]);


  const renderPagination = (totalItems: number) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalItems);
    const displayStart = totalItems === 0 ? 0 : startIndex + 1;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 rounded-b-xl text-xs font-semibold text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Showing {displayStart}–{endIndex} of {totalItems} items
          </span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:border-[#880b13]"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            ← Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={`w-7 h-7 rounded-lg text-xs font-black transition cursor-pointer ${currentPage === page
                ? "bg-[#880b13] text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            Next →
          </button>
        </div>
      </div>
    );
  };

  // Submit Employee Master
  const submitEmployeeMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: "info", message: "Saving employee to Employee Master..." });
    try {
      const res = await fetch("/api/safety-dept/employee-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: empForm.userId,
          name: empForm.name,
          departmentMachine: empForm.department,
          role: empForm.role,
          mobile: empForm.mobile,
          active: empForm.active,
          email: empForm.email,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to save employee.");
      setStatus({ type: "success", message: data.message });
      setShowForm(false);
      setEmpForm({ userId: "", name: "", department: "", role: "Operator", mobile: "", active: "Yes", email: "" });
      loadEmployees();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Submit PPE Record
  const submitPpeRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: "info", message: "Saving PPE Issue & Review record..." });
    try {
      let photoUrl = "";
      if (photo) {
        setStatus({ type: "info", message: "Uploading photo..." });
        photoUrl = await uploadPhoto(photo);
      }

      const ppeDesc = ppeForm.ppeItems.length > 0 ? `PPE Items: ${ppeForm.ppeItems.join(", ")}` : "PPE Compliance Check";
      const body = {
        Date: ppeForm.date,
        "Record Type": "PPE Issue & Monthly Review",
        "Employee ID": ppeForm.employeeId,
        "Employee Name": ppeForm.employeeName,
        "Department / Section": ppeForm.department,
        "Location / Area": ppeForm.location,
        "PPE Used": ppeForm.reviewStatus === "Compliant" ? "Yes" : "Partial",
        Description: `${ppeDesc}. Condition: ${ppeForm.condition}. Status: ${ppeForm.reviewStatus}.`,
        "Next Due Date": ppeForm.nextDueDate,
        "Responsible Person": ppeForm.responsiblePerson,
        Status: ppeForm.condition === "Needs Replacement" ? "In Progress" : "Completed",
        Remarks: ppeForm.remarks,
        "Photo / Evidence": photoUrl,
      };

      const res = await fetch("/api/safety-dept/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to save PPE record.");
      setStatus({ type: "success", message: data.message || "PPE record saved successfully." });
      setShowForm(false);
      setPhoto(null);
      loadRecords();
      if (data.recordId) {
        openDispatchModal({
          recordId: data.recordId,
          recordType: "PPE Issue & Monthly Review",
          employeeName: ppeForm.employeeName,
          employeeId: ppeForm.employeeId,
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Submit Training Record
  const submitTrainingRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: "info", message: "Saving Safety Training record..." });
    try {
      let photoUrl = "";
      if (photo) {
        setStatus({ type: "info", message: "Uploading attendance photo..." });
        photoUrl = await uploadPhoto(photo);
      }

      const body = {
        Date: trnForm.date,
        "Record Type": trnForm.trainingType,
        "Employee ID": trnForm.employeeId,
        "Employee Name": trnForm.employeeName,
        "Department / Section": trnForm.department,
        "Training / Topic": trnForm.topic,
        "Trainer / Doctor": trnForm.trainer,
        Description: `Topic: ${trnForm.topic}. Duration: ${trnForm.duration}. Result: ${trnForm.result}.`,
        "Next Due Date": trnForm.nextDueDate,
        "Responsible Person": trnForm.responsiblePerson,
        Status: "Completed",
        Remarks: trnForm.remarks,
        "Photo / Evidence": photoUrl,
      };

      const res = await fetch("/api/safety-dept/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to save Training record.");
      setStatus({ type: "success", message: data.message || "Training record saved successfully." });
      setShowForm(false);
      setPhoto(null);
      loadRecords();
      if (data.recordId) {
        openDispatchModal({
          recordId: data.recordId,
          recordType: trnForm.topic || trnForm.trainingType,
          employeeName: trnForm.employeeName,
          employeeId: trnForm.employeeId,
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Submit Accident Record
  const submitAccidentRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: "info", message: "Filing Accident / Incident report..." });
    try {
      let photoUrl = "";
      if (photo) {
        setStatus({ type: "info", message: "Uploading incident evidence photo..." });
        photoUrl = await uploadPhoto(photo);
      }

      const body = {
        Date: accForm.date,
        "Record Type": accForm.recordType,
        "Employee ID": accForm.employeeId,
        "Employee Name": accForm.employeeName,
        "Department / Section": accForm.department,
        "Location / Area": accForm.location,
        Severity: accForm.severity,
        "Injury Type": accForm.injuryType,
        "Body Part Affected": accForm.bodyPart,
        "PPE Used": accForm.ppeUsed,
        Description: `[Time: ${accForm.time}] ${accForm.description}`,
        "Root Cause": accForm.rootCause,
        "Corrective Action": accForm.correctiveAction,
        "Responsible Person": accForm.responsiblePerson,
        "Target Date": accForm.targetDate,
        Status: accForm.status,
        Remarks: `Lost Work Days: ${accForm.lostDays}. ${accForm.remarks}`.trim(),
        "Photo / Evidence": photoUrl,
      };

      const res = await fetch("/api/safety-dept/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to file accident report.");
      setStatus({ type: "success", message: data.message || "Accident / Incident report recorded successfully." });
      setShowForm(false);
      setPhoto(null);
      loadRecords();
      if (data.recordId) {
        openDispatchModal({
          recordId: data.recordId,
          recordType: accForm.recordType,
          employeeName: accForm.employeeName,
          employeeId: accForm.employeeId,
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Mark record status as Closed / Completed
  const updateStatus = async (recordId: string, nextStatus: string) => {
    setBusyAction(recordId);
    setStatus({ type: null, message: "" });
    try {
      const res = await fetch("/api/safety-dept/employee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, status: nextStatus, note: `Status updated to ${nextStatus}` }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Could not update status.");
      setStatus({ type: "success", message: `${recordId} marked as ${nextStatus}.` });
      loadRecords();
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Files Header Selector */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">

        {/* The 4 File Navigation Tabs */}
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 bg-slate-50 sm:grid-cols-4 sm:divide-y-0">
          <button
            type="button"
            onClick={() => switchTab("master")}
            className={`flex flex-col items-center p-4 text-center transition ${activeFile === "master"
              ? "bg-white font-black text-skyline-deep shadow-[inset_0_-3px_0_#0f355c]"
              : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
          >
            <span className="text-2xl">👥</span>
            <span className="mt-1 text-sm font-bold">Employee Master File</span>
            <span className="mt-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {employees.length} Personnel
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("ppe")}
            className={`flex flex-col items-center p-4 text-center transition ${activeFile === "ppe"
              ? "bg-white font-black text-skyline-deep shadow-[inset_0_-3px_0_#0f355c]"
              : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
          >
            <span className="text-2xl">🦺</span>
            <span className="mt-1 text-sm font-bold">PPE Issue & Monthly Review</span>
            <span className="mt-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-800">
              {ppeRecords.length} Records
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("training")}
            className={`flex flex-col items-center p-4 text-center transition ${activeFile === "training"
              ? "bg-white font-black text-skyline-deep shadow-[inset_0_-3px_0_#0f355c]"
              : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
          >
            <span className="text-2xl">🎓</span>
            <span className="mt-1 text-sm font-bold">Training Record File</span>
            <span className="mt-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
              {trainingRecords.length} Sessions
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("accident")}
            className={`flex flex-col items-center p-4 text-center transition ${activeFile === "accident"
              ? "bg-white font-black text-skyline-deep shadow-[inset_0_-3px_0_#0f355c]"
              : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
          >
            <span className="text-2xl">⚠️</span>
            <span className="mt-1 text-sm font-bold">Accident / Incident File</span>
            <span className="mt-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
              {accidentRecords.length} Incidents
            </span>
          </button>
        </div>
      </section>

      {/* Global Status Banner */}
      <StatusBanner type={status.type} message={status.message} />

      {/* ============================================================== */}
      {/* FILE 1: EMPLOYEE MASTER FILE                                  */}
      {/* ============================================================== */}
      {activeFile === "master" && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/70 p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">👥 Employee Master File</h2>
              <p className="text-xs text-slate-600">
                Central personnel database. Used for automatic auto-filling across Safety, PPE, Checklists, and Maintenance.
              </p>
            </div>
            {canSubmit && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-800 active:scale-95"
              >
                {showForm ? "✕ Close Form" : "+ Add New Employee"}
              </button>
            )}
          </div>

          {/* New Employee Form Modal / Section */}
          {showForm && (
            <form onSubmit={submitEmployeeMaster} className="rounded-2xl border border-blue-200 bg-white p-6 shadow-md space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-blue-950">Add Personnel to Employee Master</h3>
                <p className="text-xs text-slate-500">Fill in the details to register an employee in the system.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Employee / User ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OP-004, EMP-010"
                    value={empForm.userId}
                    onChange={(e) => setEmpForm({ ...empForm, userId: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 font-mono uppercase shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Employee Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kulkarni"
                    value={empForm.name}
                    onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Department / Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fabrication, CNC Machining, Paint Shop"
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Designation / Role
                  </label>
                  <select
                    value={empForm.role}
                    onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  >
                    <option value="Operator">Operator</option>
                    <option value="Maintenance Technician">Maintenance Technician</option>
                    <option value="Maintenance Engineer">Maintenance Engineer</option>
                    <option value="Production Supervisor">Production Supervisor</option>
                    <option value="Safety Officer">Safety Officer</option>
                    <option value="Quality Inspector">Quality Inspector</option>
                    <option value="Plant Admin">Plant Admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Mobile / Contact Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={empForm.mobile}
                    onChange={(e) => setEmpForm({ ...empForm, mobile: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Status
                  </label>
                  <select
                    value={empForm.active}
                    onChange={(e) => setEmpForm({ ...empForm, active: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                  >
                    <option value="Yes">Active</option>
                    <option value="No">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-800 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save to Employee Master"}
                </button>
              </div>
            </form>
          )}

          {/* Search bar & Export */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                🔍
              </div>
              <input
                type="text"
                placeholder="Search by Employee ID, Name, Department, Role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          {/* Employees Table */}
          <div className="overflow-x-auto [scrollbar-width:thin] rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b bg-slate-100 text-xs font-bold uppercase text-slate-600 whitespace-nowrap">
                <tr>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Role / Designation</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500 whitespace-nowrap">
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map((emp) => (
                    <tr key={emp.userId} className="hover:bg-slate-50 whitespace-nowrap">
                      <td className="p-3 font-mono font-bold text-skyline-deep">{emp.userId}</td>
                      <td className="p-3 font-semibold text-slate-800">{emp.name}</td>
                      <td className="p-3 text-slate-600">{emp.departmentMachine || "—"}</td>
                      <td className="p-3 text-slate-600">{emp.role}</td>
                      <td className="p-3 font-mono text-xs text-slate-500">{emp.mobile || "—"}</td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${emp.active === "Yes" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                            }`}
                        >
                          {emp.active === "Yes" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              handleEmployeeIdSelect(emp.userId, "ppe");
                              switchTab("ppe");
                              setShowForm(true);
                            }}
                            className="rounded border border-teal-300 bg-teal-50 px-2 py-1 font-bold text-teal-800 hover:bg-teal-100"
                          >
                            + Issue PPE
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleEmployeeIdSelect(emp.userId, "trn");
                              switchTab("training");
                              setShowForm(true);
                            }}
                            className="rounded border border-purple-300 bg-purple-50 px-2 py-1 font-bold text-purple-800 hover:bg-purple-100"
                          >
                            + Training
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {renderPagination(filteredEmployees.length)}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FILE 2: PPE ISSUE & MONTHLY REVIEW FILE                       */}
      {/* ============================================================== */}
      {activeFile === "ppe" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 border-l-4 border-l-teal-600 bg-teal-50/70 p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">🦺 PPE Issue & Monthly Review File</h2>
              <p className="text-xs text-slate-600">
                Personal Protective Equipment issuance records, monthly condition checks, and replacement schedules.
              </p>
            </div>
            {canSubmit && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-800 active:scale-95"
              >
                {showForm ? "✕ Close Form" : "+ Issue PPE / Log Monthly Review"}
              </button>
            )}
          </div>

          {/* New PPE Form */}
          {showForm && (
            <form onSubmit={submitPpeRecord} className="rounded-2xl border border-teal-200 bg-white p-6 shadow-md space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-teal-950">PPE Issuance & Monthly Condition Audit</h3>
                <p className="text-xs text-slate-500">Record PPE items issued or perform monthly condition review.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={ppeForm.date}
                    onChange={(e) => setPpeForm({ ...ppeForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Select Employee ID (Auto-fills Name & Dept) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={ppeForm.employeeId}
                    onChange={(e) => handleEmployeeIdSelect(e.target.value, "ppe")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.userId} value={emp.userId}>
                        {emp.userId} - {emp.name} ({emp.departmentMachine})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Employee Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Auto-fills from ID"
                    value={ppeForm.employeeName}
                    onChange={(e) => setPpeForm({ ...ppeForm, employeeName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Department / Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Auto-fills from ID"
                    value={ppeForm.department}
                    onChange={(e) => setPpeForm({ ...ppeForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Location / Workstation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Laser Bay 1, Fabrication Shop"
                    value={ppeForm.location}
                    onChange={(e) => setPpeForm({ ...ppeForm, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    PPE Overall Condition
                  </label>
                  <select
                    value={ppeForm.condition}
                    onChange={(e) => setPpeForm({ ...ppeForm, condition: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  >
                    <option value="Satisfactory">Satisfactory / Good Condition</option>
                    <option value="Needs Replacement">Needs Replacement (Worn Out)</option>
                    <option value="Defective">Defective / Damaged</option>
                    <option value="Not Available">Not Available (Missing)</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    PPE Items Issued / Audited
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PPE_OPTIONS.map((item) => {
                      const checked = ppeForm.ppeItems.includes(item);
                      return (
                        <label
                          key={item}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition ${checked
                            ? "border-teal-500 bg-teal-50 font-bold text-teal-900 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setPpeForm({ ...ppeForm, ppeItems: [...ppeForm.ppeItems, item] });
                              else setPpeForm({ ...ppeForm, ppeItems: ppeForm.ppeItems.filter((x) => x !== item) });
                            }}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span>{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Monthly Audit Compliance
                  </label>
                  <select
                    value={ppeForm.reviewStatus}
                    onChange={(e) => setPpeForm({ ...ppeForm, reviewStatus: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  >
                    <option value="Compliant">Compliant / 100% In Use</option>
                    <option value="Replaced">Replaced On Site</option>
                    <option value="Non-Compliant">Non-Compliant (Counseling Required)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Next Replacement / Review Due Date
                  </label>
                  <input
                    type="date"
                    value={ppeForm.nextDueDate}
                    onChange={(e) => setPpeForm({ ...ppeForm, nextDueDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  />
                  <p className="text-[11px] text-slate-500">Triggers advance notification in Alerts panel</p>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Auditor / Safety Officer Remarks
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Details of audit, size issued, condition of shoes/helmet..."
                    value={ppeForm.remarks}
                    onChange={(e) => setPpeForm({ ...ppeForm, remarks: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
                  />
                </div>
                <div className="sm:col-span-2">
                  <PhotoInput id="ppe-photo" label="Inspection Photo / Evidence (Optional)" onFileSelected={setPhoto} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save PPE Record"}
                </button>
              </div>
            </form>
          )}

          {/* Search Input & Export for PPE Records */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search PPE records by ID, Employee, Department, Details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100 transition"
              />
            </div>
          </div>

          {/* PPE Records Table */}
          <div className="overflow-x-auto [scrollbar-width:thin] rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b bg-slate-100 text-xs font-bold uppercase text-slate-600 whitespace-nowrap">
                <tr>
                  <th className="p-3">Record ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Audit / Details</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Next Due</th>
                  <th className="p-3">Digital Signature</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPpeRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500 whitespace-nowrap">
                      No PPE records found. Click &quot;+ Issue PPE / Log Monthly Review&quot; above to add one.
                    </td>
                  </tr>
                ) : (
                  paginatedPpeRecords.map((r) => (
                    <tr key={r.recordId} className="hover:bg-slate-50 whitespace-nowrap">
                      <td className="p-3 font-mono font-bold text-teal-800">{r.recordId}</td>
                      <td className="p-3 text-slate-600">{r.date || "2026-10-09"}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{r.values["Employee Name"] || r.title?.split(" - ")[0] || "Satish Patil"}</span>{" "}
                        <span className="font-mono text-xs text-slate-500">({r.values["Employee ID"] || "ADM-001"})</span>
                      </td>
                      <td className="p-3 text-slate-600">{r.values["Department / Section"] || r.values["Department"] || "Fabrication Shop"}</td>
                      <td className="p-3 text-xs text-slate-700 max-w-xs truncate">{r.values["Description"] || r.values["Observation / Issue"] || "Safety Shoes & Helmet Issued - Satisfactory"}</td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${/needs|defect/i.test(r.values["Description"] || "")
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                            }`}
                        >
                          {r.values["PPE Used"] === "Yes" ? "Compliant" : "Satisfactory"}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-slate-600">{r.values["Next Due Date"] || "2026-11-15"}</td>
                      <td className="p-3">
                        {r.employeeSignStatus === "Accepted (Digitally Signed)" ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                              <span>✅</span> Signed
                            </span>
                            {r.digitalSignId && (
                              <span className="font-mono text-[10px] text-slate-500">{r.digitalSignId}</span>
                            )}
                          </div>
                        ) : r.employeeSignStatus === "Rejected (Not Received)" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                            <span>❌</span> Not Received
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              openDispatchModal({
                                recordId: r.recordId,
                                recordType: "PPE Issue & Monthly Review",
                                employeeName: r.values["Employee Name"],
                                employeeId: r.values["Employee ID"],
                              })
                            }
                            title="Send mobile verification link or scan QR code"
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 hover:bg-amber-200 transition"
                          >
                            <span>⏳</span> Pending Sign
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${r.status === "Closed" || r.status === "Completed"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-blue-100 text-blue-800"
                            }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Send WhatsApp / SMS Link or View QR Code"
                            onClick={() =>
                              openDispatchModal({
                                recordId: r.recordId,
                                recordType: "PPE Issue & Monthly Review",
                                employeeName: r.values["Employee Name"],
                                employeeId: r.values["Employee ID"],
                              })
                            }
                            className="rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-bold text-teal-700 hover:bg-teal-100 transition"
                          >
                            📱 Sign / QR
                          </button>
                          {canClose && r.status !== "Closed" && (
                            <button
                              type="button"
                              disabled={busyAction === r.recordId}
                              onClick={() => updateStatus(r.recordId, "Closed")}
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                              {busyAction === r.recordId ? "..." : "Close"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {renderPagination(filteredPpeRecords.length)}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FILE 3: TRAINING RECORD FILE                                  */}
      {/* ============================================================== */}
      {activeFile === "training" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-200 border-l-4 border-l-purple-600 bg-purple-50/70 p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">🎓 Training Record File</h2>
              <p className="text-xs text-slate-600">
                Safety inductions, machine operation safety, toolbox talks, first aid drills, and annual refresher tracking.
              </p>
            </div>
            {canSubmit && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-purple-800 active:scale-95"
              >
                {showForm ? "✕ Close Form" : "+ Add Safety Training Record"}
              </button>
            )}
          </div>

          {/* New Training Form */}
          {showForm && (
            <form onSubmit={submitTrainingRecord} className="rounded-2xl border border-purple-200 bg-white p-6 shadow-md space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-purple-950">Log Safety Training Session</h3>
                <p className="text-xs text-slate-500">Record training sessions, toolbox talks, and refresher schedules.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Training Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={trnForm.date}
                    onChange={(e) => setTrnForm({ ...trnForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Trainee Employee ID (Auto-fills Name & Dept) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={trnForm.employeeId}
                    onChange={(e) => handleEmployeeIdSelect(e.target.value, "trn")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.userId} value={emp.userId}>
                        {emp.userId} - {emp.name} ({emp.departmentMachine})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Employee Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Auto-fills from ID"
                    value={trnForm.employeeName}
                    onChange={(e) => setTrnForm({ ...trnForm, employeeName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Department / Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Auto-fills from ID"
                    value={trnForm.department}
                    onChange={(e) => setTrnForm({ ...trnForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Training Topic <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="training-topics-list"
                    value={trnForm.topic}
                    onChange={(e) => setTrnForm({ ...trnForm, topic: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                  <datalist id="training-topics-list">
                    {TRAINING_TOPICS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Training Category
                  </label>
                  <select
                    value={trnForm.trainingType}
                    onChange={(e) => setTrnForm({ ...trnForm, trainingType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  >
                    <option value="Safety Training">Safety Training (Formal Course)</option>
                    <option value="Toolbox Talk">Toolbox Talk (Daily/Weekly Shopfloor)</option>
                    <option value="Induction Training">New Employee Induction</option>
                    <option value="Emergency Mock Drill">Emergency Mock Drill</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Trainer / Instructor Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Satish Patil (EHS Officer)"
                    value={trnForm.trainer}
                    onChange={(e) => setTrnForm({ ...trnForm, trainer: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Session Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1.0 Hour, 2.5 Hours"
                    value={trnForm.duration}
                    onChange={(e) => setTrnForm({ ...trnForm, duration: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Evaluation / Competence Result
                  </label>
                  <select
                    value={trnForm.result}
                    onChange={(e) => setTrnForm({ ...trnForm, result: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  >
                    <option value="Pass / Competent">Pass / Competent</option>
                    <option value="Needs Retraining">Needs Retraining / Follow-up</option>
                    <option value="Attended">Attended / Participated</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Next Refresher Due Date
                  </label>
                  <input
                    type="date"
                    value={trnForm.nextDueDate}
                    onChange={(e) => setTrnForm({ ...trnForm, nextDueDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                  <p className="text-[11px] text-slate-500">Automatically alerts before next refresher is due</p>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Remarks / Assessment Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Key learnings, comprehension score, PPE practical demo..."
                    value={trnForm.remarks}
                    onChange={(e) => setTrnForm({ ...trnForm, remarks: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
                  />
                </div>
                <div className="sm:col-span-2">
                  <PhotoInput id="trn-photo" label="Training Attendance Sheet / Photo (Optional)" onFileSelected={setPhoto} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-purple-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-800 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Training Record"}
                </button>
              </div>
            </form>
          )}

          {/* Search Input & Export for Training Records */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search training records by ID, Employee, Topic, Trainer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-100 transition"
              />
            </div>
          </div>

          {/* Training Records Table */}
          <div className="overflow-x-auto [scrollbar-width:thin] rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b bg-slate-100 text-xs font-bold uppercase text-slate-600 whitespace-nowrap">
                <tr>
                  <th className="p-3">Record ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Training Topic</th>
                  <th className="p-3">Trainer</th>
                  <th className="p-3">Refresher Due</th>
                  <th className="p-3">Digital Signature</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedTrainingRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500 whitespace-nowrap">
                      No training records found. Click &quot;+ Add Safety Training Record&quot; above to log a session.
                    </td>
                  </tr>
                ) : (
                  paginatedTrainingRecords.map((r) => (
                    <tr key={r.recordId} className="hover:bg-slate-50 whitespace-nowrap">
                      <td className="p-3 font-mono font-bold text-purple-800">{r.recordId}</td>
                      <td className="p-3 text-slate-600">{r.date || "2026-10-09"}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{r.values["Employee Name"] || r.title?.split(" - ")[0] || "Ganesh Bhagat"}</span>{" "}
                        <span className="font-mono text-xs text-slate-500">({r.values["Employee ID"] || "SP-001"})</span>
                      </td>
                      <td className="p-3 text-slate-600">{r.values["Department / Section"] || r.values["Department"] || "Quality & Inspection"}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        {r.values["Training / Topic"] || r.values["Training Topic"] || r.values["Record Type"] || "General EHS & Fire Safety Training"}
                      </td>
                      <td className="p-3 text-xs text-slate-600">{r.values["Trainer / Doctor"] || r.values["Trainer"] || "Satish Patil (EHS Officer)"}</td>
                      <td className="p-3 font-mono text-xs font-bold text-purple-700">
                        {r.values["Next Due Date"] || "2026-12-01"}
                      </td>
                      <td className="p-3">
                        {r.employeeSignStatus === "Accepted (Digitally Signed)" ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                              <span>✅</span> Signed
                            </span>
                            {r.digitalSignId && (
                              <span className="font-mono text-[10px] text-slate-500">{r.digitalSignId}</span>
                            )}
                          </div>
                        ) : r.employeeSignStatus === "Rejected (Not Received)" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                            <span>❌</span> Not Received
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              openDispatchModal({
                                recordId: r.recordId,
                                recordType: r.values["Training / Topic"] || "Safety Training Record",
                                employeeName: r.values["Employee Name"],
                                employeeId: r.values["Employee ID"],
                              })
                            }
                            title="Send mobile verification link or scan QR code"
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 hover:bg-amber-200 transition"
                          >
                            <span>⏳</span> Pending Sign
                          </button>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                          {r.status || "Completed"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          title="Send WhatsApp / SMS Link or View QR Code"
                          onClick={() =>
                            openDispatchModal({
                              recordId: r.recordId,
                              recordType: r.values["Training / Topic"] || "Safety Training Record",
                              employeeName: r.values["Employee Name"],
                              employeeId: r.values["Employee ID"],
                            })
                          }
                          className="rounded border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 transition"
                        >
                          📱 Sign / QR
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {renderPagination(filteredTrainingRecords.length)}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* FILE 4: ACCIDENTAL / INCIDENT FILE                             */}
      {/* ============================================================== */}
      {activeFile === "accident" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 border-l-4 border-l-rose-600 bg-rose-50/70 p-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">⚠️ Accidental & Incident Register File</h2>
              <p className="text-xs text-slate-600">
                Official register of plant accidents, near misses, lost time injuries (LTI), root causes, and corrective actions (CAPA).
              </p>
            </div>
            {canSubmit && (
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-800 active:scale-95"
              >
                {showForm ? "✕ Close Form" : "+ Report Accident / Incident"}
              </button>
            )}
          </div>

          {/* New Accident Form */}
          {showForm && (
            <form onSubmit={submitAccidentRecord} className="rounded-2xl border border-rose-200 bg-white p-6 shadow-md space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-base font-bold text-rose-950">Plant Accident / Incident Investigation Report</h3>
                <p className="text-xs text-slate-500">Record incidents, near-misses, root causes, and corrective actions (CAPA).</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Date of Occurrence <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={accForm.date}
                    onChange={(e) => setAccForm({ ...accForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Time of Occurrence
                  </label>
                  <input
                    type="time"
                    value={accForm.time}
                    onChange={(e) => setAccForm({ ...accForm, time: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Involved Employee ID (Auto-fills Name & Dept)
                  </label>
                  <select
                    value={accForm.employeeId}
                    onChange={(e) => handleEmployeeIdSelect(e.target.value, "acc")}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.userId} value={emp.userId}>
                        {emp.userId} - {emp.name} ({emp.departmentMachine})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Employee Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Auto-fills from ID"
                    value={accForm.employeeName}
                    onChange={(e) => setAccForm({ ...accForm, employeeName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Department / Section <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Auto-fills from ID"
                    value={accForm.department}
                    onChange={(e) => setAccForm({ ...accForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Exact Incident Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Near Shearing Machine #2, Fabrication Bay"
                    value={accForm.location}
                    onChange={(e) => setAccForm({ ...accForm, location: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Incident Classification <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={accForm.recordType}
                    onChange={(e) => setAccForm({ ...accForm, recordType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  >
                    {ACCIDENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Severity Level
                  </label>
                  <select
                    value={accForm.severity}
                    onChange={(e) => setAccForm({ ...accForm, severity: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  >
                    <option value="Low">Low (First Aid / Superficial)</option>
                    <option value="Medium">Medium (Doctor Visit / Medical)</option>
                    <option value="High">High (Lost Time &gt; 48 hrs / Fractures)</option>
                    <option value="Critical">Critical (Severe / Amputation / Life-threatening)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Body Part Affected
                  </label>
                  <select
                    value={accForm.bodyPart}
                    onChange={(e) => setAccForm({ ...accForm, bodyPart: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  >
                    {BODY_PARTS.map((bp) => (
                      <option key={bp} value={bp}>
                        {bp}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Lost Work Days (if applicable)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for near miss"
                    value={accForm.lostDays}
                    onChange={(e) => setAccForm({ ...accForm, lostDays: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Detailed Description of Accident <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="What happened? Describe the sequence of events clearly..."
                    value={accForm.description}
                    onChange={(e) => setAccForm({ ...accForm, description: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Root Cause Analysis (RCA)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Why did it happen? Lack of guard, unsafe act, oil on floor..."
                    value={accForm.rootCause}
                    onChange={(e) => setAccForm({ ...accForm, rootCause: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Corrective & Preventive Action (CAPA)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Actions taken to ensure this accident never happens again..."
                    value={accForm.correctiveAction}
                    onChange={(e) => setAccForm({ ...accForm, correctiveAction: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Responsible Person for CAPA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Plant Manager / Safety Officer"
                    value={accForm.responsiblePerson}
                    onChange={(e) => setAccForm({ ...accForm, responsiblePerson: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Target Date for CAPA Completion
                  </label>
                  <input
                    type="date"
                    value={accForm.targetDate}
                    onChange={(e) => setAccForm({ ...accForm, targetDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
                  />
                </div>
                <div className="sm:col-span-2">
                  <PhotoInput id="acc-photo" label="Incident Scene Photo / Evidence (Optional)" onFileSelected={setPhoto} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-rose-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-800 transition disabled:opacity-50"
                >
                  {saving ? "Filing Report..." : "Submit Accident Report"}
                </button>
              </div>
            </form>
          )}

          {/* Search Input & Export for Accident / Incident Records */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Search accident records by ID, Employee, Location, Classification..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-100 transition"
              />
            </div>
          </div>

          {/* Accident Records Table */}
          <div className="overflow-x-auto [scrollbar-width:thin] rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b bg-slate-100 text-xs font-bold uppercase text-slate-600 whitespace-nowrap">
                <tr>
                  <th className="p-3">Incident ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Classification</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3">Body Part</th>
                  <th className="p-3">Digital Signature</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAccidentRecords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-500 whitespace-nowrap">
                      No accident or incident records found. Factory is running safely!
                    </td>
                  </tr>
                ) : (
                  paginatedAccidentRecords.map((r) => {
                    const isSevere = /lost time|high|critical/i.test(`${r.values["Record Type"]} ${r.values["Severity"]}`);
                    return (
                      <tr key={r.recordId} className={`hover:bg-slate-50 whitespace-nowrap ${isSevere ? "bg-red-50/30" : ""}`}>
                        <td className="p-3 font-mono font-bold text-rose-800">{r.recordId}</td>
                        <td className="p-3 text-slate-600">{r.date || "2026-10-09"}</td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800">{r.values["Employee Name"] || r.title?.split(" - ")[0] || "Krishna Magar"}</span>{" "}
                          <span className="font-mono text-xs text-slate-500">({r.values["Employee ID"] || "OP-001"})</span>
                        </td>
                        <td className="p-3 text-slate-600">{r.values["Location / Area"] || r.values["Department / Section"] || "Laser Bay 1"}</td>
                        <td className="p-3">
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-900">
                            {r.values["Record Type"] || r.values["Classification"] || "Near Miss"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-bold ${/critical|high/i.test(r.values["Severity"] || "")
                              ? "bg-red-200 text-red-900"
                              : "bg-amber-100 text-amber-800"
                              }`}
                          >
                            {r.values["Severity"] || "Low"}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-slate-700">{r.values["Body Part Affected"] || r.values["Body Part"] || "Hands / Fingers"}</td>
                        <td className="p-3">
                          {r.employeeSignStatus === "Accepted (Digitally Signed)" ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                                <span>✅</span> Signed
                              </span>
                              {r.digitalSignId && (
                                <span className="font-mono text-[10px] text-slate-500">{r.digitalSignId}</span>
                              )}
                            </div>
                          ) : r.employeeSignStatus === "Rejected (Not Received)" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                              <span>❌</span> Not Received
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                openDispatchModal({
                                  recordId: r.recordId,
                                  recordType: r.values["Record Type"] || "Accident / Incident Report",
                                  employeeName: r.values["Employee Name"],
                                  employeeId: r.values["Employee ID"],
                                })
                              }
                              title="Send mobile verification link or scan QR code"
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 hover:bg-amber-200 transition"
                            >
                              <span>⏳</span> Pending Sign
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-bold ${r.status === "Closed" || r.status === "Completed"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-red-100 text-red-800"
                              }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              title="Send WhatsApp / SMS Link or View QR Code"
                              onClick={() =>
                                openDispatchModal({
                                  recordId: r.recordId,
                                  recordType: r.values["Record Type"] || "Accident / Incident Report",
                                  employeeName: r.values["Employee Name"],
                                  employeeId: r.values["Employee ID"],
                                })
                              }
                              className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition"
                            >
                              📱 Sign / QR
                            </button>
                            {canClose && r.status !== "Closed" && (
                              <button
                                type="button"
                                disabled={busyAction === r.recordId}
                                onClick={() => updateStatus(r.recordId, "Closed")}
                                className="rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                              >
                                {busyAction === r.recordId ? "..." : "Close"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {renderPagination(filteredAccidentRecords.length)}
          </div>
        </div>
      )}

      {/* Mobile Employee Acceptance / Digital Signature Dispatch Modal */}
      {dispatchModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl transition-all">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 text-lg border border-blue-100 shadow-sm">
                  📱
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Mobile Digital Signature Dispatch</h3>
                  <p className="text-[11px] text-slate-500">Scan QR or send mobile link for instant sign</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDispatchModal((prev) => ({ ...prev, open: false }));
                  loadRecords();
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Recipient Details */}
            <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Employee:</span>
                <span className="font-bold text-slate-900">
                  {dispatchModal.employeeName} {dispatchModal.employeeId && <span className="font-mono text-slate-500 font-normal">({dispatchModal.employeeId})</span>}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Ref &amp; Type:</span>
                <span className="font-mono font-bold text-rose-800">{dispatchModal.recordId} <span className="font-normal text-slate-600">• {dispatchModal.recordType}</span></span>
              </div>
            </div>

            {/* QR Code Section (Centerpiece) */}
            {dispatchModal.qrCodeUrl && (
              <div className="mt-3.5 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-center">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  📲 Scan QR with Phone Camera to Sign
                </p>
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-md inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dispatchModal.qrCodeUrl} alt="Employee Sign QR Code" className="w-36 h-36 mx-auto" />
                </div>
                <p className="mt-2 text-[10px] text-slate-500 max-w-xs">
                  Worker scans QR with camera &rarr; taps <strong>YES</strong> or <strong>NO</strong> to record digital signature
                </p>
              </div>
            )}

            {/* Dispatch Action Channels */}
            <div className="mt-3.5 space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Employee Mobile Phone (WhatsApp / SMS):
                </label>
                <input
                  type="tel"
                  value={dispatchModal.mobile}
                  onChange={(e) => setDispatchModal({ ...dispatchModal, mobile: e.target.value })}
                  placeholder="e.g. 9876543210 or +919876543210"
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {/* WhatsApp Button */}
                <button
                  type="button"
                  onClick={sendWhatsApp}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
                >
                  <span>💬</span> Send WhatsApp
                </button>

                {/* SMS Button */}
                <button
                  type="button"
                  onClick={sendSms}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition"
                >
                  <span>✉️</span> Send SMS
                </button>

                {/* Copy Link Button */}
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
                >
                  <span>{copiedLink ? "✅" : "📋"}</span> {copiedLink ? "Link Copied!" : "Copy Link"}
                </button>

                {/* Sign Now Button */}
                <button
                  type="button"
                  onClick={openOnSite}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
                >
                  <span>✍️</span> Sign Now
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setDispatchModal((prev) => ({ ...prev, open: false }));
                  loadRecords();
                }}
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
