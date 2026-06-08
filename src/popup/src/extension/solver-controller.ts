import {
  hasExtensionContext,
  isExtensionContextInvalidationError,
} from "./extension-context";
import { requestExactSnapshotFromMainWorld } from "./bridge";
import {
  showError,
  showFallbackAnalysisCard,
  showInfoCard,
  showLoading,
} from "./card";
import {
  buildDragAndDropAssignments,
  canUseReversoFallback,
  deriveExactDictationDecision,
  deriveExactClickDecision,
  deriveReversoFallbackDecision,
  matchClickExercise,
  matchDictationExercise,
  matchDragAndDropExercise,
} from "./matching";
import {
  getPageKindFromLocation,
  clickElementInMainWorld,
  isAdvanceButton,
  locateAlternativeWordElement,
  locateDropZonesByColumns,
  locateNextDragPlacement,
  locateWordElement,
  fillTextInputInPage,
  readClickQuestionSurface,
  readDictationSurface,
  readPageButtons,
  readVisibleDragCards,
  type ClickQuestionSurface,
  type DictationSurface,
  type PageButtons,
  type VisibleDragCard,
} from "./page-dom";
import { normalizeSolverSettings, shouldTriggerExactError } from "./settings-model";
import {
  createDefaultRuntimeStatus,
  createDefaultSessionStats,
  createSolveOutcome,
  getPageLabel,
} from "./status";
import { getStoredSolverSettings } from "./storage";
import type {
  BackgroundResponseMessage,
  ContentResponseMessage,
  ExerciseKind,
  ExerciseSnapshot,
  RuntimeStatus,
  SolveTrigger,
  SolverSettings,
} from "./types";

interface SolveContext {
  pageButtons: PageButtons;
  pageKind: ReturnType<typeof getPageKindFromLocation>;
  clickQuestion: ClickQuestionSurface | null;
  dictationSurface: DictationSurface | null;
  dragCards: VisibleDragCard[];
  matchedExercise: ExerciseSnapshot | null;
  currentExerciseKind: ExerciseKind | null;
  questionFingerprint: string | null;
  questionLabel: string | null;
  fallbackAllowed: boolean;
  exactCapability: RuntimeStatus["exactCapability"];
  currentAnswerSource: RuntimeStatus["currentAnswerSource"];
  exactSnapshotCount: number;
}

export class SolverController {
  private settings: SolverSettings;

  private status: RuntimeStatus;

  private autoSolveTimer: number | null = null;

  private awaitingValidationFingerprint: string | null = null;

  private lastSupportedPage = false;

  private lastPauseKey: string | null = null;

