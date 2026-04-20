import { downloadRunArtifact } from "@/lib/api/endpoints";
import type { Domain } from "@/lib/api/types";
import * as XLSX from "xlsx";

type XlsxCellValue = string | number | boolean | null;
const EXCEL_MAX_CELL_TEXT_LENGTH = 32767;

function clampExcelText(value: string): string {
  if (value.length <= EXCEL_MAX_CELL_TEXT_LENGTH) {
    return value;
  }

  const suffix = ` ... [truncated ${value.length - EXCEL_MAX_CELL_TEXT_LENGTH} chars]`;
  const maxPrefixLength = Math.max(0, EXCEL_MAX_CELL_TEXT_LENGTH - suffix.length);
  return `${value.slice(0, maxPrefixLength)}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCellValue(value: unknown): XlsxCellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return clampExcelText(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return clampExcelText(JSON.stringify(value));
}

function normalizeRows(items: unknown[]): Array<Record<string, XlsxCellValue>> {
  if (items.length === 0) {
    return [];
  }

  if (items.every((item) => isRecord(item))) {
    return (items as Array<Record<string, unknown>>).map((row) => {
      const normalized: Record<string, XlsxCellValue> = {};
      for (const [key, value] of Object.entries(row)) {
        normalized[key] = toCellValue(value);
      }
      return normalized;
    });
  }

  return items.map((item, index) => ({
    index: index + 1,
    value: toCellValue(item),
  }));
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/*?:[\]]/g, "_").trim();
  const fallback = cleaned.length > 0 ? cleaned : "Sheet1";
  return fallback.slice(0, 31);
}

function buildWorkbookFromData(data: unknown, primarySheetName: string): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  if (Array.isArray(data)) {
    const rows = normalizeRows(data);
    const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(primarySheetName));
    return workbook;
  }

  if (isRecord(data)) {
    const entries = Object.entries(data);
    const arrayEntries = entries.filter(([, value]) => Array.isArray(value));
    const scalarEntries = entries.filter(([, value]) => !Array.isArray(value));

    if (scalarEntries.length > 0) {
      const summaryRows = scalarEntries.map(([key, value]) => ({
        key,
        value: toCellValue(value),
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "summary");
    }

    for (const [key, value] of arrayEntries) {
      const rows = normalizeRows((value as unknown[]) ?? []);
      const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(key));
    }

    if (workbook.SheetNames.length === 0) {
      const fallbackSheet = XLSX.utils.json_to_sheet([{ value: toCellValue(data) }]);
      XLSX.utils.book_append_sheet(workbook, fallbackSheet, sanitizeSheetName(primarySheetName));
    }
    return workbook;
  }

  const sheet = XLSX.utils.json_to_sheet([{ value: toCellValue(data) }]);
  XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(primarySheetName));
  return workbook;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function downloadRunArtifactToFile(
  domain: Domain,
  runId: string,
  artifactName: string,
): Promise<void> {
  const blob = await downloadRunArtifact(domain, runId, artifactName);
  triggerBlobDownload(blob, `${domain}-${runId}-${artifactName}`);
}

export async function downloadRunArtifactToXlsx(
  domain: Domain,
  runId: string,
  artifactName: string,
): Promise<void> {
  const blob = await downloadRunArtifact(domain, runId, artifactName);
  const rawText = await blob.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawText) as unknown;
  } catch {
    payload = [{ content: rawText }];
  }

  const workbook = buildWorkbookFromData(payload, artifactName.replace(/\.[^.]+$/, ""));
  const filename = `${domain}-${runId}-${artifactName.replace(/\.[^.]+$/, "")}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function downloadRecordsToXlsx(
  rows: Array<Record<string, unknown>>,
  filename: string,
  sheetName = "data",
): void {
  const workbook = XLSX.utils.book_new();
  const normalized = normalizeRows(rows);
  const sheet =
    normalized.length > 0 ? XLSX.utils.json_to_sheet(normalized) : XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(sheetName));
  XLSX.writeFile(workbook, filename);
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerBlobDownload(blob, filename);
}
