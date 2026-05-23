interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description?: string;
  onChange: (checked: boolean) => void;
}

export default function Switch({
  checked,
  disabled = false,
  label,
  description,
  onChange,
}: SwitchProps) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="pr-2">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {description && (
          <div className="mt-1 text-xs leading-5 text-slate-600">
            {description}
          </div>
        )}
      </div>

      <span className="relative mt-0.5 inline-flex h-7 w-12 shrink-0">
        <input
          checked={checked}
          className="peer sr-only"
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked);
          }}
          type="checkbox"
        />
        <span className="absolute inset-0 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
