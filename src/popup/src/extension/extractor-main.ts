import { EXACT_EXTRACT_EVENT, MAIN_WORLD_CLICK_EVENT, writeExactSnapshotPayload } from "./bridge";
import { normalizeWhitespace } from "./normalization";
import type {
  ExerciseColumnSnapshot,
  ExerciseKind,
  ExerciseSentencePart,
  ExerciseSnapshot,
} from "./types";

interface FiberNodeLike {
  type?: unknown;
  memoizedState?: unknown;
  memoizedProps?: unknown;
  pendingProps?: unknown;
  updateQueue?: unknown;
  child?: FiberNodeLike | null;
  sibling?: FiberNodeLike | null;
  return?: FiberNodeLike | null;
  alternate?: FiberNodeLike | null;
}

function isSupportedPage(): boolean {
  const url = window.location.href;

  return (
    url.includes("/exercice") ||
    url.includes("/entrainement") ||
    url.includes("/evaluation")
  );
}

function extractFiberFromReactCarrier(carrier: unknown): FiberNodeLike | null {
  if (!carrier || typeof carrier !== "object") {
    return null;
  }

  const record = carrier as Record<string, unknown>;
  if (record.current && typeof record.current === "object") {
    return record.current as FiberNodeLike;
  }

  return carrier as FiberNodeLike;
}

function readReactCarrier(element: HTMLElement): FiberNodeLike | null {
  const record = element as unknown as Record<string, unknown>;
  const reactKey = Object.keys(record).find(
    (key) =>
      key.startsWith("__reactFiber$") || key.startsWith("__reactContainer$")
  );

  if (!reactKey) {
    return null;
  }

  return extractFiberFromReactCarrier(record[reactKey]);
}

function ascendToFiberRoot(fiberNode: FiberNodeLike): FiberNodeLike {
  let currentFiber = fiberNode;

  while (currentFiber.return && typeof currentFiber.return === "object") {
    currentFiber = currentFiber.return;
  }

  return currentFiber;
}

function findReactFiberNode(): FiberNodeLike | null {
  const preferredElements = [
    document.getElementById("root"),
    document.querySelector<HTMLElement>('[data-testid="html"]'),
    document.querySelector<HTMLElement>("div[tabindex='0']"),
    document.querySelector<HTMLElement>("button"),
    document.body,
    document.documentElement as HTMLElement | null,
  ].filter((element): element is HTMLElement => element instanceof HTMLElement);

  for (const element of preferredElements) {
    const fiberNode = readReactCarrier(element);

    if (fiberNode) {
      return ascendToFiberRoot(fiberNode);
    }
  }

  const fallbackElements = Array.from(
    document.querySelectorAll<HTMLElement>("div, button, span")
  ).slice(0, 400);

  for (const element of fallbackElements) {
    const fiberNode = readReactCarrier(element);

    if (fiberNode) {
      return ascendToFiberRoot(fiberNode);
    }
  }

  return null;
}

function looksLikeExerciseArray(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  const firstItem = value[0];
  if (!firstItem || typeof firstItem !== "object") {
    return false;
  }

  const record = firstItem as Record<string, unknown>;

  return (
    Array.isArray(record.sentence) ||
    Array.isArray(record.columns) ||
    typeof record.type === "string" ||
    typeof record.hasMistake === "boolean"
  );
}

function safeSerialize(value: unknown): string | null {
  const seenObjects = new WeakSet<object>();

  try {
    return JSON.stringify(value, (_key, nestedValue) => {
      if (typeof nestedValue === "function") {
        return undefined;
      }

      if (nestedValue instanceof Element) {
        return undefined;
      }

      if (nestedValue && typeof nestedValue === "object") {
        if (seenObjects.has(nestedValue)) {
          return undefined;
        }

        seenObjects.add(nestedValue);
      }

      return nestedValue;
    });
  } catch {
    return null;
  }
}

