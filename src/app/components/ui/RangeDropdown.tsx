import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface RangeOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: RangeOption[];
}

const ChevronSvg = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24" width={12} height={12} fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
  >
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export function RangeDropdown({ value, onChange, options }: Props) {
  const [open, setOpen]         = useState(false);
  const [pos, setPos]           = useState<{ top: number; left: number } | null>(null);
  const btnRef                  = useRef<HTMLButtonElement>(null);
  const panelRef                = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) {
      const t = e.target as Node;
      if (
        btnRef.current   && !btnRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  function toggle() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 180)) });
    setOpen(o => !o);
  }

  const currentLabel = options.find(o => o.value === value)?.label ?? value;

  const pillStyle: React.CSSProperties = {
    fontSize: 13,
    background: "var(--secondary)",
    border: "1.5px solid color-mix(in srgb, var(--primary) 25%, transparent)",
    boxShadow: "0 1px 4px rgba(26,42,241,0.08)",
    color: "var(--primary)",
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all"
        style={pillStyle}
      >
        <ChevronSvg open={open} />
        <span>{currentLabel}</span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            background: "var(--cal-bg)",
            border: "1.5px solid var(--cal-border)",
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            minWidth: 160,
            overflow: "hidden",
            padding: "6px",
          }}
        >
          {options.map(opt => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 14px",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 400,
                  color: "var(--cal-text)",
                  background: isActive ? "var(--cal-active)" : "transparent",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--cal-hover)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
