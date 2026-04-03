import { showError, showLoading, showSentenceAnalysis } from "./card";
import {
  isEditableTarget,
  matchesShortcut,
  normalizeShortcutConfig,
} from "./shortcut";
import { getSentence } from "./sentence";
import { getStoredShortcutConfig } from "./storage";
import {
  SHORTCUT_STORAGE_KEY,
  type BackgroundResponseMessage,
  type ContentRequestMessage,
  type DetectionErrorCode,
  type ShortcutConfig,
  type TriggerDetectionResponse,
} from "./types";

const UNSUPPORTED_INTERFACE_MESSAGE =
  "Impossible de détecter la phrase. Ouvrez un exercice Projet Voltaire compatible.";
const SERVICE_UNAVAILABLE_MESSAGE =
  "Le service de l'extension est indisponible. Rechargez l'extension puis réessayez.";

let shortcutConfig: ShortcutConfig = normalizeShortcutConfig();
let isAnalyzing = false;

function buildErrorResponse(
  code: DetectionErrorCode,
  message: string
): TriggerDetectionResponse {
  return { status: "error", code, message };
}

async function runDetection(): Promise<TriggerDetectionResponse> {
  if (isAnalyzing) {
    return buildErrorResponse(
      "analysis_in_progress",
      "Une analyse est déjà en cours."
    );
  }

  const sentence = getSentence();
  if (!sentence) {
    showError(UNSUPPORTED_INTERFACE_MESSAGE);

    return buildErrorResponse("unsupported_interface", UNSUPPORTED_INTERFACE_MESSAGE);
  }

  isAnalyzing = true;
  showLoading("Analyse de la phrase en cours...");

  try {
    const response = (await chrome.runtime.sendMessage({
      type: "analyzeSentence",
      sentence,
    })) as BackgroundResponseMessage;

    if (response.type === "analysisError") {
      showError(response.message);

      return buildErrorResponse(response.code, response.message);
    }

    showSentenceAnalysis(sentence, response.value);

    return { status: "success" };
  } catch {
    showError(SERVICE_UNAVAILABLE_MESSAGE);

    return buildErrorResponse("service_unavailable", SERVICE_UNAVAILABLE_MESSAGE);
  } finally {
    isAnalyzing = false;
  }
}

async function handleMessage(
  message: ContentRequestMessage
): Promise<TriggerDetectionResponse | null> {
  if (message.type !== "triggerDetection") {
    return null;
  }

  return runDetection();
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.repeat || isEditableTarget(event.target)) {
    return;
  }

  if (!matchesShortcut(event, shortcutConfig)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  void runDetection();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message as ContentRequestMessage).then((response) => {
    if (response) {
      sendResponse(response);
    }
  });

  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[SHORTCUT_STORAGE_KEY]) {
    return;
  }

  shortcutConfig = normalizeShortcutConfig(
    changes[SHORTCUT_STORAGE_KEY].newValue as Partial<ShortcutConfig> | undefined
  );
});

document.addEventListener("keydown", handleKeydown, true);

void getStoredShortcutConfig().then((storedConfig) => {
  shortcutConfig = storedConfig;
});
