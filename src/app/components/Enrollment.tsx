import { useState, useEffect, useRef } from "react";
import {
  Send, X, CalendarClock, CheckCircle, Clock,
  AlertTriangle, ChevronDown, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useLiveEnrollments } from "../hooks/useLiveEnrollments";
import {
  isPlanExpired, daysRemaining,
  type Student,
} from "../data/liveDashboard";
import {
  fetchEmailTemplates, type EmailTemplate,
} from "../../services/emailTemplateService";
import { sendMail, scheduleMail } from "../../services/mailLogService";
import { fetchActivePlansAdmin, type AdminPlan } from "../../services/planService";
import {
  approveEnrollment, cancelEnrollment,
  restoreEnrollment, hardDeleteEnrollment,
} from "../../services/enrollmentService";
import { Avatar } from "./Avatar";

interface Props { year: string; plan: string; search?: string; onStudentClick?: (s: Student) => void; }
type EnrollTab = "enrolled" | "pending" | "deleted";
type DateRange = "today" | "week" | "month" | "all";

function today() { return new Date().toISOString().split("T")[0]; }

function matchesDateRange(dateStr: string, range: DateRange): boolean {
  if (range === "all") return true;
  const d = new Date(dateStr + "T00:00:00"), now = new Date();
  if (range === "today") return d.toDateString() === now.toDateString();
  if (range === "week") {
    const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0,0,0,0);
    const we = new Date(ws); we.setDate(ws.getDate() + 7);
    return d >= ws && d < we;
  }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function paymentStatus(s: Student): "Paid" | "Pending" | "Overdue" {
  if (s.plan === "Unpaid / Unknown") return "Pending";
  return "Paid";
}

