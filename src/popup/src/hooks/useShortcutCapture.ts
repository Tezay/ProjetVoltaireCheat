import { useEffect } from "react";
import { shortcutFromKeyboardEvent } from "../extension/shortcut";
import type { ShortcutConfig } from "../extension/types";

export function useShortcutCapture(
  isCapturing: boolean,
  enabledForCapture: boolean,
  onCaptured: (shortcut: ShortcutConfig) => void,
  onInvalid: () => void
): void {
  useEffect(() => {
    if (!isCapturing) {
      return;
    }

    function handleShortcutCapture(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();

      const nextShortcut = shortcutFromKeyboardEvent(event, enabledForCapture);

      if (!nextShortcut) {
        onInvalid();
        return;
      }

      onCaptured(nextShortcut);
    }

    window.addEventListener("keydown", handleShortcutCapture, true);

    return () => {
      window.removeEventListener("keydown", handleShortcutCapture, true);
    };
  }, [isCapturing, enabledForCapture, onCaptured, onInvalid]);
}