  constructor() {
    this.settings = normalizeSolverSettings();
    this.status = createDefaultRuntimeStatus(this.settings);

    if (hasExtensionContext() && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" || !changes.solverSettings) {
          return;
        }

        this.settings = normalizeSolverSettings(
          changes.solverSettings.newValue as Partial<SolverSettings> | undefined
        );
        this.status.autoSolveEnabled = this.settings.autoSolveEnabled;
        this.status.shortcutEnabled = this.settings.shortcutConfig.enabled;

        if (this.settings.autoSolveEnabled) {
          this.startAutoSolveLoop();
        } else {
          this.stopAutoSolveLoop();
        }

        void this.refreshStatusOnly().catch(() => {
          // Ignore stale callbacks after extension reload.
        });
      });
    }
  }

  async initialize(): Promise<void> {
    this.settings = await getStoredSolverSettings();
    this.status = createDefaultRuntimeStatus(this.settings);
    await this.refreshStatusOnly();

    if (this.settings.autoSolveEnabled) {
      this.startAutoSolveLoop();
    }
  }

  async getRuntimeStatus(): Promise<ContentResponseMessage> {
    await this.refreshStatusOnly();

    return this.buildResponse(true);
  }

  async extractExactSnapshot(): Promise<ContentResponseMessage> {
    const snapshot = requestExactSnapshotFromMainWorld();
    await this.refreshStatusOnly();

    return this.buildResponse(true, undefined, snapshot?.count ?? 0);
  }

  async updateSettings(
    partialSettings: Partial<SolverSettings>
  ): Promise<ContentResponseMessage> {
    this.settings = normalizeSolverSettings({
      ...this.settings,
      ...partialSettings,
      shortcutConfig: partialSettings.shortcutConfig ?? this.settings.shortcutConfig,
    });
    this.status.autoSolveEnabled = this.settings.autoSolveEnabled;
    this.status.shortcutEnabled = this.settings.shortcutConfig.enabled;

    if (this.settings.autoSolveEnabled) {
      this.startAutoSolveLoop();
    } else {
      this.stopAutoSolveLoop();
    }

    await this.refreshStatusOnly();

    return this.buildResponse(true, "Configuration appliquee.");
  }

  async runSingleSolve(trigger: Exclude<SolveTrigger, "auto">): Promise<ContentResponseMessage> {
    return this.performSolve(trigger);
  }

  async solveCurrentExercise(trigger: SolveTrigger): Promise<ContentResponseMessage> {
    return this.performSolve(trigger);
  }

  private buildResponse(
    ok: boolean,
    message?: string,
    snapshotCount?: number
  ): ContentResponseMessage {
    return {
      ok,
      status: this.status,
      message,
      snapshotCount,
    };
  }

  private updateSessionBoundary(pageKind: SolveContext["pageKind"]): void {
    const isSupportedPage = pageKind !== "unsupported";

    if (isSupportedPage && !this.lastSupportedPage) {
      this.status.sessionStats = createDefaultSessionStats();
      this.awaitingValidationFingerprint = null;
      this.lastPauseKey = null;
    }

    this.lastSupportedPage = isSupportedPage;
  }

  private buildContext(): SolveContext {
    const pageKind = getPageKindFromLocation();
    this.updateSessionBoundary(pageKind);

    const pageButtons = readPageButtons();
    const dictationSurface = readDictationSurface();
    const clickQuestion = readClickQuestionSurface();
    const dragCards = clickQuestion || dictationSurface ? [] : readVisibleDragCards();
    const exactSnapshot =
      pageKind === "unsupported" || this.settings.reversoOnlyMode
        ? null
        : requestExactSnapshotFromMainWorld();
    const exercises = exactSnapshot?.exercises ?? [];

    let matchedExercise: ExerciseSnapshot | null = null;
    if (!this.settings.reversoOnlyMode && dictationSurface) {
      matchedExercise = matchDictationExercise(
        exercises,
        dictationSurface.words.map((word) => word.text),
        dictationSurface.inputs.length
      );
    } else if (!this.settings.reversoOnlyMode && clickQuestion) {
      matchedExercise = matchClickExercise(
        exercises,
        clickQuestion.words.map((word) => word.text)
      );
    } else if (!this.settings.reversoOnlyMode && dragCards.length >= 2) {
      matchedExercise = matchDragAndDropExercise(
        exercises,
        dragCards.map((card) => card.text)
      );
    }

    const currentExerciseKind =
      matchedExercise?.kind ??
      (clickQuestion
        ? clickQuestion.noMistakeButton
          ? "click_on_mistake"
          : "unknown"
        : dictationSurface
          ? "click_on_mistake"
          : dragCards.length >= 2
            ? "drag_and_drop"
            : null);
    const fallbackAllowed =
      clickQuestion !== null &&
      dictationSurface === null &&
      canUseReversoFallback(
        currentExerciseKind,
        Boolean(clickQuestion.noMistakeButton)
      );
    const exactCapability =
      pageKind === "unsupported"
        ? "unsupported"
        : this.settings.reversoOnlyMode
          ? fallbackAllowed
            ? "fallback_only"
            : "unavailable"
        : matchedExercise
          ? "ready"
          : fallbackAllowed
            ? "fallback_only"
            : "unavailable";
    const currentAnswerSource = matchedExercise
      ? "fiber_exact"
      : fallbackAllowed
        ? "reverso_fallback"
        : currentExerciseKind
          ? "unavailable"
          : null;
    const questionFingerprint =
      dragCards.length > 0
        ? dragCards.map((card) => card.normalizedText).sort().join("|")
        : dictationSurface?.sentenceText || clickQuestion?.sentenceText || null;
    const questionLabel =
      dragCards.length > 0
        ? `Classement (${dragCards.length} element${dragCards.length > 1 ? "s" : ""})`
        : dictationSurface?.sentenceText || clickQuestion?.sentenceText || null;

    return {
      pageButtons,
      pageKind,
      clickQuestion,
      dictationSurface,
      dragCards,
      matchedExercise,
      currentExerciseKind,
      questionFingerprint,
      questionLabel,
      fallbackAllowed,
      exactCapability,
      currentAnswerSource,
      exactSnapshotCount: exactSnapshot?.count ?? 0,
    };
  }

  private applyContextToStatus(
    context: SolveContext,
    options?: { preserveBusy?: boolean }
  ): void {
    this.status.pageKind = context.pageKind;
    this.status.currentExerciseKind = context.currentExerciseKind;
    this.status.currentAnswerSource = context.currentAnswerSource;
    this.status.exactCapability = context.exactCapability;
    this.status.exactSnapshotCount = context.exactSnapshotCount;
    this.status.currentQuestionFingerprint = context.questionFingerprint;
    this.status.currentQuestionLabel = context.questionLabel;
    this.status.autoSolveEnabled = this.settings.autoSolveEnabled;
    this.status.shortcutEnabled = this.settings.shortcutConfig.enabled;

    if (!options?.preserveBusy) {
      this.status.isBusy = false;
    }
  }

  private async refreshStatusOnly(): Promise<void> {
    const context = this.buildContext();
    this.applyContextToStatus(context);
  }

  private startAutoSolveLoop(): void {
    if (this.autoSolveTimer !== null) {
      return;
    }

    this.scheduleAutoSolve(250);
  }

  private stopAutoSolveLoop(): void {
    if (this.autoSolveTimer !== null) {
      window.clearTimeout(this.autoSolveTimer);
      this.autoSolveTimer = null;
    }
  }

  private scheduleAutoSolve(delayMs: number): void {
    this.stopAutoSolveLoop();
    this.autoSolveTimer = window.setTimeout(() => {
      this.autoSolveTimer = null;
      void this.runAutoSolveCycle();
    }, delayMs);
  }

  private getRandomDelay(): number {
    const min = this.settings.delayMinMs;
    const max = this.settings.delayMaxMs;

    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private async runAutoSolveCycle(): Promise<void> {
    if (!this.settings.autoSolveEnabled) {
      return;
    }

    if (this.status.isBusy) {
      this.scheduleAutoSolve(400);
      return;
    }

    try {
      await this.performSolve("auto");
    } catch (error) {
      if (!isExtensionContextInvalidationError(error)) {
        throw error;
      }
    }

    if (this.settings.autoSolveEnabled) {
      this.scheduleAutoSolve(this.getRandomDelay());
    }
  }

  private recordOutcome(
    kind: RuntimeStatus["lastSolveOutcome"] extends null
      ? never
      : NonNullable<RuntimeStatus["lastSolveOutcome"]>["kind"],
    message: string,
    source: NonNullable<RuntimeStatus["lastSolveOutcome"]>["source"]
  ): void {
    this.status.lastSolveOutcome = createSolveOutcome(kind, message, source);
  }

  private bumpStats(
    bucket: "exact" | "reverso" | "paused" | "skipped" | "intentional"
  ): void {
    switch (bucket) {
      case "exact":
        this.status.sessionStats.exactSolved += 1;
        this.status.sessionStats.totalActions += 1;
        break;
      case "reverso":
        this.status.sessionStats.reversoSolved += 1;
        this.status.sessionStats.totalActions += 1;
        break;
      case "paused":
        this.status.sessionStats.paused += 1;
        break;
      case "skipped":
        this.status.sessionStats.skipped += 1;
        break;
      case "intentional":
        this.status.sessionStats.intentionalErrors += 1;
        this.status.sessionStats.totalActions += 1;
        break;
    }
  }

  private handlePause(
    context: SolveContext,
    trigger: SolveTrigger,
    message: string
  ): ContentResponseMessage {
    const pauseKey = `${context.questionFingerprint ?? "none"}:${message}`;
    const shouldCountPause = this.lastPauseKey !== pauseKey;

    this.lastPauseKey = pauseKey;
    this.status.currentAnswerSource = "unavailable";
    this.recordOutcome("paused", message, "unavailable");

    if (shouldCountPause) {
      this.bumpStats("paused");
    }

    if (trigger !== "auto" || shouldCountPause) {
      showInfoCard({
        badge: "Pause",
        title: "Pause automatique",
        message,
        answerSource: "unavailable",
        tone: "warning",
      });
    }

    return this.buildResponse(false, message);
  }

  private handleImmediateButtons(context: SolveContext): ContentResponseMessage | null {
    if (context.pageButtons.audioDisableButton) {
      clickElementInMainWorld(context.pageButtons.audioDisableButton);
      this.awaitingValidationFingerprint = null;
      this.lastPauseKey = null;
      this.bumpStats("skipped");
      this.recordOutcome(
        "skipped",
        "Popup audio désactivée automatiquement.",
        "system"
      );
      showInfoCard({
        badge: "Système",
        title: "Audio désactivé",
        message: "Le popup de fonctionnalités sonores a été fermé automatiquement.",
        answerSource: null,
        tone: "system",
      });

      return this.buildResponse(true, "Popup audio désactivé.");
    }

    if (context.pageButtons.cantListenButton && !context.dictationSurface) {
      clickElementInMainWorld(context.pageButtons.cantListenButton);
      this.awaitingValidationFingerprint = null;
      this.lastPauseKey = null;
      this.bumpStats("skipped");
      this.recordOutcome(
        "skipped",
        "Option audio contournée automatiquement.",
        "system"
      );
      showInfoCard({
        badge: "Système",
        title: "Audio contournée",
        message: "Le bouton 'Je ne peux pas écouter' a été utilisé automatiquement.",
        answerSource: null,
        tone: "system",
      });

      return this.buildResponse(true, "Option audio contournée.");
    }

    const advanceButton = context.pageButtons.advanceButton;
    if (isAdvanceButton(advanceButton)) {
      clickElementInMainWorld(advanceButton);
      this.awaitingValidationFingerprint = null;
      this.lastPauseKey = null;
      this.bumpStats("skipped");
      this.recordOutcome(
        "skipped",
        "Ecran intermediaire ou correction passe automatiquement.",
        "system"
      );
      showInfoCard({
        badge: "Système",
        title: "Transition automatique",
        message:
          "Le solveur a cliqué sur Suivant / Continuer / compris pour poursuivre la session.",
        answerSource: null,
        tone: "system",
      });

      return this.buildResponse(true, "Transition automatique effectuée.");
    }

    if (
      context.pageButtons.validateButton &&
      context.questionFingerprint &&
      context.questionFingerprint === this.awaitingValidationFingerprint
    ) {
      clickElementInMainWorld(context.pageButtons.validateButton);
      this.awaitingValidationFingerprint = null;
      this.lastPauseKey = null;
      this.recordOutcome("solved", "Réponse validée automatiquement.", "system");
      showInfoCard({
        badge: "Validation",
        title: "Validation envoyée",
        message: "La réponse sélectionnée a été validée automatiquement.",
        answerSource: null,
        tone: "system",
      });

      return this.buildResponse(true, "Réponse validée.");
    }

    return null;
  }

  private async performSolve(trigger: SolveTrigger): Promise<ContentResponseMessage> {
    if (this.status.isBusy) {
      return this.buildResponse(false, "Une action est déjà en cours.");
    }

    this.status.isBusy = true;
    const loadingMessage =
      trigger === "auto"
        ? "Auto-résolution en cours..."
        : "Résolution de la question en cours...";

    if (trigger !== "auto") {
      showLoading(loadingMessage);
    }

    try {
      const context = this.buildContext();
      this.applyContextToStatus(context, { preserveBusy: true });

      if (context.pageKind === "unsupported") {
        const message =
          "Ouvrez un exercice Projet Voltaire, puis rechargez la page si l'extension vient d'être mise a jour.";
        if (trigger !== "auto") {
          showError(message);
        }
        this.recordOutcome("error", message, "system");

        return this.buildResponse(false, message);
      }

      const immediateButtonResponse = this.handleImmediateButtons(context);
      if (immediateButtonResponse) {
        return immediateButtonResponse;
      }

      if (context.dictationSurface) {
        return this.solveDictation(context, trigger);
      }

      if (context.dragCards.length > 0) {
        return this.solveDragAndDrop(context, trigger);
      }

      if (context.clickQuestion) {
        return this.solveClickQuestion(context, trigger);
      }

      const message = `Aucune question lisible pour le moment sur ${getPageLabel(
        context.pageKind
      ).toLowerCase()}.`;
      if (trigger !== "auto") {
        showError(message);
      }
      this.recordOutcome("error", message, "system");

      return this.buildResponse(false, message);
    } finally {
      this.status.isBusy = false;
    }
  }

  private solveDragAndDrop(
    context: SolveContext,
    trigger: SolveTrigger
  ): ContentResponseMessage {
    if (!context.matchedExercise || context.matchedExercise.kind !== "drag_and_drop") {
      return this.handlePause(
        context,
        trigger,
        this.settings.reversoOnlyMode
          ? "Le mode Reverso seul ne couvre pas ce type de question."
          : "Cette question n'a pas pu être lue automatiquement."
      );
    }

    const dropZones = locateDropZonesByColumns(context.matchedExercise.columns);
    const assignments = buildDragAndDropAssignments(context.matchedExercise);
    const nextPlacement = locateNextDragPlacement(
      context.dragCards,
      assignments,
      dropZones
    );

    if (!nextPlacement) {
      if (context.pageButtons.validateButton) {
        clickElementInMainWorld(context.pageButtons.validateButton);
        this.lastPauseKey = null;
        this.recordOutcome(
          "solved",
          "Classement finalisé et validé automatiquement.",
          "fiber_exact_dom_located"
        );
        showInfoCard({
          badge: "Exact",
          title: "Classement validé",
          message: "Tous les élements ont été placés puis la réponse a été validée.",
          answerSource: "fiber_exact_dom_located",
          tone: "exact",
        });

        return this.buildResponse(true, "Classement validé.");
      }

      return this.handlePause(
        context,
        trigger,
        "Impossible de terminer ce classement automatiquement."
      );
    }

    const makeIntentionalError = shouldTriggerExactError({
      mode: trigger,
      answerSource: "fiber_exact_dom_located",
      exactErrorRate: this.settings.exactErrorRate,
      randomValue: Math.random(),
    });

    clickElementInMainWorld(nextPlacement.card.element);

    if (makeIntentionalError) {
      const wrongZone = dropZones.find(
        (zone) => zone.columnInstruction !== nextPlacement.zone.columnInstruction
      );

      if (wrongZone) {
        clickElementInMainWorld(wrongZone.element);
        this.lastPauseKey = null;
        this.bumpStats("intentional");
        this.recordOutcome(
          "solved",
          `Erreur simulee: "${nextPlacement.card.text}" a été envoyé vers la mauvaise colonne.`,
          "fiber_exact_dom_located"
        );
        showInfoCard({
          badge: "Exact",
          title: "Erreur simulee",
          message: `"${nextPlacement.card.text}" a été placé volontairement dans une mauvaise colonne.`,
          answerSource: "fiber_exact_dom_located",
          tone: "exact",
        });

        return this.buildResponse(true, "Erreur simulée sur un classement.");
      }
    }

    clickElementInMainWorld(nextPlacement.zone.element);
    this.lastPauseKey = null;
    this.bumpStats("exact");
    this.recordOutcome(
      "solved",
      `Placement exact de "${nextPlacement.card.text}".`,
      "fiber_exact_dom_located"
    );
    showInfoCard({
      badge: "Exact",
      title: "Placement exact",
      message: `"${nextPlacement.card.text}" -> "${nextPlacement.zone.columnInstruction}"`,
      answerSource: "fiber_exact_dom_located",
      tone: "exact",
    });

    return this.buildResponse(true, "Placement exact effectue.");
  }

  private solveDictation(
    context: SolveContext,
    trigger: SolveTrigger
  ): ContentResponseMessage {
    if (!context.dictationSurface) {
      return this.buildResponse(false, "Aucune dictée détectée.");
    }

    if (!context.matchedExercise) {
      return this.handlePause(
        context,
        trigger,
        "La dictée est visible, mais l'exercice exact n'a pas pu être identifié."
      );
    }

    const decision = deriveExactDictationDecision(context.matchedExercise);
    if (!decision || decision.values.length !== context.dictationSurface.inputs.length) {
      return this.handlePause(
        context,
        trigger,
        "La dictée est visible, mais la réponse exacte n'est pas disponible."
      );
    }

    decision.values.forEach((value, index) => {
      const input = context.dictationSurface?.inputs[index];

      if (input) {
        fillTextInputInPage(input, value);
      }
    });

    if (context.dictationSurface.validateButton) {
      clickElementInMainWorld(context.dictationSurface.validateButton);
    } else {
      this.awaitingValidationFingerprint = context.questionFingerprint;
    }

    this.lastPauseKey = null;
    this.bumpStats("exact");
    this.recordOutcome("solved", decision.reason, decision.source);
    showInfoCard({
      badge: "Exact",
      title: "Dictée complétée",
      message: `Réponse saisie automatiquement: ${decision.values.join(" / ")}`,
      answerSource: decision.source,
      tone: "exact",
    });

    return this.buildResponse(true, decision.reason);
  }

  private async solveClickQuestion(
    context: SolveContext,
    trigger: SolveTrigger
  ): Promise<ContentResponseMessage> {
    if (!context.clickQuestion) {
      return this.buildResponse(false, "Aucune question cliquable détectée.");
    }

    if (context.matchedExercise) {
      const exactDecision = deriveExactClickDecision(context.matchedExercise);

      if (exactDecision) {
        const exactResponse = this.executeClickDecision(
          context,
          trigger,
          exactDecision,
          true
        );

        if (exactResponse) {
          return exactResponse;
        }
      }
    }

    if (!context.fallbackAllowed) {
      return this.handlePause(
        context,
        trigger,
        this.settings.reversoOnlyMode
          ? "Le mode Reverso seul ne couvre pas cette question."
          : "Cette question n'a pas pu être lue correctement."
      );
    }

    let fallbackResponse: BackgroundResponseMessage;
    try {
      fallbackResponse = (await chrome.runtime.sendMessage({
        type: "analysisFallback",
        sentence: context.clickQuestion.sentenceText,
      })) as BackgroundResponseMessage;
    } catch (error) {
      if (isExtensionContextInvalidationError(error)) {
        return this.buildResponse(
          false,
          "L'extension a été rechargée. Rechargez la page."
        );
      }

      throw error;
    }

    if (fallbackResponse.type === "analysisError") {
      const message = fallbackResponse.message;
      if (trigger !== "auto") {
        showError(message);
      }
      this.recordOutcome("error", message, "system");

      return this.buildResponse(false, message);
    }

    const fallbackDecision = deriveReversoFallbackDecision(
      context.clickQuestion.sentenceText,
      context.clickQuestion.words.map((word) => ({
        text: word.text,
        startIndex: word.startIndex,
        endIndex: word.endIndex,
      })),
      fallbackResponse.value
    );

    if (!fallbackDecision) {
      return this.handlePause(
        context,
        trigger,
        "La correction a été trouvée, mais pas l'endroit exact à cliquer."
      );
    }

    const fallbackClickResponse = this.executeClickDecision(
      context,
      trigger,
      fallbackDecision,
      false
    );

    if (!fallbackClickResponse) {
      return this.handlePause(
        context,
        trigger,
        "La correction est disponible, mais rien ne correspond clairement sur la page."
      );
    }

    showFallbackAnalysisCard(
      context.clickQuestion.sentenceText,
      fallbackResponse.value
    );

    return fallbackClickResponse;
  }

  private executeClickDecision(
    context: SolveContext,
    trigger: SolveTrigger,
    decision: ReturnType<typeof deriveExactClickDecision> extends infer TValue
      ? Exclude<TValue, null>
      : never,
    exactSource: boolean
  ): ContentResponseMessage | null {
    if (!context.clickQuestion || !context.questionFingerprint) {
      return null;
    }

    const shouldSimulateError = shouldTriggerExactError({
      mode: trigger,
      answerSource: decision.source,
      exactErrorRate: this.settings.exactErrorRate,
      randomValue: Math.random(),
    });

    if (shouldSimulateError) {
      const intentionalErrorResponse = this.executeIntentionalClickError(
        context.clickQuestion,
        decision
      );

      if (intentionalErrorResponse) {
        this.awaitingValidationFingerprint = context.questionFingerprint;
        this.lastPauseKey = null;
        this.bumpStats("intentional");
        this.recordOutcome(
          "solved",
          "Erreur simulée sur une source exacte.",
          "fiber_exact_dom_located"
        );

        return intentionalErrorResponse;
      }
    }

    let targetElement: HTMLElement | null = null;
    if (decision.kind === "click_no_mistake") {
      targetElement = context.clickQuestion.noMistakeButton;
    } else {
      targetElement = locateWordElement(context.clickQuestion.words, decision.word);
    }

    if (!targetElement) {
      return null;
    }

    clickElementInMainWorld(targetElement);
    this.awaitingValidationFingerprint = context.questionFingerprint;
    this.lastPauseKey = null;
    this.status.currentAnswerSource = decision.source;

    if (exactSource) {
      this.bumpStats("exact");
      this.recordOutcome("solved", decision.reason, decision.source);
      showInfoCard({
        badge: "Exact",
        title:
          decision.kind === "click_no_mistake"
            ? "Aucune faute detectee"
            : "Bonne réponse envoyée",
        message:
          decision.kind === "click_no_mistake"
            ? "La page indique qu'il n'y a pas de faute."
            : `Le mot "${decision.word}" a été trouvé directement sur la page.`,
        answerSource: decision.source,
        tone: "exact",
      });
    } else {
      this.bumpStats("reverso");
      this.recordOutcome("solved", decision.reason, decision.source);
    }

    return this.buildResponse(true, decision.reason);
  }

  private executeIntentionalClickError(
    clickQuestion: ClickQuestionSurface,
    decision: ReturnType<typeof deriveExactClickDecision> extends infer TValue
      ? Exclude<TValue, null>
      : never
  ): ContentResponseMessage | null {
    let wrongElement: HTMLElement | null = null;

    if (decision.kind === "click_no_mistake") {
      wrongElement = clickQuestion.words[0]?.element ?? null;
    } else if (clickQuestion.noMistakeButton) {
      wrongElement = clickQuestion.noMistakeButton;
    } else {
      wrongElement = locateAlternativeWordElement(clickQuestion.words, decision.word);
    }

    if (!wrongElement) {
      return null;
    }

    clickElementInMainWorld(wrongElement);
    showInfoCard({
      badge: "Exact",
      title: "Erreur de test",
      message:
        "Une mauvaise réponse volontaire a été envoyée pour tester le comportement.",
      answerSource: "fiber_exact_dom_located",
      tone: "exact",
    });

    return this.buildResponse(true, "Erreur simulée envoyée.");
  }
}
