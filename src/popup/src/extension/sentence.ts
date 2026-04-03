export function getSentence(): string {
  const classicSentence = document.getElementsByClassName("sentence")[0];
  if (classicSentence) {
    const sentenceArray: string[] = [];
    classicSentence.childNodes.forEach((node) => {
      sentenceArray.push(node.textContent || "");
    });

    return sentenceArray.join("").trim();
  }

  const sentenceContainer = document.querySelector(
    ".r-18u37iz.r-1w6e6rj.r-1h0z5md.r-1peese0"
  );
  if (sentenceContainer) {
    const wordDivs = sentenceContainer.querySelectorAll(
      'div[dir="auto"].css-146c3p1'
    );

    if (wordDivs.length > 0) {
      const words: string[] = [];
      wordDivs.forEach((div) => {
        words.push(div.textContent || "");
      });

      return words.join("").trim();
    }
  }

  return "";
}
