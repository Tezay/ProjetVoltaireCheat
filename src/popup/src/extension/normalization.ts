import type { ExerciseSentencePart, WordRangeSnapshot } from "./types";

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeSentence(value: string): string {
  return normalizeWhitespace(stripHtml(value))
    .replace(/[\u2018\u2019\u02BC\u0060]/g, "'")
    .replace(/[\u2011\u2010\u2012\u2013\u2014]/g, "-")
    .toLowerCase();
}

export function stripPunctuation(value: string): string {
  return normalizeWhitespace(
    normalizeSentence(value).replace(/[.,;:!?()«»"'…\-–—]/g, "")
  );
}

export function getSentencePartsText(parts: ExerciseSentencePart[]): string[] {
  return parts.map((part) => normalizeWhitespace(stripHtml(part.text)));
}

export function buildSentenceFromParts(parts: ExerciseSentencePart[]): string {
  return getSentencePartsText(parts).join(" ");
}

function needsTightJoin(previousPart: string, nextPart: string): boolean {
  if (!previousPart || !nextPart) {
    return false;
  }

  if (/['’`-]$/.test(previousPart)) {
    return true;
  }

  if (/^[.,;:!?%)\]}>»]/.test(nextPart)) {
    return true;
  }

  if (/^[’']/.test(nextPart)) {
    return true;
  }

  if (/[([{<«]$/.test(previousPart)) {
    return true;
  }

  return false;
}

function normalizeSentenceFragments(parts: string[]): string[] {
  return parts.map((part) => normalizeWhitespace(part)).filter(Boolean);
}

export function buildSentenceFromFragments(parts: string[]): string {
  const normalizedParts = normalizeSentenceFragments(parts);
  let sentence = "";

  for (const part of normalizedParts) {
    if (!sentence) {
      sentence = part;
      continue;
    }

    sentence += `${needsTightJoin(sentence, part) ? "" : " "}${part}`;
  }

  return sentence;
}

export function buildWordRangesFromFragments(
  parts: string[]
): WordRangeSnapshot[] {
  const normalizedParts = normalizeSentenceFragments(parts);
  const ranges: WordRangeSnapshot[] = [];
  let sentence = "";

  for (const part of normalizedParts) {
    const separator = !sentence
      ? ""
      : needsTightJoin(sentence, part)
        ? ""
        : " ";
    const startIndex = sentence.length + separator.length;
    sentence += `${separator}${part}`;
    ranges.push({
      text: part,
      startIndex,
      endIndex: sentence.length,
    });
  }

  return ranges;
}
