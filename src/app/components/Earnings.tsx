import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, Calendar, BarChart2, Sparkles } from "lucide-react";
import { CalendarPicker } from "./ui/CalendarPicker";

const RupeeIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>
  </svg>
);
import { useLiveEnrollments } from "../hooks/useLiveEnrollments";
import { fetchAllPlansAdmin, type AdminPlan } from "../../services/planService";
import { MONTHLY_LABELS } from "../data/liveDashboard";

const PALETTE = ["#3B5BFF","#8B5CF6","#22C55E","#F59E0B","#EF4444","#06B6D4","#F43F5E","#84CC16"];

function fmt(n: number) {
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}
function fmtFull(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-2xl px-4 py-2.5" style={{ boxShadow: "var(--shadow-card)" }}>
      <p style={{ fontSize: 11 }} className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13 }} className="font-semibold text-foreground">
          <span style={{ color: p.color || p.fill }}>■ </span>
          {p.name}: ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
};

export function Earnings({ year, plan }: { year: string; plan: string }) {
  const { students: allStudents } = useLiveEnrollments();
  const [plans,        setPlans]        = useState<AdminPlan[]>([]);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [appliedFrom,  setAppliedFrom]  = useState("");
  const [appliedTo,    setAppliedTo]    = useState("");
  const filterRef = useRef<HTMLDivElement>(null);

  const yearNum = year === "All Time" ? new Date().getFullYear() : parseInt(year);

  useEffect(() => {
    fetchAllPlansAdmin().then(all => setPlans(all.filter(p => p.is_active)));
  }, []);

  useEffect(() => {
    if (!filterOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  const isFiltered = !!(appliedFrom || appliedTo);

  const planColor = (slug: string) => {
    const idx = plans.findIndex(p => p.slug === slug);
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  };

  const filtered = allStudents.filter(s => {
    const d = new Date(s.enrolledDate);
    const y = d.getFullYear();
    if (year !== "All Time" && y !== yearNum) return false;
    if (plan !== "All Plans" && s.planSlug !== plan) return false;
    if (appliedFrom && d < new Date(appliedFrom + "T00:00:00")) return false;
    if (appliedTo   && d > new Date(appliedTo   + "T23:59:59")) return false;
    return true;
  });
  const prevFiltered = allStudents.filter(s => {
    const y = new Date(s.enrolledDate).getFullYear();
    return y === yearNum - 1 && (plan === "All Plans" || s.planSlug === plan);
  });

  const totalRevenue  = filtered.reduce((sum, s) => sum + s.planPrice, 0);
  const prevRevenue   = prevFiltered.reduce((sum, s) => sum + s.planPrice, 0);
  const revenueGrowth = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
  const monthlyRevenue = totalRevenue / 12;
  const avgRevenue     = totalRevenue / Math.max(filtered.length, 1);

  function getMonthlyRevenue(y: number, pFilter: string) {
    return MONTHLY_LABELS.map((month, i) => ({
      month,
      revenue: allStudents.filter(s => {
        const d = new Date(s.enrolledDate);
        return d.getFullYear() === y && d.getMonth() === i && (pFilter === "All Plans" || s.planSlug === pFilter);
      }).reduce((sum, s) => sum + s.planPrice, 0),
    }));
  }

  const monthly     = getMonthlyRevenue(yearNum, plan);
  const monthlyPrev = getMonthlyRevenue(yearNum - 1, plan);

  const monthlyTrend = MONTHLY_LABELS.map((month, i) => ({
    month,
    [yearNum]:     monthly[i].revenue,
    [yearNum - 1]: monthlyPrev[i].revenue,
  }));

  /* Plan-wise breakdown */
  const planWise = plans.map((p, i) => {
    const planStudents = filtered.filter(s => s.planSlug === p.slug);
    return {
      slug:    p.slug,
      color:   PALETTE[i % PALETTE.length],
      count:   planStudents.length,
      revenue: planStudents.reduce((sum, s) => sum + s.planPrice, 0),
    };
  }).filter(p => p.count > 0);

  /* Revenue prediction — rates derived from actual YoY data when available */
  const year2Revenue = allStudents
    .filter(s => new Date(s.enrolledDate).getFullYear() === yearNum - 2 && (plan === "All Plans" || s.planSlug === plan))
    .reduce((sum, s) => sum + s.planPrice, 0);

  const g1 = year2Revenue > 0 && prevRevenue > 0
    ? (prevRevenue - year2Revenue) / year2Revenue   // yearNum-2 → yearNum-1
    : null;
  const g2 = prevRevenue > 0 && totalRevenue > 0
    ? (totalRevenue - prevRevenue) / prevRevenue    // yearNum-1 → yearNum
    : null;

  function clampRate(r: number) { return Math.min(Math.max(r, -0.30), 0.80); }

  let growthRate1: number;
  let growthRate2: number;
  let rateSource: "actual" | "partial" | "default";

  if (g1 !== null && g2 !== null) {
    // Two years of history — weighted average (recent year counts more)
    const derived = g1 * 0.4 + g2 * 0.6;
    growthRate1 = clampRate(derived);
    growthRate2 = clampRate(derived * 1.05);
    rateSource = "actual";
  } else if (g2 !== null) {
    // One year of history
    growthRate1 = clampRate(g2);
    growthRate2 = clampRate(g2);
    rateSource = "partial";
  } else {
    growthRate1 = 0.22;
    growthRate2 = 0.25;
    rateSource = "default";
  }

  const pct1 = Math.round(growthRate1 * 100);
  const pct2 = Math.round(growthRate2 * 100);
  const prediction1 = Math.round(totalRevenue * (1 + growthRate1));
  const prediction2 = Math.round(prediction1  * (1 + growthRate2));
  const predData = [
    { year: String(yearNum - 1), revenue: prevRevenue,  fill: "#C7D0FF" },
    { year: String(yearNum),     revenue: totalRevenue, fill: "#3B5BFF" },
    { year: String(yearNum + 1), revenue: prediction1,  fill: "#7E9BFF", predicted: true },
    { year: String(yearNum + 2), revenue: prediction2,  fill: "#A5B4FF", predicted: true },
  ];

  /* Year-wise summary (last 3 years) */
  const yearData = [yearNum - 2, yearNum - 1, yearNum].map(y => ({
    year: String(y),
    revenue: allStudents.filter(s =>
      new Date(s.enrolledDate).getFullYear() === y && (plan === "All Plans" || s.planSlug === plan)
    ).reduce((sum, s) => sum + s.planPrice, 0),
  }));

  const KpiCard = ({ title, value, sub, icon: Icon, accent, pct }: any) => (
    <div className="bg-card rounded-3xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-start justify-between">
        <p style={{ fontSize: 11, letterSpacing: "0.06em" }} className="font-semibold text-muted-foreground uppercase">{title}</p>
        <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: accent + "18" }}>
          <Icon size={18} style={{ color: accent }}/>
        </div>
      </div>
      <div>
        <p className="font-bold text-foreground" style={{ fontSize: 28, lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: 12 }} className="text-muted-foreground mt-2">{sub}</p>}
        {pct !== undefined && (
          <div className="flex items-center gap-1.5 mt-2">
            <TrendingUp size={13} className={pct >= 0 ? "text-emerald-500" : "text-red-500"}/>
            <span style={{ fontSize: 12 }} className={pct >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
              {pct >= 0 ? "+" : ""}{pct}% vs prior year
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* Header — title + Filter button */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Revenue</h2>
          <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">
            {isFiltered ? `Filtered: ${appliedFrom || "∞"} → ${appliedTo || "∞"}` : "All enrollments in selected period"}
          </p>
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
              isFiltered ? "text-primary" : "text-muted-foreground"
            }`}
            style={{ fontSize: 13, background: "var(--secondary)", border: `1.5px solid ${isFiltered ? "color-mix(in srgb, var(--primary) 40%, transparent)" : "var(--border)"}`, boxShadow: "0 1px 4px rgba(26,42,241,0.08)" }}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              <circle cx="12" cy="16" r="3"/><polyline points="12 14.5 12 16 13 17"/>
            </svg>
            Filter
            {isFiltered && <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center font-bold" style={{ fontSize: 8 }}>1</span>}
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full mt-2 z-30 w-72 bg-card rounded-2xl border border-border shadow-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-foreground flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-primary" style={{ flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    <circle cx="12" cy="16" r="3"/><polyline points="12 14.5 12 16 13 17"/>
                  </svg>
                  Date Range
                </span>
                {isFiltered && (
                  <button onClick={() => { setDateFrom(""); setDateTo(""); setAppliedFrom(""); setAppliedTo(""); }}
                    className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-0.5">
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">From</label>
                  <CalendarPicker value={dateFrom} onChange={setDateFrom} compact placeholder="dd/mm/yyyy" align="right" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">To</label>
                  <CalendarPicker value={dateTo} onChange={setDateTo} compact placeholder="dd/mm/yyyy" align="right" />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setFilterOpen(false)}
                  className="flex-1 py-2 rounded-xl text-[11px] font-medium border border-border text-muted-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={() => { setAppliedFrom(dateFrom); setAppliedTo(dateTo); setFilterOpen(false); }}
                  className="flex-1 py-2 rounded-xl text-[11px] font-medium text-white transition-colors"
                  style={{ background: "var(--primary)" }}>
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Total Revenue"   value={fmtFull(Math.round(totalRevenue))}       pct={revenueGrowth}                   icon={RupeeIcon}  accent="#3B5BFF"/>
        <KpiCard title="Monthly Avg"     value={fmtFull(Math.round(monthlyRevenue))}     sub="Average per month"               icon={Calendar}   accent="#22C55E"/>
        <KpiCard title="Yearly Revenue"  value={fmtFull(Math.round(totalRevenue))}       sub={`${yearNum} total`}              icon={BarChart2}  accent="#8B5CF6"/>
        <KpiCard title="Avg per Student" value={fmtFull(Math.round(avgRevenue))}         sub={`From ${filtered.length} students`} icon={TrendingUp} accent="#F59E0B"/>
      </div>

      {/* Monthly revenue area chart */}
      <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-foreground">Monthly Revenue</h3>
            <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">
              <span className="text-primary font-medium">—</span> {yearNum} &nbsp;
              <span className="text-purple-400 font-medium">- -</span> {yearNum - 1}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyTrend}>
            <defs>
              <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B5BFF" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#3B5BFF" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8B5CF6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}/>
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={60} tickFormatter={v => fmt(v)}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey={yearNum}     stroke="#3B5BFF" strokeWidth={2.5} fill="url(#grad1)" dot={false}/>
            <Area type="monotone" dataKey={yearNum - 1} stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 4" fill="url(#grad2)" dot={false}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Plan-wise + Year-wise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Plan-wise earnings */}
        <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-foreground mb-4">Plan-wise Revenue</h3>
          {planWise.length === 0 ? (
            <p style={{ fontSize: 13 }} className="text-muted-foreground">No data for selected filters.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {planWise.sort((a, b) => b.revenue - a.revenue).map(p => {
                const pct = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
                return (
                  <div key={p.slug}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-full" style={{ background: p.color }}/>
                        <span style={{ fontSize: 13 }} className="font-medium text-foreground">{p.slug}</span>
                        <span style={{ fontSize: 11 }} className="text-muted-foreground">{p.count} students</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 13 }} className="font-bold text-foreground">{fmtFull(Math.round(p.revenue))}</span>
                        <span style={{ fontSize: 11 }} className="text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.color }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Year-wise */}
        <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-foreground mb-4">Year-wise Revenue</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={60} tickFormatter={v => fmt(v)}/>
              <Tooltip content={<Tip/>}/>
              <Bar dataKey="revenue" radius={[10, 10, 0, 0]}>
                {yearData.map((_, i) => <Cell key={i} fill={i === yearData.length - 1 ? "#3B5BFF" : "#C7D0FF"}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prediction */}
      <div className="bg-card rounded-3xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-primary"/>
          <h3 className="text-foreground">Revenue Prediction</h3>
        </div>
        <p style={{ fontSize: 12 }} className="text-muted-foreground mb-5">
          Projected growth at {pct1}% ({yearNum + 1}) and {pct2}% ({yearNum + 2})
          {" · "}
          {rateSource === "actual"  && "rates derived from 2 years of actual data"}
          {rateSource === "partial" && "rate derived from last year's actual growth"}
          {rateSource === "default" && "default estimate — not enough historical data yet"}
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={predData} barSize={50}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={65} tickFormatter={v => fmt(v)}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="revenue" radius={[10, 10, 0, 0]}>
                  {predData.map((d, i) => <Cell key={i} fill={d.fill}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { year: yearNum + 1, value: prediction1, growth: pct1, color: "#7E9BFF" },
              { year: yearNum + 2, value: prediction2, growth: pct2, color: "#A5B4FF" },
            ].map(p => (
              <div key={p.year} className="rounded-2xl p-4" style={{ background: p.color + "18", border: `1px solid ${p.color}44` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={13} style={{ color: p.color }}/>
                  <p style={{ fontSize: 12, color: p.color }} className="font-semibold">Projected {p.year}</p>
                </div>
                <p className="font-bold text-foreground" style={{ fontSize: 22, lineHeight: 1 }}>{fmtFull(p.value)}</p>
                <p style={{ fontSize: 11 }} className="text-muted-foreground mt-1.5">
                  {p.growth >= 0 ? "+" : ""}{p.growth}% {rateSource === "default" ? "estimated" : "based on actuals"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month-wise breakdown table */}
      <div className="bg-card rounded-3xl overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-foreground">Month-wise Revenue Breakdown — {yearNum}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Month","Revenue","Students","Avg/Student","vs Prior Month"].map(h => (
                  <th key={h} className="text-left px-6 py-3" style={{ fontSize: 11, letterSpacing: "0.06em" }}>
                    <span className="font-semibold text-muted-foreground uppercase">{h}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => {
                const prevRev = i > 0 ? monthly[i - 1].revenue : 0;
                const pctChange = prevRev > 0 ? Math.round(((m.revenue - prevRev) / prevRev) * 100) : 0;
                const studentCount = filtered.filter(s => new Date(s.enrolledDate).getMonth() === i).length;
                const avgPerStu = studentCount > 0 ? Math.round(m.revenue / studentCount) : 0;
                return (
                  <tr key={m.month} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-3 font-medium text-foreground" style={{ fontSize: 13 }}>{m.month}</td>
                    <td className="px-6 py-3 font-bold text-primary"    style={{ fontSize: 13 }}>{fmtFull(Math.round(m.revenue))}</td>
                    <td className="px-6 py-3 text-foreground"            style={{ fontSize: 13 }}>{studentCount}</td>
                    <td className="px-6 py-3 text-muted-foreground"     style={{ fontSize: 12 }}>{fmtFull(avgPerStu)}</td>
                    <td className="px-6 py-3">
                      {i === 0 ? (
                        <span style={{ fontSize: 12 }} className="text-muted-foreground">—</span>
                      ) : (
                        <span style={{ fontSize: 12 }} className={`font-semibold ${pctChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {pctChange >= 0 ? "+" : ""}{pctChange}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-secondary/30">
                <td className="px-6 py-3.5 font-bold text-foreground" style={{ fontSize: 13 }}>Total</td>
                <td className="px-6 py-3.5 font-bold text-primary"    style={{ fontSize: 14 }}>{fmtFull(Math.round(totalRevenue))}</td>
                <td className="px-6 py-3.5 font-bold text-foreground" style={{ fontSize: 13 }}>{filtered.length}</td>
                <td className="px-6 py-3.5 font-semibold text-muted-foreground" style={{ fontSize: 12 }}>{fmtFull(Math.round(avgRevenue))}</td>
                <td className="px-6 py-3.5">
                  <span style={{ fontSize: 12 }} className={`font-bold ${revenueGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {revenueGrowth >= 0 ? "+" : ""}{revenueGrowth}% YoY
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
