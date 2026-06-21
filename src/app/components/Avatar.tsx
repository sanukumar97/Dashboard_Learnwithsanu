export function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const sizeClass = size === "sm" ? "size-7 text-xs" : size === "lg" ? "size-10 text-base" : "size-8 text-sm";
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}
