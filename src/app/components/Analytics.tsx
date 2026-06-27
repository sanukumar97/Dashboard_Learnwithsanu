import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Users, UserCheck, CalendarClock, Mail, TrendingUp, TrendingDown } from "lucide-react";
import { useLiveEnrollments } from "../hooks/useLiveEnrollments";
import { fetchAllPlansAdmin, type AdminPlan } from "../../services/planService";
import { type Student, MONTHLY_LABELS } from "../data/liveDashboard";

const PALETTE = ["#3B5BFF","#8B5CF6","#22C55E","#F59E0B","#EF4444","#06B6D4","#F43F5E","#84CC16"];

function cellCount(students: Student[], slug: string, mi: number, yr?: number) {
  return students.filter(s => {
    const d = new Date(s.enrolledDate);
    return (yr === undefined || d.getFullYear() === yr) && d.getMonth() === mi && s.planSlug === slug;
  }).length;
}
function heatBg(v: number, max: number) {
  if (!v) return "var(--muted)";
  const t = v / max;
  if (t < 0.25) return "#EEF1FF"; if (t < 0.5) return "#C7D0FF"; if (t < 0.75) return "#7E9BFF";
  return "#3B5BFF";
}
function heatFg(v: number, max: number) { return v / max > 0.5 ? "#fff" : "var(--foreground)"; }

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-2.5" style={{ boxShadow: "var(--shadow-card)" }}>
      <p style={{ fontSize: 11 }} className="text-muted-foreground">{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ fontSize: 13, color: p.color }} className="font-semibold">{p.name}: {p.value}</p>)}
    </div>
  );
};

function KpiCard({ title, value, sub, trend, icon: Icon, accent }: {
  title: string; value: number | string; sub: string;
  trend?: "up" | "down" | "neutral"; icon: any; accent: string;
}) {
  return (
    <div className="bg-card rounded-3xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between">
        <p style={{ fontSize: 11, letterSpacing: "0.06em" }} className="font-semibold text-muted-foreground uppercase">{title}</p>
        <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: accent + "18" }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
      <div>
        <p className="font-bold text-foreground" style={{ fontSize: 32, lineHeight: 1 }}>{value}</p>
        <div className="flex items-center gap-1.5 mt-2">
          {trend === "up"   && <TrendingUp  size={13} className="text-emerald-500" />}
          {trend === "down" && <TrendingDown size={13} className="text-red-500" />}
          <span style={{ fontSize: 12 }} className={
            trend === "up" ? "text-emerald-600 font-medium" :
            trend === "down" ? "text-red-500 font-medium" : "text-muted-foreground"
          }>{sub}</span>
        </div>
      </div>
    </div>
  );
}

