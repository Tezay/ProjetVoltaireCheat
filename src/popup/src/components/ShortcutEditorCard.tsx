import Button from "./Button";
import InfoPill from "./InfoPill";

interface ShortcutEditorCardProps {
  title: string;
  description: string;
  formattedShortcut: string;
  enabled: boolean;
  isBusy: boolean;
  isCapturing: boolean;
  onToggleEnabled: () => void;
  onStartCapture: () => void;
  onReset: () => void;
}

export default function ShortcutEditorCard({
  title,
  description,
  formattedShortcut,
  enabled,
  isBusy,
  isCapturing,
  onToggleEnabled,
  onStartCapture,
  onReset,
}: ShortcutEditorCardProps) {
  return (
    <div className="col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {title}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {formattedShortcut}
          </div>
        </div>
        <InfoPill tone={enabled ? "exact" : "default"}>
          {enabled ? "Actif" : "Inactif"}
        </InfoPill>
      </div>

      <div className="mt-3 text-xs leading-5 text-slate-600">{description}</div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button disabled={isBusy} onClick={onToggleEnabled} variant="secondary">
          {enabled ? "Désactiver" : "Activer"}
        </Button>

        <Button disabled={isBusy} onClick={onStartCapture} variant="subtle">
          {isCapturing ? "En attente..." : "Modifier"}
        </Button>

        <Button disabled={isBusy} onClick={onReset} variant="secondary">
          Réinitialiser
        </Button>
      </div>
    </div>
  );
}
