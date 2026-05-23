import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDragAndDropAssignments,
  canUseReversoFallback,
  deriveExactClickDecision,
  deriveReversoFallbackDecision,
  matchClickExercise,
  matchDragAndDropExercise,
} from "../src/extension/matching";
import type { ExerciseSnapshot } from "../src/extension/types";

const clickOnMistakeExercise: ExerciseSnapshot = {
  id: "mistake-1",
  kind: "click_on_mistake",
  sentence: [
    { text: "Je" },
    { text: "mange" },
    { text: "des" },
    { text: "pommes", mistake: true },
  ],
  hasMistake: true,
  columns: [],
  metadata: {},
};

const noMistakeExercise: ExerciseSnapshot = {
  id: "mistake-2",
  kind: "click_on_mistake",
  sentence: [{ text: "Tout" }, { text: "va" }, { text: "bien" }],
  hasMistake: false,
  columns: [],
  metadata: {},
};

const clickOnWordExercise: ExerciseSnapshot = {
  id: "word-1",
  kind: "click_on_word",
  sentence: [
    { text: "Le" },
    { text: "chat", clue: true },
    { text: "dort" },
  ],
  columns: [],
  metadata: {},
};

const dragAndDropExercise: ExerciseSnapshot = {
  id: "drag-1",
  kind: "drag_and_drop",
  sentence: [],
  columns: [
    {
      instruction: "Nom",
      words: ["chat", "chien"],
    },
    {
      instruction: "Verbe",
      words: ["courir", "manger"],
    },
  ],
  metadata: {},
};

test("matchClickExercise matches the displayed sentence despite punctuation differences", () => {
  const matched = matchClickExercise(
    [clickOnMistakeExercise, clickOnWordExercise],
    ["Je", "mange", "des", "pommes."]
  );

  assert.equal(matched?.id, "mistake-1");
});

test("matchDragAndDropExercise matches the displayed cards against exact columns", () => {
  const matched = matchDragAndDropExercise(
    [dragAndDropExercise],
    ["manger", "chien"]
  );

  assert.equal(matched?.id, "drag-1");
});

test("deriveExactClickDecision exposes exact click decisions for mistake, no-mistake and target-word flows", () => {
  assert.deepEqual(deriveExactClickDecision(clickOnMistakeExercise), {
    kind: "click_word",
    word: "pommes",
    source: "fiber_exact_dom_located",
    reason: "Bonne réponse trouvée directement sur la page.",
  });

  assert.deepEqual(deriveExactClickDecision(noMistakeExercise), {
    kind: "click_no_mistake",
    source: "fiber_exact_dom_located",
    reason: "Aucune faute détectée dans la phrase.",
  });

  assert.deepEqual(deriveExactClickDecision(clickOnWordExercise), {
    kind: "click_word",
    word: "chat",
    source: "fiber_exact_dom_located",
    reason: "Mot trouvé directement sur la page.",
  });
});

test("buildDragAndDropAssignments maps each normalized word to its target column", () => {
  const assignments = buildDragAndDropAssignments(dragAndDropExercise);

  assert.equal(assignments.get("chat"), "Nom");
  assert.equal(assignments.get("manger"), "Verbe");
});

test("deriveReversoFallbackDecision chooses no-mistake when no correction is returned", () => {
  const decision = deriveReversoFallbackDecision(
    "Tout va bien",
    [
      { text: "Tout", startIndex: 0, endIndex: 4 },
      { text: "va", startIndex: 5, endIndex: 7 },
      { text: "bien", startIndex: 8, endIndex: 12 },
    ],
    {
      text: "Tout va bien",
      corrections: [],
    }
  );

  assert.deepEqual(decision, {
    kind: "click_no_mistake",
    source: "reverso_fallback",
    reason: "Reverso ne détecte aucune faute sur cette phrase.",
  });
});

test("deriveReversoFallbackDecision maps a correction span back to the displayed word", () => {
  const decision = deriveReversoFallbackDecision(
    "Il mange des pomme",
    [
      { text: "Il", startIndex: 0, endIndex: 2 },
      { text: "mange", startIndex: 3, endIndex: 8 },
      { text: "des", startIndex: 9, endIndex: 12 },
      { text: "pomme", startIndex: 13, endIndex: 18 },
    ],
    {
      text: "Il mange des pommes",
      corrections: [
        {
          startIndex: 13,
          endIndex: 18,
          mistakeText: "pomme",
          correctionText: "pommes",
        },
      ],
    }
  );

  assert.deepEqual(decision, {
    kind: "click_word",
    word: "pomme",
    source: "reverso_fallback",
    reason: "Mot cible dérivé depuis la suggestion Reverso.",
  });
});

test("canUseReversoFallback stays limited to phrase-compatible flows", () => {
  assert.equal(canUseReversoFallback("click_on_mistake", false), true);
  assert.equal(canUseReversoFallback("unknown", true), true);
  assert.equal(canUseReversoFallback("click_on_word", false), false);
  assert.equal(canUseReversoFallback("drag_and_drop", false), false);
});
