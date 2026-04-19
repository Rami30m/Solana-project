interface StatCardProps {
  label: string;
  value: string | number | null | undefined;
  sub?: string;
  glow?: boolean;
}

export function StatCard({ label, value, sub, glow }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1"
      style={{
        background: "#13131f",
        borderColor: glow ? "rgba(57,255,20,0.3)" : "#1e1e32",
        boxShadow: glow ? "0 0 16px rgba(57,255,20,0.08)" : "none",
      }}
    >
      <span style={{ color: "#7a7a9a", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span
        style={{
          color: glow ? "#39ff14" : "#e8e8f0",
          fontSize: "1.5rem",
          fontWeight: 700,
          fontFamily: "monospace",
          lineHeight: 1.2,
        }}
      >
        {value ?? "—"}
      </span>
      {sub && (
        <span style={{ color: "#4a4a6a", fontSize: "0.75rem" }}>{sub}</span>
      )}
    </div>
  );
}
