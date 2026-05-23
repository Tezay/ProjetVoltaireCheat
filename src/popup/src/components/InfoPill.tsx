interface InfoPillProps {
  tone?: "default" | "exact" | "fallback" | "warning";
  children: string;
}

const TONE_CLASS_NAMES: Record<NonNullable<InfoPillProps["tone"]>, string> = {
  default: "bg-slate-200 text-slate-700",
  exact: "bg-emerald-100 text-emerald-700",
  fallback: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-800",
};

export default function InfoPill({
  children,
  tone = "default",
}: InfoPillProps) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${TONE_CLASS_NAMES[tone]}`}
    >
      {children}
    </span>
  );
}
