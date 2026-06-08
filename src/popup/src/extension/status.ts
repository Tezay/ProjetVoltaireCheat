import {
  DEFAULT_SESSION_STATS,
  DEFAULT_SOLVER_SETTINGS,
  type AnswerSource,
  type ExerciseKind,
  type PageKind,
  type RuntimeStatus,
  type SessionStats,
  type SolveOutcome,
  type SolverSettings,
} from "./types";

export function createDefaultSessionStats(): SessionStats {
  return { ...DEFAULT_SESSION_STATS };
}

export function createDefaultRuntimeStatus(
  settings: SolverSettings = DEFAULT_SOLVER_SETTINGS
): RuntimeStatus {
  return {
    pageKind: "unsupported",
    currentExerciseKind: null,
    currentAnswerSource: null,
    exactCapability: "unsupported",
    exactSnapshotCount: 0,
    lastSolveOutcome: null,
    sessionStats: createDefaultSessionStats(),
    currentQuestionLabel: null,
    currentQuestionFingerprint: null,
    autoSolveEnabled: settings.autoSolveEnabled,
    shortcutEnabled: settings.shortcutConfig.enabled,
    isBusy: false,
  };
}

export function createSolveOutcome(
  kind: SolveOutcome["kind"],
  message: string,
  source: SolveOutcome["source"]
): SolveOutcome {
  return {
    kind,
    message,
    source,
    at: Date.now(),
  };
}

export function getPageLabel(pageKind: PageKind): string {
  switch (pageKind) {
    case "exercise":
      return "Exercice";
    case "training":
      return "Entraînement";
    case "evaluation":
      return "Évaluation";
    default:
      return "Hors exercice";
  }
}

export function getExerciseLabel(exerciseKind: ExerciseKind | null): string {
  switch (exerciseKind) {
    case "click_on_mistake":
      return "Phrase";
    case "click_on_word":
      return "Mot à trouver";
    case "drag_and_drop":
      return "Classement";
    case "unknown":
      return "Question";
    default:
      return "En attente";
  }
}

export function getSourceLabel(answerSource: AnswerSource | null): string {
  switch (answerSource) {
    case "fiber_exact":
    case "fiber_exact_dom_located":
      return "Réponse directe";
    case "reverso_fallback":
      return "Suggestion Reverso";
    case "unavailable":
      return "Lecture indisponible";
    default:
      return "Aucune source";
  }
}

export function getExactCapabilityLabel(
  exactCapability: RuntimeStatus["exactCapability"],
  reversoOnlyMode = false
): string {
  if (reversoOnlyMode) {
    return "Reverso uniquement";
  }

  switch (exactCapability) {
    case "ready":
      return "Lecture directe prête";
    case "fallback_only":
      return "Reverso disponible";
    case "unavailable":
      return "Lecture indisponible";
    default:
      return "Hors exercice";
  }
}
