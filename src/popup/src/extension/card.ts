import type { CorrectedSentence, Correction } from "./types";

const CARD_ID = "pvc-feedback-card";
const CARD_CONTENT_ID = "pvc-feedback-content";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightSentence(
  sentence: string,
  corrections: Correction[]
): string {
  if (corrections.length === 0) {
    return escapeHtml(sentence);
  }

  const sortedCorrections = [...corrections].sort(
    (firstCorrection, secondCorrection) =>
      firstCorrection.startIndex - secondCorrection.startIndex
  );

  const parts: string[] = [];
  let cursor = 0;

  for (const correction of sortedCorrections) {
    const startIndex = Math.max(correction.startIndex, cursor);
    const endIndex = Math.max(correction.endIndex, startIndex);

    if (startIndex > cursor) {
      parts.push(escapeHtml(sentence.slice(cursor, startIndex)));
    }

    if (endIndex > startIndex) {
      parts.push(
        `<span class="pvc-highlight-error">${escapeHtml(
          sentence.slice(startIndex, endIndex)
        )}</span>`
      );
      cursor = endIndex;
    }
  }

  if (cursor < sentence.length) {
    parts.push(escapeHtml(sentence.slice(cursor)));
  }

  return parts.join("");
}

function ensureCardElements(): { card: HTMLDivElement; content: HTMLDivElement } {
  const existingCard = document.getElementById(CARD_ID) as HTMLDivElement | null;
  const existingContent = document.getElementById(
    CARD_CONTENT_ID
  ) as HTMLDivElement | null;

  if (existingCard && existingContent) {
    return { card: existingCard, content: existingContent };
  }

  const card = document.createElement("div");
  const content = document.createElement("div");
  const closeButton = document.createElement("button");
  const style = document.createElement("style");

  card.id = CARD_ID;
  content.id = CARD_CONTENT_ID;
  closeButton.type = "button";
  closeButton.className = "pvc-close-btn";
  closeButton.setAttribute("aria-label", "Fermer le feedback");
  closeButton.textContent = "✕";
  style.textContent = `
    #${CARD_ID} {
      font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      position: fixed;
      bottom: 16px;
      left: 16px;
      width: min(400px, calc(100vw - 32px));
      max-height: 250px;
      overflow-y: auto;
      z-index: 99999;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      padding: 16px;
      color: white;
      transition: background-color 0.3s ease;
      line-height: 1.45;
    }

    #${CARD_ID} .pvc-close-btn {
      position: absolute;
      top: 8px;
      right: 12px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 18px;
      opacity: 0.75;
      transition: opacity 0.2s ease;
    }

    #${CARD_ID} .pvc-close-btn:hover {
      opacity: 1;
    }

    #${CARD_ID} .pvc-status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 12px;
      background: rgba(255, 255, 255, 0.2);
    }

    #${CARD_ID} .pvc-section-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.78;
      margin-bottom: 4px;
    }

    #${CARD_ID} .pvc-sentence-box {
      background: rgba(0, 0, 0, 0.16);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 14px;
      word-break: break-word;
    }

    #${CARD_ID} .pvc-highlight-error {
      background: rgba(255, 234, 0, 0.3);
      color: #fff9cc;
      font-weight: 700;
      border-radius: 3px;
      padding: 0 2px;
    }
  `;

  card.append(style, closeButton, content);
  closeButton.addEventListener("click", () => {
    card.remove();
  });

  const host = document.body || document.documentElement;
  host.appendChild(card);

  return { card, content };
}

function renderCard(background: string, markup: string): void {
  const { card, content } = ensureCardElements();

  card.style.background = background;
  content.innerHTML = markup;
}

export function showLoading(message: string): void {
  renderCard(
    "linear-gradient(135deg, #0f766e 0%, #155e75 100%)",
    `
      <div class="pvc-status-badge">Analyse</div>
      <div class="pvc-sentence-box">${escapeHtml(message)}</div>
    `
  );
}

export function showError(message: string): void {
  renderCard(
    "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
    `
      <div class="pvc-status-badge">Erreur</div>
      <div class="pvc-sentence-box">${escapeHtml(message)}</div>
    `
  );
}

export function showSentenceAnalysis(
  sentence: string,
  analysis: CorrectedSentence
): void {
  if (analysis.corrections.length === 0) {
    renderCard(
      "linear-gradient(135deg, #16a34a 0%, #10b981 100%)",
      `
        <div class="pvc-status-badge">Correct</div>
        <div class="pvc-section-label">Phrase analysée</div>
        <div class="pvc-sentence-box">${escapeHtml(analysis.text)}</div>
      `
    );

    return;
  }

  renderCard(
    "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
    `
      <div class="pvc-status-badge">Erreur détectée</div>
      <div class="pvc-section-label">Phrase proposée</div>
      <div class="pvc-sentence-box">${highlightSentence(
        sentence,
        analysis.corrections
      )}</div>
      <div class="pvc-section-label">Version corrigée</div>
      <div class="pvc-sentence-box">${escapeHtml(analysis.text)}</div>
    `
  );
}
