import * as XLSX from "xlsx";
import { defaultScheduleForDate, SCHEDULE_OPTIONS } from "@/lib/schedule";

export type ParsedFile = {
  headers: string[];
  rows: string[][];
};

export function parseSpreadsheetFile(
  arrayBuffer: ArrayBuffer,
  fileName: string
): ParsedFile {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`No sheet found in ${fileName}.`);
  }
  const sheet = workbook.Sheets[firstSheetName];
  const raw = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    sheet,
    { header: 1, raw: false, dateNF: "yyyy-mm-dd" }
  );

  const rows = raw
    .filter((row) => row.some((cell) => cell !== null && cell !== undefined && cell !== ""))
    .map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));

  if (rows.length === 0) {
    throw new Error("The file appears to be empty.");
  }

  const [headers, ...dataRows] = rows;
  return { headers, rows: dataRows };
}

export const SYSTEM_FIELDS = [
  { key: "borrower_name", labelKey: "import_field_name", required: true },
  { key: "principal", labelKey: "import_field_amount", required: true },
  { key: "interest_rate", labelKey: "import_field_rate", required: false },
  { key: "installments_count", labelKey: "import_field_installments", required: false },
  { key: "collection_schedule", labelKey: "import_field_schedule", required: false },
  { key: "given_at", labelKey: "import_field_date", required: false },
  { key: "notes", labelKey: "import_field_notes", required: false },
] as const;

export type SystemFieldKey = (typeof SYSTEM_FIELDS)[number]["key"];

export type FieldMapping = Partial<Record<SystemFieldKey, number>>; // column index or undefined

export type MappedLoan = {
  borrower_name: string;
  principal: number;
  interest_rate: number;
  installments_count: number;
  collection_schedule: string;
  given_at: string; // ISO date
  notes: string | null;
};

export type MapResult = {
  valid: MappedLoan[];
  invalid: { row: string[]; reason: string }[];
};

function parseDateLenient(value: string): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!isNaN(direct.getTime())) return direct;
  // try dd/mm/yyyy
  const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const candidate = new Date(year, Number(mo) - 1, Number(d));
    if (!isNaN(candidate.getTime())) return candidate;
  }
  return null;
}

export function mapRows(
  rows: string[][],
  mapping: FieldMapping
): MapResult {
  const valid: MappedLoan[] = [];
  const invalid: { row: string[]; reason: string }[] = [];

  const nameIdx = mapping.borrower_name;
  const amountIdx = mapping.principal;

  for (const row of rows) {
    const get = (idx: number | undefined) =>
      idx === undefined ? "" : (row[idx] ?? "").trim();

    const name = get(nameIdx);
    const amountRaw = get(amountIdx);
    const amount = parseFloat(amountRaw.replace(/[,₹\s]/g, ""));

    if (!name) {
      invalid.push({ row, reason: "Missing borrower name" });
      continue;
    }
    if (!amountRaw || isNaN(amount) || amount <= 0) {
      invalid.push({ row, reason: "Missing or invalid amount" });
      continue;
    }

    const rateRaw = get(mapping.interest_rate);
    const rate = rateRaw ? parseFloat(rateRaw.replace(/%/g, "")) : 25;

    const installmentsRaw = get(mapping.installments_count);
    const installments = installmentsRaw
      ? Math.max(1, parseInt(installmentsRaw, 10) || 1)
      : 1;

    const dateRaw = get(mapping.given_at);
    const parsedDate = parseDateLenient(dateRaw) ?? new Date();

    const scheduleRaw = get(mapping.collection_schedule);
    const normalizedSchedule = SCHEDULE_OPTIONS.find(
      (opt) => opt.toLowerCase() === scheduleRaw.toLowerCase()
    );
    const schedule = normalizedSchedule ?? defaultScheduleForDate(parsedDate);

    const notes = get(mapping.notes) || null;

    valid.push({
      borrower_name: name,
      principal: amount,
      interest_rate: isNaN(rate) ? 25 : rate,
      installments_count: installments,
      collection_schedule: schedule,
      given_at: parsedDate.toISOString(),
      notes,
    });
  }

  return { valid, invalid };
}
