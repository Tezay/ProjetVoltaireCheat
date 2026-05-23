export interface Correction {
  startIndex: number;
  endIndex: number;
  mistakeText?: string;
  correctionText?: string;
}

export interface CorrectedSentence {
  text: string;
  corrections: Correction[];
}

export interface ShortcutConfig {
  enabled: boolean;
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type PageKind = "unsupported" | "exercise" | "training";

export type ExerciseKind =
  | "click_on_mistake"
  | "click_on_word"
  | "drag_and_drop"
  | "unknown";

export type AnswerSource =
  | "fiber_exact"
  | "fiber_exact_dom_located"
  | "reverso_fallback"
  | "unavailable";

export type ExactCapability =
  | "ready"
  | "fallback_only"
  | "unavailable"
  | "unsupported";

export type SolveTrigger = "auto" | "popup" | "shortcut";

export interface SolverSettings {
  autoSolveEnabled: boolean;
  reversoOnlyMode: boolean;
  shortcutConfig: ShortcutConfig;
  delayMinMs: number;
  delayMaxMs: number;
  exactErrorRate: number;
  advancedPanelOpen: boolean;
}

export interface SessionStats {
  exactSolved: number;
  reversoSolved: number;
  paused: number;
  skipped: number;
  intentionalErrors: number;
  totalActions: number;
}

export interface SolveOutcome {
  kind: "idle" | "solved" | "skipped" | "paused" | "error";
  message: string;
  source: AnswerSource | "system";
  at: number;
}

export interface RuntimeStatus {
  pageKind: PageKind;
  currentExerciseKind: ExerciseKind | null;
  currentAnswerSource: AnswerSource | null;
  exactCapability: ExactCapability;
  exactSnapshotCount: number;
  lastSolveOutcome: SolveOutcome | null;
  sessionStats: SessionStats;
  currentQuestionLabel: string | null;
  currentQuestionFingerprint: string | null;
  autoSolveEnabled: boolean;
  shortcutEnabled: boolean;
  isBusy: boolean;
}

export interface ExerciseSentencePart {
  text: string;
  mistake?: boolean;
  clue?: boolean;
}

export interface ExerciseColumnSnapshot {
  instruction: string;
  words: string[];
}

export interface ExerciseSnapshot {
  id: string;
  kind: ExerciseKind;
  sentence: ExerciseSentencePart[];
  hasMistake?: boolean;
  columns: ExerciseColumnSnapshot[];
  metadata: {
    rawType?: string;
  };
}

export interface ExactSnapshotPayload {
  exercises: ExerciseSnapshot[];
  extractedAt: number;
  count: number;
}

export interface WordRangeSnapshot {
  text: string;
  startIndex: number;
  endIndex: number;
}

export type SolveDecision =
  | {
    kind: "click_word";
    word: string;
    source: AnswerSource;
    reason: string;
  }
  | {
    kind: "click_no_mistake";
    source: AnswerSource;
    reason: string;
  };

export const SHORTCUT_STORAGE_KEY = "shortcutConfig";
export const SOLVER_SETTINGS_STORAGE_KEY = "solverSettings";
export const POPUP_ONBOARDING_STORAGE_KEY = "popupOnboardingDismissed";

export const DEFAULT_SHORTCUT_CONFIG: ShortcutConfig = {
  enabled: false,
  key: "V",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
};

export const DEFAULT_SOLVER_SETTINGS: SolverSettings = {
  autoSolveEnabled: false,
  reversoOnlyMode: false,
  shortcutConfig: DEFAULT_SHORTCUT_CONFIG,
  delayMinMs: 1000,
  delayMaxMs: 2000,
  exactErrorRate: 0,
  advancedPanelOpen: false,
};

export const DEFAULT_SESSION_STATS: SessionStats = {
  exactSolved: 0,
  reversoSolved: 0,
  paused: 0,
  skipped: 0,
  intentionalErrors: 0,
  totalActions: 0,
};

export type AnalysisErrorCode =
  | "rate_limited"
  | "timeout"
  | "network_error";

export interface AnalysisFallbackMessage {
  type: "analysisFallback";
  sentence: string;
}

export interface AnalysisResultMessage {
  type: "analysisResult";
  value: CorrectedSentence;
}

export interface AnalysisErrorMessage {
  type: "analysisError";
  code: AnalysisErrorCode;
  message: string;
}

export interface GetRuntimeStatusMessage {
  type: "getRuntimeStatus";
}

export interface UpdateSolverSettingsMessage {
  type: "updateSolverSettings";
  value: Partial<SolverSettings>;
}

export interface RunSingleSolveMessage {
  type: "runSingleSolve";
  source: Exclude<SolveTrigger, "auto">;
}

export interface SolveCurrentExerciseMessage {
  type: "solveCurrentExercise";
  trigger: SolveTrigger;
}

export interface ExtractExerciseSnapshotMessage {
  type: "extractExerciseSnapshot";
}

export interface ContentResponseMessage {
  ok: boolean;
  status: RuntimeStatus;
  message?: string;
  snapshotCount?: number;
}

export type BackgroundRequestMessage = AnalysisFallbackMessage;
export type BackgroundResponseMessage =
  | AnalysisResultMessage
  | AnalysisErrorMessage;

export type ContentRequestMessage =
  | GetRuntimeStatusMessage
  | UpdateSolverSettingsMessage
  | RunSingleSolveMessage
  | SolveCurrentExerciseMessage
  | ExtractExerciseSnapshotMessage;