function StatusPill({ label, variant }: { label: string; variant: "amber" | "red" | "green" | "gray" | "blue" }) {
  const styles = {
    amber: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    red:   "border-red-300   text-red-600   bg-red-50   dark:bg-red-950/30   dark:text-red-400   dark:border-red-800",
    green: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    gray:  "border-border text-muted-foreground bg-transparent",
    blue:  "border-primary/40 text-primary bg-primary/5 dark:bg-primary/10",
  };
  const dots = { amber:"bg-amber-400", red:"bg-red-500", green:"bg-emerald-500", gray:"bg-muted-foreground/50", blue:"bg-primary" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${styles[variant]}`} style={{ fontSize:11 }}>
      <span className={`size-1.5 rounded-full ${dots[variant]}`}/>
      {label}
    </span>
  );
}

function bundleBody(plan: AdminPlan): string {
  return `Hi {{name}},

Great news! Your bundle access for {{plan}} has been confirmed.

Join all your sessions using the Google Meet link below:
${plan.gmeet_link || "Meet link will be shared shortly"}

Please save this link — it will be used for all your sessions.

Looking forward to seeing you!

Regards,
LearnWithSanu Team`;
}

function MailModal({ s, templates, plans, onClose }: {
  s: Student;
  templates: EmailTemplate[];
  plans: AdminPlan[];
  onClose: () => void;
}) {
  const [mode, setMode]         = useState<"template"|"custom"|"bundle">("template");
  const [tplId, setTplId]       = useState(() => templates[0]?.id ?? "");
  const [custom, setCustom]     = useState("");
  const [subject, setSub]       = useState("");
  const [planId, setPlanId]     = useState(() => plans[0]?.id ?? "");
  const [sent, setSent]         = useState(false);

  useEffect(() => {
    if (!tplId && templates[0]) setTplId(templates[0].id);
  }, [templates, tplId]);

  useEffect(() => {
    if (!planId && plans[0]) setPlanId(plans[0].id);
  }, [plans, planId]);

  const tpl         = templates.find(t => t.id === tplId) ?? templates[0];
  const selectedPlan = plans.find(p => p.id === planId) ?? plans[0];

  function previewBody(b: string) {
    return b.replace(/{{name}}/g, s.name).replace(/{{plan}}/g, s.plan)
      .replace(/{{session_date}}/g, s.sessionDate || "TBD")
      .replace(/{{session_time}}/g, s.sessionTime || "TBD");
  }

  async function handleSend() {
    setSent(true);
    let body = "";
    let name = "";
    let grantAccess = false;
    if (mode === "template") {
      body = tpl?.body ?? "";
      name = tpl?.name ?? "Template";
    } else if (mode === "custom") {
      body = custom;
      name = subject || "Custom";
    } else {
      body = selectedPlan ? bundleBody(selectedPlan) : "";
      name = `Bundle: ${selectedPlan?.name ?? ""}`;
      grantAccess = true;
    }
    try {
      await sendMail({
        enrollmentId: s.id,
        to: s.email,
        toName: s.name,
        plan: s.plan,
        sessionDate: s.sessionDate,
        sessionTime: s.sessionTime,
        templateBody: body,
        templateName: name,
        grantAccess,
      });
    } catch (e) {
      console.error("Mail send failed:", e);
    }
    setTimeout(onClose, 1200);
  }

  const TABS = [
    { id: "template" as const, label: "Use Template" },
    { id: "custom"   as const, label: "Custom Email" },
    { id: "bundle"   as const, label: "Bundle" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-card rounded-2xl w-full max-w-2xl overflow-hidden border border-border" style={{ boxShadow:"0 8px 32px rgba(0,0,0,0.12)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div><h3 className="text-foreground">Send Mail</h3><p style={{ fontSize:12 }} className="text-muted-foreground mt-0.5">To: {s.name} — {s.email}</p></div>
          <button onClick={onClose} className="size-8 rounded-xl flex items-center justify-center hover:bg-muted"><X size={16} className="text-muted-foreground"/></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex rounded-xl border border-border overflow-hidden w-fit" style={{ fontSize:12 }}>
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setMode(id)}
                className={`px-4 py-2 transition-colors ${mode===id?"bg-primary text-white":"text-muted-foreground hover:bg-muted"}`}>
                {label}
              </button>
            ))}
          </div>

          {mode === "template" && (
            <>
              <select value={tplId} onChange={e=>setTplId(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground appearance-none" style={{ fontSize:13 }}>
                {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="bg-muted rounded-xl p-4 whitespace-pre-wrap leading-relaxed text-foreground" style={{ fontSize:13, minHeight:120 }}>
                {tpl ? previewBody(tpl.body) : ""}
              </div>
            </>
          )}

          {mode === "custom" && (
            <>
              <input value={subject} onChange={e=>setSub(e.target.value)} placeholder="Subject…" className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize:13 }}/>
              <textarea value={custom} onChange={e=>setCustom(e.target.value)} rows={6} placeholder="Write your email…" className="w-full bg-muted border border-border rounded-xl px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize:13 }}/>
            </>
          )}

          {mode === "bundle" && (
            <>
              <select value={planId} onChange={e=>setPlanId(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground appearance-none" style={{ fontSize:13 }}>
                {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="bg-muted rounded-xl p-4 whitespace-pre-wrap leading-relaxed text-foreground" style={{ fontSize:13, minHeight:160 }}>
                {selectedPlan ? previewBody(bundleBody(selectedPlan)) : ""}
              </div>
              <p style={{ fontSize:11 }} className="text-muted-foreground -mt-2">
                Sending this mail will mark Bundle Access as <strong>Granted</strong>.
              </p>
            </>
          )}

          <div className="flex gap-2">
            <button onClick={handleSend} className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all ${sent?"bg-emerald-500 text-white":"bg-primary text-white hover:opacity-90"}`} style={{ fontSize:13 }}>
              <Send size={14}/>{sent?"Sent!":"Send Now"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:bg-muted" style={{ fontSize:13 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScheduleMailModal({ s, templates, plans, onClose }: {
  s: Student;
  templates: EmailTemplate[];
  plans: AdminPlan[];
  onClose: () => void;
}) {
  const [date,    setDate]    = useState("");
  const [time,    setTime]    = useState("09:00");
  // Value is "tpl:<id>" or "bundle:<planId>"
  const [sel,     setSel]     = useState(() => templates[0] ? `tpl:${templates[0].id}` : "");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    if (!sel && templates[0]) setSel(`tpl:${templates[0].id}`);
  }, [templates, sel]);

  function parseSelection() {
    if (sel.startsWith("bundle:")) {
      const planId = sel.slice(7);
      const plan   = plans.find(p => p.id === planId);
      return { templateName: `Bundle: ${plan?.name ?? ""}`, body: plan ? bundleBody(plan) : "" };
    }
    const tplId = sel.slice(4);
    const tpl   = templates.find(t => t.id === tplId) ?? templates[0];
    return { templateName: tpl?.name ?? "", body: undefined };
  }

  async function handleSchedule() {
    if (!date) return;
    setSaving(true);
    const { templateName, body } = parseSelection();
    const scheduledFor = new Date(`${date}T${time}:00`).toISOString();
    try {
      await scheduleMail({
        enrollmentId: s.id,
        sentTo:       s.name,
        email:        s.email,
        templateName,
        scheduledFor,
        body,
      });
      setSaved(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      console.error("scheduleMail failed:", e);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-card rounded-2xl w-full max-w-md overflow-hidden border border-border" style={{ boxShadow:"0 8px 32px rgba(0,0,0,0.12)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-foreground">Schedule Mail</h3>
            <p style={{ fontSize:12 }} className="text-muted-foreground mt-0.5">Saves to Mail Log — you can send it later from there</p>
          </div>
          <button onClick={onClose} className="size-8 rounded-xl flex items-center justify-center hover:bg-muted"><X size={16} className="text-muted-foreground"/></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p style={{ fontSize:13 }} className="text-muted-foreground">To: {s.name} — {s.email}</p>
          <select value={sel} onChange={e=>setSel(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground appearance-none" style={{ fontSize:13 }}>
            {templates.length > 0 && <optgroup label="Templates">
              {templates.map(t=><option key={t.id} value={`tpl:${t.id}`}>{t.name}</option>)}
            </optgroup>}
            {plans.length > 0 && <optgroup label="Bundle Access">
              {plans.map(p=><option key={p.id} value={`bundle:${p.id}`}>Bundle: {p.name}</option>)}
            </optgroup>}
          </select>
          {sel.startsWith("bundle:") && (
            <p style={{ fontSize:11 }} className="text-muted-foreground -mt-1">
              Sending this scheduled mail will mark Bundle Access as <strong>Granted</strong>.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block mb-1.5 text-muted-foreground" style={{ fontSize:12 }}>Date</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize:13 }}/></div>
            <div><label className="block mb-1.5 text-muted-foreground" style={{ fontSize:12 }}>Time</label>
              <input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize:13 }}/></div>
          </div>
          <div className="flex gap-2">
            <button disabled={!date || saving} onClick={handleSchedule}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full disabled:opacity-40 transition-all ${saved?"bg-emerald-500 text-white":"bg-primary text-white hover:opacity-90"}`}
              style={{ fontSize:13 }}>
              <CalendarClock size={14}/>{saved ? "Scheduled!" : saving ? "Saving…" : "Schedule Mail"}
            </button>
            <button onClick={onClose} className="px-5 py-2.5 rounded-full border border-border text-muted-foreground hover:bg-muted" style={{ fontSize:13 }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionMenu({ s, onMail, onSchedule, onMovePending, onDelete }: {
  s: Student;
  onMail: () => void;
  onSchedule: () => void;
  onMovePending?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ top: 0, right: 0 });
  const btnRef          = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  }

  const items = [
    { label:"Send Mail",     icon:Send,         fn:onMail,        color:"text-muted-foreground" },
    { label:"Schedule Mail", icon:CalendarClock, fn:onSchedule,   color:"text-muted-foreground" },
    ...(onMovePending ? [{ label:"Move to Pending", icon:Clock,   fn:onMovePending, color:"text-amber-500" }] : []),
    ...(onDelete      ? [{ label:"Delete",          icon:Trash2,  fn:onDelete,      color:"text-red-500"   }] : []),
  ];

  return (
    <div>
      <button ref={btnRef} onClick={handleToggle}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors font-medium"
        style={{ fontSize:12 }}>
        Actions <ChevronDown size={11}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="fixed z-50 bg-card border border-border rounded-xl overflow-hidden w-44"
            style={{ top: pos.top, right: pos.right, boxShadow:"0 4px 16px rgba(0,0,0,0.10)" }}>
            {items.map(({ label, icon:Icon, fn, color }) => (
              <button key={label} onClick={() => { fn(); setOpen(false); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left hover:bg-muted transition-colors text-foreground"
                style={{ fontSize:12 }}>
                <Icon size={13} className={color}/>{label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const RotateCcwIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
  </svg>
);
const TrashIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

function KpiCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-card rounded-2xl p-5 border border-border flex flex-col gap-2" style={{ boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
      <p style={{ fontSize:13 }} className="text-muted-foreground font-medium">{label}</p>
      <p className="font-bold text-foreground" style={{ fontSize:36, lineHeight:1 }}>{value}</p>
      <p style={{ fontSize:12 }} className="text-muted-foreground">{sub}</p>
    </div>
  );
}

export function Enrollment({ year, plan, search = "", onStudentClick }: Props) {
  const { students, loading, error, refresh } = useLiveEnrollments();
  const [tab,         setTab]        = useState<EnrollTab>("enrolled");
  const [dateRange,   setDateRange]  = useState<DateRange>("all");
  const [pickerDate,  setPickerDate] = useState("");
  const [mailTarget,  setMailTarget] = useState<Student|null>(null);
  const [schedTarget, setSchedTarget]= useState<Student|null>(null);
  const [page,        setPage]       = useState(1);
  const [templates,   setTemplates]  = useState<EmailTemplate[]>([]);
  const [plans,       setPlans]      = useState<AdminPlan[]>([]);
  const PER = 12;

  useEffect(() => {
    fetchEmailTemplates()
      .then(data => setTemplates(data.filter(t => !t.archived)))
      .catch(console.error);
    fetchActivePlansAdmin()
      .then(setPlans)
      .catch(console.error);
  }, []);

  const yearNum = year === "All Time" ? null : parseInt(year);
  const effectivePlan = plan === "All Plans" ? null : plan;

  const PLAN_COLORS: Record<string,string> = {
    "Free 1-on-1":"#1A2AF1", Pro:"#8B5CF6", Bundle:"#22C55E", Beginner:"#F59E0B", Advanced:"#EF4444",
  };

  const planFiltered = students.filter(s => effectivePlan === null || s.planSlug === effectivePlan);

  const base = planFiltered.filter(s => {
    const d = new Date(s.enrolledDate);
    return yearNum === null || d.getFullYear() === yearNum;
  });

  const dateFilter = (arr: Student[]) => {
    if (pickerDate) return arr.filter(s => s.enrolledDate === pickerDate);
    return dateRange === "all" ? arr : arr.filter(s => matchesDateRange(s.enrolledDate, dateRange));
  };

  // Correct tri-tab split using raw DB fields
  const pending  = dateFilter(planFiltered.filter(s => s.dbStatus === "submitted" && !s.adminApprovedAt));
  const enrolled = dateFilter(planFiltered.filter(s => s.dbStatus === "submitted" && !!s.adminApprovedAt));
  const deleted  = dateFilter(planFiltered.filter(s => s.dbStatus === "cancelled"));

  const enrolledCount = planFiltered.filter(s => s.dbStatus === "submitted" && !!s.adminApprovedAt).length;
  const pendingCount  = planFiltered.filter(s => s.dbStatus === "submitted" && !s.adminApprovedAt).length;
  const deletedCount  = planFiltered.filter(s => s.dbStatus === "cancelled").length;

  const atRisk = enrolled.filter(s => {
    const planLimit = parseInt(plans.find(p => p.slug === s.planSlug)?.session_limit ?? "0", 10);
    return planLimit > 0 && s.sessionsAttended >= planLimit;
  });
  const addedThisWeek = base.filter(s => {
    const d = new Date(s.enrolledDate), now = new Date();
    const ws = new Date(now); ws.setDate(now.getDate() - now.getDay()); ws.setHours(0,0,0,0);
    return d >= ws;
  }).length;
  const sessionDone = base.filter(s => s.sessionCompleted).length;

  const q    = search.trim().toLowerCase();
  const list = (tab === "enrolled" ? enrolled : tab === "pending" ? pending : deleted)
    .filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  const paged      = list.slice((page-1)*PER, page*PER);
  const totalPages = Math.max(1, Math.ceil(list.length / PER));

  const TH = ({ cols }: { cols: string[] }) => (
    <thead>
      <tr className="border-b border-border bg-muted/30">
        {cols.map(c => (
          <th key={c} className="text-left px-5 py-3" style={{ fontSize:11, letterSpacing:"0.07em" }}>
            <span className="font-semibold text-muted-foreground uppercase">{c}</span>
          </th>
        ))}
      </tr>
    </thead>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin"/>
          <p style={{ fontSize:13 }}>Loading enrollments…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <AlertTriangle size={32} className="text-red-500"/>
          <p style={{ fontSize:13 }} className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">

      {/* ── STICKY HEADER ────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-card border-b border-border"
        style={{ boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-foreground flex-shrink-0">Onboarding</h2>
          <div className="flex items-center gap-1 bg-muted/50 rounded-full px-1 py-1" style={{ border:"1px solid var(--border)" }}>
            {([
              { id:"enrolled" as EnrollTab, label:"Onboarded", count:enrolledCount },
              { id:"pending"  as EnrollTab, label:"Pending",  count:pendingCount },
              { id:"deleted"  as EnrollTab, label:"Deleted",  count:deletedCount },
            ]).map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all duration-150 font-medium ${
                  tab === t.id ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ fontSize:13 }}>
                {t.label}
                <span className={`min-w-[22px] h-5 rounded-full flex items-center justify-center px-1.5 font-bold ${
                  tab === t.id ? "bg-white/20 text-white" : "bg-muted-foreground/20 text-muted-foreground"
                }`} style={{ fontSize:11 }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-secondary border border-primary/20 rounded-xl px-3 py-1.5"
            style={{ boxShadow:"0 1px 4px rgba(26,42,241,0.08)" }}>
            <ChevronDown size={12} className="text-primary flex-shrink-0"/>
            <select value={dateRange} onChange={e => { setDateRange(e.target.value as DateRange); setPage(1); }}
              className="bg-transparent outline-none text-primary font-semibold appearance-none cursor-pointer" style={{ fontSize:12 }}>
              <option value="all">All</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="today">Today</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 rounded-xl px-3 py-1.5"
            style={{ boxShadow:"0 1px 4px rgba(26,42,241,0.10)" }}>
            <CalendarClock size={13} className="text-primary flex-shrink-0"/>
            <input type="date" value={pickerDate} onChange={e => { setPickerDate(e.target.value); setPage(1); }}
              className="bg-transparent outline-none text-primary font-semibold cursor-pointer" style={{ fontSize:12 }}/>
            {pickerDate && (
              <button onClick={() => { setPickerDate(""); setPage(1); }}
                className="text-muted-foreground hover:text-foreground transition-colors ml-0.5" style={{ fontSize:14, lineHeight:1 }}>
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ──────────────────────────────────────────── */}
      <div className="p-5 flex flex-col gap-4">

        {/* ── KPI Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Total Onboarded" value={enrolledCount} sub={`+${addedThisWeek} this week`}/>
          <KpiCard label="Pending Review"  value={pendingCount}  sub="Awaiting action"/>
          <KpiCard label="At Risk"         value={atRisk.length} sub="Overdue plan"/>
          <KpiCard label="Sessions Done"   value={sessionDone}   sub="Completed sessions"/>
        </div>

        {/* ── At-risk alert banner ───────────────────────────── */}
        {atRisk.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border"
            style={{ background:"rgba(239,68,68,0.04)", borderColor:"rgba(239,68,68,0.25)" }}>
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0"/>
              <p style={{ fontSize:13 }} className="text-red-700 dark:text-red-400 font-medium">
                <strong>{atRisk.length} student{atRisk.length !== 1 ? "s" : ""}</strong> have completed all sessions — renewal reminders needed
              </p>
            </div>
            <button onClick={() => setTab("enrolled")}
              className="px-3 py-1.5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 font-medium"
              style={{ fontSize:12 }}>
              View All At-Risk
            </button>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border" style={{ boxShadow:"0 1px 8px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-foreground">
                {tab === "enrolled" ? "Onboarded Students" : tab === "pending" ? "Pending Students" : "Archived Records"}
              </h3>
              <span className="inline-flex items-center justify-center min-w-[24px] h-5 rounded-full bg-primary/10 text-primary font-bold px-2"
                style={{ fontSize:11 }}>
                {list.length}
              </span>
            </div>
            {tab === "deleted" && (
              <div className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize:12 }}>
                <Trash2 size={12}/>
                <span>Rejected enrollments — restore or permanently delete</span>
              </div>
            )}
          </div>

          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <p style={{ fontSize:13 }}>No students for the selected period</p>
              <p style={{ fontSize:12 }} className="opacity-60">Try changing the date range to "All"</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TH cols={[
                    "Student","Plan","Onboarded Date","Bundle Access","Payment",
                    ...(tab === "pending" ? ["Approvals"] : []),
                    "Actions",
                  ]}/>
                  <tbody>
                    {paged.map(s => {
                      const planLimit = parseInt(plans.find(p => p.slug === s.planSlug)?.session_limit ?? "0", 10);
                      const allSessionsDone = planLimit > 0 && s.sessionsAttended >= planLimit;
                      const pay      = paymentStatus(s);

                      return (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          {/* Student */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <button onClick={() => onStudentClick?.(s)} className="flex-shrink-0 focus:outline-none">
                                <Avatar name={s.name} color={s.avatarColor} size="sm"/>
                              </button>
                              <div>
                                <button onClick={() => onStudentClick?.(s)}
                                  className="font-semibold text-foreground hover:text-primary transition-colors text-left"
                                  style={{ fontSize:13 }}>
                                  {s.name}
                                </button>
                                <p style={{ fontSize:11 }} className="text-muted-foreground">{s.email}</p>
                                {allSessionsDone && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <AlertTriangle size={10} className="text-red-500"/>
                                    <span style={{ fontSize:10 }} className="text-red-500">
                                      All {planLimit} sessions done · Renewal needed
                                    </span>
                                  </div>
                                )}
                                {!allSessionsDone && planLimit > 0 && s.sessionsAttended > 0 && s.sessionsAttended >= planLimit - 1 && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <AlertTriangle size={10} className="text-amber-500"/>
                                    <span style={{ fontSize:10 }} className="text-amber-600">{s.sessionsAttended}/{planLimit} sessions done</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="size-2 rounded-full flex-shrink-0" style={{ background:PLAN_COLORS[s.plan]||"#888" }}/>
                              <span style={{ fontSize:13 }} className="text-foreground">{s.plan}</span>
                            </div>
                          </td>

                          {/* Enrolled Date */}
                          <td className="px-5 py-3.5">
                            <span style={{ fontSize:13 }} className="text-foreground font-medium">{s.enrolledDate}</span>
                          </td>

                          {/* Bundle Access */}
                          <td className="px-5 py-3.5">
                            {s.mailSent
                              ? <StatusPill label="Granted" variant="green"/>
                              : <StatusPill label="Pending" variant="gray"/>
                            }
                          </td>

                          {/* Payment */}
                          <td className="px-5 py-3.5">
                            {pay === "Paid"
                              ? <span className="flex items-center gap-1.5 text-emerald-600 font-medium" style={{ fontSize:12 }}><CheckCircle size={12}/> Paid</span>
                              : pay === "Pending"
                              ? <span className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize:12 }}><Clock size={12}/> Pending</span>
                              : <StatusPill label="Overdue" variant="red"/>
                            }
                          </td>

                          {/* Approvals — Pending tab only */}
                          {tab === "pending" && (
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await approveEnrollment(s.id);
                                      await refresh();
                                      toast.success(`${s.name} approved and moved to Onboarded`);
                                    } catch {
                                      toast.error("Failed to approve enrollment");
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 text-white font-medium hover:opacity-90 transition-opacity shadow-sm"
                                  style={{ fontSize:12, boxShadow:"0 2px 6px rgba(34,197,94,0.3)" }}>
                                  <CheckCircle size={12}/> Approve
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Reject enrollment for ${s.name}? This moves them to Deleted.`)) return;
                                    try {
                                      await cancelEnrollment(s.id);
                                      await refresh();
                                      toast.success(`${s.name} rejected and moved to Deleted`);
                                    } catch {
                                      toast.error("Failed to reject enrollment");
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500 text-white font-medium hover:opacity-90 transition-opacity shadow-sm"
                                  style={{ fontSize:12, boxShadow:"0 2px 6px rgba(239,68,68,0.3)" }}>
                                  <X size={12}/> Reject
                                </button>
                              </div>
                            </td>
                          )}

                          {/* Actions */}
                          <td className="px-5 py-3.5">
                            {tab === "deleted" ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await restoreEnrollment(s.id);
                                      await refresh();
                                      toast.success(`${s.name} restored to Pending`);
                                    } catch {
                                      toast.error("Failed to restore enrollment");
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-medium transition-colors" style={{ fontSize:12 }}>
                                  <RotateCcwIcon size={12}/> Restore
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Permanently delete ${s.name}'s enrollment? This cannot be undone.`)) return;
                                    try {
                                      await hardDeleteEnrollment(s.id);
                                      await refresh();
                                      toast.success(`${s.name}'s record permanently deleted`);
                                    } catch {
                                      toast.error("Failed to delete enrollment");
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium transition-colors" style={{ fontSize:12 }}>
                                  <TrashIcon size={12}/> Delete
                                </button>
                              </div>
                            ) : (
                              <ActionMenu s={s}
                                onMail={() => setMailTarget(s)}
                                onSchedule={() => setSchedTarget(s)}
                                onMovePending={tab === "enrolled" ? async () => {
                                  try {
                                    await restoreEnrollment(s.id);
                                    await refresh();
                                    toast.success(`${s.name} moved back to Pending`);
                                  } catch {
                                    toast.error("Failed to move to Pending");
                                  }
                                } : undefined}
                                onDelete={tab === "enrolled" ? async () => {
                                  if (!confirm(`Move ${s.name} to Deleted?`)) return;
                                  try {
                                    await cancelEnrollment(s.id);
                                    await refresh();
                                    toast.success(`${s.name} moved to Deleted`);
                                  } catch {
                                    toast.error("Failed to delete enrollment");
                                  }
                                } : undefined}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
                <span style={{ fontSize:12 }} className="text-muted-foreground">
                  {(page-1)*PER+1}–{Math.min(page*PER,list.length)} of {list.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1}
                    className="size-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground">‹</button>
                  {Array.from({length:Math.min(5,totalPages)},(_,i)=>i+1).map(p=>(
                    <button key={p} onClick={()=>setPage(p)}
                      className={`size-8 rounded-full flex items-center justify-center transition-all ${p===page?"bg-primary text-white font-bold":"border border-border text-muted-foreground hover:bg-muted"}`}
                      style={{ fontSize:12 }}>{p}</button>
                  ))}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                    className="size-8 rounded-full border border-border flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors text-muted-foreground">›</button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>

      {mailTarget  && <MailModal         s={mailTarget}  templates={templates} plans={plans} onClose={async()=>{ setMailTarget(null); await refresh(); }}/>}
      {schedTarget && <ScheduleMailModal s={schedTarget} templates={templates} plans={plans} onClose={()=>setSchedTarget(null)}/>}
    </div>
  );
}
