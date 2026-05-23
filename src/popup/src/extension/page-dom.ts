import { dispatchMainWorldClickAt } from "./bridge";
import {
  buildSentenceFromFragments,
  buildWordRangesFromFragments,
  normalizeSentence,
  normalizeWhitespace,
  stripPunctuation,
} from "./normalization";
import type { ExerciseColumnSnapshot, PageKind, WordRangeSnapshot } from "./types";

const UI_WORD_EXCLUSIONS = [
  "COUP DE POUCE",
  "RETOUR AU MENU",
  "SUIVANT",
  "CONTINUER",
  "VALIDER",
  "PAS DE FAUTE",
  "PAS DE FAUTES",
  "AUCUNE FAUTE",
];
const LEGACY_SENTENCE_CONTAINER_SELECTOR =
  ".sentence, .r-18u37iz.r-1w6e6rj.r-1h0z5md.r-1peese0";
const LEGACY_WORD_SELECTOR =
  'div[dir="auto"].css-146c3p1, span[dir="auto"].css-146c3p1';
const ADVANCE_BUTTON_TEXTS = [
  "SUIVANT",
  "CONTINUER",
  "J'AI COMPRIS",
  "J AI COMPRIS",
  "JE COMPRENDS",
  "COMPRIS",
];
const NO_MISTAKE_TEXTS = [
  "IL N'Y A PAS DE FAUTE",
  "IL N'Y A PAS DE FAUTES",
  "IL N'Y A AUCUNE FAUTE",
  "PAS DE FAUTE",
  "PAS DE FAUTES",
  "AUCUNE FAUTE",
];

export interface VisibleWordElement extends WordRangeSnapshot {
  element: HTMLElement;
}

export interface ClickQuestionSurface {
  sentenceText: string;
  words: VisibleWordElement[];
  noMistakeButton: HTMLElement | null;
}

export interface VisibleDragCard {
  element: HTMLElement;
  text: string;
  normalizedText: string;
  top: number;
}

export interface DropZoneMatch {
  columnInstruction: string;
  element: HTMLElement;
}

export interface DragPlacement {
  card: VisibleDragCard;
  zone: DropZoneMatch;
}

export interface PageButtons {
  audioDisableButton: HTMLElement | null;
  cantListenButton: HTMLElement | null;
  advanceButton: HTMLElement | null;
  validateButton: HTMLElement | null;
}

function normalizeUiText(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[\u2018\u2019\u02BC\u0060]/g, "'")
    .toUpperCase();
}

function getElementText(element: HTMLElement): string {
  return normalizeWhitespace(element.innerText || element.textContent || "");
}

export function isVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);

  return (
    (element.offsetWidth > 0 ||
      element.offsetHeight > 0 ||
      element.getClientRects().length > 0) &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    style.opacity !== "0"
  );
}

export function getPageKindFromLocation(url = window.location.href): PageKind {
  if (url.includes("/exercice")) {
    return "exercise";
  }

  if (url.includes("/entrainement")) {
    return "training";
  }

  return "unsupported";
}

function getVisibleButtons(): HTMLElement[] {
  const selectors = ["button", '[data-testid="button"]', 'div[role="button"]'];

  return selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)).filter(isVisible)
  );
}

function collectLegacySentenceWordElements(): HTMLElement[] {
  const directContainers = Array.from(
    document.querySelectorAll<HTMLElement>(LEGACY_SENTENCE_CONTAINER_SELECTOR)
  ).filter(isVisible);

  for (const container of directContainers) {
    const words = Array.from(
      container.querySelectorAll<HTMLElement>(LEGACY_WORD_SELECTOR)
    )
      .filter(isVisible)
      .filter((element) => {
        const text = getElementText(element);

        return text.length > 0 && text.length < 50 && !element.querySelector("svg");
      });

    if (words.length >= 3) {
      return words;
    }
  }

  const legacyWordElements = Array.from(
    document.querySelectorAll<HTMLElement>(LEGACY_WORD_SELECTOR)
  )
    .filter(isVisible)
    .filter((element) => {
      const text = getElementText(element);

      return text.length > 0 && text.length < 50 && !element.querySelector("svg");
    });

  if (legacyWordElements.length === 0) {
    return [];
  }

  const groups = new Map<HTMLElement, HTMLElement[]>();

  for (const element of legacyWordElements) {
    const parent = element.parentElement;

    if (!parent) {
      continue;
    }

    const group = groups.get(parent) ?? [];
    group.push(element);
    groups.set(parent, group);
  }

  const bestGroup = Array.from(groups.values()).sort(
    (leftGroup, rightGroup) => rightGroup.length - leftGroup.length
  )[0];

  return bestGroup && bestGroup.length >= 3 ? bestGroup : [];
}

function findButtonByExactTexts(texts: string[]): HTMLElement | null {
  const expectedTexts = texts.map((text) => normalizeUiText(text));

  return (
    getVisibleButtons().find((button) => {
      const buttonText = normalizeUiText(button.innerText || button.textContent || "");

      return expectedTexts.some((expectedText) => buttonText === expectedText);
    }) ?? null
  );
}

