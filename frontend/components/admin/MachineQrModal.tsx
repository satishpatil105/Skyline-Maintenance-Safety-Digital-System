"use client";

import { useState, useEffect, useRef } from "react";

interface MachineQrModalProps {
    isOpen: boolean;
    machinesList: { assetId: string; name: string; department?: string; status?: string }[];
    onClose: () => void;
}

function extractAssetId(text: string): string {
    const raw = text.trim();
    const match = raw.match(/\/machine\/([^/?#]+)/i);
    if (match) return decodeURIComponent(match[1]);

    const paramMatch = raw.match(/[?&]assetId=([^&#]+)/i);
    if (paramMatch) return decodeURIComponent(paramMatch[1]);

    return raw;
}

export default function MachineQrModal({
    isOpen,
    machinesList,
    onClose,
}: MachineQrModalProps) {
    const [searchQr, setSearchQr] = useState("");
    const [isCameraActive, setIsCameraActive] = useState(true);
    const [cameraSupported, setCameraSupported] = useState(true);
    const [simulatedScanSuccess, setSimulatedScanSuccess] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    const handleOpenMachine = (assetId: string) => {
        const cleanId = extractAssetId(assetId);
        if (!cleanId) return;

        setSimulatedScanSuccess(cleanId);
        stopCamera();

        setTimeout(() => {
            if (typeof window !== "undefined") {
                window.open(`/operator/machine/${encodeURIComponent(cleanId)}`, "_blank");
            }
            onClose();
        }, 600);
    };

    // Camera initialization and live detection
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }

        setSearchQr("");
        setSimulatedScanSuccess(null);

        if (!isCameraActive) {
            stopCamera();
            return;
        }

        let isSubscribed = true;

        async function initCamera() {
            try {
                if (!navigator?.mediaDevices?.getUserMedia) {
                    setCameraSupported(false);
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: false,
                });

                if (!isSubscribed) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => {});
                }
                setCameraSupported(true);

                // Live barcode detection if supported by browser
                const win = typeof window !== "undefined" ? (window as any) : null;
                if (win && win.BarcodeDetector) {
                    const detector = new win.BarcodeDetector({ formats: ["qr_code", "code_128"] });
                    const loop = async () => {
                        if (!isSubscribed || !videoRef.current || videoRef.current.readyState < 2) {
                            if (isSubscribed) requestAnimationFrame(loop);
                            return;
                        }
                        try {
                            const barcodes = await detector.detect(videoRef.current);
                            if (barcodes.length > 0 && barcodes[0].rawValue) {
                                handleOpenMachine(barcodes[0].rawValue);
                                return;
                            }
                        } catch {
                            // ignore frame error
                        }
                        if (isSubscribed) requestAnimationFrame(loop);
                    };
                    requestAnimationFrame(loop);
                }
            } catch {
                setCameraSupported(false);
            }
        }

        initCamera();

        return () => {
            isSubscribed = false;
            stopCamera();
        };
    }, [isOpen, isCameraActive]);

    if (!isOpen) return null;

    const filteredMachines = machinesList.filter((m) => {
        const s = searchQr.toLowerCase().trim();
        return (
            !s ||
            m.assetId.toLowerCase().includes(s) ||
            m.name.toLowerCase().includes(s) ||
            (m.department && m.department.toLowerCase().includes(s))
        );
    });

    // Handle image file upload for QR code
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                    handleOpenMachine(barcodes[0].rawValue);
                    return;
                }
            } catch {
                // fall through
            }
        }

        // Fallback: search by file name or prompt
        const guess = file.name.replace(/\.[^/.]+$/, "");
        const matched = machinesList.find(
            (m) =>
                m.assetId.toLowerCase() === guess.toLowerCase() ||
                m.name.toLowerCase().includes(guess.toLowerCase())
        );
        if (matched) {
            handleOpenMachine(matched.assetId);
        } else {
            setSearchQr(guess);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-150">
            <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">

                {/* Top Header Bar */}
                <div className="bg-gradient-to-r from-[#880b13] to-[#a3121b] px-5 py-3.5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-lg shadow-inner border border-white/20">
                            📷
                        </div>
                        <div>
                            <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
                                Skyline QR Scanner
                                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                                    Machine Portal
                                </span>
                            </h3>
                            <p className="text-[11px] text-white/80 font-medium leading-none mt-0.5">
                                Scan QR tag or select machine to open details
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors font-bold text-xs"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 space-y-3.5">
                    {/* QR Viewfinder Viewport */}
                    <div className="relative h-44 w-full rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border-2 border-slate-800 shadow-inner">

                        {/* Live Camera Video Feed */}
                        {isCameraActive && cameraSupported && (
                            <video
                                ref={videoRef}
                                className="absolute inset-0 h-full w-full object-cover"
                                autoPlay
                                playsInline
                                muted
                            />
                        )}

                        {/* Background Grid Pattern when camera is off or inactive */}
                        {(!isCameraActive || !cameraSupported) && (
                            <div className="absolute inset-0 bg-[radial-[#1e293b]_1px,transparent_1px] [background-size:14px_14px] opacity-40"></div>
                        )}

                        {/* Simulated Live Laser Line */}
                        {isCameraActive && (
                            <div className="absolute inset-x-6 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_15px_#ef4444] animate-[bounce_2s_infinite] z-10 pointer-events-none"></div>
                        )}

                        {/* Target Framing Reticle */}
                        <div className="relative h-28 w-28 border-2 border-white/40 rounded-xl flex items-center justify-center bg-black/20 backdrop-blur-xs z-10">
                            {/* Corner Accents */}
                            <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-[#880b13] rounded-tl-md"></div>
                            <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-[#880b13] rounded-tr-md"></div>
                            <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-[#880b13] rounded-bl-md"></div>
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-[#880b13] rounded-br-md"></div>

                            {simulatedScanSuccess ? (
                                <div className="text-center p-2 animate-in zoom-in-75 duration-150">
                                    <span className="text-2xl">✅</span>
                                    <p className="text-[10px] font-black text-emerald-400 mt-0.5">Opening Machine!</p>
                                    <p className="text-[10px] font-mono text-white truncate max-w-[100px]">{simulatedScanSuccess}</p>
                                </div>
                            ) : (
                                <div className="text-center p-1.5">
                                    <span className="text-2xl opacity-90 animate-pulse">📷</span>
                                    <p className="text-[10px] font-bold text-white mt-0.5 drop-shadow-md">Center QR Tag</p>
                                </div>
                            )}
                        </div>

                        {/* Camera Control Footer inside Viewport */}
                        <div className="absolute bottom-2 inset-x-3 flex items-center justify-between px-1 z-10">
                            <span className="text-[10px] font-medium text-slate-300 drop-shadow-sm flex items-center gap-1.5">
                                <span className={`h-1.5 w-1.5 rounded-full ${isCameraActive && cameraSupported ? "bg-emerald-500 animate-ping" : "bg-amber-400"}`}></span>
                                {isCameraActive && cameraSupported ? "Live Camera" : "Ready to Scan"}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-[10px] font-bold text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
                                    title="Upload QR Image"
                                >
                                    📁 Upload
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsCameraActive(!isCameraActive)}
                                    className="text-[10px] font-bold text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
                                >
                                    {isCameraActive ? "Pause" : "Start"}
                                </button>
                            </div>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>

                    {/* Quick Machine Search & Register List */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                                🔍 Quick Asset Search
                            </label>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                {filteredMachines.length} Assets Registered
                            </span>
                        </div>

                        <div className="relative">
                            <input
                                type="text"
                                value={searchQr}
                                onChange={(e) => setSearchQr(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        if (filteredMachines.length > 0) {
                                            handleOpenMachine(filteredMachines[0].assetId);
                                        } else if (searchQr.trim()) {
                                            handleOpenMachine(searchQr.trim());
                                        }
                                    }
                                }}
                                placeholder="Type Asset ID (e.g. SKY-LSR-MCH-001) or Machine Name..."
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#880b13] focus:ring-2 focus:ring-[#880b13]/10 focus:outline-hidden transition-all shadow-2xs"
                            />
                            <span className="absolute left-3 top-2 text-xs text-slate-400">🔍</span>
                            {searchQr && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQr("")}
                                    className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Asset Matches Dropdown List */}
                        <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs">
                            {filteredMachines.length === 0 ? (
                                <div className="p-3 text-center text-xs font-semibold text-slate-400">
                                    No matching machines found for "{searchQr}"
                                </div>
                            ) : (
                                filteredMachines.map((m) => (
                                    <div
                                        key={m.assetId}
                                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-lg bg-[#faf1f2] text-[#880b13] flex items-center justify-center font-mono font-bold text-xs border border-[#880b13]/10 group-hover:bg-[#880b13] group-hover:text-white transition-colors shrink-0">
                                                ⚙️
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-xs font-black text-slate-900">{m.assetId}</span>
                                                    {m.department && (
                                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md truncate max-w-[90px]">
                                                            {m.department}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-medium text-slate-600 truncate max-w-[190px]">
                                                    {m.name}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenMachine(m.assetId)}
                                            className="rounded-lg bg-[#880b13] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#a3121b] transition-all shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                                            title={`Open ${m.assetId} machine workstation`}
                                        >
                                            <span>Open Machine</span>
                                            <span className="text-[10px]">↗</span>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-500">
                        Skyline Digital Safety Tag System v2.4
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                    >
                        Close Scanner
                    </button>
                </div>

            </div>
        </div>
    );
}
