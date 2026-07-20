export type BackupLoan = {
  id: string;
  borrower_name: string;
  borrower_name_ta: string | null;
  principal: number;
  interest_rate: number;
  payback_amount: number;
  installments_count: number;
  collection_schedule: string;
  given_at: string;
  notes: string | null;
  repayments: { amount: number; paid_at: string }[];
};

function csvEscape(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function loansToCsv(loans: BackupLoan[]): string {
  const header = [
    "Borrower Name",
    "Borrower Name (Tamil)",
    "Amount Given",
    "Interest Rate (%)",
    "Payback Amount",
    "Installments",
    "Collection Schedule",
    "Date Given",
    "Notes",
    "Total Repaid",
    "Outstanding",
    "Repayment Dates & Amounts",
  ];

  const rows = loans.map((loan) => {
    const totalRepaid = loan.repayments.reduce(
      (s, r) => s + Number(r.amount),
      0
    );
    const outstanding = Number(loan.payback_amount) - totalRepaid;
    const repaymentsSummary = loan.repayments
      .slice()
      .sort((a, b) => a.paid_at.localeCompare(b.paid_at))
      .map((r) => `${r.paid_at.slice(0, 10)}: ${r.amount}`)
      .join(" | ");

    return [
      loan.borrower_name,
      loan.borrower_name_ta ?? "",
      loan.principal,
      loan.interest_rate,
      loan.payback_amount,
      loan.installments_count,
      loan.collection_schedule,
      loan.given_at.slice(0, 10),
      loan.notes ?? "",
      totalRepaid,
      outstanding,
      repaymentsSummary,
    ];
  });

  const lines = [header, ...rows].map((row) =>
    row.map((cell) => csvEscape(cell)).join(",")
  );
  return lines.join("\n") + "\n";
}

export function loansToJson(loans: BackupLoan[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      loans,
    },
    null,
    2
  );
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