function findButtonContainingTexts(texts: string[]): HTMLElement | null {
  const expectedTexts = texts.map((text) => normalizeUiText(text));

  return (
    getVisibleButtons().find((button) => {
      const buttonText = normalizeUiText(button.innerText || button.textContent || "");

      return expectedTexts.some((expectedText) => buttonText.includes(expectedText));
    }) ?? null
  );
}

function getButtonText(button: HTMLElement): string {
  return normalizeUiText(getElementText(button));
}

function isNoMistakeText(value: string): boolean {
  const normalizedText = normalizeUiText(value);

  return NO_MISTAKE_TEXTS.some((expectedText) =>
    normalizedText.includes(expectedText)
  );
}

function findClickableAncestor(element: HTMLElement): HTMLElement | null {
  let currentElement: HTMLElement | null = element;

  while (currentElement && currentElement !== document.body) {
    if (
      currentElement.matches("button") ||
      currentElement.matches('[data-testid="button"]') ||
      currentElement.matches('div[role="button"]') ||
      currentElement.matches("div[tabindex='0']")
    ) {
      return currentElement;
    }

    currentElement = currentElement.parentElement;
  }

  return element;
}

function isNoMistakeCandidate(element: HTMLElement): boolean {
  const text = getElementText(element);
  // The length guard is critical: without it, the root container div (which wraps
  // both the sentence words and the button) matches too, because its textContent
  // includes the button text. The real button wrapper has only the button text (~22 chars).
  return text.length > 0 && text.length < 80 && isNoMistakeText(text);
}

function findNoMistakeButton(
  wordCandidates: HTMLElement[]
): HTMLElement | null {
  // Prefer the div[tabindex='0'] wrapper: same element type as word clicks, where
  // Projet Voltaire registers its React handler (React Native Web Pressable pattern).
  // The length guard ensures we skip the root exercise container, which also matches
  // because its textContent includes both the sentence and the button text.
  const divCandidate = wordCandidates.find(isNoMistakeCandidate);
  if (divCandidate) {
    return divCandidate;
  }

  // Fall back to explicit button elements (different page layouts).
  const buttonCandidate = getVisibleButtons().find(isNoMistakeCandidate);
  if (buttonCandidate) {
    return buttonCandidate;
  }

  // Broad search: find any matching element and walk up to its clickable ancestor.
  const broadCandidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      `div[tabindex='0'], button, [data-testid="button"], div[role="button"], ${LEGACY_WORD_SELECTOR}`
    )
  ).filter((element) => isVisible(element) && isNoMistakeCandidate(element));

  for (const candidate of broadCandidates) {
    const clickableAncestor = findClickableAncestor(candidate);
    if (clickableAncestor && isVisible(clickableAncestor)) {
      return clickableAncestor;
    }
  }

  return null;
}

function buildSentenceSurface(elements: HTMLElement[]): {
  sentenceText: string;
  words: VisibleWordElement[];
} {
  const fragments = elements.map((element) => getElementText(element));
  const ranges = buildWordRangesFromFragments(fragments);
  const sentenceText = buildSentenceFromFragments(fragments);
  const words = ranges.map((range, index) => ({
    ...range,
    element: elements[index]!,
  }));

  return {
    sentenceText,
    words,
  };
}

function isUiWordCandidate(element: HTMLElement, noMistakeButton: HTMLElement | null): boolean {
  const rawText = getElementText(element);
  const normalizedText = normalizeUiText(rawText);

  if (!rawText || rawText.length >= 50) {
    return false;
  }

  if (element === noMistakeButton || element.querySelector("svg")) {
    return false;
  }

  return !UI_WORD_EXCLUSIONS.some((excludedText) =>
    normalizedText.includes(excludedText)
  );
}

export function readPageButtons(): PageButtons {
  return {
    audioDisableButton: findButtonByExactTexts(["DESACTIVER", "DÉSACTIVER"]),
    cantListenButton: findButtonContainingTexts([
      "JE NE PEUX PAS ECOUTER",
      "JE NE PEUX PAS ÉCOUTER",
      "PAS ECOUTER",
      "PAS ÉCOUTER",
    ]),
    advanceButton: findButtonContainingTexts(ADVANCE_BUTTON_TEXTS),
    validateButton: findButtonContainingTexts(["VALIDER"]),
  };
}

export function isAdvanceButton(
  element: HTMLElement | null
): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const text = getButtonText(element);

  return ADVANCE_BUTTON_TEXTS.some((expectedText) => text.includes(expectedText));
}

export function readClickQuestionSurface(): ClickQuestionSurface | null {
  const wordCandidates = Array.from(
    document.querySelectorAll<HTMLElement>("div[tabindex='0']")
  ).filter(isVisible);
  const noMistakeButton = findNoMistakeButton(wordCandidates);

  const legacyWordElements = collectLegacySentenceWordElements();
  const sentenceWordElements =
    legacyWordElements.length >= 3
      ? legacyWordElements
      : wordCandidates.filter((element) => isUiWordCandidate(element, noMistakeButton));

  if (sentenceWordElements.length < 3) {
    return null;
  }

  const { words, sentenceText } = buildSentenceSurface(sentenceWordElements);

  return {
    sentenceText,
    words,
    noMistakeButton,
  };
}

