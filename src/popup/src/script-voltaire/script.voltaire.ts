import { MessageType, CorrectedSentence, Correction } from "../types/ChromeRuntime";

export const scriptVoltaire = async function () {
  // Create or find the feedback card
  if (!document.getElementById("cardou")) {
    const card = document.createElement("div");
    card.id = "cardou";
    card.innerHTML = `
      <style>
        #cardou {
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
          position: fixed;
          bottom: 16px;
          left: 16px;
          width: 400px;
          max-height: 250px;
          overflow-y: auto;
          z-index: 99999;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
          padding: 16px;
          color: white;
          transition: background-color 0.3s ease;
        }
        #cardou .close-btn {
          position: absolute;
          top: 8px;
          right: 12px;
          cursor: pointer;
          font-size: 18px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        #cardou .close-btn:hover { opacity: 1; }
        #cardou .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }
        #cardou .section-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.7;
          margin-bottom: 4px;
        }
        #cardou .sentence-box {
          background: rgba(0,0,0,0.15);
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 12px;
          line-height: 1.5;
          font-size: 14px;
        }
        #cardou .highlight-error {
          background: rgba(255, 255, 0, 0.3);
          color: #ffffcc;
          font-weight: 600;
          border-radius: 2px;
          padding: 0 2px;
        }
      </style>
      <span class="close-btn">✕</span>
      <div id="cardou-content"></div>
    `;
    document.body.appendChild(card);

    card.querySelector(".close-btn")?.addEventListener("click", () => {
      card.remove();
    });
  }

  const updateCard = (isCorrect: boolean, correctedText: string, originalSentence: string, corrections: Correction[]) => {
    const card = document.getElementById("cardou")!;
    const content = document.getElementById("cardou-content")!;

    if (isCorrect) {
      card.style.background = "linear-gradient(135deg, #28a745 0%, #20c997 100%)";
      content.innerHTML = `
        <div class="status-badge" style="background: rgba(255,255,255,0.2);">✓ Correct</div>
        <div class="section-label">Phrase analysée</div>
        <div class="sentence-box">${correctedText}</div>
      `;
    } else {
      card.style.background = "linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)";

      // Build the highlighted sentence using API-provided positions
      let highlightedSentence = originalSentence;
      // Sort corrections by startIndex descending to avoid position shifts
      const sortedCorrections = [...corrections].sort((a, b) => b.startIndex - a.startIndex);
      for (const correction of sortedCorrections) {
        const { startIndex, endIndex } = correction;
        highlightedSentence =
          highlightedSentence.slice(0, startIndex) +
          `<span class="highlight-error">${highlightedSentence.slice(startIndex, endIndex)}</span>` +
          highlightedSentence.slice(endIndex);
      }

      content.innerHTML = `
        <div class="status-badge" style="background: rgba(255,255,255,0.2);">✗ Erreur détectée</div>
        
        <div class="section-label">Phrase proposée (erreurs surlignées)</div>
        <div class="sentence-box">${highlightedSentence}</div>
        
        <div class="section-label">Version corrigée</div>
        <div class="sentence-box" style="border-left: 3px solid rgba(255,255,255,0.5);">${correctedText}</div>
      `;
    }
  };


  const getSentence = (): string => {
    // Strategy 1: Classic Projet Voltaire interface (uses .sentence class)
    const classicSentence = document.getElementsByClassName("sentence")[0];
    if (classicSentence) {
      const sentenceArray: string[] = [];
      classicSentence.childNodes.forEach((node) => {
        sentenceArray.push(node.textContent || "");
      });
      return sentenceArray.join("");
    }

    // Strategy 2: Académie Voltaire / React Native Web interface
    const sentenceContainer = document.querySelector('.r-18u37iz.r-1w6e6rj.r-1h0z5md.r-1peese0');
    if (sentenceContainer) {
      const wordDivs = sentenceContainer.querySelectorAll('div[dir="auto"].css-146c3p1');
      if (wordDivs.length > 0) {
        const words: string[] = [];
        wordDivs.forEach((div) => {
          const text = div.textContent || "";
          words.push(text);
        });
        return words.join("");
      }
    }

    // Fallback: return empty (will trigger error message)
    return "";
  };

  const listener = (port: chrome.runtime.Port) => {
    port.onMessage.addListener((message: MessageType) => {
      if (message.type === "startSession") {
        const sentence = getSentence();
        if (!sentence) {
          showError("Impossible de détecter la phrase. Interface non reconnue.");
          return;
        }
        port.postMessage(sentence);
        chrome.runtime.onConnect.removeListener(listener);
      } else if (message.type === "sentenceResponse") {
        const value = message.value as CorrectedSentence;
        const originalSentence = getSentence();
        const isCorrect = value.corrections.length === 0;
        updateCard(isCorrect, value.text, originalSentence, value.corrections);
      } else if (message.type === "apiError") {
        showError("Erreur de connexion à Reverso. Réessayez.");
      }
    });
  };

  const showError = (message: string) => {
    const card = document.getElementById("cardou")!;
    const content = document.getElementById("cardou-content")!;
    card.style.background = "linear-gradient(135deg, #6c757d 0%, #495057 100%)";
    content.innerHTML = `
      <div class="status-badge" style="background: rgba(255,255,255,0.2);">⚠ Erreur</div>
      <div class="sentence-box">${message}</div>
    `;
  };

  chrome.runtime.onConnect.addListener(listener);
};
