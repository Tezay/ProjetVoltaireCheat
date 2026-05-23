import { ensureStoredSolverSettings } from "./storage";
import type {
  AnalysisErrorCode,
  AnalysisErrorMessage,
  AnalysisFallbackMessage,
  AnalysisResultMessage,
  BackgroundRequestMessage,
  CorrectedSentence,
} from "./types";

const REVERSO_API_URL = "https://orthographe.reverso.net/api/v1/Spelling";
const REQUEST_TIMEOUT_MS = 10000;

function buildAnalysisError(
  code: AnalysisErrorCode,
  message: string
): AnalysisErrorMessage {
  return {
    type: "analysisError",
    code,
    message,
  };
}

async function fetchFallbackAnalysis(
  sentence: string
): Promise<AnalysisResultMessage | AnalysisErrorMessage> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(REVERSO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        language: "fra",
        text: sentence,
        autoReplace: true,
        interfaceLanguage: "fr",
        locale: "Indifferent",
        origin: "interactive",
        generateSynonyms: false,
        getCorrectionDetails: true,
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      return buildAnalysisError(
        "rate_limited",
        "Rate limite par Reverso. Reessayez dans quelques secondes."
      );
    }

    if (!response.ok) {
      return buildAnalysisError(
        "network_error",
        "Erreur de connexion a Reverso."
      );
    }

    const payload = (await response.json()) as CorrectedSentence;

    return {
      type: "analysisResult",
      value: payload,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return buildAnalysisError("timeout", "Timeout - Reverso ne repond pas.");
    }

    return buildAnalysisError("network_error", "Erreur de connexion a Reverso.");
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function handleAnalysisFallback(
  message: AnalysisFallbackMessage
): Promise<AnalysisResultMessage | AnalysisErrorMessage> {
  return fetchFallbackAnalysis(message.sentence);
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureStoredSolverSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStoredSolverSettings();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const runtimeMessage = message as BackgroundRequestMessage;

  if (runtimeMessage.type !== "analysisFallback") {
    return false;
  }

  void handleAnalysisFallback(runtimeMessage).then(sendResponse);

  return true;
});
