import type { ExactSnapshotPayload } from "./types";

export const EXACT_SNAPSHOT_ELEMENT_ID = "__pvc_exact_snapshot";
export const EXACT_EXTRACT_EVENT = "__pvc_extract_snapshot";
export const MAIN_WORLD_CLICK_EVENT = "__pvc_main_world_click";

function ensureBridgeElement(): HTMLDivElement {
  const existing = document.getElementById(
    EXACT_SNAPSHOT_ELEMENT_ID
  ) as HTMLDivElement | null;

  if (existing) {
    return existing;
  }

  const element = document.createElement("div");
  element.id = EXACT_SNAPSHOT_ELEMENT_ID;
  element.hidden = true;
  (document.body || document.documentElement).appendChild(element);

  return element;
}

export function writeExactSnapshotPayload(payload: ExactSnapshotPayload): void {
  const element = ensureBridgeElement();
  element.textContent = JSON.stringify(payload);
}

export function readExactSnapshotPayload(): ExactSnapshotPayload | null {
  const element = document.getElementById(EXACT_SNAPSHOT_ELEMENT_ID);

  if (!element?.textContent) {
    return null;
  }

  try {
    return JSON.parse(element.textContent) as ExactSnapshotPayload;
  } catch {
    return null;
  }
}

export function requestExactSnapshotFromMainWorld(): ExactSnapshotPayload | null {
  document.dispatchEvent(new CustomEvent(EXACT_EXTRACT_EVENT));

  return readExactSnapshotPayload();
}

export function dispatchMainWorldClickAt(x: number, y: number): void {
  document.dispatchEvent(
    new CustomEvent(MAIN_WORLD_CLICK_EVENT, {
      detail: { x, y },
    })
  );
}