export function Analytics({ year, plan, onStudentClick }: {
  year: string; plan: string; onStudentClick?: (s: Student) => void;
}) {
  const { students: allStudents } = useLiveEnrollments();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [drillCell, setDrillCell] = useState<{ planSlug: string; month: string } | null>(null);
  const [barView, setBarView] = useState<"grouped" | "stacked">("grouped");

  const isAllTime = year === "All Time";
  const yearNum   = isAllTime ? null : parseInt(year);
  const heatYr    = yearNum ?? undefined;

  useEffect(() => {
    fetchAllPlansAdmin().then(all => setPlans(all.filter(p => p.is_active)));
  }, []);

  const planColor = (slug: string) => {
    const idx = plans.findIndex(p => p.slug === slug);
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  };

  const approvedStudents = allStudents.filter(s =>
    s.dbStatus === "submitted" && !!s.adminApprovedAt
  );

  const filtered = approvedStudents.filter(s =>
    (isAllTime || new Date(s.enrolledDate).getFullYear() === yearNum!) &&
    (plan === "All Plans" || s.planSlug === plan)
  );
  const prevYear = isAllTime ? [] : approvedStudents.filter(s =>
    new Date(s.enrolledDate).getFullYear() === yearNum! - 1 &&
    (plan === "All Plans" || s.planSlug === plan)
  );

  const total     = filtered.length;
  const pTotal    = prevYear.length;
  const growthPct = (!isAllTime && pTotal > 0) ? Math.round(((total - pTotal) / pTotal) * 100) : null;
  const active    = filtered.filter(s => s.status !== "Completed" && s.status !== "Overdue").length;
  const thisM     = new Date().getMonth();
  const added     = filtered.filter(s => new Date(s.enrolledDate).getMonth() === thisM).length;
  const sched     = filtered.filter(s => s.status === "Scheduled").length;
  const unpend    = filtered.filter(s => !!s.adminApprovedAt && !s.sessionDate).length;
  const mails     = filtered.filter(s => s.mailSent).length;
  const openR     = total > 0 ? Math.round((mails / total) * 100) : 0;

  function getMonthly(yr: number | null, pFilter: string) {
    return MONTHLY_LABELS.map((month, i) => ({
      month,
      count: approvedStudents.filter(s => {
        const d = new Date(s.enrolledDate);
        return (yr === null || d.getFullYear() === yr) && d.getMonth() === i &&
          (pFilter === "All Plans" || s.planSlug === pFilter);
      }).length,
    }));
  }

  const monthly     = getMonthly(yearNum, plan);
  const monthlyPrev = isAllTime ? null : getMonthly(yearNum! - 1, plan);
  const avg  = monthly.reduce((a, b) => a + b.count, 0) / 12;
  const peak = monthly.reduce((a, b) => b.count > a.count ? b : a, monthly[0]);

  const trend = isAllTime ? [] : MONTHLY_LABELS.map((month, i) => ({
    month, [yearNum!]: monthly[i].count, [yearNum! - 1]: monthlyPrev![i].count,
  }));

  const topMonths = MONTHLY_LABELS.map((month, i) => {
    const count = monthly[i].count;
    const prevC = isAllTime ? 0 : monthlyPrev![i].count;
    const topPlan = plans.length > 0
      ? plans.reduce((b, p) => cellCount(approvedStudents, p.slug, i, heatYr) > cellCount(approvedStudents, b.slug, i, heatYr) ? p : b, plans[0])
      : null;
    const moPct = (!isAllTime && prevC > 0) ? Math.round(((count - prevC) / prevC) * 100) : null;
    return { month, count, topSlug: topPlan?.slug ?? "—", pct: moPct };
  }).sort((a, b) => b.count - a.count);

  const planComp = MONTHLY_LABELS.map((month, i) => {
    const row: Record<string, unknown> = { month };
    plans.forEach(p => { row[p.slug] = cellCount(approvedStudents, p.slug, i, heatYr); });
    return row;
  });

  const planData = plans.map((p, i) => ({
    plan: p.slug,
    count: filtered.filter(s => s.planSlug === p.slug).length,
    color: PALETTE[i % PALETTE.length],
  }));
  const planTotal = planData.reduce((a, b) => a + b.count, 0);

  const allVals = plans.flatMap(p => MONTHLY_LABELS.map((_, i) => cellCount(approvedStudents, p.slug, i, heatYr)));
  const maxVal  = Math.max(...allVals, 1);

  const drillStudents = drillCell
    ? approvedStudents.filter(s => {
        const d = new Date(s.enrolledDate);
        return (isAllTime || d.getFullYear() === yearNum!) &&
          d.getMonth() === MONTHLY_LABELS.indexOf(drillCell.month) &&
          s.planSlug === drillCell.planSlug;
      })
    : [];

  const BarTip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-2xl px-4 py-2.5" style={{ boxShadow: "var(--shadow-card)" }}>
        <p style={{ fontSize: 11 }} className="text-muted-foreground">{label}</p>
        <p style={{ fontSize: 14 }} className="font-bold text-primary">{payload[0].value}</p>
      </div>
    );
  };

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Onboarded"
          value={total}
          sub={growthPct !== null ? `${growthPct >= 0 ? "+" : ""}${growthPct}% vs prior year` : "All onboarded students"}
          trend={growthPct !== null ? (growthPct >= 0 ? "up" : "down") : "neutral"}
          icon={Users} accent="#3B5BFF"
        />
        <KpiCard title="Active Students" value={active} sub={`+${added} this month`}   trend="up"      icon={UserCheck}    accent="#22C55E"/>
        <KpiCard title="Sessions"        value={sched}  sub={`${unpend} unscheduled`}  trend="neutral" icon={CalendarClock} accent="#8B5CF6"/>
        <KpiCard title="Mails Sent"      value={mails}  sub={`${openR}% send rate`}    trend="up"      icon={Mail}         accent="#F59E0B"/>
      </div>

      {/* Enrollment bar + donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-foreground">Monthly Onboardings</h3>
              <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">
                Peak — <strong className="text-primary">{peak.month}</strong> with {peak.count} students
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={26}/>
              <Tooltip content={<BarTip/>} cursor={{ fill: "var(--muted)", radius: 8 }}/>
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {monthly.map((e, i) => (
                  <Cell key={i} fill={e.month === peak.month ? "#1A3BCC" : e.count < avg ? "#C7D0FF" : "#3B5BFF"}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-foreground mb-0.5">By Plan</h3>
          <p style={{ fontSize: 12 }} className="text-muted-foreground mb-3">Distribution breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={planData} dataKey="count" nameKey="plan" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3}>
                {planData.map((e, i) => <Cell key={i} fill={e.color}/>)}
              </Pie>
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                style={{ fontSize: 22, fontWeight: 700, fill: "var(--foreground)" }}>{planTotal}</text>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1.5 mt-2">
            {planData.map(d => (
              <div key={d.plan} className="flex items-center justify-between px-2 py-1 rounded-xl hover:bg-muted transition-colors">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: d.color }}/>
                  <span style={{ fontSize: 12 }} className="text-foreground">{d.plan}</span>
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: 11 }}>
                  <span className="text-muted-foreground">{d.count}</span>
                  <span className="w-7 text-right text-muted-foreground">
                    {planTotal > 0 ? Math.round((d.count / planTotal) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-card rounded-3xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-foreground">Onboarding Heatmap</h3>
          <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">
            Plan × Month {isAllTime ? "(All Time)" : `for ${yearNum}`} — click any cell to drill in
          </p>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left pr-4 pb-2 w-28" style={{ fontSize: 11 }}>
                  <span className="text-muted-foreground font-medium">Plan</span>
                </th>
                {MONTHLY_LABELS.map(m => (
                  <th key={m} className="text-center pb-2 px-0.5" style={{ fontSize: 11 }}>
                    <span className="text-muted-foreground font-medium">{m}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.slug}>
                  <td className="pr-4 py-1 whitespace-nowrap" style={{ fontSize: 12 }}>
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: planColor(p.slug) }}/>
                      <span className="font-medium text-foreground">{p.slug}</span>
                    </div>
                  </td>
                  {MONTHLY_LABELS.map((m, i) => {
                    const v = cellCount(approvedStudents, p.slug, i, heatYr);
                    const isDrill = drillCell?.planSlug === p.slug && drillCell.month === m;
                    return (
                      <td key={m} className="py-1 px-0.5">
                        <div
                          className={`rounded-xl text-center py-2 cursor-pointer transition-all select-none ${isDrill ? "ring-2 ring-primary ring-offset-1" : "hover:scale-105"}`}
                          style={{ background: heatBg(v, maxVal), color: v > 0 ? heatFg(v, maxVal) : "var(--muted-foreground)", fontSize: 12, fontWeight: 600, minWidth: 32 }}
                          onClick={() => setDrillCell(isDrill ? null : { planSlug: p.slug, month: m })}
                        >
                          {v || "·"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {drillCell && (
          <div className="border-t border-border px-6 py-4 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-foreground" style={{ fontSize: 13 }}>
                {drillCell.planSlug} — {drillCell.month}{isAllTime ? " (All Time)" : ` ${yearNum}`}
                <span className="ml-2 font-normal text-muted-foreground" style={{ fontSize: 12 }}>
                  ({drillStudents.length} students)
                </span>
              </p>
              <button onClick={() => setDrillCell(null)} style={{ fontSize: 12 }} className="text-muted-foreground hover:text-foreground">✕ Close</button>
            </div>
            {drillStudents.length === 0 ? (
              <p style={{ fontSize: 13 }} className="text-muted-foreground">No students found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {drillStudents.map(s => (
                  <button key={s.id} onClick={() => onStudentClick?.(s)}
                    className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 hover:border-primary transition-colors text-left">
                    <div className="size-6 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ background: s.avatarColor, fontSize: 10 }}>
                      {s.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p style={{ fontSize: 12 }} className="font-medium text-foreground">{s.name}</p>
                      <p style={{ fontSize: 11 }} className="text-muted-foreground">{s.planSlug}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* YoY Trend — only for specific year */}
      {!isAllTime && (
        <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-foreground mb-0.5">Year-over-Year Trend</h3>
          <p style={{ fontSize: 12 }} className="text-muted-foreground mb-4">
            <span className="text-primary font-medium">—</span> {yearNum} &nbsp;
            <span className="text-emerald-500 font-medium">- -</span> {yearNum! - 1}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={26}/>
              <Tooltip content={<Tip/>}/>
              <Line type="monotone" dataKey={yearNum!}     stroke="#3B5BFF" strokeWidth={2.5} dot={{ r: 3, fill: "#3B5BFF" }}/>
              <Line type="monotone" dataKey={yearNum! - 1} stroke="#22C55E" strokeWidth={2} strokeDasharray="5 4" dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top months */}
        <div className="bg-card rounded-3xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="px-6 py-4 border-b border-border"><h3 className="text-foreground">Top Performing Months</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Month", "Onboardings", "Top Plan", ...(!isAllTime ? ["vs Prior"] : [])].map(h => (
                    <th key={h} className="text-left px-6 py-3" style={{ fontSize: 11, letterSpacing: "0.05em" }}>
                      <span className="font-semibold text-muted-foreground uppercase">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topMonths.map((r, i) => (
                  <tr key={r.month} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 text-foreground" style={{ fontSize: 13 }}>
                      {i === 0 && <span className="text-amber-400 mr-1.5">★</span>}{r.month}
                    </td>
                    <td className="px-6 py-3 text-foreground" style={{ fontSize: 13 }}>{r.count}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full" style={{ background: planColor(r.topSlug) }}/>
                        <span style={{ fontSize: 12 }} className="text-foreground">{r.topSlug || "—"}</span>
                      </div>
                    </td>
                    {!isAllTime && (
                      <td className="px-6 py-3">
                        <span style={{ fontSize: 12 }} className={`font-semibold ${(r.pct ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {r.pct !== null ? `${r.pct >= 0 ? "+" : ""}${r.pct}%` : "—"}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Plan comparison */}
        <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground">Plan Comparison</h3>
            <div className="flex rounded-2xl border border-border overflow-hidden" style={{ fontSize: 11 }}>
              {(["grouped", "stacked"] as const).map(v => (
                <button key={v} onClick={() => setBarView(v)}
                  className={`px-3 py-1.5 capitalize transition-colors ${barView === v ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={planComp} barSize={barView === "grouped" ? 7 : 14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={22}/>
              <Tooltip content={<Tip/>}/>
              {plans.map((p, i) => (
                <Bar key={p.slug} dataKey={p.slug} stackId={barView === "stacked" ? "s" : undefined}
                  fill={PALETTE[i % PALETTE.length]} radius={barView === "grouped" ? [4, 4, 0, 0] : undefined}/>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
