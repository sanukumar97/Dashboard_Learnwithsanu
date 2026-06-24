import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarClock, Mail, ClipboardList, BarChart2,
  Search, Sun, Moon, ChevronDown, Menu, X,
  DollarSign, Settings2, LogOut, Calendar, Lock, Star,
} from "lucide-react";
import logoImg from "@/public/Logo_lws.png";
import { Sessions }       from "./components/Sessions";
import { Communications } from "./components/Communications";
import { Enrollment }     from "./components/Enrollment";
import { Analytics }      from "./components/Analytics";
import { Earnings }       from "./components/Earnings";
import { Feedback }       from "./components/Feedback";
import { SetPlans }       from "./components/SetPlans";
import { Login }          from "./components/Login";
import { StudentProfile } from "./components/StudentProfile";
import { type Student }   from "./data/liveDashboard";
import { fetchActivePlansAdmin } from "../services/planService";
import { fetchEnrollmentsAdmin } from "../services/enrollmentService";
import { signOut, getSession, onAuthStateChange } from "../services/authService";

type Tab = "sessions" | "communication" | "enrollment" | "analytics" | "earnings" | "feedback";

const NAV: { id: Tab; label: string; icon: any; emoji?: string }[] = [
  { id:"sessions",      label:"Sessions",      icon:CalendarClock },
  { id:"communication", label:"Communication", icon:Mail },
  { id:"analytics",     label:"Analytics",     icon:BarChart2 },
  { id:"feedback",      label:"Feedback",      icon:Star },
  { id:"earnings",      label:"Revenue",       icon:DollarSign, emoji:"👑" },
  { id:"enrollment",    label:"Onboarding",    icon:ClipboardList },
];

const FALLBACK_PLANS = ["All Plans","ai-chatbot","roadmap","portfolio","interview","flex","pro","core"];