export function readVisibleDragCards(): VisibleDragCard[] {
  const htmlElements = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="html"]')
  ).filter(isVisible);
  const tabElements = Array.from(
    document.querySelectorAll<HTMLElement>("div[tabindex='0']")
  )
    .filter(isVisible)
    .filter((element) => {
      const text = getElementText(element);
      const normalizedText = normalizeUiText(text);

      return (
        text.length > 0 &&
        text.length < 60 &&
        !element.querySelector("svg") &&
        !normalizedText.includes("VALIDER") &&
        !normalizedText.includes("CONTINUER") &&
        !normalizedText.includes("SUIVANT")
      );
    });

  const uniqueCards = new Map<string, VisibleDragCard>();

  for (const element of [...htmlElements, ...tabElements]) {
    const targetElement =
      element.getAttribute("data-testid") === "html" && element.parentElement
        ? element.parentElement
        : element;
    const text = getElementText(element);
    const normalizedText = normalizeSentence(text);

    if (!normalizedText || uniqueCards.has(normalizedText)) {
      continue;
    }

    uniqueCards.set(normalizedText, {
      element: targetElement,
      text,
      normalizedText,
      top: targetElement.getBoundingClientRect().top,
    });
  }

  return Array.from(uniqueCards.values());
}

export function locateWordElement(
  words: VisibleWordElement[],
  targetWord: string
): HTMLElement | null {
  const normalizedTarget = normalizeSentence(targetWord);
  const normalizedTargetWords = normalizedTarget.split(/\s+/).filter(Boolean);

  return (
    words.find((word) => normalizeSentence(word.text) === normalizedTarget)?.element ??
    words.find((word) =>
      normalizedTargetWords.includes(normalizeSentence(word.text))
    )?.element ??
    null
  );
}

export function locateAlternativeWordElement(
  words: VisibleWordElement[],
  excludedWord: string
): HTMLElement | null {
  const normalizedExcludedWord = normalizeSentence(excludedWord);

  return (
    words.find((word) => normalizeSentence(word.text) !== normalizedExcludedWord)
      ?.element ?? null
  );
}

export function clickElementInMainWorld(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  dispatchMainWorldClickAt(x, y);
}

export function locateDropZonesByColumns(
  columns: ExerciseColumnSnapshot[]
): DropZoneMatch[] {
  const visibleDropZones = Array.from(document.querySelectorAll(".r-vacyoi")).filter(
    isVisible
  );

  if (visibleDropZones.length >= columns.length) {
    const sortedZones = [...visibleDropZones].sort(
      (leftZone, rightZone) =>
        leftZone.getBoundingClientRect().left - rightZone.getBoundingClientRect().left
    );

    return columns.map((column, index) => ({
      columnInstruction: column.instruction,
      element: sortedZones[index],
    }));
  }

  const allDivs = Array.from(document.querySelectorAll("div")).filter(isVisible);
  const matches: DropZoneMatch[] = [];

  for (const column of columns) {
    const normalizedInstruction = normalizeUiText(column.instruction);
    const keyword = normalizedInstruction.split(/\s+/).filter(Boolean).pop();

    if (!keyword) {
      continue;
    }

    const zone = allDivs.find((element) => {
      const text = normalizeUiText(element.innerText || "");
      const rect = element.getBoundingClientRect();

      return (
        text.includes(keyword) &&
        rect.height > 50 &&
        rect.width > 100 &&
        !matches.some((match) => match.element === element)
      );
    });

    if (zone) {
      matches.push({
        columnInstruction: column.instruction,
        element: zone,
      });
    }
  }

  return matches;
}

export function locateNextDragPlacement(
  cards: VisibleDragCard[],
  columnAssignments: Map<string, string>,
  zoneMatches: DropZoneMatch[]
): DragPlacement | null {
  if (zoneMatches.length === 0) {
    return null;
  }

  const dropZoneTop = Math.min(
    ...zoneMatches.map((zoneMatch) => zoneMatch.element.getBoundingClientRect().top)
  );

  for (const card of cards) {
    if (card.top >= dropZoneTop - 10) {
      continue;
    }

    const directAssignment = columnAssignments.get(card.normalizedText);
    let assignedColumn = directAssignment ?? null;

    if (!assignedColumn) {
      const strippedCard = stripPunctuation(card.normalizedText);

      for (const [phrase, columnInstruction] of columnAssignments.entries()) {
        if (stripPunctuation(phrase) === strippedCard) {
          assignedColumn = columnInstruction;
          break;
        }
      }
    }

    if (!assignedColumn) {
      continue;
    }

    const zone = zoneMatches.find(
      (zoneMatch) => zoneMatch.columnInstruction === assignedColumn
    );

    if (zone) {
      return {
        card,
        zone,
      };
    }
  }

  return null;
}
