export type StorageAreaName = "sync" | "local";

export function hasExtensionContext(): boolean {
  return (
    typeof chrome !== "undefined" &&
    typeof chrome.runtime !== "undefined"
  );
}

export function getStorageArea(
  areaName: StorageAreaName
): chrome.storage.StorageArea | null {
  if (!hasExtensionContext() || !chrome.storage) {
    return null;
  }

  return chrome.storage[areaName] ?? null;
}

export function isExtensionContextInvalidationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Extension context invalidated") ||
    message.includes("message port closed") ||
    message.includes("Cannot read properties of undefined")
  );
}