function formatSlug(slug: string) {
  if (slug === "All Plans") return slug;
  return slug.split("-").map(w => w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
const YEARS = ["2026","2025","2024","2023","All Time"];

function nameFromEmail(email: string) {
  const local = email.split("@")[0];
  const stripped = local.replace(/\d+$/, "");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
function initialsFromEmail(email: string) {
  const local = email.split("@")[0].replace(/\d+$/, "");
  return local.slice(0, 2).toUpperCase();
}

/* ── Logo ──────────────────────────────────────────────────── */
function Logo() {
  return (
    <img src={logoImg} alt="LearnWithSanu" className="h-9 w-auto object-contain flex-shrink-0"/>
  );
}

/* ── Rupee nav icon ────────────────────────────────────────── */
function RupeeNavIcon({ active }: { active: boolean }) {
  return (
    <div className={`size-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${active ? "bg-white/20" : "bg-muted group-hover:bg-accent"}`}>
      <span style={{ fontSize:13, fontWeight:400, lineHeight:1, fontFamily:"Arial,sans-serif" }}
        className={active ? "text-white" : "text-muted-foreground group-hover:text-primary"}>₹</span>
    </div>
  );
}

/* ── Revenue password gate ─────────────────────────────────── */
const REVENUE_PASSWORD = import.meta.env.VITE_REVENUE_PASSWORD as string;

function RevenueGate({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pw, setPw]       = useState("");
  const [show, setShow]   = useState(false);
  const [error, setError] = useState(false);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === REVENUE_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
      setPw("");
      setTimeout(() => setError(false), 1800);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-3xl bg-card border border-border p-7"
        style={{ boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}>
        <div className="flex flex-col items-center gap-1 mb-6">
          <div className="size-12 rounded-2xl flex items-center justify-center mb-2"
            style={{ background:"linear-gradient(135deg,#1A2AF1 0%,#3D4FFF 100%)" }}>
            <Lock size={20} className="text-white"/>
          </div>
          <h2 className="font-bold text-foreground" style={{ fontSize:17 }}>Revenue Access</h2>
          <p className="text-muted-foreground text-center" style={{ fontSize:13 }}>
            Enter the password to view revenue data
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="Enter password"
              className={`w-full bg-background border rounded-2xl px-4 pr-11 py-3 outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all ${error ? "border-red-400 ring-2 ring-red-300" : "border-border"}`}
              style={{ fontSize:14 }}
            />
            <button type="button" onClick={() => setShow(s => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {show
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {error && <p className="text-red-500 text-center" style={{ fontSize:12 }}>Incorrect password. Try again.</p>}
          <button type="submit"
            className="w-full py-3 rounded-2xl text-white font-semibold transition-all"
            style={{ background:"linear-gradient(135deg,#1A2AF1 0%,#3D4FFF 100%)", boxShadow:"0 4px 20px rgba(26,42,241,0.3)", fontSize:14 }}>
            Unlock Revenue
          </button>
          <button type="button" onClick={onCancel}
            className="w-full py-2.5 rounded-2xl text-muted-foreground hover:text-foreground transition-colors"
            style={{ fontSize:13 }}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authChecking,   setAuthChecking]   = useState(true);
  const [loggedIn,       setLoggedIn]       = useState(false);
  const [adminEmail,     setAdminEmail]     = useState("");
  const [dark,           setDark]           = useState(false);
  const [tab,            setTab]            = useState<Tab>("enrollment");
  const [plan,           setPlan]           = useState("All Plans");
  const [year,           setYear]           = useState("All Time");
  const [planOptions,    setPlanOptions]    = useState<string[]>(FALLBACK_PLANS);
  const [sidebarOpen,    setSidebar]        = useState(false);
  const [search,         setSearch]         = useState("");
  const [setPlansOpen,   setSetPlansOpen]   = useState(false);
  const [profileStudent, setProfileStudent] = useState<Student|null>(null);
  const [revenueUnlocked, setRevenueUnlocked] = useState(false);
  const [revenueGate,     setRevenueGate]     = useState(false);

  const selfManagedHeader = tab === "sessions" || tab === "communication" || tab === "enrollment" || tab === "feedback" || tab === "earnings";
  const showFilters = tab !== "feedback";

  // Restore session on mount so a page refresh doesn't force re-login
  useEffect(() => {
    getSession()
      .then(session => {
        if (session?.user?.email) {
          setAdminEmail(session.user.email);
          setLoggedIn(true);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecking(false));

    // Sign out if the session is revoked in another tab
    const sub = onAuthStateChange(present => {
      if (!present) { setLoggedIn(false); setAdminEmail(""); }
    });
    return () => sub.unsubscribe();
  }, []);

  const loadPlanOptions = useCallback(() => {
    Promise.all([fetchActivePlansAdmin(), fetchEnrollmentsAdmin()])
      .then(([activePlans, enrollments]) => {
        // Only keep plans that have at least one approved (admin-approved) student
        const approvedSlugs = new Set(
          enrollments
            .filter(e => e.dbStatus === "submitted" && !!e.adminApprovedAt)
            .map(e => e.planSlug)
            .filter(Boolean)
        );
        const slugs = activePlans
          .map(p => p.slug)
          .filter(slug => approvedSlugs.has(slug));
        setPlanOptions(["All Plans", ...slugs]);
      })
      .catch(() => setPlanOptions(FALLBACK_PLANS));
  }, []);

  useEffect(() => { loadPlanOptions(); }, [loadPlanOptions]);

  // Sync dark class + color-scheme to <html> so native browser controls (date/time picker icons) adapt
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);

  if (authChecking) {
    return (
      <div className={dark?"dark":""} style={{ height:"100dvh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--background)" }}>
        <div style={{ width:32, height:32, borderRadius:"50%", border:"3px solid var(--border)", borderTopColor:"var(--primary)", animation:"spin 0.7s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className={dark?"dark":""}>
        <Login onLogin={(email) => { setAdminEmail(email); setLoggedIn(true); }}/>
      </div>
    );
  }

  return (
    <div className={dark?"dark":""} style={{ height:"100dvh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div className="flex flex-col h-full bg-background">

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header
          className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-3 bg-card border-b border-border"
          style={{ zIndex:50, position:"relative", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}
        >
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button className="lg:hidden p-2 rounded-xl hover:bg-muted transition-colors" onClick={() => setSidebar(o=>!o)}>
              {sidebarOpen ? <X size={18} className="text-muted-foreground"/> : <Menu size={18} className="text-muted-foreground"/>}
            </button>
            <Logo/>
          </div>

          {/* Center: search */}
          <div className="flex-1 max-w-sm hidden sm:flex items-center gap-2.5 bg-muted border border-border rounded-full px-4 py-2">
            <Search size={14} className="text-muted-foreground flex-shrink-0"/>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search students…"
              className="bg-transparent outline-none text-foreground placeholder:text-muted-foreground w-full"
              style={{ fontSize:13 }}
            />
          </div>

          {/* Right: Theme · Profile · Year */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Theme */}
            <button onClick={() => setDark(d=>!d)}
              className="size-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
              {dark ? <Sun size={16} className="text-amber-400"/> : <Moon size={16} className="text-muted-foreground"/>}
            </button>

            {/* Profile */}
            <button className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-muted transition-colors border border-border">
              <div
                className="size-8 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ background:"linear-gradient(135deg,#1A2AF1,#5B3FFF)", fontSize:12 }}
              >
                {adminEmail ? initialsFromEmail(adminEmail) : "AD"}
              </div>
              <div className="hidden md:block text-left leading-none">
                <p style={{ fontSize:12 }} className="font-semibold text-foreground">
                  {adminEmail ? nameFromEmail(adminEmail) : "Admin"}
                </p>
                <p style={{ fontSize:10 }} className="text-muted-foreground">Admin</p>
              </div>
            </button>

            {/* Logout */}
            <button onClick={async () => { await signOut().catch(() => {}); setLoggedIn(false); }}
              className="size-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors border border-border"
              title="Sign out">
              <LogOut size={15} className="text-muted-foreground"/>
            </button>

            {/* Year selector — in header right per reference */}
            <div className="hidden sm:flex items-center gap-1.5 border border-border rounded-xl px-3 py-1.5 bg-muted ml-1">
              <Calendar size={13} className="text-muted-foreground flex-shrink-0"/>
              <select
                value={year} onChange={e => setYear(e.target.value)}
                className="bg-transparent outline-none text-foreground font-medium appearance-none cursor-pointer"
                style={{ fontSize:12 }}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown size={11} className="text-muted-foreground"/>
            </div>
          </div>
        </header>

        {/* ── BODY ───────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Mobile overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebar(false)}/>
          )}

          {/* ── SIDEBAR ─────────────────────────────────────── */}
          <aside
            className={`
              flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border
              fixed lg:relative inset-y-0 left-0 z-40 lg:z-auto
              transition-transform duration-300 ease-in-out
              ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
            style={{ width:220 }}
          >
            {/* Nav items */}
            <nav className="flex flex-col gap-0.5 px-3 pt-[68px] lg:pt-4 flex-1">
              {NAV.map(({ id, label, icon: Icon, emoji }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (id === "earnings" && !revenueUnlocked) {
                        setRevenueGate(true);
                      } else {
                        setTab(id);
                        setSidebar(false);
                      }
                    }}
                    className={`
                      flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left w-full
                      transition-all duration-150 group
                      ${active
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }
                    `}
                  >
                    {id === "earnings" ? (
                      <RupeeNavIcon active={active}/>
                    ) : (
                      <div className={`size-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${active ? "bg-white/20" : "bg-muted group-hover:bg-accent"}`}>
                        <Icon size={14} className={active ? "text-white" : "text-muted-foreground group-hover:text-primary"}/>
                      </div>
                    )}
                    <span style={{ fontSize:13 }} className="font-medium flex-1">{label}</span>
                    {emoji && <span style={{ fontSize:14 }}>{emoji}</span>}
                    {active && <div className="size-1.5 rounded-full bg-white/60"/>}
                  </button>
                );
              })}
            </nav>

            {/* ── Set Plans CTA ──────────────────────────────── */}
            <div className="px-3 pb-5">
              <button
                onClick={() => setSetPlansOpen(true)}
                className="w-full flex flex-col gap-2 px-4 py-3.5 rounded-2xl text-left relative overflow-hidden"
                style={{
                  background:"linear-gradient(135deg,#1A2AF1 0%,#4D5EFF 100%)",
                  boxShadow:"0 4px 16px rgba(26,42,241,0.35)",
                }}
              >
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage:"radial-gradient(circle at 80% 20%, white 0%, transparent 60%)" }}/>
                <div className="relative flex items-center justify-between">
                  <div className="size-7 rounded-lg bg-white/20 flex items-center justify-center">
                    <Settings2 size={13} className="text-white"/>
                  </div>
                  <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
                    <span className="size-1.5 rounded-full bg-emerald-400"/>
                    <span style={{ fontSize:10 }} className="text-white/80 font-medium">Active</span>
                  </div>
                </div>
                <div className="relative">
                  <p style={{ fontSize:13 }} className="font-bold text-white">Set Plans</p>
                  <p style={{ fontSize:11 }} className="text-white/65 mt-0.5">Create · Duration · Expiry · Limits</p>
                </div>
              </button>
            </div>
          </aside>

          {/* ── RIGHT PANEL ─────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* Plan filter bar — only when filters relevant, year is now in header */}
            {showFilters && (
              <div
                className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-card border-b border-border overflow-x-auto"
                style={{ boxShadow:"0 1px 4px rgba(0,0,0,0.04)", scrollbarWidth:"none" }}
              >
                {planOptions.map(p => (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`
                      flex-shrink-0 px-4 py-1.5 rounded-full transition-all font-medium border
                      ${plan === p
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      }
                    `}
                    style={{ fontSize:13 }}
                  >
                    {formatSlug(p)}
                  </button>
                ))}
              </div>
            )}

            {/* Section title — only for self-managed tabs that don't render their own */}
            {!selfManagedHeader && (
              <div className="flex-shrink-0 px-5 pt-4 pb-1 flex items-center gap-2">
                <h2 className="text-foreground">{NAV.find(n => n.id === tab)?.label}</h2>
                {NAV.find(n => n.id === tab)?.emoji && (
                  <span style={{ fontSize:18 }}>{NAV.find(n => n.id === tab)?.emoji}</span>
                )}
                {plan !== "All Plans" && showFilters && (
                  <span className="inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border" style={{ fontSize:11 }}>
                    {formatSlug(plan)}
                    <button onClick={() => setPlan("All Plans")} className="hover:text-destructive">✕</button>
                  </span>
                )}
              </div>
            )}

            {/* Content */}
            <main className="flex-1 overflow-y-auto flex flex-col">
              {tab === "sessions"      && <Sessions      plan={plan} search={search} onStudentClick={setProfileStudent}/>}
              {tab === "communication" && <Communications plan={plan} search={search}/>}
              {tab === "enrollment"    && <Enrollment    year={year} plan={plan} search={search} onStudentClick={setProfileStudent}/>}
              {tab === "analytics"     && <Analytics     year={year} plan={plan} onStudentClick={setProfileStudent}/>}
              {tab === "earnings"      && <Earnings      year={year} plan={plan}/>}
              {tab === "feedback"      && <Feedback/>}
            </main>
          </div>
        </div>
      </div>

      {setPlansOpen   && <SetPlans        onClose={() => { setSetPlansOpen(false); loadPlanOptions(); }}/>}
      {profileStudent && <StudentProfile  student={profileStudent} onClose={() => setProfileStudent(null)}/>}
      {revenueGate    && <RevenueGate
        onSuccess={() => { setRevenueUnlocked(true); setRevenueGate(false); setTab("earnings"); setSidebar(false); }}
        onCancel={() => setRevenueGate(false)}
      />}
    </div>
  );
}
