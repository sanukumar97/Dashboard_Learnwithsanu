import { useState, useEffect, useRef } from "react";
import {
  Copy, CheckCircle, AlertCircle, RotateCcw,
  Clock, MessageCircle, Mail, Save, Video, Send, X,
} from "lucide-react";
import { CalendarPicker } from "./ui/CalendarPicker";
import { RangeDropdown } from "./ui/RangeDropdown";

import { useLiveEnrollments } from "../hooks/useLiveEnrollments";
import {
  updateEnrollmentSession, updateEnrollmentNotes,
  incrementSessionsAttended, resetEnrollmentSession,
} from "../../services/enrollmentService";
import { type Student } from "../data/liveDashboard";
import { Avatar } from "./Avatar";
import { fetchActivePlansAdmin, type AdminPlan } from "../../services/planService";
import { fetchEmailTemplates, type EmailTemplate } from "../../services/emailTemplateService";
import { sendMail } from "../../services/mailLogService";

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(t: string) {
  if (!t) return "";
  const [hStr, mStr = "00"] = t.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

function parse12to24(display: string, ampm: string): string {
  const [hStr, mStr = "00"] = display.split(":");
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return "";
  const m = mStr.replace(/\D/g, "").padStart(2, "0").slice(0, 2);
  if (ampm === "AM") { if (h === 12) h = 0; }
  else               { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, "0")}:${m}`;
}

function parse24to12(v: string): { display: string; ampm: "AM" | "PM" } {
  if (!v) return { display: "", ampm: "AM" };
  const [hStr, mStr = "00"] = v.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return { display: v, ampm: "AM" };
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { display: `${h12}:${mStr}`, ampm };
}

function TimeInput({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const { display: initDisplay, ampm: initAmpm } = parse24to12(value);
  const [display, setDisplay] = useState(initDisplay);
  const [ampm, setAmpm]       = useState<"AM" | "PM">(initAmpm);

  useEffect(() => {
    const { display: d, ampm: a } = parse24to12(value);
    setDisplay(d);
    setAmpm(a);
  }, [value]);

  function handleDisplayChange(v: string) {
    setDisplay(v);
    const t24 = parse12to24(v, ampm);
    if (t24) onChange(t24);
  }

  function handleAmpm(a: "AM" | "PM") {
    setAmpm(a);
    const t24 = parse12to24(display, a);
    if (t24) onChange(t24);
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <input
        type="text"
        value={display}
        onChange={e => handleDisplayChange(e.target.value)}
        placeholder="10:30"
        maxLength={5}
        className="bg-muted border border-border rounded-xl px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary text-foreground text-center"
        style={{ fontSize: 12, width: 60 }}
      />
      <div className="flex rounded-xl overflow-hidden border border-border">
        {(["AM", "PM"] as const).map(a => (
          <button key={a} type="button" onClick={() => handleAmpm(a)}
            className={`px-2 py-1.5 font-medium transition-colors ${ampm === a ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-accent"}`}
            style={{ fontSize: 11 }}>
            {a}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SE { studentId: string; date: string; time: string; notes: string; gmeetLink: string; completed: boolean; }
type STab = "scheduled" | "pending" | "completed";
type SessionRange = "all" | "today" | "week" | "month" | "custom";

function matchesRange(dateStr: string, range: SessionRange): boolean {
  if (range === "all") return true;
  const d = new Date(dateStr + "T00:00:00"), now = new Date();
  if (range === "today") return d.toDateString() === now.toDateString();
  if (range === "week") {
    const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0, 0, 0, 0);
    const we = new Date(ws); we.setDate(ws.getDate() + 7);
    return d >= ws && d < we;
  }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card rounded-3xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
    {children}
  </div>
);

interface Props { year?: string; plan?: string; search?: string; onStudentClick?: (s: Student) => void; }

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
      className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:opacity-75 transition-opacity whitespace-nowrap" style={{ fontSize: 12 }}>
      <MessageCircle size={12} />{phone}
    </a>
  );
}
function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`}
      className="flex items-center gap-1.5 text-primary hover:opacity-75 transition-opacity whitespace-nowrap" style={{ fontSize: 12 }}>
      <Mail size={12} />{email}
    </a>
  );
}

const TH = ({ cols }: { cols: string[] }) => (
  <thead>
    <tr className="border-b border-border bg-muted/40">
      {cols.map(c => (
        <th key={c} className="text-left px-5 py-3" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
          <span className="font-semibold text-muted-foreground uppercase">{c}</span>
        </th>
      ))}
    </tr>
  </thead>
);

function CommentCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft]     = useState(value);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved]     = useState(false);

  function handleSave() {
    onChange(draft);
    setSaved(true);
    setTimeout(() => { setSaved(false); setEditing(false); }, 900);
  }
  function handleCancel() { setDraft(value); setEditing(false); }

  return (
    <div className="flex flex-col gap-2 min-w-[160px] max-w-[220px]">
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); setEditing(true); }}
        onFocus={() => setEditing(true)}
        rows={editing ? 4 : 2}
        placeholder="Add comment…"
        className="w-full resize-none outline-none placeholder:text-muted-foreground text-foreground transition-all"
        style={{
          fontSize: 12, lineHeight: 1.5,
          background: "var(--secondary)",
          border: "1.5px solid var(--accent)",
          borderRadius: 14,
          padding: "10px 12px",
        }}
      />
      {editing && (
        <div className="flex items-center gap-2">
          <button onClick={handleSave}
            className="px-4 py-1.5 rounded-full text-white font-semibold transition-all"
            style={{ fontSize: 12, background: saved ? "#22C55E" : "var(--primary)", boxShadow: "0 2px 8px rgba(26,42,241,0.3)" }}>
            {saved ? "Saved!" : "Save"}
          </button>
          <button onClick={handleCancel}
            className="px-4 py-1.5 rounded-full font-medium transition-colors"
            style={{ fontSize: 12, border: "1.5px solid var(--border)", color: "var(--muted-foreground)", background: "var(--card)" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function Sessions({ year = "All Time", plan = "All Plans", search = "", onStudentClick }: Props) {
  const { students, loading, refresh } = useLiveEnrollments();
  const [activeTab, setActiveTab]     = useState<STab>("scheduled");
  const [pendingForm, setPendingForm] = useState<Record<string, { date: string; time: string; notes: string }>>({});
  const [reschedId, setReschedId]     = useState<string | null>(null);
  const [reschedForm, setReschedForm] = useState({ date: "", time: "" });
  const [copied, setCopied]           = useState<string | null>(null);
  const [savedFlash, setSavedFlash]   = useState<string | null>(null);
  const [sessionRange, setSessionRange] = useState<SessionRange>("all");
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo,   setAppliedTo]   = useState("");
  const [plans, setPlans]             = useState<AdminPlan[]>([]);
  const [templates, setTemplates]     = useState<EmailTemplate[]>([]);
  const [mailTarget, setMailTarget]   = useState<Student | null>(null);

  useEffect(() => {
    fetchActivePlansAdmin().then(setPlans).catch(console.error);
    fetchEmailTemplates().then(d => setTemplates(d.filter(t => !t.archived))).catch(console.error);
  }, []);

  // Only approved (enrolled) students, optionally filtered by plan slug
  const q = search.trim().toLowerCase();
  const approvedStudents = students.filter(s =>
    s.dbStatus === "submitted" && !!s.adminApprovedAt &&
    (year === "All Time" || new Date(s.enrolledDate).getFullYear() === parseInt(year)) &&
    (plan === "All Plans" || s.planSlug === plan) &&
    (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  );

  function toSE(s: Student): SE {
    return {
      studentId: s.id,
      date:      s.sessionDate ?? "",
      time:      s.sessionTime ?? "",
      notes:     s.notes,
      gmeetLink: s.gmeetLink ?? "",
      completed: s.sessionCompleted,
    };
  }

  const applyFilters = (list: SE[]) => {
    let out = list;
    if (sessionRange === "custom") {
      if (appliedFrom || appliedTo) {
        out = out.filter(se => {
          if (!se.date) return false;
          const d = new Date(se.date + "T00:00:00");
          if (appliedFrom && d < new Date(appliedFrom + "T00:00:00")) return false;
          if (appliedTo   && d > new Date(appliedTo   + "T23:59:59")) return false;
          return true;
        });
      }
    } else if (sessionRange !== "all") {
      out = out.filter(se => se.date && matchesRange(se.date, sessionRange));
    }
    return out;
  };

  const scheduled = applyFilters(
    approvedStudents.filter(s => s.sessionDate && s.sessionTime && !s.sessionCompleted).map(toSE)
  );
  const completed = applyFilters(
    approvedStudents.filter(s => s.sessionCompleted).map(toSE)
  );
  const pendingQ = approvedStudents.filter(s => !s.sessionDate);

  const counts: Record<STab, number> = {
    scheduled: scheduled.length,
    pending:   pendingQ.length,
    completed: completed.length,
  };

  const TABS: { id: STab; label: string; short: string }[] = [
    { id: "scheduled", label: "Scheduled Sessions", short: "Scheduled Sessions" },
    { id: "pending",   label: "Pending Sessions",   short: "Pending Sessions" },
    { id: "completed", label: "Completed",           short: "Completed" },
  ];

  function getS(id: string) { return students.find(s => s.id === id)!; }

  async function saveSession(id: string) {
    const f = pendingForm[id];
    if (!f?.date || !f?.time) return;
    const s = getS(id);
    try {
      await updateEnrollmentSession(id, {
        sessionDate: f.date,
        sessionTime: f.time,
        notes: f.notes || undefined,
      });
      const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const fmtT = (t: string) => { const [h, m] = t.split(":"); const hr = parseInt(h); return `${String(hr % 12 || 12).padStart(2, "0")}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
      await navigator.clipboard.writeText(
        `🎓 LearnWithSanu\n\n👤Name: ${s.name}\n📧Email: ${s.email}\n📱Phone: ${s.phone}\n\n📅Meeting Date: ${fmtD(f.date)}\n🕖Meeting Time: ${fmtT(f.time)}${f.notes ? `\n\n📝Note: ${f.notes}` : ""}\n✅Meeting Scheduled with Sanu Kumar`
            
      );
    } catch (e) { console.error("saveSession failed:", e); }
    setPendingForm(p => { const n = { ...p }; delete n[id]; return n; });
    setSavedFlash(id);
    setTimeout(() => setSavedFlash(null), 2000);
    await refresh();
  }

  async function confirmReschedule() {
    if (!reschedId) return;
    try {
      await updateEnrollmentSession(reschedId, {
        sessionDate: reschedForm.date,
        sessionTime: reschedForm.time,
      });
    } catch (e) { console.error("reschedule failed:", e); }
    setReschedId(null);
    await refresh();
  }

  async function markDone(id: string) {
    const s = getS(id);
    const planLimit = parseInt(plans.find(p => p.slug === s?.planSlug)?.session_limit ?? "0", 10);
    const newCount = (s?.sessionsAttended ?? 0) + 1;
    const isFullyDone = planLimit > 0 && newCount >= planLimit;
    try {
      await incrementSessionsAttended(id);
      if (isFullyDone) {
        // Final session — mark permanently complete, renewal alert fires
        await updateEnrollmentSession(id, { sessionCompleted: true });
      } else {
        // More sessions remaining — reset back to Pending Sessions for next schedule
        await resetEnrollmentSession(id);
      }
    } catch (e) { console.error("markDone failed:", e); }
    await refresh();
  }

  async function copyAndSave(id: string) {
    const se = scheduled.find(x => x.studentId === id) ?? completed.find(x => x.studentId === id);
    const s  = getS(id);
    if (!se || !s) return;
    const link = plans.find(p => p.slug === s.planSlug)?.gmeet_link ?? "";
    const fmtD = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const fmtT = (t: string) => { const [h, m] = t.split(":"); const hr = parseInt(h); return `${String(hr % 12 || 12).padStart(2, "0")}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
    await navigator.clipboard.writeText(
      `🎓 LearnWithSanu\n\n👤Name: ${s.name}\n📧Email: ${s.email}\n📱Phone: ${s.phone}\n\n📅Meeting Date: ${fmtD(se.date)}\n🕖Meeting Time: ${fmtT(se.time)}\n\n🔗Meeting Link: ${link || "—"}${se.notes ? `\n\n📝Note: ${se.notes}` : ""}\n✅Meeting Scheduled with Sanu Kumar`
    );
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function updateNote(id: string, v: string) {
    try {
      await updateEnrollmentNotes(id, v);
    } catch (e) { console.error("updateNote failed:", e); }
  }

  /* ── Scheduled table ─────────────────────────────────────── */
  const ScheduledTable = () => (
    <Card>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
            <CheckCircle size={15} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="text-foreground">Scheduled Sessions</h3>
            <p style={{ fontSize: 11 }} className="text-muted-foreground">{scheduled.length} sessions booked</p>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin"/>
        </div>
      ) : scheduled.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Clock size={36} className="opacity-20" />
          <p style={{ fontSize: 13 }}>No scheduled sessions yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TH cols={["Name", "Contact", "Date & Time", "GMeet", "Comments", "Mail", "Save Copy", "Reschedule"]} />
            <tbody>
              {scheduled.map(se => {
                const s  = getS(se.studentId);
                if (!s) return null;
                const isR = reschedId === se.studentId;
                return (
                  <tr key={se.studentId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} color={s.avatarColor} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => onStudentClick?.(s)}
                              className="font-semibold text-foreground hover:text-primary transition-colors text-left whitespace-nowrap" style={{ fontSize: 13 }}>
                              {s.name}
                            </button>
                            {s.planPrice === 0 && (
                              <span className="px-1.5 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 whitespace-nowrap" style={{ fontSize: 10 }}>
                                Free
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11 }} className="text-muted-foreground">{s.plan}</p>
                          {(() => {
                            const planLimit = parseInt(plans.find(p => p.slug === s.planSlug)?.session_limit ?? "0", 10);
                            if (!planLimit) return null;
                            const done = s.sessionsAttended;
                            const isLast = done >= planLimit - 1;
                            return (
                              <span
                                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-md font-semibold ${isLast ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}
                                style={{ fontSize: 10 }}>
                                {done}/{planLimit} sessions
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <PhoneLink phone={s.phone} />
                      <div className="mt-0.5"><EmailLink email={s.email} /></div>
                    </td>
                    <td className="px-5 py-3.5">
                      {isR ? (
                        <div className="flex flex-col gap-1.5">
                          <input type="date" value={reschedForm.date}
                            onChange={e => setReschedForm(f => ({ ...f, date: e.target.value }))}
                            className="bg-muted border border-border rounded-xl px-2 py-1 outline-none focus:ring-1 focus:ring-primary text-foreground" style={{ fontSize: 12 }} />
                          <TimeInput
                            value={reschedForm.time}
                            onChange={v => setReschedForm(f => ({ ...f, time: v }))}
                          />
                          <div className="flex gap-1">
                            <button onClick={confirmReschedule}
                              className="px-2.5 py-1 bg-primary text-white rounded-xl" style={{ fontSize: 11 }}>Save</button>
                            <button onClick={() => setReschedId(null)}
                              className="px-2.5 py-1 border border-border rounded-xl text-muted-foreground" style={{ fontSize: 11 }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontSize: 13 }} className="font-medium text-foreground">{fmtDate(se.date)}</p>
                          <p style={{ fontSize: 11 }} className="text-muted-foreground">{fmtTime(se.time)}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const planGmeet = plans.find(p => p.slug === s.planSlug)?.gmeet_link;
                        return planGmeet ? (
                          <a
                            href={planGmeet}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ fontSize: 12, background: "#00897B", boxShadow: "0 2px 6px rgba(0,137,123,0.30)", whiteSpace: "nowrap" }}
                          >
                            <Video size={12} /> GMEET
                          </a>
                        ) : (
                          <span style={{ fontSize: 12 }} className="text-muted-foreground">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5">
                      <CommentCell value={se.notes} onChange={v => updateNote(se.studentId, v)} />
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setMailTarget(s)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors whitespace-nowrap"
                        style={{ fontSize: 12 }}>
                        <Mail size={11} /> Send Mail
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => copyAndSave(se.studentId)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap ${copied === se.studentId ? "bg-emerald-500 text-white" : "bg-primary text-white hover:opacity-90"}`}
                        style={{ fontSize: 12, boxShadow: "0 2px 6px rgba(26,42,241,0.25)" }}>
                        <Save size={11} />{copied === se.studentId ? "Copied!" : "Save Copy"}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <button onClick={() => { setReschedId(se.studentId); setReschedForm({ date: se.date, time: se.time }); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white hover:opacity-90 transition-all whitespace-nowrap font-medium shadow-sm"
                          style={{ fontSize: 12, boxShadow: "0 2px 6px rgba(245,158,11,0.3)" }}>
                          <RotateCcw size={11} /> Reschedule
                        </button>
                        <button onClick={() => markDone(se.studentId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white hover:opacity-90 transition-all whitespace-nowrap font-medium shadow-sm"
                          style={{ fontSize: 12, boxShadow: "0 2px 6px rgba(34,197,94,0.3)" }}>
                          <CheckCircle size={11} /> Mark Done
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {mailTarget && (
        <SessionMailModal
          s={mailTarget}
          templates={templates}
          plans={plans}
          onClose={() => setMailTarget(null)}
        />
      )}
    </Card>
  );

  /* ── Pending table ─────────────────────────────────────────── */
  const PendingTable = () => (
    <Card>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
            <AlertCircle size={15} className="text-amber-500" />
          </div>
          <div>
            <h3 className="text-foreground">Pending Sessions</h3>
            <p style={{ fontSize: 11 }} className="text-muted-foreground">Free 1-on-1 awaiting booking</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900" style={{ fontSize: 12 }}>
          {pendingQ.length} pending
        </span>
      </div>
      {pendingQ.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <CheckCircle size={36} className="text-emerald-400 opacity-70" />
          <p style={{ fontSize: 13 }}>All Free 1-on-1 students have sessions booked!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TH cols={["Name", "Contact", "Email", "Pick Date", "Pick Time", "Add Notes", "Action"]} />
            <tbody>
              {pendingQ.map(s => {
                const f    = pendingForm[s.id] || { date: "", time: "", notes: "" };
                const isSaved = savedFlash === s.id;
                return (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} color={s.avatarColor} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => onStudentClick?.(s)}
                              className="font-semibold text-foreground hover:text-primary transition-colors text-left whitespace-nowrap" style={{ fontSize: 13 }}>
                              {s.name}
                            </button>
                            {s.planPrice === 0 && (
                              <span className="px-1.5 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 whitespace-nowrap" style={{ fontSize: 10 }}>
                                Free
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11 }} className="text-muted-foreground">{s.plan}</p>
                          {(() => {
                            const planLimit = parseInt(plans.find(p => p.slug === s.planSlug)?.session_limit ?? "0", 10);
                            if (!planLimit) return null;
                            const done = s.sessionsAttended;
                            const isLast = done >= planLimit - 1;
                            return (
                              <span
                                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-md font-semibold ${isLast ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"}`}
                                style={{ fontSize: 10 }}>
                                {done}/{planLimit} sessions
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><PhoneLink phone={s.phone} /></td>
                    <td className="px-5 py-3.5"><EmailLink email={s.email} /></td>
                    <td className="px-5 py-3.5">
                      <input type="date" value={f.date}
                        onChange={e => setPendingForm(p => ({ ...p, [s.id]: { ...f, date: e.target.value } }))}
                        className="bg-muted border border-border rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize: 12 }} />
                    </td>
                    <td className="px-5 py-3.5">
                      <TimeInput
                        value={f.time}
                        onChange={v => setPendingForm(p => ({ ...p, [s.id]: { ...f, time: v } }))}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <textarea
                        value={f.notes}
                        onChange={e => setPendingForm(p => ({ ...p, [s.id]: { ...f, notes: e.target.value } }))}
                        rows={3}
                        placeholder="Add notes…"
                        className="w-full resize-none outline-none placeholder:text-muted-foreground text-foreground"
                        style={{
                          fontSize: 12, lineHeight: 1.5,
                          background: "var(--secondary)",
                          border: "1.5px solid var(--accent)",
                          borderRadius: 14,
                          padding: "10px 12px",
                          minWidth: 160,
                        }}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <button disabled={!f.date || !f.time} onClick={() => saveSession(s.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all whitespace-nowrap ${isSaved ? "bg-emerald-500 text-white" : "bg-primary text-white disabled:opacity-35 hover:opacity-90"}`}
                        style={{ fontSize: 12 }}>
                        <Copy size={12} />{isSaved ? "Saved!" : "Copy & Save"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  /* ── Completed table ───────────────────────────────────────── */
  const CompletedTable = () => (
    <Card>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CheckCircle size={15} className="text-primary" />
          </div>
          <div>
            <h3 className="text-foreground">Completed Sessions</h3>
            <p style={{ fontSize: 11 }} className="text-muted-foreground">Marked done from Scheduled tab</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground border border-border" style={{ fontSize: 12 }}>
          {completed.length} completed
        </span>
      </div>
      {completed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Clock size={36} className="opacity-20" />
          <p style={{ fontSize: 13 }}>No completed sessions — mark sessions done from the Scheduled tab</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <TH cols={["Name", "Contact", "Email", "Session Date", "Status", "Notes", "Copy"]} />
            <tbody>
              {completed.map(se => {
                const s = getS(se.studentId);
                if (!s) return null;
                return (
                  <tr key={se.studentId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} color={s.avatarColor} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => onStudentClick?.(s)}
                              className="font-semibold text-foreground hover:text-primary transition-colors text-left whitespace-nowrap" style={{ fontSize: 13 }}>
                              {s.name}
                            </button>
                            {s.planPrice === 0 && (
                              <span className="px-1.5 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 whitespace-nowrap" style={{ fontSize: 10 }}>
                                Free
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11 }} className="text-muted-foreground">{s.plan}</p>
                          {(() => {
                            const planLimit = parseInt(plans.find(p => p.slug === s.planSlug)?.session_limit ?? "0", 10);
                            if (!planLimit) return null;
                            return (
                              <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-md font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" style={{ fontSize: 10 }}>
                                {s.sessionsAttended}/{planLimit} sessions ✓
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><PhoneLink phone={s.phone} /></td>
                    <td className="px-5 py-3.5"><EmailLink email={s.email} /></td>
                    <td className="px-5 py-3.5">
                      <p style={{ fontSize: 13 }} className="font-medium text-foreground">{fmtDate(se.date)}</p>
                      <p style={{ fontSize: 11 }} className="text-muted-foreground">{fmtTime(se.time)}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 whitespace-nowrap" style={{ fontSize: 12 }}>
                        <span className="size-1.5 rounded-full bg-emerald-500" /> Completed
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px]">
                      <p style={{ fontSize: 12 }} className="text-muted-foreground line-clamp-2">
                        {se.notes || <em className="opacity-40">No notes</em>}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => copyAndSave(se.studentId)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${copied === se.studentId ? "border-emerald-400 text-emerald-600" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                        style={{ fontSize: 12 }}>
                        <Copy size={11} />{copied === se.studentId ? "Copied!" : "Copy"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col min-h-0">

      {/* ── STICKY HEADER ─────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 bg-card border-b border-border"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        {/* Left group: heading + tab pills — flex-wrap makes heading wrap above tabs on mobile */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-foreground flex-shrink-0">Sessions</h2>
          <div className="flex items-center gap-1 bg-muted/50 rounded-full px-1 py-1"
            style={{ border: "1px solid var(--border)" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-full transition-all duration-150 font-medium ${
                  activeTab === t.id ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontSize: 12 }}>
                {t.short}
                <span className={`min-w-[18px] h-[18px] sm:min-w-[22px] sm:h-5 rounded-full flex items-center justify-center px-1 sm:px-1.5 font-bold ${
                  activeTab === t.id ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                }`} style={{ fontSize: 10 }}>
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right group: filter controls — w-full on mobile forces to new row */}
        {activeTab !== "pending" && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Range dropdown */}
            <RangeDropdown
              value={sessionRange}
              onChange={v => {
                setSessionRange(v as SessionRange);
                if (v !== "custom") { setCustomFrom(""); setCustomTo(""); setAppliedFrom(""); setAppliedTo(""); }
              }}
              options={[
                { value: "all",    label: "All" },
                { value: "today",  label: "Today" },
                { value: "week",   label: "This Week" },
                { value: "month",  label: "This Month" },
                { value: "custom", label: "Custom" },
              ]}
            />

            {/* Custom date range — only shown when Custom is selected */}
            {sessionRange === "custom" && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <CalendarPicker value={customFrom} onChange={setCustomFrom} compact placeholder="From" align="right" />
                <span className="text-muted-foreground" style={{ fontSize: 11 }}>→</span>
                <CalendarPicker value={customTo}   onChange={setCustomTo}   compact placeholder="To"   align="right" />
                <button
                  onClick={() => { setAppliedFrom(customFrom); setAppliedTo(customTo); }}
                  className="px-2.5 py-1 rounded-lg text-white font-medium flex-shrink-0"
                  style={{ background: "var(--primary)", fontSize: 11 }}>
                  Apply
                </button>
                {(appliedFrom || appliedTo) && (
                  <button
                    onClick={() => { setCustomFrom(""); setCustomTo(""); setAppliedFrom(""); setAppliedTo(""); }}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0" style={{ fontSize: 16, lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CONTENT ───────────────────────────────────────────── */}
      <div className="p-5 flex flex-col gap-5">
        {activeTab === "scheduled" && ScheduledTable()}
        {activeTab === "pending"   && PendingTable()}
        {activeTab === "completed" && CompletedTable()}
      </div>
    </div>
  );
}

function SessionMailModal({ s, templates, plans, onClose }: {
  s: Student;
  templates: EmailTemplate[];
  plans: AdminPlan[];
  onClose: () => void;
}) {
  const [tplId, setTplId] = useState(() => templates[0]?.id ?? "");
  const [sent,  setSent]  = useState(false);

  useEffect(() => {
    if (!tplId && templates[0]) setTplId(templates[0].id);
  }, [templates, tplId]);

  const tpl = templates.find(t => t.id === tplId) ?? templates[0];
  const gmeetLink = plans.find(p => p.slug === s.planSlug)?.gmeet_link ?? "";

  function preview(b: string) {
    return b
      .replace(/{{name}}/g, s.name)
      .replace(/{{plan}}/g, s.plan)
      .replace(/{{session_date}}/g, s.sessionDate || "TBD")
      .replace(/{{session_time}}/g, s.sessionTime || "TBD")
      .replace(/{{gmeet_link}}/g, gmeetLink || "—");
  }

  async function handleSend() {
    if (!tpl) return;
    setSent(true);
    try {
      await sendMail({
        enrollmentId: s.id,
        to: s.email,
        toName: s.name,
        plan: s.plan,
        sessionDate: s.sessionDate,
        sessionTime: s.sessionTime,
        templateBody: tpl.body,
        templateName: tpl.name,
        gmeetLink,
      });
    } catch (e) {
      console.error("SessionMailModal send failed:", e);
    }
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-2xl w-full max-w-lg overflow-hidden border border-border"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-foreground">Send Session Mail</h3>
            <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">To: {s.name} — {s.email}</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl flex items-center justify-center hover:bg-muted">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <select value={tplId} onChange={e => setTplId(e.target.value)}
            className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground appearance-none"
            style={{ fontSize: 13 }}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="bg-muted rounded-xl p-4 whitespace-pre-wrap leading-relaxed text-foreground"
            style={{ fontSize: 13, minHeight: 120 }}>
            {tpl ? preview(tpl.body) : ""}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSend}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${sent ? "bg-emerald-500 text-white" : "bg-primary text-white hover:opacity-90"}`}
              style={{ fontSize: 13 }}>
              <Send size={14} />{sent ? "Sent!" : "Send Now"}
            </button>
            <button onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:bg-muted"
              style={{ fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
