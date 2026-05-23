import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSentenceFromFragments,
  buildSentenceFromParts,
  buildWordRangesFromFragments,
  normalizeSentence,
  normalizeWhitespace,
  stripHtml,
  stripPunctuation,
} from "../src/extension/normalization";

test("normalizeSentence normalizes quotes, dashes and whitespace", () => {
  const normalized = normalizeSentence("  C’est\u00A0un mot\u2014test  ");

  assert.equal(normalized, "c'est un mot-test");
});

test("stripHtml removes embedded markup before normalization", () => {
  assert.equal(stripHtml("<span>Bon</span> <strong>jour</strong>"), "Bon jour");
  assert.equal(normalizeWhitespace("  bon \n  jour  "), "bon jour");
});

test("stripPunctuation removes punctuation while preserving lexical matching", () => {
  const stripped = stripPunctuation("« Bonjour ! », dit-il.");

  assert.equal(stripped, "bonjour ditil");
});

test("buildSentenceFromParts rebuilds a clean sentence from fiber parts", () => {
  const sentence = buildSentenceFromParts([
    { text: "<span>Nous</span>" },
    { text: "  irons " },
    { text: "demain." },
  ]);

  assert.equal(sentence, "Nous irons demain.");
});

test("buildSentenceFromFragments restores spaces between split DOM fragments", () => {
  const sentence = buildSentenceFromFragments([
    "Les",
    "derniers",
    "coursiers",
    "passe",
    "à",
    "19",
    "h",
    "30",
    ".",
  ]);

  assert.equal(sentence, "Les derniers coursiers passe à 19 h 30.");
});

test("buildSentenceFromFragments keeps tight joins for punctuation and apostrophes", () => {
  assert.equal(
    buildSentenceFromFragments(["l'", "homme", ",", "ici", "!"]),
    "l'homme, ici!"
  );
});

test("buildWordRangesFromFragments stays aligned with the rebuilt sentence", () => {
  const ranges = buildWordRangesFromFragments(["Les", "derniers", "coursiers"]);

  assert.deepEqual(ranges, [
    { text: "Les", startIndex: 0, endIndex: 3 },
    { text: "derniers", startIndex: 4, endIndex: 12 },
    { text: "coursiers", startIndex: 13, endIndex: 22 },
  ]);
});
