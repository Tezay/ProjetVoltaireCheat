import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSolverSettings,
  shouldTriggerExactError,
} from "../src/extension/settings-model";

test("normalizeSolverSettings migrates legacy shortcut config and clamps delays", () => {
  const settings = normalizeSolverSettings(
    {
      autoSolveEnabled: true,
      delayMinMs: 300,
      delayMaxMs: 700,
      exactErrorRate: 99,
    },
    {
      enabled: true,
      key: "b",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    }
  );

  assert.equal(settings.autoSolveEnabled, true);
  assert.equal(settings.reversoOnlyMode, false);
  assert.equal(settings.shortcutConfig.enabled, true);
  assert.equal(settings.shortcutConfig.key, "B");
  assert.equal(settings.shortcutConfig.ctrlKey, true);
  assert.equal(settings.delayMinMs, 1000);
  assert.equal(settings.delayMaxMs, 1000);
  assert.equal(settings.exactErrorRate, 50);
});

test("shouldTriggerExactError only applies on auto mode with exact sources", () => {
  assert.equal(
    shouldTriggerExactError({
      mode: "auto",
      answerSource: "fiber_exact_dom_located",
      exactErrorRate: 20,
      randomValue: 0.05,
    }),
    true
  );

  assert.equal(
    shouldTriggerExactError({
      mode: "popup",
      answerSource: "fiber_exact_dom_located",
      exactErrorRate: 20,
      randomValue: 0.05,
    }),
    false
  );

  assert.equal(
    shouldTriggerExactError({
      mode: "auto",
      answerSource: "reverso_fallback",
      exactErrorRate: 20,
      randomValue: 0.05,
    }),
    false
  );
});
