import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  value: string;
  onChange: (v: string) => void;
  align?: "left" | "right";
  compact?: boolean;
  placeholder?: string;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES = ["SU","MO","TU","WE","TH","FR","SA"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function todayStr() {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;
}

const CalClockSvg = () => (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    <circle cx="12" cy="16" r="3"/><polyline points="12 14.5 12 16 13 17"/>
  </svg>
);
const CalEndSvg = () => (
  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
    <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

interface PanelPos { top: number; left?: number; right?: number; }

export function CalendarPicker({ value, onChange, align = "left", compact = false, placeholder }: Props) {
  const today = new Date();
  const initYear  = value ? parseInt(value.split("-")[0]) : today.getFullYear();
  const initMonth = value ? parseInt(value.split("-")[1]) - 1 : today.getMonth();

  const [open, setOpen]           = useState(false);
  const [panelPos, setPanelPos]   = useState<PanelPos | null>(null);
  const [viewYear, setViewYear]   = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const btnRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  /* Sync view when value changes externally */
  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split("-")[0]));
      setViewMonth(parseInt(value.split("-")[1]) - 1);
    }
  }, [value]);

  function openPanel() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const PANEL_W = 252;
    const GAP = 6;

    if (align === "right") {
      /* Right-align: panel right edge = button right edge, clamped to viewport */
      const right = window.innerWidth - rect.right;
      const clampedRight = Math.max(8, right);
      setPanelPos({ top: rect.bottom + GAP, right: clampedRight });
    } else {
      /* Left-align: panel left edge = button left edge, clamped to viewport */
      const left = Math.min(rect.left, window.innerWidth - PANEL_W - 8);
      setPanelPos({ top: rect.bottom + GAP, left: Math.max(8, left) });
    }
    setOpen(o => !o);
  }

  const td = todayStr();
  const displayText = value
    ? value.split("-").reverse().join("/")
    : placeholder !== undefined
      ? placeholder
      : td.split("-").reverse().join("/");

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }
  function pickDay(day: number) {
    onChange(`${viewYear}-${pad(viewMonth+1)}-${pad(day)}`);
    setOpen(false);
  }

  const pillStyle: React.CSSProperties = {
    fontSize: compact ? 12 : 13,
    background: "var(--secondary)",
    border: "1.5px solid color-mix(in srgb, var(--primary) 25%, transparent)",
    boxShadow: compact ? "none" : "0 1px 4px rgba(26,42,241,0.08)",
    color: "var(--primary)",
  };

  const panel = open && panelPos && createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: panelPos.top,
        ...(panelPos.right !== undefined ? { right: panelPos.right } : { left: panelPos.left }),
        zIndex: 9999,
        background: "var(--cal-bg)",
        border: "1.5px solid var(--cal-border)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        borderRadius: 16,
        padding: 16,
        minWidth: 252,
        maxWidth: "calc(100vw - 16px)",
        userSelect: "none",
      }}
    >
      {/* Month/year nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button
          onClick={prevMonth}
          style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--cal-text)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--cal-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >‹</button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--cal-text)" }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "var(--cal-text)", background: "transparent", border: "none", cursor: "pointer" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--cal-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >›</button>
      </div>

      {/* Day name headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--cal-text-muted)", padding: "3px 0", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px 0" }}>
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day  = i + 1;
          const dStr = `${viewYear}-${pad(viewMonth+1)}-${pad(day)}`;
          const isSel   = dStr === value;
          const isToday = dStr === td;
          return (
            <button
              key={day}
              onClick={() => pickDay(day)}
              style={{
                width: "100%",
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isSel || isToday ? 700 : 400,
                background: isSel ? "var(--cal-selected-bg)" : "transparent",
                color: isSel ? "var(--cal-selected-fg)" : "var(--cal-text)",
                border: "none",
                cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "var(--cal-hover)"; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPanel}
        className={`flex items-center gap-2 font-medium ${
          compact ? "w-full px-3 py-2 rounded-xl" : "px-4 py-2 rounded-full"
        }`}
        style={pillStyle}
      >
        <CalClockSvg />
        <span className="whitespace-nowrap flex-1 text-left">{displayText}</span>
        {!compact && <CalEndSvg />}
      </button>
      {panel}
    </>
  );
}
