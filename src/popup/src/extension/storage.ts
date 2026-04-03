import {
  DEFAULT_SHORTCUT_CONFIG,
  SHORTCUT_STORAGE_KEY,
  type ShortcutConfig,
} from "./types";
import { normalizeShortcutConfig } from "./shortcut";

export async function getStoredShortcutConfig(): Promise<ShortcutConfig> {
  const stored = await chrome.storage.sync.get(SHORTCUT_STORAGE_KEY);

  return normalizeShortcutConfig(
    stored[SHORTCUT_STORAGE_KEY] as Partial<ShortcutConfig> | undefined
  );
}

export async function setStoredShortcutConfig(
  config: Partial<ShortcutConfig>
): Promise<ShortcutConfig> {
  const current = await getStoredShortcutConfig();
  const next = normalizeShortcutConfig({ ...current, ...config });

  await chrome.storage.sync.set({
    [SHORTCUT_STORAGE_KEY]: next,
  });

  return next;
}

export async function ensureStoredShortcutConfig(): Promise<ShortcutConfig> {
  const stored = await chrome.storage.sync.get(SHORTCUT_STORAGE_KEY);

  if (!stored[SHORTCUT_STORAGE_KEY]) {
    await chrome.storage.sync.set({
      [SHORTCUT_STORAGE_KEY]: DEFAULT_SHORTCUT_CONFIG,
    });

    return DEFAULT_SHORTCUT_CONFIG;
  }

  const normalized = normalizeShortcutConfig(
    stored[SHORTCUT_STORAGE_KEY] as Partial<ShortcutConfig>
  );

  await chrome.storage.sync.set({
    [SHORTCUT_STORAGE_KEY]: normalized,
  });

  return normalized;
}
