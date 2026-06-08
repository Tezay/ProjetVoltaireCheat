import {
  buildSentenceFromParts,
  normalizeSentence,
  stripHtml,
  stripPunctuation,
} from "./normalization";
import type {
  CorrectedSentence,
  ClickSolveDecision,
  DictationSolveDecision,
  ExerciseKind,
  ExerciseSentencePart,
  ExerciseSnapshot,
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

function isDictationMissingPart(
  exercise: ExerciseSnapshot,
  part: ExerciseSentencePart
): boolean {
  return (
    (exercise.hasMistake !== false && part.mistake === true) ||
    (exercise.hasMistake === false && part.clue === true)
  );
}

export function matchDictationExercise(
  exercises: ExerciseSnapshot[],
  displayedWords: string[],
  inputCount: number
): ExerciseSnapshot | null {
  if (displayedWords.length === 0 || inputCount === 0) {
    return null;
  }

  const displayedText = normalizeSentence(displayedWords.join(" "));
  const displayedStripped = stripPunctuation(displayedText);

  if (!displayedStripped) {
    return null;
  }

  let bestMatch: ExerciseSnapshot | null = null;
  let bestScore = 0;

  for (const exercise of exercises) {
    if (exercise.kind !== "click_on_mistake") {
      continue;
    }

    const visibleParts = exercise.sentence.filter(
      (part) => !isDictationMissingPart(exercise, part)
    );
    const missingPartCount = exercise.sentence.length - visibleParts.length;

    if (missingPartCount !== inputCount) {
      continue;
    }

    const candidateText = normalizeSentence(buildSentenceFromParts(visibleParts));
    const candidateStripped = stripPunctuation(candidateText);

    if (!candidateStripped) {
      continue;
    }

    if (
      candidateText === displayedText ||
      candidateStripped === displayedStripped ||
      candidateText.includes(displayedText) ||
      displayedText.includes(candidateText) ||
      candidateStripped.includes(displayedStripped) ||
      displayedStripped.includes(candidateStripped)
    ) {
      return exercise;
    }

    const exerciseWords = candidateStripped.split(/\s+/).filter(Boolean);
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

  return bestScore >= 0.5 ? bestMatch : null;
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
): ClickSolveDecision | null {
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

export function deriveExactDictationDecision(
  exercise: ExerciseSnapshot
): DictationSolveDecision | null {
  if (exercise.kind !== "click_on_mistake") {
    return null;
  }

  const firstCorrection = exercise.corrections?.[0] ?? [];
  const values = exercise.sentence
    .map((part, index) => {
      if (!isDictationMissingPart(exercise, part)) {
        return null;
      }

      const correctedPart =
        exercise.hasMistake !== false ? firstCorrection[index] : part;
      const text = correctedPart?.text ?? part.text;

      return stripHtml(text);
    })
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return null;
  }

  return {
    kind: "fill_dictation",
    values,
    source: "fiber_exact_dom_located",
    reason: "Réponse de dictée trouvée dans les corrections exactes.",
  };
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
): ClickSolveDecision | null {
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
