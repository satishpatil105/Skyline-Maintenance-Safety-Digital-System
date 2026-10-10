"use client";

import { useEffect, useRef, useState } from "react";

interface PhotoInputProps {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  onFileSelected: (file: File | null) => void;
}

export default function PhotoInput({
  id,
  label,
  required = false,
  helperText,
  onFileSelected,
}: PhotoInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Clean up object URLs and camera streams on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewUrl, cameraStream]);

  // Handle stream assignment to video element
  useEffect(() => {
    if (isCameraOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [isCameraOpen, cameraStream]);

  function handleFileChange(file: File | null) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (file) {
      setSelectedFile(file);
      onFileSelected(file);
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
      onFileSelected(null);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0];
    handleFileChange(file || null);
  }

  function clearSelection() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (mobileCameraRef.current) mobileCameraRef.current.value = "";
    handleFileChange(null);
  }

  async function startCamera() {
    setCameraError(null);
    setCapturedSnapshot(null);

    // Check if getUserMedia is supported
    if (!navigator?.mediaDevices?.getUserMedia) {
      // Fallback to native mobile device camera input
      mobileCameraRef.current?.click();
      return;
    }

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err) {
      console.warn("Could not start WebRTC camera, falling back to device camera input", err);
      // Fallback directly to native camera input
      setIsCameraOpen(false);
      mobileCameraRef.current?.click();
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setCapturedSnapshot(null);
    setCameraError(null);
  }

  function switchCamera() {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
    }

    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { exact: nextMode } },
        audio: false,
      })
      .then((stream) => {
        setCameraStream(stream);
      })
      .catch(() => {
        // Fall back to ideal
        navigator.mediaDevices
          ?.getUserMedia({
            video: { facingMode: { ideal: nextMode } },
            audio: false,
          })
          .then((stream) => setCameraStream(stream))
          .catch((err) => setCameraError("Cannot switch camera: " + err.message));
      });
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedSnapshot(dataUrl);
  }

  function confirmSnapshot() {
    if (!capturedSnapshot) return;

    // Convert dataUrl to File
    const arr = capturedSnapshot.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File([u8arr], `Camera_Capture_${timestamp}.jpg`, { type: mime });

    handleFileChange(file);
    stopCamera();
  }

  function retakeSnapshot() {
    setCapturedSnapshot(null);
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-2">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        id={id}
        name={id}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleInputChange}
        className="hidden"
      />
      {/* Native Mobile Camera Fallback Input */}
      <input
        ref={mobileCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Label and Status */}
      <div className="flex items-center justify-between">
        <label className="field-label !mt-0 flex items-center gap-1.5" htmlFor={id}>
          <span>{label}</span>
          {required ? (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
              Required *
            </span>
          ) : (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
              Optional
            </span>
          )}
        </label>
        {selectedFile && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span>✓ Attached (Optional)</span>
          </span>
        )}
      </div>

      {/* Main Evidence Capture / Upload Sector */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileChange(file);
          }}
          className={`relative rounded-2xl border-2 border-dashed p-4 transition-all duration-200 ${
            isDragOver
              ? "border-skyline-deep bg-skyline-deep/5"
              : required
              ? "border-amber-300 bg-amber-50/40 hover:border-amber-400"
              : "border-slate-300 bg-slate-50/70 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-white text-2xl shadow-sm border border-slate-200">
                📸
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Provide Inspection Photo or Evidence File
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {helperText || "Open your camera for a live snapshot or upload an image/document. (Optional — attach if available)"}
                </p>
              </div>
            </div>

            {/* Action Buttons: Open Camera & Upload File */}
            <div className="flex w-full flex-wrap items-center justify-center sm:w-auto sm:justify-end gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-skyline-deep to-skyline-dark px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 transition-all"
              >
                <span>📷</span>
                <span>Open Camera</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100 transition-all"
              >
                <span>📁</span>
                <span>Upload Image / File</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Selected Evidence Preview Card */
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 to-teal-50/40 p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {previewUrl ? (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Click to view full photo"
                  className="group relative flex-none block h-14 w-14 overflow-hidden rounded-xl border border-emerald-300 bg-black shadow-inner"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    🔍
                  </div>
                </a>
              ) : (
                <div className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-white text-2xl shadow-sm border border-emerald-200">
                  📄
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-800" title={selectedFile.name}>
                  {selectedFile.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded bg-white/80 border border-slate-200 px-1.5 py-0.5 font-mono">
                    {formatBytes(selectedFile.size)}
                  </span>
                  <span className="font-medium text-emerald-800">
                    {selectedFile.type || "Document"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions for current file */}
            <div className="flex items-center gap-1.5 flex-none">
              <button
                type="button"
                onClick={startCamera}
                title="Retake with camera"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                📷 Retake
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Replace with another file"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                📁 Replace
              </button>
              <button
                type="button"
                onClick={clearSelection}
                title="Remove attachment"
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 shadow-sm"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE BROWSER CAMERA MODAL --- */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex flex-col w-full max-w-lg rounded-3xl bg-slate-900 shadow-2xl overflow-hidden border border-slate-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="font-bold text-sm">Live Camera Capture</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={switchCamera}
                  title="Switch Front/Rear Camera"
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-300"
                >
                  🔄 Flip
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-bold text-slate-300"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Viewfinder / Video Feed */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              {!capturedSnapshot ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {/* Viewfinder crosshairs / focus rectangle */}
                  <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/30 flex items-center justify-center">
                    <div className="h-8 w-8 border-t-2 border-l-2 border-white/70 absolute top-2 left-2"></div>
                    <div className="h-8 w-8 border-t-2 border-r-2 border-white/70 absolute top-2 right-2"></div>
                    <div className="h-8 w-8 border-b-2 border-l-2 border-white/70 absolute bottom-2 left-2"></div>
                    <div className="h-8 w-8 border-b-2 border-r-2 border-white/70 absolute bottom-2 right-2"></div>
                    <span className="text-[11px] font-bold text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
                      Align equipment or evidence in frame
                    </span>
                  </div>
                </>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={capturedSnapshot}
                  alt="Captured snapshot"
                  className="h-full w-full object-cover animate-in zoom-in-95 duration-150"
                />
              )}

              {cameraError && (
                <div className="absolute inset-x-4 bottom-4 rounded-xl bg-red-900/90 p-2.5 text-center text-xs text-red-200">
                  {cameraError}
                </div>
              )}
            </div>

            {/* Modal Controls */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 p-4">
              {!capturedSnapshot ? (
                <div className="flex w-full items-center justify-center">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-600 shadow-lg active:scale-95 transition-transform"
                    title="Take Snapshot"
                  >
                    <span className="block h-11 w-11 rounded-full bg-white"></span>
                  </button>
                </div>
              ) : (
                <div className="flex w-full items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={retakeSnapshot}
                    className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-bold text-white hover:bg-slate-700"
                  >
                    🔄 Retake Photo
                  </button>
                  <button
                    type="button"
                    onClick={confirmSnapshot}
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-md"
                  >
                    ✓ Use This Photo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
