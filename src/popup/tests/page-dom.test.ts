import assert from "node:assert/strict";
import test from "node:test";
import { getPageKindFromLocation } from "../src/extension/page-dom";

test("getPageKindFromLocation supports exercise, training and evaluation routes", () => {
  assert.equal(
    getPageKindFromLocation("https://apprentissage.appli3.projet-voltaire.fr/exercice"),
    "exercise"
  );
  assert.equal(
    getPageKindFromLocation("https://apprentissage.appli3.projet-voltaire.fr/entrainement"),
    "training"
  );
  assert.equal(
    getPageKindFromLocation("https://apprentissage.appli3.projet-voltaire.fr/evaluation"),
    "evaluation"
  );
  assert.equal(
    getPageKindFromLocation("https://apprentissage.appli3.projet-voltaire.fr/accueil"),
    "unsupported"
  );
});
