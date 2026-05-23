import {
  hasExtensionContext,
  isExtensionContextInvalidationError,
} from "./extension-context";
import { matchesShortcut } from "./shortcut";
import { SolverController } from "./solver-controller";
import { getStoredSolverSettings } from "./storage";
import { createDefaultRuntimeStatus } from "./status";
import type { ContentRequestMessage } from "./types";

const controller = new SolverController();

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

if (hasExtensionContext()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const requestMessage = message as ContentRequestMessage;

    async function handleRequest(): Promise<void> {
      switch (requestMessage.type) {
        case "getRuntimeStatus":
          sendResponse(await controller.getRuntimeStatus());
          break;
        case "extractExerciseSnapshot":
          sendResponse(await controller.extractExactSnapshot());
          break;
        case "updateSolverSettings":
          sendResponse(await controller.updateSettings(requestMessage.value));
          break;
        case "runSingleSolve":
          sendResponse(await controller.runSingleSolve(requestMessage.source));
          break;
        case "solveCurrentExercise":
          sendResponse(await controller.solveCurrentExercise(requestMessage.trigger));
          break;
        default:
          sendResponse({
            ok: false,
            status: (await controller.getRuntimeStatus()).status,
            message: "Message non pris en charge.",
          });
      }
    }

    void handleRequest().catch((error) => {
      if (isExtensionContextInvalidationError(error)) {
        sendResponse({
          ok: false,
          status: createDefaultRuntimeStatus(),
          message: "Le contexte de l'extension a ete recharge. Rechargez l'onglet.",
        });
        return;
      }

      console.error("[PVC] Content request failed:", error);
      sendResponse({
        ok: false,
        status: createDefaultRuntimeStatus(),
        message: "Le script de page a rencontre une erreur interne.",
      });
    });

    return true;
  });
}

document.addEventListener("keydown", (event) => {
  if (event.repeat || isEditableTarget(event.target)) {
    return;
  }

  void getStoredSolverSettings()
    .then(async (settings) => {
      if (!matchesShortcut(event, settings.shortcutConfig)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      await controller.runSingleSolve("shortcut");
    })
    .catch((error) => {
      if (!isExtensionContextInvalidationError(error)) {
        console.error("[PVC] Shortcut handling failed:", error);
      }
    });
}, true);

if (hasExtensionContext() && chrome.storage?.onChanged) {
  void controller.initialize().catch(() => {
    // Ignore initialization failures caused by a stale content script after reload.
  });
}
