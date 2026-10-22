"use client";

export interface ExportColumn {
  header?: string;
  label?: string;
  key: string;
  width?: number;
  format?: (value: any, row?: any) => string;
}

export interface ExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  format: "xlsx" | "csv" | "pdf";
  summary?: Record<string, any>;
  dateRange?: { start?: string; end?: string };
}

/** Escapes CSV cell value and wraps in quotes if needed */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Client-side fast CSV export with UTF-8 BOM */
export function downloadClientCsv(
  columns: ExportColumn[],
  data: Record<string, any>[],
  filename: string
): void {
  const BOM = "\uFEFF";
  const headerLine = columns
    .map((c) => escapeCsvCell(c.header || c.label || c.key))
    .join(",");
  const dataLines = data.map((row) =>
    columns
      .map((col) => {
        let val: any;
        if (typeof col.format === "function") {
          val = col.format(row[col.key], row);
        } else if (row[col.key] !== undefined) {
          val = row[col.key];
        } else if (col.header && row[col.header] !== undefined) {
          val = row[col.header];
        } else if (col.label && row[col.label] !== undefined) {
          val = row[col.label];
        } else {
          val = "";
        }
        return escapeCsvCell(val);
      })
      .join(",")
  );

  const csvContent = BOM + [headerLine, ...dataLines].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerBrowserDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Triggers a browser file download from a Blob or URL */
export function triggerBrowserDownload(blobOrUrl: Blob | string, filename: string): void {
  let url = typeof blobOrUrl === "string" ? blobOrUrl : window.URL.createObjectURL(blobOrUrl);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (typeof blobOrUrl !== "string") {
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}

/** Universal Export function for XLSX, CSV, and PDF */
export async function exportRecords(options: ExportOptions): Promise<void> {
  const { filename, title, subtitle, columns, data, format, summary, dateRange } = options;

  if (!data || data.length === 0) {
    throw new Error("No records available to export with current filters.");
  }

  // Fast client-side CSV download
  if (format === "csv") {
    downloadClientCsv(columns, data, filename);
    return;
  }

  // Normalize column definitions and pre-format data rows if format functions are present
  const normalizedColumns = columns.map((c) => ({
    header: c.header || c.label || c.key,
    key: c.key,
    width: c.width,
  }));

  const normalizedData = data.map((row) => {
    const formattedRow: Record<string, any> = { ...row };
    for (const col of columns) {
      if (typeof col.format === "function") {
        formattedRow[col.key] = col.format(row[col.key], row);
      }
    }
    return formattedRow;
  });

  // Server-side generation for Excel (.xlsx) and PDF (.pdf)
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      format,
      title,
      subtitle,
      filename,
      columns: normalizedColumns,
      data: normalizedData,
      summary,
      dateRange,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to generate ${format.toUpperCase()} export`);
  }

  const blob = await res.blob();
  const ext = format === "pdf" ? "pdf" : "xlsx";
  const safeFilename = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
  triggerBrowserDownload(blob, safeFilename);
}

/** Direct module streaming export from database */
export async function exportModuleDirect(
  moduleName: string,
  format: "xlsx" | "csv" | "pdf",
  params?: Record<string, string>,
  customFilename?: string
): Promise<void> {
  const qs = new URLSearchParams({ module: moduleName, format, ...(params || {}) });
  const res = await fetch(`/api/export?${qs.toString()}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to download ${moduleName} export`);
  }

  const blob = await res.blob();
  const filename =
    customFilename ||
    `SkyMS_${moduleName.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.${format}`;
  triggerBrowserDownload(blob, filename);
}

/** Download original uploaded technical document */
export async function downloadOriginalDocument(
  fileUrlOrName: string,
  originalFilename?: string
): Promise<void> {
  const url = fileUrlOrName.startsWith("http") || fileUrlOrName.startsWith("/")
    ? fileUrlOrName
    : `/api/uploads/${encodeURIComponent(fileUrlOrName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Document file could not be retrieved from server storage.");
  }

  const blob = await res.blob();
  const finalFilename = originalFilename || fileUrlOrName.split("/").pop() || "document";
  triggerBrowserDownload(blob, finalFilename);
}
