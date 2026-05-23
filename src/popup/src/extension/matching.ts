import {
  buildSentenceFromParts,
  normalizeSentence,
  stripHtml,
  stripPunctuation,
} from "./normalization";
import type {
  CorrectedSentence,
  ExerciseKind,
  ExerciseSnapshot,
  SolveDecision,
  WordRangeSnapshot,
} from "./types";

export function matchClickExercise(
  exercises: ExerciseSnapshot[],
  displayedWords: string[]
): ExerciseSnapshot | null {
  if (displayedWords.length === 0) {
    return null;
  }

  const candidates = exercises.filter(
    (exercise) =>
      exercise.kind === "click_on_mistake" || exercise.kind === "click_on_word"
  );
  const displayedText = normalizeSentence(displayedWords.join(" "));
  const displayedStripped = stripPunctuation(displayedText);

  let bestMatch: ExerciseSnapshot | null = null;
  let bestScore = 0;

  for (const exercise of candidates) {
    const sentenceText = normalizeSentence(buildSentenceFromParts(exercise.sentence));
    const strippedSentence = stripPunctuation(sentenceText);

    if (
      sentenceText === displayedText ||
      strippedSentence === displayedStripped ||
      sentenceText.includes(displayedText) ||
      displayedText.includes(sentenceText) ||
      strippedSentence.includes(displayedStripped) ||
      displayedStripped.includes(strippedSentence)
    ) {
      return exercise;
    }

    const exerciseWords = strippedSentence.split(/\s+/).filter(Boolean);
    const visibleWords = displayedStripped.split(/\s+/).filter(Boolean);
    if (exerciseWords.length === 0 || visibleWords.length === 0) {
      continue;
    }

    const matches = visibleWords.filter((word) => exerciseWords.includes(word)).length;
    const score = matches / Math.max(exerciseWords.length, visibleWords.length);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = exercise;
    }
  }

  return bestScore >= 0.6 ? bestMatch : null;
}

export function matchDragAndDropExercise(
  exercises: ExerciseSnapshot[],
  displayedCards: string[]
): ExerciseSnapshot | null {
  const candidates = exercises.filter(
    (exercise) => exercise.kind === "drag_and_drop" && exercise.columns.length > 0
  );

  let bestMatch: ExerciseSnapshot | null = null;
  let bestMatchCount = 0;

  for (const exercise of candidates) {
    const normalizedWords = exercise.columns.flatMap((column) =>
      column.words.map((word) => normalizeSentence(stripHtml(word)))
    );

    const matchCount = displayedCards.filter((card) =>
      normalizedWords.includes(normalizeSentence(card))
    ).length;

    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestMatch = exercise;
    }
  }

  return bestMatchCount > 0 ? bestMatch : null;
}

export function deriveExactClickDecision(
  exercise: ExerciseSnapshot
): SolveDecision | null {
  if (exercise.kind === "click_on_mistake") {
    if (exercise.hasMistake === false) {
      return {
        kind: "click_no_mistake",
        source: "fiber_exact_dom_located",
        reason: "Aucune faute détectée dans la phrase.",
      };
    }

    const mistakenPart = exercise.sentence.find((part) => part.mistake);
    if (mistakenPart) {
      return {
        kind: "click_word",
        word: stripHtml(mistakenPart.text),
        source: "fiber_exact_dom_located",
        reason: "Bonne réponse trouvée directement sur la page.",
      };
    }
  }

  if (exercise.kind === "click_on_word") {
    const cluePart = exercise.sentence.find((part) => part.clue);
    if (cluePart) {
      return {
        kind: "click_word",
        word: stripHtml(cluePart.text),
        source: "fiber_exact_dom_located",
        reason: "Mot trouvé directement sur la page.",
      };
    }
  }

  const fallbackPart = exercise.sentence.find((part) => part.mistake || part.clue);
  if (fallbackPart) {
    return {
      kind: "click_word",
      word: stripHtml(fallbackPart.text),
      source: "fiber_exact_dom_located",
      reason: "Bonne réponse déduite directement sur la page.",
    };
  }

  if (exercise.hasMistake === false) {
    return {
      kind: "click_no_mistake",
      source: "fiber_exact_dom_located",
      reason: "Aucune faute détectée dans la phrase.",
    };
  }

  return null;
}

export function buildDragAndDropAssignments(
  exercise: ExerciseSnapshot
): Map<string, string> {
  const assignments = new Map<string, string>();

  for (const column of exercise.columns) {
    const columnInstruction = stripHtml(column.instruction);
    for (const word of column.words) {
      assignments.set(normalizeSentence(stripHtml(word)), columnInstruction);
    }
  }

  return assignments;
}

export function canUseReversoFallback(
  exerciseKind: ExerciseKind | null,
  hasNoMistakeButton: boolean
): boolean {
  return exerciseKind === "click_on_mistake" || hasNoMistakeButton;
}

export function deriveReversoFallbackDecision(
  sentenceText: string,
  displayedWords: WordRangeSnapshot[],
  analysis: CorrectedSentence
): SolveDecision | null {
  if (analysis.corrections.length === 0) {
    return {
      kind: "click_no_mistake",
      source: "reverso_fallback",
      reason: "Reverso ne détecte aucune faute sur cette phrase.",
    };
  }

  const [firstCorrection] = analysis.corrections;
  const highlightedSlice = normalizeSentence(
    sentenceText.slice(firstCorrection.startIndex, firstCorrection.endIndex)
  );

  const targetWord = displayedWords.find((word) => {
    const overlaps =
      word.startIndex < firstCorrection.endIndex &&
      word.endIndex > firstCorrection.startIndex;
    const sameText =
      firstCorrection.mistakeText &&
      normalizeSentence(firstCorrection.mistakeText) === normalizeSentence(word.text);
    const sameSlice =
      highlightedSlice.length > 0 &&
      normalizeSentence(word.text).includes(highlightedSlice);

    return overlaps || sameText || sameSlice;
  });

  if (!targetWord) {
    return null;
  }

  return {
    kind: "click_word",
    word: targetWord.text,
    source: "reverso_fallback",
    reason: "Mot cible dérivé depuis la suggestion Reverso.",
  };
}
