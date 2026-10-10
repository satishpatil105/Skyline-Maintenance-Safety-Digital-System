"use client";

import { useState } from "react";
import QRCode from "qrcode";
import StatusBanner from "@/components/shared/StatusBanner";

/**
 * The QR always encodes <base URL>/machine/<Asset ID>, so a given machine
 * always produces the identical QR. Set NEXT_PUBLIC_BASE_URL to the live
 * domain so codes printed from any device point at the real site.
 */
export function machineUrl(assetId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = (process.env.NEXT_PUBLIC_BASE_URL || origin).replace(/\/+$/, "");
  return `${base}/machine/${encodeURIComponent(assetId)}`;
}

const RED = "#A00D17";
const LABEL_W = 1000;
const LABEL_H = 1600;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load " + src));
    img.src = src;
  });
}

/** Shrink the font until the text fits `maxWidth`; returns the size used. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number, weight = "bold") {
  let size = startPx;
  do {
    ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > minPx);
  return size;
}

/** Cut the text with "..." if it is still too wide at the smallest size. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "...").width > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + "...";
}

/**
 * A print-ready label: Skyline logo and name on a red band, the machine name,
 * a big Asset ID, and the QR code. Drawn on a canvas so the preview, the PNG
 * download and the printout are all the same picture.
 */
async function buildLabel(assetId: string, machineName: string, qrDataUrl: string): Promise<string> {
  const [logo, qr] = await Promise.all([loadImage("/skyline-logo.png"), loadImage(qrDataUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the label.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  // Red header band with rounded top corners
  const band = ctx.createLinearGradient(0, 0, LABEL_W, 560);
  band.addColorStop(0, "#6f0912");
  band.addColorStop(0.55, "#a00d17");
  band.addColorStop(1, "#c2202c");
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.roundRect(20, 20, LABEL_W - 40, 540, [40, 40, 0, 0]);
  ctx.fill();

  // Emblem: the round part of the logo file (which has white margins), in a white circle
  const cx = LABEL_W / 2;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, 215, 155, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, 215, 150, 0, Math.PI * 2);
  ctx.clip();
  const sx = logo.width * (106.7 / 640), sy = logo.height * (55.5 / 640), side = logo.width * (426.7 / 640);
  ctx.drawImage(logo, sx, sy, side, side, cx - 150, 65, 300, 300);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "Skyline Project & Engineers", LABEL_W - 120, 68, 40, "800");
  ctx.fillText("Skyline Project & Engineers", cx, 448);
  ctx.font = '600 42px "Segoe UI", Arial, sans-serif';
  ctx.fillText("Maintenance & Safety", cx, 510);

  // Machine name + Asset ID
  ctx.fillStyle = "#2e2022";
  fitFont(ctx, machineName, LABEL_W - 120, 54, 34);
  ctx.fillText(ellipsize(ctx, machineName, LABEL_W - 120), cx, 640);

  ctx.fillStyle = "#86656a";
  ctx.font = '700 30px "Segoe UI", Arial, sans-serif';
  ctx.fillText("ASSET ID", cx, 712);
  ctx.fillStyle = RED;
  fitFont(ctx, assetId, LABEL_W - 120, 120, 56, "800");
  ctx.fillText(assetId, cx, 820);

  // QR code (crisp squares, no smoothing)
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, (LABEL_W - 640) / 2, 860, 640, 640);
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = "#4a3437";
  ctx.font = '600 34px "Segoe UI", Arial, sans-serif';
  ctx.fillText("Scan to view machine details and keep the record", cx, 1552);

  // Outer border
  ctx.strokeStyle = RED;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(20, 20, LABEL_W - 40, LABEL_H - 40, 40);
  ctx.stroke();

  return canvas.toDataURL("image/png");
}

export default function QrCodeCard({
  assetId,
  machineName,
}: {
  assetId: string;
  machineName: string;
}) {
  const [qr, setQr] = useState<{ dataUrl: string; label: string; url: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const url = machineUrl(assetId);
      const dataUrl = await QRCode.toDataURL(url, {
        width: 640,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      const label = await buildLabel(assetId, machineName, dataUrl);
      setQr({ dataUrl, label, url });
    } catch (err) {
      setError(
        "Could not generate QR: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setBusy(false);
    }
  }

  function printLabel() {
    if (!qr) return;
    const win = window.open("", "_blank", "width=640,height=900");
    if (!win) {
      setError("Pop-up blocked. Allow pop-ups to print the QR label.");
      return;
    }
    // The label is one picture, sized to fit the page.
    win.document.write(`<!doctype html><title>${assetId.replace(/[<>&"]/g, "")}</title>
      <style>
        @page { margin: 8mm; }
        html, body { margin: 0; height: 100%; }
        body { display: flex; align-items: center; justify-content: center; }
        img { max-width: 100%; max-height: 100vh; }
      </style>
      <img src="${qr.label}" alt="Label" />
      <script>window.onload=function(){window.print()}<\/script>`);
    win.document.close();
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
      {!qr && (
        <button
          type="button"
          className="primary-button mt-0"
          disabled={busy}
          onClick={generate}
        >
          {busy ? "Generating..." : "Generate QR"}
        </button>
      )}

      <StatusBanner type={error ? "error" : null} message={error} />

      {qr && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr.label}
            alt={`Print label for ${assetId}`}
            className="mx-auto w-72 max-w-full rounded-lg border border-slate-200 shadow-sm"
          />
          <p className="mt-2 text-sm font-bold text-slate-800">{assetId}</p>
          <p className="break-all text-xs text-slate-500">{qr.url}</p>
          <p className="mt-1 text-xs text-slate-500">
            This QR is permanent for this machine. Generating it again always
            gives the same code.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <a
              href={qr.label}
              download={`Label_${assetId}.png`}
              className="primary-button mt-0 block no-underline"
            >
              Download Label
            </a>
            <button
              type="button"
              className="primary-button mt-0 bg-slate-500"
              onClick={printLabel}
            >
              Print Label
            </button>
            <a
              href={qr.dataUrl}
              download={`QR_${assetId}.png`}
              className="primary-button mt-0 block bg-slate-500 no-underline"
            >
              QR only (PNG)
            </a>
          </div>
        </>
      )}
    </div>
  );
}
