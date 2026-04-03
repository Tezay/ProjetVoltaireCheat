import { ComponentProps } from "react";

type ButtonVariant = "primary" | "secondary" | "subtle";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-900 text-white border-slate-900 hover:bg-slate-800 hover:border-slate-800",
  secondary:
    "bg-white text-slate-900 border-slate-300 hover:bg-slate-100 hover:border-slate-400",
  subtle:
    "bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200 hover:border-slate-300",
};

export default function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <div className="block w-full my-1">
      <button
        className={`w-full rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS_NAMES[variant]} ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
