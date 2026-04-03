import {
  DEFAULT_SHORTCUT_CONFIG,
  type ShortcutConfig,
} from "./types";

const MODIFIER_KEYS = new Set(["Alt", "Control", "Meta", "Shift"]);

const SPECIAL_KEY_LABELS: Record<string, string> = {
  ArrowDown: "Bas",
  ArrowLeft: "Gauche",
  ArrowRight: "Droite",
  ArrowUp: "Haut",
  Backspace: "Retour",
  Delete: "Suppr",
  Enter: "Entrée",
  Escape: "Échap",
  Home: "Début",
  Insert: "Inser",
  PageDown: "Page bas",
  PageUp: "Page haut",
  Space: "Espace",
  Tab: "Tab",
};

function normalizeKeyValue(key: string | undefined): string {
  if (!key) {
    return DEFAULT_SHORTCUT_CONFIG.key;
  }

  if (key === " ") {
    return "Space";
  }

  if (key.startsWith("Arrow")) {
    return key;
  }

  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
}

export function normalizeShortcutConfig(
  config?: Partial<ShortcutConfig> | null
): ShortcutConfig {
  return {
    enabled: config?.enabled ?? DEFAULT_SHORTCUT_CONFIG.enabled,
    key: normalizeKeyValue(config?.key),
    ctrlKey: config?.ctrlKey ?? DEFAULT_SHORTCUT_CONFIG.ctrlKey,
    altKey: config?.altKey ?? DEFAULT_SHORTCUT_CONFIG.altKey,
    shiftKey: config?.shiftKey ?? DEFAULT_SHORTCUT_CONFIG.shiftKey,
    metaKey: config?.metaKey ?? DEFAULT_SHORTCUT_CONFIG.metaKey,
  };
}

export function formatShortcut(config: ShortcutConfig): string {
  const parts: string[] = [];

  if (config.ctrlKey) {
    parts.push("Ctrl");
  }
  if (config.altKey) {
    parts.push("Alt");
  }
  if (config.shiftKey) {
    parts.push("Shift");
  }
  if (config.metaKey) {
    parts.push("Cmd");
  }

  parts.push(SPECIAL_KEY_LABELS[config.key] ?? config.key);

  return parts.join(" + ");
}

export function shortcutFromKeyboardEvent(
  event: KeyboardEvent,
  enabled = false
): ShortcutConfig | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  return normalizeShortcutConfig({
    enabled,
    key: event.key,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
  });
}

export function matchesShortcut(
  event: KeyboardEvent,
  config: ShortcutConfig
): boolean {
  const eventShortcut = shortcutFromKeyboardEvent(event, config.enabled);

  if (!config.enabled || !eventShortcut) {
    return false;
  }

  return (
    eventShortcut.key === config.key &&
    eventShortcut.ctrlKey === config.ctrlKey &&
    eventShortcut.altKey === config.altKey &&
    eventShortcut.shiftKey === config.shiftKey &&
    eventShortcut.metaKey === config.metaKey
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const editableParent = target.closest("[contenteditable='true']");
  if (editableParent) {
    return true;
  }

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
