import { normalizeShortcutConfig } from "./shortcut";
import {
  DEFAULT_SOLVER_SETTINGS,
  type AnswerSource,
  type ShortcutConfig,
  type SolveTrigger,
  type SolverSettings,
} from "./types";

const MIN_DELAY_MS = 1000;
const MAX_ERROR_RATE = 50;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeDelayMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SOLVER_SETTINGS.delayMinMs;
  }

  return Math.max(MIN_DELAY_MS, Math.round(value));
}

export function normalizeExactErrorRate(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_SOLVER_SETTINGS.exactErrorRate;
  }

  return clampNumber(Math.round(value), 0, MAX_ERROR_RATE);
}

export function normalizeSolverSettings(
  storedSettings?: Partial<SolverSettings> | null,
  legacyShortcut?: Partial<ShortcutConfig> | null
): SolverSettings {
  const shortcutConfig = normalizeShortcutConfig(
    storedSettings?.shortcutConfig ?? legacyShortcut ?? DEFAULT_SOLVER_SETTINGS.shortcutConfig
  );
  const delayMinMs = normalizeDelayMs(storedSettings?.delayMinMs);
  const delayMaxMs = Math.max(
    delayMinMs,
    normalizeDelayMs(storedSettings?.delayMaxMs)
  );

  return {
    autoSolveEnabled:
      storedSettings?.autoSolveEnabled ?? DEFAULT_SOLVER_SETTINGS.autoSolveEnabled,
    reversoOnlyMode:
      storedSettings?.reversoOnlyMode ?? DEFAULT_SOLVER_SETTINGS.reversoOnlyMode,
    shortcutConfig,
    delayMinMs,
    delayMaxMs,
    exactErrorRate: normalizeExactErrorRate(storedSettings?.exactErrorRate),
    advancedPanelOpen:
      storedSettings?.advancedPanelOpen ?? DEFAULT_SOLVER_SETTINGS.advancedPanelOpen,
  };
}

export function shouldTriggerExactError(params: {
  mode: SolveTrigger;
  answerSource: AnswerSource;
  exactErrorRate: number;
  randomValue: number;
}): boolean {
  const normalizedRate = normalizeExactErrorRate(params.exactErrorRate);

  if (params.mode !== "auto" || normalizedRate === 0) {
    return false;
  }

  if (
    params.answerSource !== "fiber_exact" &&
    params.answerSource !== "fiber_exact_dom_located"
  ) {
    return false;
  }

  return params.randomValue * 100 < normalizedRate;
}
