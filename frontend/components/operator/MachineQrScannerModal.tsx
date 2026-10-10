"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

export default function MachineQrScannerModal({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user?: SessionUser | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedAssetId, setScannedAssetId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [selectedMachineId, setSelectedMachineId] = useState("");
  const [machines, setMachines] = useState<{ assetId: string; name: string; category?: string }[]>([]);

  // Fetch machine list directly from MongoDB Atlas API exclusively (100% Dynamic)
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/checklist")
      .then((res) => res.json())
      .then((data) => {
        if (data.machines && Array.isArray(data.machines)) {
          const roleLower = (user?.role || "").toLowerCase();
          const isSuperOrAdmin = roleLower === "admin" || roleLower === "supervisor";
          if (user && !isSuperOrAdmin && user.departmentMachine) {
            const dept = user.departmentMachine.trim().toLowerCase();
            const filtered = data.machines.filter((m: any) => {
              const mName = (m.name || "").toLowerCase();
              const mId = (m.assetId || "").toLowerCase();
              const mCat = (m.category || "").toLowerCase();
              return (
                mId === dept ||
                mName === dept ||
                mName.includes(dept) ||
                dept.includes(mName) ||
                mId.includes(dept) ||
                mCat.includes(dept)
              );
            });
            if (filtered.length > 0) {
              setMachines(filtered);
            } else {
              setMachines([{ assetId: user.departmentMachine, name: user.departmentMachine }]);
            }
          } else {
            setMachines(data.machines);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching machines from MongoDB Atlas:", err);
      });
  }, [isOpen, user]);

  // Camera Lifecycle
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanMessage(null);
      setScannedAssetId(null);
      setManualInput("");
      setSelectedMachineId("");
      return;
    }
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  async function startCamera() {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera stream not supported by current browser environment. Use Quick Picker or Select Asset ID below.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
      }
      setCameraActive(true);
      startDetectionLoop();
    } catch {
      setCameraActive(false);
      setCameraError("Camera permission denied or camera offline. Use Quick Picker or enter Asset ID below.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function flipCamera() {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }

  function startDetectionLoop() {
    const win = typeof window !== "undefined" ? (window as any) : null;
    if (!win || !win.BarcodeDetector) return;

    try {
      const barcodeDetector = new win.BarcodeDetector({ formats: ["qr_code", "code_128", "code_39"] });
      let active = true;

      const detectFrame = async () => {
        if (!active || !videoRef.current || videoRef.current.readyState < 2) {
          if (active) requestAnimationFrame(detectFrame);
          return;
        }

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const raw = barcodes[0].rawValue || "";
            handleDecoded(raw);
            return;
          }
        } catch {
          // ignore frame errors
        }

        if (active) requestAnimationFrame(detectFrame);
      };

      requestAnimationFrame(detectFrame);
      return () => {
        active = false;
      };
    } catch {
      // initialization fallback
    }
  }

  function extractAssetId(text: string): string {
    const raw = text.trim();
    const match = raw.match(/\/machine\/([^/?#]+)/i);
    if (match) return decodeURIComponent(match[1]);

    const paramMatch = raw.match(/[?&]assetId=([^&#]+)/i);
    if (paramMatch) return decodeURIComponent(paramMatch[1]);

    return raw;
  }

  function handleDecoded(rawCode: string) {
    const assetId = extractAssetId(rawCode);
    if (!assetId) return;

    setScannedAssetId(assetId);

    // Operator authorization check (Admins and Supervisors have unrestricted access)
    const roleLower = (user?.role || "").toLowerCase();
    const isSuperOrAdmin = roleLower === "admin" || roleLower === "supervisor";

    if (user && !isSuperOrAdmin && user.departmentMachine) {
      const dept = user.departmentMachine.trim().toLowerCase();
      const tokens = dept.split(/[\s/,-]+/).filter((t) => t.length > 2 && t !== "machine");
      const cleanAsset = assetId.toLowerCase();

      const found = machines.find((m) => m.assetId.toLowerCase() === cleanAsset);
      const mName = (found?.name || "").toLowerCase();

      const matches =
        dept === cleanAsset ||
        dept === mName ||
        cleanAsset.includes(dept) ||
        mName.includes(dept) ||
        (tokens.length > 0 && tokens.some((token) => cleanAsset.includes(token) || mName.includes(token)));

      if (!matches) {
        setScanMessage({
          type: "error",
          text: `🚫 Access Restricted: You scanned ${found?.name || assetId}. You are assigned strictly to ${user.departmentMachine}.`,
        });
        return;
      }
    }

    // Success!
    setScanMessage({
      type: "success",
      text: `✓ Machine Identified: ${assetId}. Navigating to machine details...`,
    });
    stopCamera();

    setTimeout(() => {
      onClose();
      window.open(`/operator/machine/${encodeURIComponent(assetId)}`, "_blank");
    }, 600);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetId = manualInput.trim() || selectedMachineId;
    if (targetId) {
      handleDecoded(targetId);
    }
  }

  // Handle uploaded QR image file
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const win = typeof window !== "undefined" ? (window as any) : null;
    if (win && win.BarcodeDetector) {
      try {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const detector = new win.BarcodeDetector({ formats: ["qr_code", "code_128"] });
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0) {
          handleDecoded(barcodes[0].rawValue || "");
          return;
        }
      } catch {
        // Fallback below
      }
    }

    // Fallback if image detector unavailable: ask user to select machine
    setScanMessage({
      type: "info",
      text: `QR Photo uploaded. Please select or verify the machine from the Quick Picker list below.`,
    });
  }

  if (!isOpen) return null;

  const userRole = user?.role || "Supervisor";
  const userName = user?.name || "Ganesh Bhagat";
  const userDept = user?.departmentMachine || "Quality";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#880b13] via-rose-950 to-slate-900 px-5 py-4 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-md shadow-xs border border-white/20">
              📷
            </span>
            <div>
              <h2 className="text-base font-black tracking-tight leading-tight">Scan Machine QR / Barcode</h2>
              <p className="text-[11px] text-rose-200 font-medium">
                Point camera at machine label or pick Asset ID below
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-all cursor-pointer"
            title="Cancel / Close Scanner"
          >
            ✕
          </button>
        </div>

        {/* User Context Banner */}
        <div className="bg-slate-900 text-white px-5 py-2.5 flex items-center justify-between text-xs border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-200 font-medium">
              Signed in as: <strong className="text-white font-bold">{userName}</strong>
            </span>
          </div>
          <span className="font-extrabold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-[11px]">
            {userRole} ({userDept})
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Camera Viewport */}
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner flex items-center justify-center border border-slate-800">
            {cameraActive ? (
              <>
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

                {/* Target Reticle */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-44 w-44 rounded-2xl border-2 border-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                    <div className="absolute inset-x-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse top-1/2 -translate-y-1/2" />
                    <span className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-white rounded-tl-sm" />
                    <span className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-white rounded-tr-sm" />
                    <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-white rounded-bl-sm" />
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-white rounded-br-sm" />
                  </div>
                </div>

                {/* Camera controls overlay */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={flipCamera}
                    className="rounded-xl bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md hover:bg-black/90 flex items-center gap-1.5 shadow-md border border-white/10"
                  >
                    <span>🔄</span> Flip Camera
                  </button>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <span className="text-4xl block animate-bounce">📹</span>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                  {cameraError || "Camera stream unavailable. Select a machine or upload photo below."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
                  >
                    Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-200 transition-all border border-slate-700 cursor-pointer"
                  >
                    📁 Upload QR Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Feedback Banner */}
          {scanMessage && (
            <div
              className={`rounded-2xl p-3.5 text-xs font-bold shadow-sm ${scanMessage.type === "success"
                ? "bg-emerald-50 text-emerald-950 border border-emerald-300"
                : scanMessage.type === "error"
                  ? "bg-red-50 text-red-950 border border-red-300"
                  : "bg-blue-50 text-blue-950 border border-blue-300"
                }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base flex-none">
                  {scanMessage.type === "success" ? "✅" : scanMessage.type === "error" ? "🚫" : "ℹ️"}
                </span>
                <div className="flex-1 leading-relaxed">{scanMessage.text}</div>
              </div>
            </div>
          )}

          {/* Machine Selection Options */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wide">
              Select or Enter Machine Asset ID
            </label>

            {/* Quick Select Dropdown */}
            <div className="flex flex-col gap-1.5">
              <select
                value={selectedMachineId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMachineId(val);
                  if (val) {
                    setManualInput(val);
                    handleDecoded(val);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-rose-50/50 px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-xs focus:border-[#880b13] focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100 transition cursor-pointer"
              >
                <option value="">-- Choose Machine Station --</option>
                {machines.map((m) => (
                  <option key={m.assetId} value={m.assetId}>
                    {m.name} ({m.assetId})
                  </option>
                ))}
              </select>
            </div>

            {/* Manual input & Open button */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="e.g. SKY-LSR-MCH-001"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:border-[#880b13] focus:outline-none focus:ring-2 focus:ring-rose-100 shadow-xs transition"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#880b13] hover:bg-[#72070e] px-4 py-2 text-xs font-extrabold text-white shadow-sm shrink-0 transition-all active:scale-95 cursor-pointer"
              >
                Open Machine
              </button>
            </form>

            {/* Fast-select Chip List */}
            {machines.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Quick Factory Stations:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {machines.slice(0, 6).map((m) => (
                    <button
                      key={m.assetId}
                      type="button"
                      onClick={() => handleDecoded(m.assetId)}
                      className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-950 transition cursor-pointer"
                    >
                      {m.name ? m.name.split(" (")[0] : m.assetId}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-semibold">Skyline Digital QR Scanner</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900 hover:underline cursor-pointer"
          >
            Cancel / Close
          </button>
        </div>
      </div>
    </div>
  );
}
