import { useEffect, useState } from "react";
import Button from "./components/Button";
import InfoPill from "./components/InfoPill";
import MetricTile from "./components/MetricTile";
import Switch from "./components/Switch";
import {
  normalizeDelayMs,
  normalizeExactErrorRate,
} from "./extension/settings-model";
import {
  createDefaultRuntimeStatus,
  getExerciseLabel,
  getPageLabel,
} from "./extension/status";
import {
  getStoredSolverSettings,
  setStoredSolverSettings,
} from "./extension/storage";
import {
  formatShortcut,
  shortcutFromKeyboardEvent,
} from "./extension/shortcut";
import {
  DEFAULT_SHORTCUT_CONFIG,
  DEFAULT_SOLVER_SETTINGS,
  type ContentResponseMessage,
  type RuntimeStatus,
  type SolverSettings,
} from "./extension/types";

const STATUS_POLL_INTERVAL_MS = 1500;

async function getActiveTabId(): Promise<number | null> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return activeTab?.id ?? null;
}

async function sendMessageToActiveTab(
  message: unknown
): Promise<ContentResponseMessage | null> {
  const tabId = await getActiveTabId();

  if (!tabId) {
    return null;
  }

  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as ContentResponseMessage;
  } catch {
    return null;
  }
}

type SourceIndicatorConfig = {
  dot: string;
  bg: string;
  border: string;
  title: string;
  subtitle: string;
};

function getSourceIndicator(
  status: RuntimeStatus,
  reversoOnlyMode: boolean
): SourceIndicatorConfig | null {
  if (status.pageKind !== "exercise") {
    return null;
  }

  if (
    status.currentAnswerSource === "fiber_exact" ||
    status.currentAnswerSource === "fiber_exact_dom_located"
  ) {
    return {
      dot: "bg-emerald-500",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      title: "Lecture directe",
      subtitle: "Réponse lue directement sur la page — certaine",
    };
  }

  if (status.currentAnswerSource === "reverso_fallback" || reversoOnlyMode) {
    return {
      dot: "bg-sky-500",
      bg: "bg-sky-50",
      border: "border-sky-200",
      title: "Reverso (suggestion)",
      subtitle: "Suggestion de correction approximative",
    };
  }

  if (status.currentAnswerSource === "unavailable") {
    return {
      dot: "bg-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-200",
      title: "Source indisponible",
      subtitle: "Impossible de lire ou suggérer une réponse",
    };
  }

  return {
    dot: "bg-slate-400",
    bg: "bg-slate-50",
    border: "border-slate-200",
    title: "Aucune question active",
    subtitle: "En attente d'un exercice",
  };
}

