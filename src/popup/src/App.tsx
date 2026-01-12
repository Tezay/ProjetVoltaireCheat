import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { scriptVoltaire } from "./script-voltaire/script.voltaire";
import { MessageType } from "./types/ChromeRuntime";
import Button from "./components/Button";

export function App() {
  const [sentence, setSentence] = useState("");

  const fetchSentence = useCallback(async (string: string) => {
    return axios.post("https://orthographe.reverso.net/api/v1/Spelling", {
      language: "fra",
      text: string,
      autoReplace: true,
      interfaceLanguage: "fr",
      locale: "Indifferent",
      origin: "interactive",
      generateSynonyms: false,
      getCorrectionDetails: true,
    });
  }, []);

  const startScript = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scriptVoltaire,
    });

    const port = chrome.tabs.connect(tab.id);
    const initSession: MessageType = { type: "startSession" };
    port.postMessage(initSession);
    port.onMessage.addListener(async (response) => {
      if (sentence !== response) {
        setSentence((res) => res);

        const { data } = await fetchSentence(response);
        const sentenceResponse: MessageType = {
          type: "sentenceResponse",
          value: data,
        };
        port.postMessage(sentenceResponse);
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSentence]);

  useEffect(() => {
    // chrome.runtime.connect(); // Removed in V3 as background script is optional
    startScript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-400 text-center lg:px-4 w-64 p-2">
      <Button onClick={startScript}>Lancer une session !!</Button>
    </div>
  );
}
