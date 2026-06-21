import { useEffect, useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle } from "lucide-react";
import logoImg from "@/public/Logo_lws.png";
import {
  getAdminProfile,
  getSession,
  onAuthStateChange,
  signIn,
  type AdminProfile,
} from "../../services/authService";

interface Props { onLogin: (email: string) => void; }

const FEATURES = [
  "Track onboardings across all plans in one view",
  "Schedule sessions and auto-notify students",
  "Send templated emails with merge fields",
  "Revenue analytics with growth predictions",
];

export function Login({ onLogin }: Props) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [admin,    setAdmin]    = useState<AdminProfile | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = await getSession();
        if (!active || !session) {
          setChecking(false);
          return;
        }
        const profile = await getAdminProfile();
        if (!active) return;
        setAdmin(profile);
      } catch {
        setAdmin(null);
      } finally {
        if (active) setChecking(false);
      }
    }

    load();
    const sub = onAuthStateChange(async (sessionPresent) => {
      if (!sessionPresent) {
        setAdmin(null);
        return;
      }
      const profile = await getAdminProfile().catch(() => null);
      setAdmin(profile);
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      const profile = await getAdminProfile();
      setAdmin(profile);
      onLogin(profile?.email ?? email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  const initials = admin?.email
    ? admin.email.split("@")[0].slice(0, 2).toUpperCase()
    : "AD";

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={{ fontFamily:"'Inter','DM Sans',system-ui,sans-serif" }}>
        <div className="flex items-center gap-3 text-foreground">
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"/>
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          Checking admin access…
        </div>
      </div>
    );
  }

  if (admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" style={{ fontFamily:"'Inter','DM Sans',system-ui,sans-serif" }}>
        <div className="w-full max-w-sm rounded-3xl p-6 border border-border bg-card text-center" style={{ boxShadow:"var(--shadow-card)" }}>
          <div className="size-14 mx-auto rounded-2xl flex items-center justify-center text-white font-bold mb-4"
            style={{ background:"linear-gradient(135deg,#1A2AF1,#5B3FFF)", fontSize:18 }}>
            {initials}
          </div>
          <h1 className="text-foreground font-bold text-xl mb-2">Admin access confirmed</h1>
          <p className="text-muted-foreground text-sm mb-6">{admin.email} · {admin.role}</p>
          <button onClick={() => onLogin(admin?.email ?? "")}
            className="w-full py-3 rounded-2xl text-white font-semibold"
            style={{ background:"linear-gradient(135deg,#1A2AF1 0%,#3D4FFF 100%)", boxShadow:"0 4px 20px rgba(26,42,241,0.35)" }}>
            Open Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex" style={{ fontFamily:"'Inter','DM Sans',system-ui,sans-serif" }}>

      {/* ── LEFT panel — brand ───────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] p-12 relative overflow-hidden"
        style={{ background:"linear-gradient(145deg,#0B1499 0%,#1A2AF1 45%,#3D4FFF 80%,#6270FF 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 size-96 rounded-full opacity-20"
            style={{ background:"radial-gradient(circle,#fff 0%,transparent 70%)" }}/>
          <div className="absolute bottom-20 -left-20 size-72 rounded-full opacity-10"
            style={{ background:"radial-gradient(circle,#fff 0%,transparent 70%)" }}/>
          <div className="absolute top-1/2 left-1/3 size-[500px] rounded-full opacity-5"
            style={{ background:"radial-gradient(circle,#fff 0%,transparent 70%)", transform:"translate(-50%,-50%)" }}/>
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
          </svg>
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <img src={logoImg} alt="LearnWithSanu" className="h-11 w-auto object-contain" style={{ filter:"brightness(0) invert(1)" }}/>
        </div>

        {/* Hero text */}
        <div className="relative">
          <h1 className="text-white leading-tight mb-4" style={{ fontSize:42, fontWeight:800, lineHeight:1.1 }}>
            Everything you need to<br/>
            <span className="text-white/70">run your coaching</span><br/>
            business.
          </h1>
          <p className="text-white/60 mb-10 leading-relaxed" style={{ fontSize:15, maxWidth:380 }}>
            Manage enrollments, sessions, communications, and earnings — all in one elegant workspace.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-3">
            {FEATURES.map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="size-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={12} className="text-white"/>
                </div>
                <p style={{ fontSize:13 }} className="text-white/75">{f}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative"/>
      </div>

      {/* ── RIGHT panel — login form ─────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src={logoImg} alt="LearnWithSanu" className="h-9 w-auto object-contain"/>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 style={{ fontSize:28 }} className="text-foreground">Welcome back 👋</h1>
            <p style={{ fontSize:14 }} className="text-muted-foreground mt-1.5">Sign in to your coaching dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Email */}
            <div>
              <label className="block mb-2 font-semibold text-foreground" style={{ fontSize:13 }}>Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <input
                  type="email"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  placeholder="coach@example.com"
                  className="w-full bg-card border border-border rounded-2xl pl-11 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all"
                  style={{ fontSize:14, boxShadow:"var(--shadow-sm)" }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-2">
                <label className="font-semibold text-foreground" style={{ fontSize:13 }}>Password</label>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-card border border-border rounded-2xl pl-11 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all"
                  style={{ fontSize:14, boxShadow:"var(--shadow-sm)" }}
                />
                <button type="button" onClick={()=>setShow(s=>!s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {show ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400" style={{ fontSize:13 }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-white font-semibold transition-all disabled:opacity-70 mt-1"
              style={{
                fontSize:15,
                background: loading
                  ? "#1A2AF1"
                  : "linear-gradient(135deg,#1A2AF1 0%,#3D4FFF 100%)",
                boxShadow: loading ? "none" : "0 4px 20px rgba(26,42,241,0.35)",
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={16}/>
                </>
              )}
            </button>
            {/* Footer note */}
            <p style={{ fontSize:12 }} className="text-muted-foreground text-center mt-1">
              Internal tool · Access restricted to authorised coaches only
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
