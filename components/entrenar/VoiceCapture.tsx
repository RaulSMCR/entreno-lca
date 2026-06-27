"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { VoiceParsedSet } from "@/app/api/parse-voice/route";

export type VoiceContextExercise = {
  name: string;
  unit: "kg" | "seconds" | "meters" | "intervals" | "reps";
  loadOptions?: number[];
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

function subscribeOnline(onStoreChange: () => void): () => void {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getOnlineServerSnapshot(): boolean {
  return true;
}

function subscribeStatic(): () => void {
  return () => {};
}

function getSpeechSupportSnapshot(): boolean {
  return !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function getSpeechSupportServerSnapshot(): boolean {
  return false;
}

export function VoiceCapture({
  contexto,
  onParsed,
}: {
  contexto: VoiceContextExercise[];
  onParsed: (sets: VoiceParsedSet[]) => void;
}) {
  const supported = useSyncExternalStore(
    subscribeStatic,
    getSpeechSupportSnapshot,
    getSpeechSupportServerSnapshot
  );
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<"idle" | "processing" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  async function submitTranscript(text: string) {
    if (!text.trim() || contexto.length === 0) return;
    setStatus("processing");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, contexto }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data?.error ?? "No se pudo interpretar el audio.");
        return;
      }
      setStatus("idle");
      onParsed(data.sets as VoiceParsedSet[]);
      setTranscript("");
    } catch {
      setStatus("error");
      setErrorMsg("Sin conexión con el servidor.");
    }
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "es-AR";
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i][0];
        if (result) interim += result.transcript;
      }
      finalText = interim;
      setTranscript(interim);
    };
    recognition.onerror = () => {
      setListening(false);
      setStatus("error");
      setErrorMsg("Error de reconocimiento de voz.");
    };
    recognition.onend = () => {
      setListening(false);
      if (finalText.trim()) void submitTranscript(finalText);
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setStatus("idle");
    setErrorMsg(null);
    setListening(true);
    recognition.start();
  }

  if (!supported) return null;

  const disabled = !online && !listening;

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleListening}
          disabled={disabled}
          aria-label={listening ? "Detener dictado" : "Dictar serie por voz"}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-xl disabled:opacity-40 ${
            listening
              ? "bg-red-600 text-white"
              : "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
          }`}
        >
          🎤
        </button>
        <div className="flex-1 text-sm text-zinc-500 dark:text-zinc-400">
          {!online
            ? "Sin conexión: dictado deshabilitado, usá el registro manual."
            : listening
              ? "Escuchando…"
              : status === "processing"
                ? "Interpretando…"
                : 'Tocá el micrófono y decí, por ejemplo: "press banca setenta kilos, ocho reps, esfuerzo ocho".'}
        </div>
      </div>
      {transcript && <p className="text-sm italic text-zinc-700 dark:text-zinc-300">&ldquo;{transcript}&rdquo;</p>}
      {errorMsg && <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>}
    </div>
  );
}
