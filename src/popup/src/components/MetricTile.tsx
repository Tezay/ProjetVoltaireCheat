interface MetricTileProps {
  label: string;
  value: string;
  tone?: "default" | "exact" | "fallback" | "warning";
}

const TONE_CLASS_NAMES: Record<
  NonNullable<MetricTileProps["tone"]>,
  string
> = {
  default: "bg-slate-50 border-slate-200 text-slate-900",
  exact: "bg-emerald-50 border-emerald-200 text-emerald-900",
  fallback: "bg-sky-50 border-sky-200 text-sky-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
};

export default function MetricTile({
  label,
  value,
  tone = "default",
}: MetricTileProps) {
  return (
    <div
      className={`rounded-2xl border p-3 ${TONE_CLASS_NAMES[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold leading-none">{value}</div>
    </div>
  );
}
