import { useCallback, useEffect, useState } from "react";
import axios, { AxiosError } from "axios";
import { scriptVoltaire } from "./script-voltaire/script.voltaire";
import { MessageType } from "./types/ChromeRuntime";
import Button from "./components/Button";

export function App() {
  const [sentence, setSentence] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchSentence = useCallback(async (text: string) => {
    try {
      const response = await axios.post("https://orthographe.reverso.net/api/v1/Spelling", {
        language: "fra",
        text: text,
        autoReplace: true,
        interfaceLanguage: "fr",
        locale: "Indifferent",
        origin: "interactive",
        generateSynonyms: false,
        getCorrectionDetails: true,
      }, {
        timeout: 10000, // 10 second timeout
      });
      setError(null);
      return response;
    } catch (err) {
      const axiosError = err as AxiosError;
      if (axiosError.response?.status === 429) {
        setError("Rate limité par Reverso. Réessayez dans quelques secondes.");
      } else if (axiosError.code === 'ECONNABORTED') {
        setError("Timeout - Reverso ne répond pas.");
      } else {
        setError("Erreur de connexion à Reverso.");
      }
      throw err;
    }
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
        setSentence(() => response);

        try {
          const { data } = await fetchSentence(response);
          const sentenceResponse: MessageType = {
            type: "sentenceResponse",
            value: data,
          };
          port.postMessage(sentenceResponse);
        } catch {
          // Error already handled in fetchSentence, send error message to content script
          const errorMessage: MessageType = {
            type: "apiError",
          };
          port.postMessage(errorMessage);
        }
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchSentence]);

  useEffect(() => {
    startScript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-400 text-center lg:px-4 w-64 p-2">
      {error && (
        <div className="bg-red-500 text-white text-xs p-2 mb-2 rounded">
          {error}
        </div>
      )}
      <Button onClick={startScript}>Lancer une session !!</Button>
    </div>
  );
}
