import type { Status } from "../data/liveDashboard";

const chipStyles: Record<Status, string> = {
  New: "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  Scheduled: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  "Mail Sent": "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  Overdue: "bg-red-50 text-red-600 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

const dotColors: Record<Status, string> = {
  New: "bg-blue-500",
  Scheduled: "bg-green-500",
  "Mail Sent": "bg-amber-500",
  Completed: "bg-emerald-500",
  Overdue: "bg-red-500",
};

export function StatusChip({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${chipStyles[status]}`}>
      <span className={`size-1.5 rounded-full ${dotColors[status]}`} />
      {status}
    </span>
  );
}

export function EditableStatusChip({
  status,
  onChange,
}: {
  status: Status;
  onChange: (s: Status) => void;
}) {
  const statuses: Status[] = ["New", "Scheduled", "Mail Sent", "Completed", "Overdue"];
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as Status)}
      className={`appearance-none cursor-pointer text-xs font-medium px-2.5 py-0.5 rounded-full border outline-none ${chipStyles[status]}`}
    >
      {statuses.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
