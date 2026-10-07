import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

export const SPREADSHEET_ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const SPREADSHEET_MAX_BYTES = 5 * 1024 * 1024;

export function isSpreadsheetFilename(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".csv") || lower.endsWith(".xlsx");
}

export function parseSpreadsheetBuffer(buffer: Buffer, filename: string): Record<string, string>[] {
  const name = filename.toLowerCase();
  if (name.endsWith(".xlsx")) return parseXlsx(buffer);
  if (name.endsWith(".csv")) return parseCsv(buffer.toString("utf8"));
  throw new SpreadsheetParseError("Select a CSV or XLSX file");
}

function parseCsv(text: string): Record<string, string>[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  }) as Record<string, string>[];
}

function parseXlsx(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeCell(value)])
    )
  );
}

function normalizeCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

export class SpreadsheetParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetParseError";
  }
}
