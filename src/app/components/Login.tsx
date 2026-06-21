import { useEffect, useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle } from "lucide-react";
import logoImg from "@/public/Logo_lws.png";
import {
  getAdminProfile,
  getSession,
  onAuthStateChange,
  signIn,
  signInWithGoogle,
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

  async function handleGoogle() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google sign in.");
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
          <img src={logoImg} alt="LearnWithSanu" className="h-11 w-auto object-contain"/>
        </div>

        {/* Hero text */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-3.5 py-1.5 mb-6 backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"/>
            <span style={{ fontSize:12 }} className="text-white/90 font-medium">Internal Dashboard · v1.0</span>
          </div>
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

        {/* Bottom stats */}
        <div className="relative flex items-center gap-8">
          {[["256","Active Students"],["98%","Session Rate"],["$48k","Monthly Revenue"]].map(([n,l])=>(
            <div key={l}>
              <p className="font-bold text-white" style={{ fontSize:22 }}>{n}</p>
              <p style={{ fontSize:11 }} className="text-white/50">{l}</p>
            </div>
          ))}
        </div>
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
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-foreground" style={{ fontSize:13 }}>Password</label>
                <button type="button" className="text-primary hover:opacity-80 transition-opacity" style={{ fontSize:12 }}>
                  Forgot password?
                </button>
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
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border"/>
            <span style={{ fontSize:12 }} className="text-muted-foreground">or continue with</span>
            <div className="flex-1 h-px bg-border"/>
          </div>

          {/* Google SSO */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:bg-secondary transition-all disabled:opacity-50"
            style={{ fontSize:14, boxShadow:"var(--shadow-sm)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          {/* Footer note */}
          <p style={{ fontSize:12 }} className="text-muted-foreground text-center mt-8">
            Internal tool · Access restricted to authorised coaches only
          </p>
        </div>
      </div>
    </div>
  );
}
