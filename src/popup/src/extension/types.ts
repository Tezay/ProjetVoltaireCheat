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

export const SHORTCUT_STORAGE_KEY = "shortcutConfig";

export const DEFAULT_SHORTCUT_CONFIG: ShortcutConfig = {
  enabled: false,
  key: "V",
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
};

export type AnalysisErrorCode =
  | "rate_limited"
  | "timeout"
  | "network_error";

export interface AnalyzeSentenceMessage {
  type: "analyzeSentence";
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

export interface TriggerDetectionMessage {
  type: "triggerDetection";
  source: "popup" | "shortcut";
}

export type DetectionErrorCode =
  | AnalysisErrorCode
  | "analysis_in_progress"
  | "service_unavailable"
  | "unsupported_interface";

export type TriggerDetectionResponse =
  | { status: "success" }
  | { status: "error"; code: DetectionErrorCode; message: string };

export type BackgroundRequestMessage = AnalyzeSentenceMessage;
export type BackgroundResponseMessage =
  | AnalysisResultMessage
  | AnalysisErrorMessage;
export type ContentRequestMessage = TriggerDetectionMessage;
