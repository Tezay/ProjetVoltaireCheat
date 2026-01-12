export interface Correction {
  startIndex: number;
  endIndex: number;
  mistakeText?: string;
  correctionText?: string;
}

export interface CorrectedSentence {
  text: string;
  corrections: Correction[];
}

export type MessageType =
  | {
    type: "startSession" | "sentenceChange";
  }
  | { type: "sentenceResponse"; value: CorrectedSentence };
