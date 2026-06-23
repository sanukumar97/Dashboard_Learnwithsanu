import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Download, Filter, MessageSquare,
  ChevronLeft, ChevronRight, Star, X, Copy, Check,
} from "lucide-react";
import { CalendarPicker } from "./ui/CalendarPicker";

const C = {
  blue:        "#4A6CF7",
  blueLight:   "#EEF1FE",
  green:       "#10B981",
  greenLight:  "#ECFDF5",
  red:         "#EF4444",
  redLight:    "#FEF2F2",
  amber:       "#F59E0B",
  amberLight:  "#FFFBEB",
  purple:      "#8B5CF6",
  purpleLight: "#F5F3FF",
  dark:        "#0F172A",
  muted:       "#64748B",
  border:      "#E8ECF0",
  surface:     "#F8FAFC",
};

// Form registry — add new forms here as { id: tallyFormId, label: displayName }
const FORMS = [
  
  { id: "0QGLL9", label: "Mid Review Form" },
  { id: "GxkDLz", label: "Final Review Form" },
  { id: "aQkDqv", label: "Form-3" },
  { id: "KYOJKA", label: "Form-4" },
  { id: "J9GJv4", label: "Form-5" },
];


interface FeedbackRow {
  id: string;
  response_id: string | null;
  submitted_at: string;
  raw_payload: Record<string, unknown> | null;
}

// Extract all form fields from a Tally raw_payload, resolving option IDs → text labels
function getFields(raw: Record<string, unknown> | null): Array<{ label: string; value: string }> {
  if (!raw) return [];
  const data = raw.data as Record<string, unknown> | undefined;
  const fields = (data?.fields as Array<{
    label?: string;
    value?: unknown;
    options?: Array<{ id: string; text: string }>;
  }>) ?? [];

  return fields
    .filter(f => f.label)
    .map(f => {
      const opts = (f.options ?? []) as Array<{ id: string; text: string }>;

      function resolveId(id: string): string {
        const match = opts.find(o => o.id === id);
        return match ? match.text : id;
      }

      let value: string;
      if (Array.isArray(f.value)) {
        const resolved = (f.value as string[]).map(resolveId).filter(v => v && v !== "(Select Choice)");
        value = resolved.length ? resolved.join(", ") : "–";
      } else if (f.value != null && f.value !== "") {
        const str = String(f.value);
        value = str === "(Select Choice)" ? "–" : resolveId(str);
      } else {
        value = "–";
      }

      return { label: f.label!, value };
    });
}

const AV_COLORS = [C.blue, C.purple, C.green, C.amber, C.red];

function ratingToStars(r: string | null): number {

  if (!r) return 0;
  const map: Record<string, number> = { worst: 1, bad: 2, average: 3, best: 5 };
  return map[r.toLowerCase()] ?? 0;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-px">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={11} className={i <= n ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-200"} />
      ))}
    </div>
  );
}

// ── Feedback Tab ───────────────────────────────────────────────────────────────

