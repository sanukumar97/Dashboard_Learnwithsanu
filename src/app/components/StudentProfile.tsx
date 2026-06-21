import { AlertTriangle, CalendarDays, Clock, Mail, MessageCircle, Timer, X } from "lucide-react";
import { daysRemaining, isPlanExpired, type Student } from "../data/liveDashboard";
import { StatusChip } from "./StatusChip";
import { Avatar } from "./Avatar";

interface Props {
  student: Student;
  onClose: () => void;
}

function DaysRemainingBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
        <AlertTriangle size={12} />
        Expired
      </span>
    );
  }

  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
        <Timer size={12} />
        {days}d left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400">
      <Clock size={12} />
      {days}d remaining
    </span>
  );
}

export function StudentProfile({ student, onClose }: Props) {
  const days = daysRemaining(student);
  const expired = isPlanExpired(student);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-sm flex-col overflow-y-auto bg-card" style={{ boxShadow: "-4px 0 48px rgba(0,0,0,0.16)" }}>
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h3 className="text-foreground">Student Profile</h3>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-xl hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={student.name} color={student.avatarColor} size="lg" />
            <div>
              <p className="text-foreground font-bold" style={{ fontSize: 16 }}>{student.name}</p>
              <p className="text-muted-foreground" style={{ fontSize: 12 }}>{student.plan}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted p-3.5">
              <p style={{ fontSize: 10 }} className="mb-1.5 text-muted-foreground uppercase tracking-wide font-semibold">Status</p>
              <StatusChip status={student.status} />
            </div>
            <div className="rounded-2xl bg-muted p-3.5">
              <p style={{ fontSize: 10 }} className="mb-1 text-muted-foreground uppercase tracking-wide font-semibold">Plan Price</p>
              <p style={{ fontSize: 13 }} className="font-semibold text-foreground">INR {student.planPrice.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <a href={`mailto:${student.email}`} className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 hover:bg-accent transition-colors">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10">
              <Mail size={14} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 10 }} className="mb-0.5 text-muted-foreground uppercase tracking-wide font-semibold">Email</p>
              <p style={{ fontSize: 12 }} className="truncate text-foreground">{student.email}</p>
            </div>
          </a>

          <a href={`https://wa.me/${student.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-2xl bg-muted p-3.5 hover:bg-accent transition-colors">
            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10">
              <MessageCircle size={14} className="text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 10 }} className="mb-0.5 text-muted-foreground uppercase tracking-wide font-semibold">WhatsApp</p>
              <p style={{ fontSize: 12 }} className="truncate text-foreground">{student.phone || "Not provided"}</p>
            </div>
          </a>

          <div className={`rounded-2xl border p-4 ${expired ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-border bg-muted"}`}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={13} className={expired ? "text-red-500" : "text-muted-foreground"} />
                <p style={{ fontSize: 10 }} className="text-muted-foreground uppercase tracking-wide font-semibold">Plan Expiry</p>
              </div>
              <DaysRemainingBadge days={days} />
            </div>
            <p className="text-foreground font-bold" style={{ fontSize: 18 }}>{student.planExpiryDate}</p>
            <p style={{ fontSize: 11 }} className="mt-1 text-muted-foreground">
              Enrolled on {student.enrolledDate}
            </p>
          </div>

          {(student.sessionDate || student.sessionTime) && (
            <div className="rounded-2xl border border-border bg-secondary p-4">
              <p style={{ fontSize: 10 }} className="mb-1.5 text-muted-foreground uppercase tracking-wide font-semibold">
                {student.sessionCompleted ? "Completed Session" : "Upcoming Session"}
              </p>
              <p className="text-foreground font-semibold" style={{ fontSize: 14 }}>{student.sessionDate ?? "Not set"}</p>
              <p style={{ fontSize: 12 }} className="text-muted-foreground">{student.sessionTime ?? "Time not set"}</p>
            </div>
          )}

          <div className="rounded-2xl bg-muted p-4">
            <p style={{ fontSize: 10 }} className="mb-1.5 text-muted-foreground uppercase tracking-wide font-semibold">Enrollment Details</p>
            <div className="space-y-2 text-sm text-foreground">
              <p><strong>UTR:</strong> {student.utrNumber || "Not provided"}</p>
              <p><strong>Referral:</strong> {student.referralSource || "Not provided"}</p>
              <p><strong>Target Colleges:</strong> {student.targetColleges.length ? student.targetColleges.join(", ") : "Not provided"}</p>
            </div>
          </div>

          {student.notes && (
            <div className="rounded-2xl bg-muted p-4">
              <p style={{ fontSize: 10 }} className="mb-1.5 text-muted-foreground uppercase tracking-wide font-semibold">Admin Notes</p>
              <p style={{ fontSize: 13 }} className="text-foreground leading-relaxed">{student.notes}</p>
            </div>
          )}

          {student.remarks && (
            <div className="rounded-2xl bg-muted p-4">
              <p style={{ fontSize: 10 }} className="mb-1.5 text-muted-foreground uppercase tracking-wide font-semibold">Student Remarks</p>
              <p style={{ fontSize: 13 }} className="text-foreground leading-relaxed">{student.remarks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
