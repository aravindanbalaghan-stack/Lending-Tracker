"use client";

// Grey placeholder shapes shown while data loads, so screens don't flash
// blank. The pulse animation signals "loading" without a spinner.

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-ledger-line/60 ${className}`}
    />
  );
}

// A list of placeholder rows matching the borrower/repay list shape.
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-ledger-line bg-white divide-y divide-ledger-line overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center justify-between">
          <div className="flex-1">
            <SkeletonLine className="h-4 w-1/2 mb-2" />
            <SkeletonLine className="h-3 w-1/3" />
          </div>
          <SkeletonLine className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// Dashboard-specific skeleton: the two summary cards + a list.
export function SkeletonDashboard() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <SkeletonLine className="h-20 rounded-xl" />
        <SkeletonLine className="h-20 rounded-xl" />
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}