export function App() {
  const [settings, setSettings] = useState<SolverSettings>(DEFAULT_SOLVER_SETTINGS);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>(
    createDefaultRuntimeStatus(DEFAULT_SOLVER_SETTINGS)
  );
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [solvingNow, setSolvingNow] = useState(false);
  const [capturingShortcut, setCapturingShortcut] = useState(false);
  const [delayDraft, setDelayDraft] = useState({
    min: String(DEFAULT_SOLVER_SETTINGS.delayMinMs / 1000),
    max: String(DEFAULT_SOLVER_SETTINGS.delayMaxMs / 1000),
  });
  const [exactErrorDraft, setExactErrorDraft] = useState(
    DEFAULT_SOLVER_SETTINGS.exactErrorRate
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialState() {
      try {
        const storedSettings = await getStoredSolverSettings();
        setSettings(storedSettings);
        setDelayDraft({
          min: String(storedSettings.delayMinMs / 1000),
          max: String(storedSettings.delayMaxMs / 1000),
        });
        setExactErrorDraft(storedSettings.exactErrorRate);
      } catch {
        setErrorMessage("Impossible de charger les réglages.");
      } finally {
        setLoadingSettings(false);
      }
    }

    void loadInitialState();
  }, []);

  useEffect(() => {
    async function refreshRuntimeStatus() {
      const response = await sendMessageToActiveTab({
        type: "getRuntimeStatus",
      });

      if (response?.status) {
        setRuntimeStatus(response.status);
        return;
      }

      setRuntimeStatus((currentStatus) => ({
        ...createDefaultRuntimeStatus(settings),
        lastSolveOutcome: currentStatus.lastSolveOutcome,
        sessionStats: currentStatus.sessionStats,
      }));
    }

    void refreshRuntimeStatus();
    const intervalId = window.setInterval(() => {
      void refreshRuntimeStatus();
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [settings]);

  useEffect(() => {
    if (!capturingShortcut) {
      return;
    }

    function handleShortcutCapture(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      const nextShortcut = shortcutFromKeyboardEvent(
        event,
        settings.shortcutConfig.enabled
      );

      if (!nextShortcut) {
        setErrorMessage("La combinaison doit inclure une touche principale.");
        return;
      }

      setCapturingShortcut(false);
      void persistSettings(
        {
          shortcutConfig: nextShortcut,
        },
        "Nouveau raccourci enregistré."
      );
    }

    window.addEventListener("keydown", handleShortcutCapture, true);

    return () => {
      window.removeEventListener("keydown", handleShortcutCapture, true);
    };
  }, [capturingShortcut, settings.shortcutConfig.enabled]);

  const isBusy = loadingSettings || savingSettings || solvingNow;
  const formattedShortcut = formatShortcut(settings.shortcutConfig);
  const normalizedDraftDelayMin = normalizeDelayMs(Math.round(Number(delayDraft.min) * 1000));
  const normalizedDraftDelayMax = Math.max(
    normalizedDraftDelayMin,
    normalizeDelayMs(Math.round(Number(delayDraft.max) * 1000))
  );
  const exactSliderEnabled =
    settings.autoSolveEnabled && !settings.reversoOnlyMode;
  const exactSourceReady =
    runtimeStatus.exactCapability === "ready" &&
    !settings.reversoOnlyMode;

  const headerBadge =
    settings.autoSolveEnabled && settings.shortcutConfig.enabled
      ? "Auto · Raccourci"
      : settings.autoSolveEnabled
        ? "Mode automatique"
        : settings.shortcutConfig.enabled
          ? "Raccourci seul"
          : "Mode manuel";

  const sourceIndicator = getSourceIndicator(runtimeStatus, settings.reversoOnlyMode);

  const shortcutDisplay = settings.shortcutConfig.enabled
    ? `${formattedShortcut} · Actif`
    : `${formattedShortcut} · Inactif`;

  async function persistSettings(
    partialSettings: Partial<SolverSettings>,
    successMessage: string
  ) {
    setSavingSettings(true);

    try {
      const nextSettings = await setStoredSolverSettings(partialSettings);
      setSettings(nextSettings);
      setDelayDraft({
        min: String(nextSettings.delayMinMs / 1000),
        max: String(nextSettings.delayMaxMs / 1000),
      });
      setExactErrorDraft(nextSettings.exactErrorRate);
      setErrorMessage(null);
      setInfoMessage(successMessage);

      const runtimeResponse = await sendMessageToActiveTab({
        type: "updateSolverSettings",
        value: partialSettings,
      });

      if (runtimeResponse?.status) {
        setRuntimeStatus(runtimeResponse.status);
      }
    } catch {
      setInfoMessage(null);
      setErrorMessage("Impossible d'enregistrer les réglages.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSolveNow() {
    setSolvingNow(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const response = await sendMessageToActiveTab({
      type: "runSingleSolve",
      source: "popup",
    });

    setSolvingNow(false);

    if (!response) {
      setErrorMessage("Rechargez la page Projet Voltaire puis réessayez.");
      return;
    }

    setRuntimeStatus(response.status);

    if (!response.ok) {
      setErrorMessage(response.message ?? "Impossible de lancer la correction.");
      return;
    }

    setInfoMessage(response.message ?? "Correction lancée.");
  }

  async function commitExactErrorDraft() {
    const nextExactErrorRate = normalizeExactErrorRate(exactErrorDraft);
    setExactErrorDraft(nextExactErrorRate);

    if (nextExactErrorRate === settings.exactErrorRate) {
      return;
    }

    await persistSettings(
      {
        exactErrorRate: nextExactErrorRate,
      },
      "Taux d'erreur directe mis à jour."
    );
  }

  const exactSliderHint = !settings.autoSolveEnabled
    ? "Activez d'abord le mode automatique."
    : settings.reversoOnlyMode
      ? "Indisponible en mode Reverso seul."
      : exactSourceReady
        ? "Applique les erreurs de test uniquement aux réponses directes."
        : "Prêt pour la prochaine réponse directe lue sur la page.";

  return (
    <div className="w-[26rem] max-h-[42rem] overflow-y-auto bg-slate-100 p-4 text-slate-900">
      <div className="mb-4 rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_100%)] p-4 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              v3.0.0
            </div>
            <h1 className="mt-1 text-lg font-bold">Projet Voltaire Cheat</h1>
          </div>
          <div className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-blue-50">
            {headerBadge}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-3 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-sm">
          {errorMessage}
        </div>
      )}

      {infoMessage && (
        <div className="mb-3 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-sm">
          {infoMessage}
        </div>
      )}

      <div className="space-y-4">
        <Switch
          checked={settings.autoSolveEnabled}
          description="L'extension répond, valide et passe à la suite automatiquement."
          disabled={isBusy}
          label="Mode automatique"
          onChange={(checked) => {
            void persistSettings(
              {
                autoSolveEnabled: checked,
              },
              checked ? "Mode automatique activé." : "Mode automatique désactivé."
            );
          }}
        />

        <Button disabled={isBusy} onClick={handleSolveNow}>
          {solvingNow ? "Correction en cours..." : "Corriger cette question"}
        </Button>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <InfoPill>{getPageLabel(runtimeStatus.pageKind)}</InfoPill>
            {settings.reversoOnlyMode && (
              <InfoPill tone="fallback">Reverso seul</InfoPill>
            )}
          </div>

          {sourceIndicator && (
            <div
              className={`mt-4 rounded-2xl border ${sourceIndicator.border} ${sourceIndicator.bg} p-3`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${sourceIndicator.dot}`}
                />
                <span className="text-sm font-semibold text-slate-900">
                  {sourceIndicator.title}
                </span>
              </div>
              <div className="mt-1 pl-[18px] text-xs leading-5 text-slate-600">
                {sourceIndicator.subtitle}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Question
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {getExerciseLabel(runtimeStatus.currentExerciseKind)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Raccourci
              </div>
              <div className="mt-1 font-semibold text-slate-900">
                {shortcutDisplay}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Phrase en cours
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-700">
              {runtimeStatus.currentQuestionLabel ?? "Aucune question lue pour l'instant."}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Dernière action
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-700">
              {runtimeStatus.lastSolveOutcome?.message ??
                "Aucune action lancée pendant cette session."}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Statistiques de session
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricTile
              label="Directes"
              tone="exact"
              value={String(runtimeStatus.sessionStats.exactSolved)}
            />
            <MetricTile
              label="Reverso"
              tone="fallback"
              value={String(runtimeStatus.sessionStats.reversoSolved)}
            />
            <MetricTile
              label="Total"
              value={String(runtimeStatus.sessionStats.totalActions)}
            />
            <MetricTile
              label="Transitions"
              value={String(runtimeStatus.sessionStats.skipped)}
            />
            <MetricTile
              label="Pauses"
              tone="warning"
              value={String(runtimeStatus.sessionStats.paused)}
            />
            <MetricTile
              label="Erreurs de test"
              value={String(runtimeStatus.sessionStats.intentionalErrors)}
            />
          </div>

          <div className="mt-4 text-xs leading-5 text-slate-600">
            Aperçus internes lus : {runtimeStatus.exactSnapshotCount}
          </div>
        </div>

        <details
          className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
          onToggle={(event) => {
            const detailsElement = event.currentTarget;
            if (detailsElement.open !== settings.advancedPanelOpen) {
              void persistSettings(
                {
                  advancedPanelOpen: detailsElement.open,
                },
                detailsElement.open
                  ? "Réglages avancés ouverts."
                  : "Réglages avancés fermés."
              );
            }
          }}
          open={settings.advancedPanelOpen}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
            Réglages avancés
          </summary>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <Switch
                checked={settings.reversoOnlyMode}
                description="Désactive la lecture Projet Voltaire et utilise seulement Reverso. Pratique pour les tests."
                disabled={isBusy}
                label="Utiliser seulement Reverso"
                onChange={(checked) => {
                  void persistSettings(
                    {
                      reversoOnlyMode: checked,
                    },
                    checked
                      ? "Mode Reverso seul activé."
                      : "Mode Projet Voltaire + Reverso activé."
                  );
                }}
              />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Délai auto
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-600">
                  Min (s)
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    min={1}
                    onChange={(event) => {
                      setDelayDraft((currentValue) => ({
                        ...currentValue,
                        min: event.target.value,
                      }));
                    }}
                    step={0.1}
                    type="number"
                    value={delayDraft.min}
                  />
                </label>

                <label className="text-xs text-slate-600">
                  Max (s)
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    min={1}
                    onChange={(event) => {
                      setDelayDraft((currentValue) => ({
                        ...currentValue,
                        max: event.target.value,
                      }));
                    }}
                    step={0.1}
                    type="number"
                    value={delayDraft.max}
                  />
                </label>
              </div>

              <div className="mt-3 text-xs text-slate-600">
                Entre {(normalizedDraftDelayMin / 1000).toFixed(1)} et {(normalizedDraftDelayMax / 1000).toFixed(1)} s
              </div>

              <div className="mt-3">
                <Button
                  disabled={isBusy}
                  onClick={() => {
                    void persistSettings(
                      {
                        delayMinMs: normalizedDraftDelayMin,
                        delayMaxMs: normalizedDraftDelayMax,
                      },
                      "Délai automatique mis à jour."
                    );
                  }}
                  variant="secondary"
                >
                  Appliquer
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Taux d'erreur directe
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">
                    {exactErrorDraft}%
                  </div>
                </div>
                <InfoPill tone={exactSliderEnabled ? "exact" : "default"}>
                  {exactSliderEnabled ? "Actif" : "En attente"}
                </InfoPill>
              </div>

              <input
                className="mt-4 w-full accent-emerald-600 disabled:opacity-50"
                disabled={!exactSliderEnabled}
                max={50}
                min={0}
                onChange={(event) => {
                  setExactErrorDraft(
                    normalizeExactErrorRate(Number(event.target.value))
                  );
                }}
                onBlur={() => {
                  void commitExactErrorDraft();
                }}
                onKeyUp={() => {
                  void commitExactErrorDraft();
                }}
                onMouseUp={() => {
                  void commitExactErrorDraft();
                }}
                onTouchEnd={() => {
                  void commitExactErrorDraft();
                }}
                step={1}
                type="range"
                value={exactErrorDraft}
              />

              <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-500">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
              </div>

              <div className="mt-3 text-xs leading-5 text-slate-600">
                {exactSliderHint}
              </div>
            </div>

            <div className="col-span-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Raccourci
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {formattedShortcut}
                  </div>
                </div>
                <InfoPill tone={settings.shortcutConfig.enabled ? "exact" : "default"}>
                  {settings.shortcutConfig.enabled ? "Actif" : "Inactif"}
                </InfoPill>
              </div>

              <div className="mt-3 text-xs leading-5 text-slate-600">
                Ce raccourci lance une correction ponctuelle de la question en cours.
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button
                  disabled={isBusy}
                  onClick={() => {
                    setCapturingShortcut(false);
                    void persistSettings(
                      {
                        shortcutConfig: {
                          ...settings.shortcutConfig,
                          enabled: !settings.shortcutConfig.enabled,
                        },
                      },
                      settings.shortcutConfig.enabled
                        ? "Raccourci désactivé."
                        : "Raccourci activé."
                    );
                  }}
                  variant="secondary"
                >
                  {settings.shortcutConfig.enabled ? "Désactiver" : "Activer"}
                </Button>

                <Button
                  disabled={isBusy}
                  onClick={() => {
                    setErrorMessage(null);
                    setInfoMessage(null);
                    setCapturingShortcut((currentValue) => !currentValue);
                  }}
                  variant="subtle"
                >
                  {capturingShortcut ? "En attente..." : "Modifier"}
                </Button>

                <Button
                  disabled={isBusy}
                  onClick={() => {
                    setCapturingShortcut(false);
                    void persistSettings(
                      {
                        shortcutConfig: {
                          ...DEFAULT_SHORTCUT_CONFIG,
                          enabled: settings.shortcutConfig.enabled,
                        },
                      },
                      "Raccourci réinitialisé sur V."
                    );
                  }}
                  variant="secondary"
                >
                  Réinitialiser
                </Button>
              </div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
