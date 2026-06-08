import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDragAndDropAssignments,
  canUseReversoFallback,
  deriveExactDictationDecision,
  deriveExactClickDecision,
  deriveReversoFallbackDecision,
  matchClickExercise,
  matchDictationExercise,
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

test("matchDictationExercise matches a visible sentence with the missing part removed", () => {
  const matched = matchDictationExercise(
    [
      {
        id: "dictation-mistake",
        kind: "click_on_mistake",
        sentence: [
          { text: "Ma voiture est en panne : il ne manquait plus que" },
          { text: "sa", mistake: true, clue: true },
          { text: "!" },
        ],
        corrections: [
          [
            { text: "Ma voiture est en panne : il ne manquait plus que" },
            { text: "ça" },
            { text: "!" },
          ],
        ],
        hasMistake: true,
        columns: [],
        metadata: {},
      },
    ],
    ["Il", "ne", "manquait", "plus", "que", "!"],
    1
  );

  assert.equal(matched?.id, "dictation-mistake");
});

test("matchDictationExercise matches when the missing part is at the beginning", () => {
  const matched = matchDictationExercise(
    [
      {
        id: "dictation-leading-mistake",
        kind: "click_on_mistake",
        sentence: [
          { text: "Connaissait-tu", mistake: true, clue: true },
          { text: "l'ancienne directrice commerciale ?" },
        ],
        corrections: [
          [
            { text: "Connaissais-tu" },
            { text: "l'ancienne directrice commerciale ?" },
          ],
        ],
        hasMistake: true,
        columns: [],
        metadata: {},
      },
    ],
    ["l'ancienne", "directrice", "commerciale", "?"],
    1
  );

  assert.equal(matched?.id, "dictation-leading-mistake");
});

test("matchDictationExercise matches the short dictation sentence visible around the input", () => {
  const matched = matchDictationExercise(
    [
      {
        id: "dictation-visible-short",
        kind: "click_on_mistake",
        sentence: [
          { text: "Ils" },
          { text: "bavardes", mistake: true, clue: true },
          { text: "devant l'entrée de l'immeuble." },
        ],
        corrections: [
          [
            { text: "Ils" },
            { text: "bavardent" },
            { text: "devant l'entrée de l'immeuble." },
          ],
        ],
        hasMistake: true,
        columns: [],
        metadata: {},
      },
    ],
    ["Ils", "devant l'entrée de l'immeuble."],
    1
  );

  assert.equal(matched?.id, "dictation-visible-short");
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

test("deriveExactDictationDecision fills missing words from corrections or clues", () => {
  assert.deepEqual(
    deriveExactDictationDecision({
      id: "dictation-mistake",
      kind: "click_on_mistake",
      sentence: [
        { text: "Il ne manquait plus que" },
        { text: "sa", mistake: true, clue: true },
        { text: "!" },
      ],
      corrections: [
        [
          { text: "Il ne manquait plus que" },
          { text: "ça" },
          { text: "!" },
        ],
      ],
      hasMistake: true,
      columns: [],
      metadata: {},
    }),
    {
      kind: "fill_dictation",
      values: ["ça"],
      source: "fiber_exact_dom_located",
      reason: "Réponse de dictée trouvée dans les corrections exactes.",
    }
  );

  assert.deepEqual(
    deriveExactDictationDecision({
      id: "dictation-no-mistake",
      kind: "click_on_mistake",
      sentence: [
        { text: "Est-il possible" },
        { text: "d'en", clue: true },
        { text: "mettre trois autres ici ?" },
      ],
      hasMistake: false,
      columns: [],
      metadata: {},
    })?.values,
    ["d'en"]
  );
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
