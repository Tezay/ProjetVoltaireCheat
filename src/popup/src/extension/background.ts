import { ensureStoredShortcutConfig } from "./storage";
import {
  type AnalysisErrorMessage,
  type AnalysisErrorCode,
  type AnalysisResultMessage,
  type AnalyzeSentenceMessage,
  type BackgroundRequestMessage,
  type CorrectedSentence,
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

async function fetchSentenceAnalysis(
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
        "Rate limité par Reverso. Réessayez dans quelques secondes."
      );
    }

    if (!response.ok) {
      return buildAnalysisError(
        "network_error",
        "Erreur de connexion à Reverso."
      );
    }

    const data = (await response.json()) as CorrectedSentence;

    return {
      type: "analysisResult",
      value: data,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return buildAnalysisError("timeout", "Timeout - Reverso ne répond pas.");
    }

    return buildAnalysisError("network_error", "Erreur de connexion à Reverso.");
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function handleAnalyzeSentence(
  message: AnalyzeSentenceMessage
): Promise<AnalysisResultMessage | AnalysisErrorMessage> {
  return fetchSentenceAnalysis(message.sentence);
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureStoredShortcutConfig();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStoredShortcutConfig();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const runtimeMessage = message as BackgroundRequestMessage;

  if (runtimeMessage.type !== "analyzeSentence") {
    return false;
  }

  void handleAnalyzeSentence(runtimeMessage).then(sendResponse);

  return true;
});