export function Feedback() {
  const [selectedForm,  setSelectedForm]  = useState("0QGLL9");
  const [page,          setPage]          = useState(1);
  const [feedbackRows,  setFeedbackRows]  = useState<FeedbackRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [colWidths,     setColWidths]     = useState<Record<string, number>>({});
  const [filterOpen,    setFilterOpen]    = useState(false);
  const [copiedKey,     setCopiedKey]     = useState<string | null>(null);
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [appliedFrom,   setAppliedFrom]   = useState("");
  const [appliedTo,     setAppliedTo]     = useState("");
  const filterRef = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<{ col: string; startX: number; startW: number } | null>(null);

  // Close filter panel when clicking outside
  useEffect(() => {
    if (!filterOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  function startResize(col: string, e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { col, startX: e.clientX, startW: colWidths[col] ?? 160 };
    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const w = Math.max(70, dragRef.current.startW + ev.clientX - dragRef.current.startX);
      setColWidths(prev => ({ ...prev, [dragRef.current!.col]: w }));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("feedback")
        .select("id,response_id,submitted_at,raw_payload")
        .order("submitted_at", { ascending: false });
      if (active) {
        setFeedbackRows(data ?? []);
        setLoading(false);
      }
    }

    load();

    const channel = supabase
      .channel("feedback-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () => load())
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  const total = feedbackRows.length;

  // Filter by selected form then by date range
  const filteredRows = feedbackRows.filter(r => {
    // form filter
    if (selectedForm !== "all") {
      const fid = (r.raw_payload?.data as Record<string, unknown> | undefined)?.formId as string | undefined;
      if (fid !== selectedForm) return false;
    }
    // date range filter (inclusive)
    if (appliedFrom) {
      const d = new Date(r.submitted_at);
      if (d < new Date(appliedFrom + "T00:00:00")) return false;
    }
    if (appliedTo) {
      const d = new Date(r.submitted_at);
      if (d > new Date(appliedTo + "T23:59:59")) return false;
    }
    return true;
  });

  const isFiltered = !!(appliedFrom || appliedTo);

  // All unique question labels from filtered responses (preserves order of first occurrence)
  const allLabels = [...new Set(filteredRows.flatMap(r => getFields(r.raw_payload).map(f => f.label)))];

  // Pagination
  const PAGE_SIZE = 20;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pagedRows  = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function exportCSV() {
    const headers = ["#", "Date", ...allLabels];
    const rows = filteredRows.map((r, idx) => {
      const fields   = getFields(r.raw_payload);
      const fieldMap = Object.fromEntries(fields.map(f => [f.label, f.value]));
      const date     = r.submitted_at
        ? new Date(r.submitted_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })
        : "";
      const cols = [
        String(idx + 1),
        date,
        ...allLabels.map(l => fieldMap[l] ?? ""),
      ];
      // Wrap cells that contain commas/quotes/newlines
      return cols.map(c => {
        const s = c.replace(/"/g, '""');
        return /[,"\n]/.test(s) ? `"${s}"` : s;
      }).join(",");
    });

    const csv  = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const formLabel = FORMS.find(f => f.id === selectedForm)?.label ?? "feedback";
    a.href     = url;
    a.download = `${formLabel.replace(/\s+/g, "_")}_responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col min-h-0">

      {/* ── Sticky header — form capsules only ── */}
      <div className="sticky top-0 z-20 bg-card border-b border-border"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="px-5 py-3">
          {/* Form capsules — single row, horizontally scrollable */}
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FORMS.map(f => (
              <button key={f.id}
                onClick={() => { setSelectedForm(f.id); setPage(1); }}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full font-medium border transition-all ${
                  selectedForm === f.id
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
                style={{ fontSize: 13 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ fontFamily: "Inter, sans-serif" }}>

        {/* Page heading + Filter + Export */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground font-bold" style={{ fontSize: 20 }}>Feedback</h2>
            <p style={{ fontSize: 12 }} className="text-muted-foreground mt-0.5">Student ratings and course reviews</p>
          </div>
          {/* Filter + Export side by side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Filter button + dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterOpen(o => !o)}
                className={`flex items-center gap-1.5 border rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isFiltered
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}>
                <Filter size={11} />
                <span className="hidden sm:inline">Filter</span>
                {isFiltered && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center font-bold" style={{ fontSize: 8 }}>1</span>
                )}
              </button>

              {filterOpen && (
                <div className="absolute right-0 top-full mt-2 z-30 w-[min(288px,calc(100vw-2rem))] bg-card rounded-2xl border border-border shadow-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-foreground">Date Range</span>
                    {isFiltered && (
                      <button onClick={() => { setDateFrom(""); setDateTo(""); setAppliedFrom(""); setAppliedTo(""); setPage(1); }}
                        className="text-[10px] text-red-500 hover:text-red-600 font-medium flex items-center gap-0.5">
                        <X size={9} /> Clear
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
                    <button onClick={() => { setAppliedFrom(dateFrom); setAppliedTo(dateTo); setPage(1); setFilterOpen(false); }}
                      className="flex-1 py-2 rounded-xl text-[11px] font-medium text-white transition-colors"
                      style={{ background: "var(--primary)" }}>
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Export CSV */}
            <button
              onClick={exportCSV}
              disabled={filteredRows.length === 0}
              className="flex items-center gap-1.5 border border-border rounded-xl px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Download size={11} /><span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Total Responses KPI card */}
        <div className="w-56">
          <div className="bg-card rounded-3xl p-5 flex flex-col gap-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-start justify-between">
              <p style={{ fontSize: 11, letterSpacing: "0.06em" }} className="font-semibold text-muted-foreground uppercase">Total Responses</p>
              <div className="size-10 rounded-2xl flex items-center justify-center" style={{ background: C.blue + "18" }}>
                <MessageSquare size={18} style={{ color: C.blue }} />
              </div>
            </div>
            <div>
              <p className="font-bold text-foreground" style={{ fontSize: 32, lineHeight: 1 }}>{total}</p>
              <p style={{ fontSize: 12 }} className="text-muted-foreground mt-2">responses collected</p>
            </div>
          </div>
        </div>

        {/* Responses table card */}
        <div className="bg-card rounded-3xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-foreground">Responses</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: C.blue + "18", color: C.blue }}>{filteredRows.length}</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-[12px] text-muted-foreground">Loading responses…</div>
          ) : feedbackRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <MessageSquare size={32} className="text-muted-foreground/30" />
              <p className="text-[13px] font-semibold text-muted-foreground">No responses yet</p>
              <p className="text-[11px] text-muted-foreground/60">Submit the Tally form to see responses here</p>
            </div>
          ) : (
            <>
              {/* Resizable horizontal table — drag column borders to resize */}
              <div className="overflow-x-auto">
                <table style={{ tableLayout: "fixed", borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="relative px-4 py-3 text-left"
                        style={{ width: colWidths["#"] ?? 48, minWidth: 44 }}>
                        <span className="font-semibold text-muted-foreground uppercase" style={{ fontSize: 11, letterSpacing: "0.07em" }}>#</span>
                        <div onMouseDown={e => startResize("#", e)}
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 select-none" />
                      </th>
                      <th className="relative px-4 py-3 text-left"
                        style={{ width: colWidths["date"] ?? 120, minWidth: 90 }}>
                        <span className="font-semibold text-muted-foreground uppercase" style={{ fontSize: 11, letterSpacing: "0.07em" }}>Date</span>
                        <div onMouseDown={e => startResize("date", e)}
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 select-none" />
                      </th>
                      {allLabels.map(label => (
                        <th key={label} className="relative px-4 py-3 text-left"
                          style={{ width: colWidths[label] ?? 180, minWidth: 90 }}>
                          <span className="block font-semibold text-muted-foreground uppercase pr-2 break-words whitespace-normal leading-snug" style={{ fontSize: 11, letterSpacing: "0.07em" }}>{label}</span>
                          <div onMouseDown={e => startResize(label, e)}
                            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 select-none" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((r, idx) => {
                      const fields   = getFields(r.raw_payload);
                      const fieldMap = Object.fromEntries(fields.map(f => [f.label, f.value]));
                      const date     = r.submitted_at
                        ? new Date(r.submitted_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })
                        : "–";
                      const rowNum   = (safePage - 1) * PAGE_SIZE + idx + 1;
                      const color    = AV_COLORS[idx % AV_COLORS.length];
                      return (
                        <tr key={r.id}
                          className="border-b border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 align-top" style={{ width: colWidths["#"] ?? 48 }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold"
                              style={{ background: color, fontSize: 10 }}>{rowNum}</div>
                          </td>
                          <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap"
                            style={{ width: colWidths["date"] ?? 120, fontSize: 13 }}>{date}</td>
                          {allLabels.map(label => {
                            const val      = fieldMap[label] ?? "–";
                            const isRating = ["worst","bad","average","best"].includes(val.toLowerCase());
                            return (
                              <td key={label} className="px-4 py-3 align-top"
                                style={{ width: colWidths[label] ?? 180 }}>
                                {isRating ? (
                                  <div className="flex items-center gap-1.5">
                                    <Stars n={ratingToStars(val)} />
                                    <span className="text-muted-foreground capitalize whitespace-nowrap" style={{ fontSize: 11 }}>{val}</span>
                                  </div>
                                ) : val === "–" ? (
                                  <span className="text-muted-foreground/30" style={{ fontSize: 13 }}>—</span>
                                ) : (
                                  <div className="group relative">
                                    <span className="text-foreground break-words whitespace-normal leading-relaxed" style={{ fontSize: 13 }}>{val}</span>
                                    <button
                                      onClick={() => {
                                        const key = `${r.id}-${label}`;
                                        navigator.clipboard.writeText(val);
                                        setCopiedKey(key);
                                        setTimeout(() => setCopiedKey(k => k === key ? null : k), 1500);
                                      }}
                                      className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-primary/10"
                                      title="Copy">
                                      {copiedKey === `${r.id}-${label}`
                                        ? <Check size={11} className="text-emerald-500" />
                                        : <Copy  size={11} className="text-muted-foreground hover:text-primary" />}
                                    </button>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
                <span className="text-muted-foreground" style={{ fontSize: 12 }}>
                  Showing {Math.min((safePage - 1) * PAGE_SIZE + 1, filteredRows.length)}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronLeft size={12} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map(n => (
                    <button key={n} onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded-xl text-[11px] font-semibold transition-all ${safePage === n ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    className="w-7 h-7 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
