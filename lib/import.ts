import * as XLSX from "xlsx";
import { defaultScheduleForDate, SCHEDULE_OPTIONS } from "@/lib/schedule";
import { transliterateToTamil } from "@/lib/transliterate";

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

export const LOAN_FIELDS = [
  { key: "borrower_name", labelKey: "import_field_name", required: true },
  { key: "borrower_name_ta", labelKey: "import_field_nameTamil", required: false },
  { key: "principal", labelKey: "import_field_amount", required: true },
  { key: "interest_rate", labelKey: "import_field_rate", required: false },
  { key: "installments_count", labelKey: "import_field_installments", required: false },
  { key: "collection_schedule", labelKey: "import_field_schedule", required: false },
  { key: "given_at", labelKey: "import_field_date", required: false },
  { key: "notes", labelKey: "import_field_notes", required: false },
] as const;

export type LoanFieldKey = (typeof LOAN_FIELDS)[number]["key"];

export const PAYMENT_FIELDS = [
  { key: "borrower_name", labelKey: "import_field_name", required: true },
  { key: "amount", labelKey: "import_field_paymentAmount", required: true },
  { key: "payment_mode", labelKey: "import_field_paymentMode", required: false },
  { key: "paid_at", labelKey: "import_field_paidDate", required: false },
] as const;

export type PaymentFieldKey = (typeof PAYMENT_FIELDS)[number]["key"];

export type FieldMapping = Partial<Record<string, number>>; // column index or undefined

export type MappedLoan = {
  borrower_name: string;
  borrower_name_ta: string | null;
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

export type MappedPayment = {
  loan_id: string;
  amount: number;
  payment_mode: string;
  paid_at: string; // ISO date
  borrower_name: string; // kept for the preview list only
};

export type PaymentMapResult = {
  valid: MappedPayment[];
  invalid: { row: string[]; reason: string }[];
};

export type LoanForMatching = {
  id: string;
  borrower_name: string;
  payback_amount: number;
  given_at: string;
};

export type RepaymentForMatching = {
  loan_id: string;
  amount: number;
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

    const nameTaRaw = get(mapping.borrower_name_ta);
    const nameTa = nameTaRaw || transliterateToTamil(name);

    valid.push({
      borrower_name: name,
      borrower_name_ta: nameTa || null,
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

// Matches each payment row to a specific loan by borrower name, since
// imported data won't have this app's internal loan IDs. When a borrower
// has more than one loan, payments are applied to their oldest loan that
// still has an outstanding balance first (like a natural repayment
// waterfall) — falling back to their most recent loan once everything
// else is settled, so the payment is never silently dropped.
export function mapPaymentRows(
  rows: string[][],
  mapping: FieldMapping,
  loans: LoanForMatching[],
  existingRepayments: RepaymentForMatching[]
): PaymentMapResult {
  const valid: MappedPayment[] = [];
  const invalid: { row: string[]; reason: string }[] = [];

  const nameIdx = mapping.borrower_name;
  const amountIdx = mapping.amount;
  const dateIdx = mapping.paid_at;

  const outstanding = new Map<string, number>();
  for (const loan of loans) {
    const paidSoFar = existingRepayments
      .filter((r) => r.loan_id === loan.id)
      .reduce((s, r) => s + Number(r.amount), 0);
    outstanding.set(loan.id, Number(loan.payback_amount) - paidSoFar);
  }

  const loansByBorrower = new Map<string, LoanForMatching[]>();
  for (const loan of loans) {
    const key = loan.borrower_name.trim().toLowerCase();
    const list = loansByBorrower.get(key) ?? [];
    list.push(loan);
    loansByBorrower.set(key, list);
  }
  for (const list of loansByBorrower.values()) {
    list.sort(
      (a, b) => new Date(a.given_at).getTime() - new Date(b.given_at).getTime()
    );
  }

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

    const borrowerLoans = loansByBorrower.get(name.toLowerCase());
    if (!borrowerLoans || borrowerLoans.length === 0) {
      invalid.push({ row, reason: `No loan found for "${name}" — add their loan first` });
      continue;
    }

    const target =
      borrowerLoans.find((l) => (outstanding.get(l.id) ?? 0) > 0) ??
      borrowerLoans[borrowerLoans.length - 1];

    outstanding.set(target.id, (outstanding.get(target.id) ?? 0) - amount);

    const dateRaw = get(dateIdx);
    const parsedDate = parseDateLenient(dateRaw) ?? new Date();

    const modeRaw = get(mapping.payment_mode).toUpperCase();
    const paymentMode = modeRaw === "UPI" ? "UPI" : "Cash";

    valid.push({
      loan_id: target.id,
      amount,
      payment_mode: paymentMode,
      paid_at: parsedDate.toISOString(),
      borrower_name: name,
    });
  }

  return { valid, invalid };
}