function collectExerciseArrays(value: unknown, results: unknown[][], seen: WeakSet<object>): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (looksLikeExerciseArray(value)) {
    results.push(value as unknown[]);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectExerciseArrays(item, results, seen);
    }
    return;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    collectExerciseArrays(nestedValue, results, seen);
  }
}

function collectExerciseArraysFromSerializedState(
  value: unknown,
  results: unknown[][]
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  const serialized = safeSerialize(value);

  if (
    !serialized ||
    !serialized.includes('"sentence"') ||
    (!serialized.includes('"hasMistake"') &&
      !serialized.includes('"type"') &&
      !serialized.includes('"columns"'))
  ) {
    return;
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    collectExerciseArrays(parsed, results, new WeakSet<object>());
  } catch {
    // Ignore unparsable intermediate states.
  }
}

function collectExerciseArraysFromLiveValue(
  value: unknown,
  results: unknown[][]
): void {
  if (looksLikeExerciseArray(value)) {
    results.push(value as unknown[]);
  }
}

function sanitizeSentenceParts(value: unknown): ExerciseSentencePart[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rawSentenceParts: Array<ExerciseSentencePart | null> = value.map((part) => {
      if (!part || typeof part !== "object") {
        return null;
      }

      const record = part as Record<string, unknown>;
      const text = typeof record.text === "string" ? normalizeWhitespace(record.text) : "";

      if (!text) {
        return null;
      }

      const sentencePart: ExerciseSentencePart = { text };

      if (record.mistake === true) {
        sentencePart.mistake = true;
      }

      if (record.clue === true) {
        sentencePart.clue = true;
      }

      return sentencePart;
    });

  return rawSentenceParts.filter(
    (part): part is ExerciseSentencePart => part !== null
  );
}

function sanitizeColumns(value: unknown): ExerciseColumnSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((column) => {
      if (!column || typeof column !== "object") {
        return null;
      }

      const record = column as Record<string, unknown>;
      const instruction =
        typeof record.instruction === "string"
          ? normalizeWhitespace(record.instruction)
          : "";
      const words = Array.isArray(record.words)
        ? record.words
          .map((word) =>
            typeof word === "string" ? normalizeWhitespace(word) : ""
          )
          .filter(Boolean)
        : [];

      if (!instruction && words.length === 0) {
        return null;
      }

      return {
        instruction,
        words,
      };
    })
    .filter((column): column is ExerciseColumnSnapshot => column !== null);
}

function sanitizeCorrectionSentences(value: unknown): ExerciseSentencePart[][] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((correction) => sanitizeSentenceParts(correction))
    .filter((correction) => correction.length > 0);
}

function inferExerciseKind(rawExercise: Record<string, unknown>): ExerciseKind {
  const rawType = typeof rawExercise.type === "string" ? rawExercise.type : "";

  if (rawType === "click_on_mistake" || rawType === "click_on_word") {
    return rawType;
  }

  if (rawType === "drag_and_drop" || Array.isArray(rawExercise.columns)) {
    return "drag_and_drop";
  }

  if (Array.isArray(rawExercise.sentence) && typeof rawExercise.hasMistake === "boolean") {
    return "click_on_mistake";
  }

  return "unknown";
}

function sanitizeExercise(rawExercise: unknown, index: number): ExerciseSnapshot | null {
  if (!rawExercise || typeof rawExercise !== "object") {
    return null;
  }

  const record = rawExercise as Record<string, unknown>;
  const sentence = sanitizeSentenceParts(record.sentence);
  const corrections = sanitizeCorrectionSentences(record.corrections);
  const columns = sanitizeColumns(record.columns);
  const kind = inferExerciseKind(record);

  if (sentence.length === 0 && columns.length === 0) {
    return null;
  }

  const rawId = typeof record.id === "string" || typeof record.id === "number"
    ? String(record.id)
    : `${kind}:${index}:${sentence.map((part) => part.text).join("|")}:${columns
      .map((column) => column.instruction)
      .join("|")}`;

  return {
    id: rawId,
    kind,
    sentence,
    corrections: corrections.length > 0 ? corrections : undefined,
    hasMistake:
      typeof record.hasMistake === "boolean" ? record.hasMistake : undefined,
    columns,
    metadata: {
      rawType: typeof record.type === "string" ? record.type : undefined,
    },
  };
}

