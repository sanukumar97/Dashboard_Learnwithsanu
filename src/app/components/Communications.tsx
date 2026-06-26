import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Send, Edit2, Plus, Mail, CheckCircle, XCircle, FileText,
  Archive, RotateCcw, Trash2, CalendarClock, X,
} from "lucide-react";
import { useLiveEnrollments } from "../hooks/useLiveEnrollments";
import { fetchActivePlansAdmin, type AdminPlan } from "../../services/planService";
import {
  fetchEmailTemplates, upsertEmailTemplate, archiveEmailTemplate,
  restoreEmailTemplate, deleteEmailTemplate, type EmailTemplate,
} from "../../services/emailTemplateService";
import {
  fetchMailLog, fetchArchivedMailLog, sendMail, markMailLogSent, scheduleMail,
  archiveMailLogEntry, restoreMailLogEntry, deleteMailLogEntry, type MailLogEntry,
} from "../../services/mailLogService";
import { supabase } from "../../lib/supabase";
import { Avatar } from "./Avatar";

function CardWrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-3xl overflow-hidden ${className}`} style={{ boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/40">
        {cols.map(c => (
          <th key={c} className="text-left px-6 py-3" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
            <span className="font-semibold text-muted-foreground uppercase">{c}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

function preview(b: string) {
  return b
    .replace(/{{name}}/g, "Aisha Johnson")
    .replace(/{{plan}}/g, "Pro")
    .replace(/{{session_date}}/g, "2025-07-15")
    .replace(/{{session_time}}/g, "10:00");
}

export function Communications({ year = "All Time", plan = "All Plans", search = "" }: { year?: string; plan?: string; search?: string }) {
  const { students: allS } = useLiveEnrollments();

  const [plans, setPlans]          = useState<AdminPlan[]>([]);
  const [tpls, setTpls]           = useState<EmailTemplate[]>([]);
  const [log, setLog]             = useState<MailLogEntry[]>([]);
  const [archivedLog, setArchLog] = useState<MailLogEntry[]>([]);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editBody, setEB]         = useState("");
  const [editName, setEN]         = useState("");
  const [editDesc, setED]         = useState("");
  const [isNew, setIsNew]         = useState(false);
  const [selTpl,    setSelTpl]    = useState<Record<string, string>>({});
  const [schedDate, setSchedDate] = useState<Record<string, string>>({});
  const [schedTime, setSchedTime] = useState<Record<string, string>>({});
  const [schedTpl,  setSchedTpl]  = useState<Record<string, string>>({});
  const [flash, setFlash]         = useState<string | null>(null);
  const [activeTab, setATab]      = useState<"queue" | "templates" | "log">("queue");
  const [showArch, setShowArch]   = useState(false);
  const [showLogArch, setShowLogArch] = useState(false);
  const [sendingNow, setSendingNow]   = useState<Set<string>>(new Set());
  const [mailPage, setMailPage]       = useState(1);
  const MAIL_PAGE_SIZE = 20;

  const reloadLog = () => {
    fetchMailLog().then(setLog).catch(console.error);
    fetchArchivedMailLog().then(setArchLog).catch(console.error);
  };

  // Load templates + mail log + plans, subscribe to realtime
  useEffect(() => {
    fetchActivePlansAdmin().then(setPlans).catch(console.error);
    fetchEmailTemplates().then(setTpls).catch(console.error);
    reloadLog();

    const tplChannel = supabase.channel("comm-email-templates")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_templates" }, () => {
        fetchEmailTemplates().then(setTpls).catch(console.error);
      }).subscribe();

    const logChannel = supabase.channel("comm-mail-log")
      .on("postgres_changes", { event: "*", schema: "public", table: "mail_log" }, () => {
        reloadLog();
      }).subscribe();

    return () => {
      void supabase.removeChannel(tplChannel);
      void supabase.removeChannel(logChannel);
    };
  }, []);

  // Reset to page 1 whenever filters change
  useEffect(() => { setMailPage(1); }, [plan, search]);

  const q = search.trim().toLowerCase();
  const mailStudents = allS.filter(s =>
    s.dbStatus === "submitted" && !!s.adminApprovedAt &&
    (year === "All Time" || new Date(s.enrolledDate).getFullYear() === parseInt(year)) &&
    (plan === "All Plans" || s.planSlug === plan) &&
    (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  );
  const pendingCount = mailStudents.filter(s => {
    const isFree = s.planPrice === 0;
    return !isFree && !s.mailSent;
  }).length;
  const mailTotalPages = Math.max(1, Math.ceil(mailStudents.length / MAIL_PAGE_SIZE));
  const mailPageSafe = Math.min(mailPage, mailTotalPages);
  const mailPagedStudents = mailStudents.slice((mailPageSafe - 1) * MAIL_PAGE_SIZE, mailPageSafe * MAIL_PAGE_SIZE);

  const activeTpls = tpls.filter(t => !t.archived);

  async function handleSendMail(s: typeof allS[0]) {
    const tplName  = selTpl[s.id] || "";
    const tplEntry = activeTpls.find(t => t.name === tplName);
    if (!tplEntry) return;

    setFlash(s.id);
    try {
      const result = await sendMail({
        enrollmentId: s.id,
        to:           s.email,
        toName:       s.name,
        plan:         s.plan,
        sessionDate:  s.sessionDate,
        sessionTime:  s.sessionTime,
        templateBody: tplEntry.body,
        templateName: tplEntry.name,
      });
      if (!result.success) {
        toast.error(`Mail to ${s.name} failed — check Mail Log`);
        setFlash(null);
        return;
      }
      toast.success(`Mail sent to ${s.name}`);
    } catch (e) {
      console.error("sendMail failed:", e);
      toast.error("Mail send failed — please try again");
      setFlash(null);
      return;
    }
    setTimeout(() => setFlash(null), 2000);
    // allS will refresh via useLiveEnrollments realtime (mail_sent updated in DB by edge function)
  }

  async function handleScheduleMail(s: typeof allS[0]) {
    const tplName  = schedTpl[s.id]  || activeTpls[0]?.name || "";
    const tplEntry = activeTpls.find(t => t.name === tplName) ?? activeTpls[0];
    const date     = schedDate[s.id] || "";
    const time     = schedTime[s.id] || "09:00";
    if (!tplEntry) { toast.error("Please select a template"); return; }
    if (!date)     { toast.error("Please pick a date");       return; }
    try {
      await scheduleMail({
        enrollmentId:  s.id,
        sentTo:        s.name,
        email:         s.email,
        templateName:  tplEntry.name,
        body:          tplEntry.body,
        scheduledFor:  new Date(`${date}T${time}:00`).toISOString(),
      });
      // Reset all schedule fields and close the schedule form
      setSelTpl(p  => ({ ...p, [s.id]: "" }));
      setSchedTpl(p => ({ ...p, [s.id]: "" }));
      setSchedDate(p => ({ ...p, [s.id]: "" }));
      setSchedTime(p => ({ ...p, [s.id]: "09:00" }));
      reloadLog();
      toast.success(`Scheduled for ${new Date(`${date}T${time}:00`).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`);
    } catch(e) {
      console.error("scheduleMail failed:", e);
      toast.error("Failed to schedule mail — please try again");
    }
  }

  function openEdit(id: string) {
    const t = tpls.find(x => x.id === id)!;
    setEditId(id); setEB(t.body); setEN(t.name); setED(t.description); setIsNew(false);
  }
  function openNew() { setEditId("new"); setEB(""); setEN(""); setED(""); setIsNew(true); }

  const reloadTpls = () => fetchEmailTemplates().then(setTpls).catch(console.error);

  async function saveTpl() {
    const today = new Date().toISOString().slice(0, 10);
    if (isNew) {
      setTpls(prev => [...prev, { id: `tmp-${Date.now()}`, name: editName, description: editDesc, body: editBody, archived: false, lastEdited: today }]);
    } else {
      setTpls(prev => prev.map(t => t.id === editId ? { ...t, name: editName, description: editDesc, body: editBody, lastEdited: today } : t));
    }
    setEditId(null);
    try {
      await upsertEmailTemplate({ id: isNew ? undefined : editId!, name: editName, description: editDesc, body: editBody });
    } catch (e) { console.error("saveTpl failed:", e); }
    reloadTpls();
  }

  async function handleArchiveTpl(id: string) {
    setTpls(prev => prev.map(t => t.id === id ? { ...t, archived: true } : t));
    try { await archiveEmailTemplate(id); } catch (e) { console.error(e); reloadTpls(); }
  }
  async function handleRestoreTpl(id: string) {
    setTpls(prev => prev.map(t => t.id === id ? { ...t, archived: false } : t));
    try { await restoreEmailTemplate(id); } catch (e) { console.error(e); reloadTpls(); }
  }
  async function handleDeleteTpl(id: string) {
    setTpls(prev => prev.filter(t => t.id !== id));
    try { await deleteEmailTemplate(id); } catch (e) { console.error(e); reloadTpls(); }
  }
  async function handleRetry(entry: MailLogEntry) {
    try { await markMailLogSent(entry.id); } catch (e) { console.error(e); }
  }

  async function handleSendNow(entry: MailLogEntry) {
    if (sendingNow.has(entry.id)) return;
    const student = allS.find(s => s.id === entry.enrollmentId);
    // Bundle mails store their body directly; regular mails look up the template
    const tplEntry = tpls.find(t => t.name === entry.template && !t.archived) ?? tpls.find(t => t.name === entry.template);
    const body = entry.body ?? tplEntry?.body;
    if (!body) { alert("Template not found — it may have been archived or deleted."); return; }

    setSendingNow(prev => new Set(prev).add(entry.id));
    try {
      const result = await sendMail({
        enrollmentId:  entry.enrollmentId,
        to:            entry.email,
        toName:        entry.sentTo,
        plan:          student?.plan ?? "",
        sessionDate:   student?.sessionDate,
        sessionTime:   student?.sessionTime,
        templateBody:  body,
        templateName:  entry.template,
        grantAccess:   entry.template.startsWith("Bundle:"),
        existingLogId: entry.id,
      });
      if (result.success) {
        toast.success(`Mail sent to ${entry.sentTo}`);
      } else {
        toast.error("Mail send failed — check Mail Log for details");
      }
    } catch (e) {
      console.error("sendNow failed:", e);
      toast.error("Mail send failed — please try again");
    } finally {
      setSendingNow(prev => { const n = new Set(prev); n.delete(entry.id); return n; });
    }
  }


  const TABS: { id: "queue" | "templates" | "log"; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "queue",     label: "Mails",          icon: Mail,        count: pendingCount },
    { id: "log",       label: "Mail Log",       icon: CheckCircle },
    { id: "templates", label: "Mail Templates", icon: FileText },
  ];

  return (
    <div className="flex flex-col min-h-0">

      {/* ── STICKY HEADER ─────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-card border-b border-border"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground flex-shrink-0">Communication</h2>
            {plan !== "All Plans" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium"
                style={{ fontSize: 11 }}>
                <span className="size-1.5 rounded-full bg-primary" />{plan}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <button key={id} onClick={() => setATab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all font-medium ${activeTab === id ? "bg-primary text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                style={{ fontSize: 13 }}>
                <Icon size={14} />
                {label}
                {count !== undefined && count > 0 && (
                  <span className={`min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5 ${activeTab === id ? "bg-white/25 text-white" : "bg-primary/10 text-primary"}`}
                    style={{ fontSize: 11 }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">

        {/* ── MAILS (was Pending Queue) ──────────────────────────── */}
        {activeTab === "queue" && (
          <CardWrap>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-foreground">All Students</h3>
                <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">Send mails to enrolled students</p>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
                <span className="text-muted-foreground">{mailStudents.length} Students</span>
                {pendingCount > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                    {pendingCount} Bundle pending
                  </span>
                )}
              </div>
            </div>
            {mailStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Mail size={36} className="opacity-20" />
                <p style={{ fontSize: 13 }}>No enrolled students yet</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <THead cols={["Student", "Email", "Plan", "Enrolled", "Bundle Access", "Template", "Action"]} />
                  <tbody>
                    {mailPagedStudents.map(s => {
                      const sent = flash === s.id;
                      return (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar name={s.name} color={s.avatarColor} size="sm" />
                              <span style={{ fontSize: 13 }} className="font-semibold text-foreground whitespace-nowrap">{s.name}</span>
                              {s.planPrice === 0 && (
                                <span className="px-1.5 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 whitespace-nowrap" style={{ fontSize: 10 }}>
                                  Free
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground" style={{ fontSize: 12 }}>{s.email}</td>
                          <td className="px-6 py-3.5 text-foreground" style={{ fontSize: 13 }}>{s.plan}</td>
                          <td className="px-6 py-3.5 text-muted-foreground whitespace-nowrap" style={{ fontSize: 12 }}>{s.enrolledDate}</td>
                          <td className="px-6 py-3.5">
                            {s.planPrice === 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" style={{ fontSize: 11 }}>
                                <CheckCircle size={11} /> Free
                              </span>
                            ) : s.mailSent ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" style={{ fontSize: 11 }}>
                                <CheckCircle size={11} /> Granted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-medium dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800" style={{ fontSize: 11 }}>
                                <XCircle size={11} /> Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">
                            <select value={selTpl[s.id] ?? ""}
                              onChange={e => setSelTpl(p => ({ ...p, [s.id]: e.target.value }))}
                              className="bg-muted border border-border rounded-xl px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-primary text-foreground appearance-none" style={{ fontSize: 12 }}>
                              <option value="">Select template</option>
                              {activeTpls.map(t => (
                                <option key={t.id} value={t.name}>{t.name}</option>
                              ))}
                              <option disabled>──────────────</option>
                              <option value="__schedule__">📅 Schedule Mail</option>
                            </select>
                          </td>
                          <td className="px-6 py-3.5">
                            {selTpl[s.id] === "__schedule__" ? (
                              <div className="flex flex-col gap-1.5">
                                <select value={schedTpl[s.id] || ""}
                                  onChange={e => setSchedTpl(p => ({ ...p, [s.id]: e.target.value }))}
                                  className="bg-muted border border-border rounded-xl px-2 py-1 outline-none focus:ring-1 focus:ring-primary text-foreground appearance-none" style={{ fontSize: 11 }}>
                                  <option value="">Select template</option>
                                  {activeTpls.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                                <div className="flex gap-1">
                                  <input type="date" value={schedDate[s.id] || ""}
                                    onChange={e => setSchedDate(p => ({ ...p, [s.id]: e.target.value }))}
                                    className="bg-muted border border-border rounded-xl px-2 py-1 outline-none text-foreground flex-1" style={{ fontSize: 11 }}/>
                                  <input type="time" value={schedTime[s.id] || "09:00"}
                                    onChange={e => setSchedTime(p => ({ ...p, [s.id]: e.target.value }))}
                                    className="bg-muted border border-border rounded-xl px-2 py-1 outline-none text-foreground" style={{ fontSize: 11, width: 80 }}/>
                                </div>
                                <button onClick={() => handleScheduleMail(s)}
                                  className="px-3 py-1.5 rounded-full bg-primary text-white hover:opacity-90 transition-all"
                                  style={{ fontSize: 11 }}>
                                  Schedule
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => handleSendMail(s)}
                                disabled={!selTpl[s.id]}
                                className={`px-4 py-2 rounded-full transition-all ${sent ? "bg-emerald-500 text-white" : "bg-primary text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"}`}
                                style={{ fontSize: 12 }}>
                                {sent ? "Sent!" : "Send Mail"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {mailTotalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-border">
                  <span style={{ fontSize: 12 }} className="text-muted-foreground">
                    Showing {(mailPageSafe - 1) * MAIL_PAGE_SIZE + 1}–{Math.min(mailPageSafe * MAIL_PAGE_SIZE, mailStudents.length)} of {mailStudents.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setMailPage(p => Math.max(1, p - 1))}
                      disabled={mailPageSafe === 1}
                      className="px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      style={{ fontSize: 12 }}>
                      ← Prev
                    </button>
                    {Array.from({ length: mailTotalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setMailPage(p)}
                        className={`w-8 h-8 rounded-xl transition-colors ${p === mailPageSafe ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}
                        style={{ fontSize: 12 }}>
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setMailPage(p => Math.min(mailTotalPages, p + 1))}
                      disabled={mailPageSafe === mailTotalPages}
                      className="px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      style={{ fontSize: 12 }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardWrap>
        )}

        {/* ── MAIL LOG ──────────────────────────────────────────── */}
        {activeTab === "log" && (
          <CardWrap>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-foreground">Mail Log</h3>
              <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
                <span className="text-muted-foreground">{log.filter(l => l.status === "Scheduled").length} scheduled</span>
                <span className="text-muted-foreground">{log.length} total</span>
              </div>
            </div>
            {log.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Mail size={36} className="opacity-20" />
                <p style={{ fontSize: 13 }}>No emails yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <THead cols={["Sent To", "Template", "Date / Scheduled For", "Status", "Action"]} />
                  <tbody>
                    {log.map(l => (
                      <tr key={l.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                        l.status === "Failed"    ? "bg-red-50/30 dark:bg-red-950/10" :
                        l.status === "Scheduled" ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
                      }`}>
                        <td className="px-6 py-3.5">
                          <p style={{ fontSize: 13 }} className="font-semibold text-foreground">{l.sentTo}</p>
                          <p style={{ fontSize: 11 }} className="text-muted-foreground">{l.email}</p>
                        </td>
                        <td className="px-6 py-3.5 text-foreground" style={{ fontSize: 13 }}>{l.template}</td>
                        <td className="px-6 py-3.5 text-muted-foreground" style={{ fontSize: 12 }}>
                          {l.status === "Scheduled" && l.scheduledFor
                            ? new Date(l.scheduledFor).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                            : l.sentDate}
                        </td>
                        <td className="px-6 py-3.5">
                          {l.status === "Sent" && (
                            <div className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                              <CheckCircle size={13} className="text-emerald-500" />
                              <span className="text-emerald-600 font-medium">Sent</span>
                            </div>
                          )}
                          {l.status === "Failed" && (
                            <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
                              <div className="flex items-center gap-1.5">
                                <XCircle size={13} className="text-red-500" />
                                <span className="text-red-500 font-medium">Failed</span>
                              </div>
                              <button onClick={() => handleRetry(l)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                                style={{ fontSize: 11 }}>
                                Mark Resolved
                              </button>
                            </div>
                          )}
                          {l.status === "Scheduled" && (
                            <div className="flex items-center gap-3" style={{ fontSize: 12 }}>
                              <div className="flex items-center gap-1.5">
                                <CalendarClock size={13} className="text-blue-500" />
                                <span className="text-blue-600 font-medium dark:text-blue-400">Scheduled</span>
                              </div>
                              <button
                                onClick={() => handleSendNow(l)}
                                disabled={sendingNow.has(l.id)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ fontSize: 11 }}>
                                <Send size={10} /> {sendingNow.has(l.id) ? "Sending…" : "Send Now"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={async () => {
                              setLog(prev => prev.filter(e => e.id !== l.id));
                              try { await archiveMailLogEntry(l.id); reloadLog(); } catch (e) {
                                console.error(e); reloadLog();
                              }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 dark:hover:bg-amber-950/30 dark:hover:text-amber-400 transition-colors"
                            style={{ fontSize: 11 }}
                            title="Archive entry">
                            <Archive size={11} /> Archive
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Archived mail log */}
            {archivedLog.length > 0 && (
              <div className="px-6 pb-5">
                <button
                  onClick={() => setShowLogArch(v => !v)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-3"
                  style={{ fontSize: 13 }}>
                  <Archive size={14} className="text-amber-500" />
                  Archived ({archivedLog.length})
                  <span style={{ fontSize: 11 }}>{showLogArch ? "▲" : "▼"}</span>
                </button>
                {showLogArch && (
                  <div className="overflow-x-auto rounded-2xl border border-dashed border-border">
                    <table className="w-full">
                      <THead cols={["Sent To", "Template", "Date", "Status", "Actions"]} />
                      <tbody>
                        {archivedLog.map(l => (
                          <tr key={l.id} className="border-b border-border last:border-0 opacity-60 hover:opacity-80 transition-opacity">
                            <td className="px-6 py-3">
                              <p className="text-foreground" style={{ fontSize: 13 }}>{l.sentTo}</p>
                              <p className="text-muted-foreground" style={{ fontSize: 11 }}>{l.email}</p>
                            </td>
                            <td className="px-6 py-3 text-foreground" style={{ fontSize: 13 }}>{l.template}</td>
                            <td className="px-6 py-3 text-muted-foreground" style={{ fontSize: 12 }}>{l.sentDate}</td>
                            <td className="px-6 py-3 text-muted-foreground" style={{ fontSize: 12 }}>{l.status}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    setArchLog(prev => prev.filter(e => e.id !== l.id));
                                    try { await restoreMailLogEntry(l.id); reloadLog(); } catch (e) {
                                      console.error(e); reloadLog();
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
                                  style={{ fontSize: 11 }}>
                                  <RotateCcw size={10} /> Restore
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm("Permanently delete this mail log entry?")) return;
                                    setArchLog(prev => prev.filter(e => e.id !== l.id));
                                    try { await deleteMailLogEntry(l.id); } catch (e) {
                                      console.error(e); reloadLog();
                                    }
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                  style={{ fontSize: 11 }}>
                                  <Trash2 size={10} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardWrap>
        )}

        {/* ── MAIL TEMPLATES ────────────────────────────────────── */}
        {activeTab === "templates" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <button onClick={openNew}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-white hover:opacity-90 transition-opacity" style={{ fontSize: 13 }}>
                <Plus size={14} /> New Template
              </button>
            </div>

            {editId && (
              <CardWrap>
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-foreground">{isNew ? "Create Template" : "Edit Template"}</h3>
                </div>
                <div className="p-6 flex flex-col gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 12 }}>Template Name</label>
                      <input value={editName} onChange={e => setEN(e.target.value)}
                        className="w-full bg-muted border border-border rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize: 13 }} />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 12 }}>Description</label>
                      <input value={editDesc} onChange={e => setED(e.target.value)}
                        className="w-full bg-muted border border-border rounded-2xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-foreground" style={{ fontSize: 13 }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 12 }}>
                        Body —{" "}
                        <code className="bg-secondary text-primary px-1 rounded" style={{ fontSize: 11 }}>{"{{name}}"}</code>{" "}
                        <code className="bg-secondary text-primary px-1 rounded" style={{ fontSize: 11 }}>{"{{plan}}"}</code>{" "}
                        <code className="bg-secondary text-primary px-1 rounded" style={{ fontSize: 11 }}>{"{{session_date}}"}</code>
                      </label>
                      <textarea value={editBody} onChange={e => setEB(e.target.value)}
                        className="w-full bg-muted border border-border rounded-2xl px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-primary text-foreground font-mono" style={{ fontSize: 12 }} rows={10} />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-muted-foreground" style={{ fontSize: 12 }}>Live Preview</label>
                      <div className="bg-muted rounded-2xl px-4 py-3 min-h-[200px] whitespace-pre-wrap leading-relaxed text-foreground" style={{ fontSize: 13 }}>
                        {preview(editBody) || <span className="text-muted-foreground italic">Start typing to preview…</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveTpl} className="px-6 py-2.5 rounded-full bg-primary text-white hover:opacity-90" style={{ fontSize: 13 }}>Save Template</button>
                    <button onClick={() => setEditId(null)} className="px-6 py-2.5 rounded-full border border-border text-muted-foreground hover:bg-muted" style={{ fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              </CardWrap>
            )}

            {/* Active templates grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeTpls.map(t => (
                <div key={t.id} className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate" style={{ fontSize: 14 }}>{t.name}</p>
                      <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => openEdit(t.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors" style={{ fontSize: 12 }}>
                        <Edit2 size={11} /> Edit
                      </button>
                      <button onClick={() => handleArchiveTpl(t.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-amber-200 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors" style={{ fontSize: 12 }}>
                        <Archive size={11} /> Archive
                      </button>
                    </div>
                  </div>
                  <div className="bg-muted rounded-2xl p-3.5 text-muted-foreground whitespace-pre-wrap line-clamp-4 leading-relaxed" style={{ fontSize: 11 }}>
                    {t.body.slice(0, 200)}…
                  </div>
                  <p style={{ fontSize: 11 }} className="text-muted-foreground mt-2">Last edited: {t.lastEdited}</p>
                </div>
              ))}
            </div>

            {/* Archived templates */}
            {tpls.some(t => t.archived) && (
              <div>
                <button onClick={() => setShowArch(v => !v)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-3"
                  style={{ fontSize: 13 }}>
                  <Archive size={14} className="text-amber-500" />
                  Archived Templates ({tpls.filter(t => t.archived).length})
                  <span style={{ fontSize: 11 }}>{showArch ? "▲" : "▼"}</span>
                </button>
                {showArch && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tpls.filter(t => t.archived).map(t => (
                      <div key={t.id} className="bg-muted/40 rounded-2xl p-4 border border-dashed border-border opacity-75">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <p className="font-semibold text-foreground" style={{ fontSize: 13 }}>{t.name}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => handleRestoreTpl(t.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors" style={{ fontSize: 11 }}>
                              <RotateCcw size={10} /> Restore
                            </button>
                            <button onClick={() => handleDeleteTpl(t.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" style={{ fontSize: 11 }}>
                              <Trash2 size={10} /> Delete
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: 11 }} className="text-muted-foreground">{t.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
