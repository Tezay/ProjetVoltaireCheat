import { useEffect, useState } from "react";
import Button from "./components/Button";
import {
  formatShortcut,
  shortcutFromKeyboardEvent,
} from "./extension/shortcut";
import {
  getStoredShortcutConfig,
  setStoredShortcutConfig,
} from "./extension/storage";
import {
  DEFAULT_SHORTCUT_CONFIG,
  type ShortcutConfig,
  type TriggerDetectionResponse,
} from "./extension/types";

export function App() {
  const [shortcutConfig, setShortcutConfig] = useState<ShortcutConfig>(
    DEFAULT_SHORTCUT_CONFIG
  );
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false);

  useEffect(() => {
    async function loadShortcutConfig() {
      try {
        const storedConfig = await getStoredShortcutConfig();
        setShortcutConfig(storedConfig);
      } catch {
        setError("Impossible de charger le raccourci clavier.");
      } finally {
        setIsLoadingConfig(false);
      }
    }

    void loadShortcutConfig();
  }, []);

  useEffect(() => {
    if (!isCapturingShortcut) {
      return;
    }

    function handleKeydown(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      const capturedShortcut = shortcutFromKeyboardEvent(
        event,
        shortcutConfig.enabled
      );

      if (!capturedShortcut) {
        setError("La combinaison doit inclure une touche principale.");
        return;
      }

      setIsCapturingShortcut(false);
      void saveShortcutConfig(capturedShortcut, "Raccourci clavier mis à jour.");
    }

    window.addEventListener("keydown", handleKeydown, true);

    return () => {
      window.removeEventListener("keydown", handleKeydown, true);
    };
  }, [isCapturingShortcut, shortcutConfig.enabled]);

  async function saveShortcutConfig(
    nextConfig: Partial<ShortcutConfig>,
    successMessage: string
  ) {
    setIsSavingShortcut(true);

    try {
      const updatedConfig = await setStoredShortcutConfig(nextConfig);
      setShortcutConfig(updatedConfig);
      setError(null);
      setInfo(successMessage);
    } catch {
      setInfo(null);
      setError("Impossible d'enregistrer le raccourci clavier.");
    } finally {
      setIsSavingShortcut(false);
    }
  }

  async function handleManualDetection() {
    setIsDetecting(true);
    setError(null);
    setInfo(null);

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab?.id) {
        throw new Error("missing_tab");
      }

      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: "triggerDetection",
        source: "popup",
      })) as TriggerDetectionResponse;

      if (response.status === "error") {
        setError(response.message);
        return;
      }

      setInfo("Analyse lancée sur l'onglet actif.");
    } catch {
      setError(
        "Ouvrez ou rechargez une page d'exercice Projet Voltaire, puis réessayez."
      );
    } finally {
      setIsDetecting(false);
    }
  }

  async function handleToggleShortcut() {
    setIsCapturingShortcut(false);
    setInfo(null);
    await saveShortcutConfig(
      { enabled: !shortcutConfig.enabled },
      shortcutConfig.enabled
        ? "Raccourci clavier désactivé."
        : "Raccourci clavier activé."
    );
  }

  async function handleResetShortcut() {
    setIsCapturingShortcut(false);
    setInfo(null);
    await saveShortcutConfig(
      {
        key: DEFAULT_SHORTCUT_CONFIG.key,
        ctrlKey: DEFAULT_SHORTCUT_CONFIG.ctrlKey,
        altKey: DEFAULT_SHORTCUT_CONFIG.altKey,
        shiftKey: DEFAULT_SHORTCUT_CONFIG.shiftKey,
        metaKey: DEFAULT_SHORTCUT_CONFIG.metaKey,
      },
      "Raccourci réinitialisé sur V."
    );
  }

  const formattedShortcut = formatShortcut(shortcutConfig);
  const isBusy = isLoadingConfig || isSavingShortcut;

  return (
    <div className="w-80 bg-slate-100 p-3 text-slate-900">
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Projet Voltaire Cheat 2.2.1
        </p>
        <h1 className="mt-1 text-lg font-bold">Détection rapide</h1>
        <p className="mt-1 text-sm text-slate-600">
          Lance une analyse manuelle ou configure le raccourci global pour les
          pages Projet Voltaire.
        </p>
      </div>

      {error && (
        <div className="mb-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white">
          {error}
        </div>
      )}

      {info && (
        <div className="mb-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white">
          {info}
        </div>
      )}

      <Button disabled={isBusy || isDetecting} onClick={handleManualDetection}>
        {isDetecting ? "Détection en cours..." : "Détecter cette phrase"}
      </Button>

      <Button
        disabled={isBusy}
        onClick={handleToggleShortcut}
        variant="secondary"
      >
        {shortcutConfig.enabled
          ? `Désactiver le raccourci clavier (${formattedShortcut})`
          : `Activer le raccourci clavier (${formattedShortcut})`}
      </Button>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Raccourci actuel
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {formattedShortcut}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
              shortcutConfig.enabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {shortcutConfig.enabled ? "Actif" : "Inactif"}
          </span>
        </div>

        <p className="mt-3 text-xs text-slate-600">
          Clique sur le bouton ci-dessous puis appuie sur la combinaison à
          enregistrer. Le reset remet uniquement la touche par défaut.
        </p>

        <Button
          disabled={isBusy}
          onClick={() => {
            setError(null);
            setInfo(null);
            setIsCapturingShortcut((currentValue) => !currentValue);
          }}
          variant="subtle"
        >
          {isCapturingShortcut
            ? "En attente d'une combinaison..."
            : "Modifier le raccourci"}
        </Button>

        {isCapturingShortcut && (
          <div className="rounded-lg border border-dashed border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Appuie maintenant sur la combinaison à enregistrer dans la popup.
          </div>
        )}

        <Button
          disabled={isBusy}
          onClick={handleResetShortcut}
          variant="secondary"
        >
          Réinitialiser sur V
        </Button>
      </div>
    </div>
  );
}