function extractExerciseSnapshot(): ExerciseSnapshot[] {
  const fiberNode = findReactFiberNode();

  if (!fiberNode) {
    return [];
  }

  const exerciseArrays: unknown[][] = [];
  const visitedFibers = new WeakSet<object>();
  const fibersToVisit: FiberNodeLike[] = [fiberNode];

  while (fibersToVisit.length > 0) {
    const currentFiber = fibersToVisit.shift();

    if (!currentFiber || visitedFibers.has(currentFiber as object)) {
      continue;
    }
    visitedFibers.add(currentFiber as object);

    collectExerciseArraysFromLiveValue(currentFiber.memoizedState, exerciseArrays);
    collectExerciseArraysFromLiveValue(currentFiber.memoizedProps, exerciseArrays);
    collectExerciseArraysFromLiveValue(currentFiber.pendingProps, exerciseArrays);
    collectExerciseArraysFromLiveValue(currentFiber.updateQueue, exerciseArrays);
    collectExerciseArraysFromSerializedState(currentFiber.memoizedState, exerciseArrays);
    collectExerciseArraysFromSerializedState(currentFiber.memoizedProps, exerciseArrays);
    collectExerciseArraysFromSerializedState(currentFiber.pendingProps, exerciseArrays);
    collectExerciseArraysFromSerializedState(currentFiber.updateQueue, exerciseArrays);

    if (currentFiber.child) {
      fibersToVisit.push(currentFiber.child);
    }
    if (currentFiber.sibling) {
      fibersToVisit.push(currentFiber.sibling);
    }
    if (currentFiber.alternate) {
      fibersToVisit.push(currentFiber.alternate);
    }
  }

  const uniqueExercises = new Map<string, ExerciseSnapshot>();

  exerciseArrays.flat().forEach((exercise, index) => {
    const sanitizedExercise = sanitizeExercise(exercise, index);

    if (sanitizedExercise) {
      uniqueExercises.set(sanitizedExercise.id, sanitizedExercise);
    }
  });

  return Array.from(uniqueExercises.values());
}

function storeExercises(): void {
  const exercises = extractExerciseSnapshot();

  writeExactSnapshotPayload({
    exercises,
    extractedAt: Date.now(),
    count: exercises.length,
  });
}

function clickAtPoint(detail: unknown): void {
  if (!detail || typeof detail !== "object") {
    return;
  }

  const record = detail as Record<string, unknown>;
  const x = typeof record.x === "number" ? record.x : null;
  const y = typeof record.y === "number" ? record.y : null;

  if (x === null || y === null) {
    return;
  }

  const element = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!element) {
    return;
  }

  let currentElement: HTMLElement | null = element;
  for (let index = 0; index < 5 && currentElement; index += 1) {
    const rect = currentElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const eventInit = {
      bubbles: true,
      cancelable: true,
      clientX: centerX,
      clientY: centerY,
      view: window,
    };

    currentElement.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...eventInit,
        pointerId: 1,
      })
    );
    currentElement.dispatchEvent(new MouseEvent("mousedown", eventInit));
    currentElement.dispatchEvent(
      new PointerEvent("pointerup", {
        ...eventInit,
        pointerId: 1,
      })
    );
    currentElement.dispatchEvent(new MouseEvent("mouseup", eventInit));
    currentElement.dispatchEvent(new MouseEvent("click", eventInit));
    currentElement.click();

    currentElement = currentElement.parentElement;
  }
}

if (isSupportedPage()) {
  document.addEventListener(EXACT_EXTRACT_EVENT, () => {
    storeExercises();
  });

  document.addEventListener(MAIN_WORLD_CLICK_EVENT, (event) => {
    clickAtPoint((event as CustomEvent).detail);
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    storeExercises();
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      storeExercises();
    });
  }
}
