import {
  getStorageArea,
  isExtensionContextInvalidationError,
} from "./extension-context";
import { normalizeSolverSettings } from "./settings-model";
import {
  DEFAULT_SOLVER_SETTINGS,
  POPUP_ONBOARDING_STORAGE_KEY,
  SHORTCUT_STORAGE_KEY,
  SOLVER_SETTINGS_STORAGE_KEY,
  type ShortcutConfig,
  type SolverSettings,
} from "./types";

export async function getStoredSolverSettings(): Promise<SolverSettings> {
  const syncStorage = getStorageArea("sync");
  if (!syncStorage) {
    return normalizeSolverSettings(DEFAULT_SOLVER_SETTINGS);
  }

  try {
    const stored = await syncStorage.get([
      SOLVER_SETTINGS_STORAGE_KEY,
      SHORTCUT_STORAGE_KEY,
    ]);

    return normalizeSolverSettings(
      stored[SOLVER_SETTINGS_STORAGE_KEY] as Partial<SolverSettings> | undefined,
      stored[SHORTCUT_STORAGE_KEY] as Partial<ShortcutConfig> | undefined
    );
  } catch (error) {
    if (isExtensionContextInvalidationError(error)) {
      return normalizeSolverSettings(DEFAULT_SOLVER_SETTINGS);
    }

    throw error;
  }
}

export async function setStoredSolverSettings(
  partialSettings: Partial<SolverSettings>
): Promise<SolverSettings> {
  const currentSettings = await getStoredSolverSettings();
  const nextSettings = normalizeSolverSettings({
    ...currentSettings,
    ...partialSettings,
    shortcutConfig: partialSettings.shortcutConfig ?? currentSettings.shortcutConfig,
    discreetShortcutConfig:
      partialSettings.discreetShortcutConfig ?? currentSettings.discreetShortcutConfig,
  });

  const syncStorage = getStorageArea("sync");
  if (!syncStorage) {
    return nextSettings;
  }

  try {
    await syncStorage.set({
      [SOLVER_SETTINGS_STORAGE_KEY]: nextSettings,
      [SHORTCUT_STORAGE_KEY]: nextSettings.shortcutConfig,
    });
  } catch (error) {
    if (!isExtensionContextInvalidationError(error)) {
      throw error;
    }
  }

  return nextSettings;
}

export async function ensureStoredSolverSettings(): Promise<SolverSettings> {
  const settings = await getStoredSolverSettings();

  const syncStorage = getStorageArea("sync");
  if (!syncStorage) {
    return settings;
  }

  try {
    await syncStorage.set({
      [SOLVER_SETTINGS_STORAGE_KEY]: settings,
      [SHORTCUT_STORAGE_KEY]: settings.shortcutConfig,
    });
  } catch (error) {
    if (!isExtensionContextInvalidationError(error)) {
      throw error;
    }
  }

  return settings;
}

export async function getPopupOnboardingDismissed(): Promise<boolean> {
  const localStorage = getStorageArea("local");
  if (!localStorage) {
    return false;
  }

  try {
    const stored = await localStorage.get(POPUP_ONBOARDING_STORAGE_KEY);

    return Boolean(stored[POPUP_ONBOARDING_STORAGE_KEY]);
  } catch (error) {
    if (isExtensionContextInvalidationError(error)) {
      return false;
    }

    throw error;
  }
}

export async function setPopupOnboardingDismissed(
  dismissed: boolean
): Promise<void> {
  const localStorage = getStorageArea("local");
  if (!localStorage) {
    return;
  }

  try {
    await localStorage.set({
      [POPUP_ONBOARDING_STORAGE_KEY]: dismissed,
    });
  } catch (error) {
    if (!isExtensionContextInvalidationError(error)) {
      throw error;
    }
  }
}
