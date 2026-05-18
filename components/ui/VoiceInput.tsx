"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type Props = {
  onTranscript: (text: string) => void;
  className?: string;
  ariaLabel?: string;
};

export default function VoiceInput({ onTranscript, className, ariaLabel = "Dictar" }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const r = new SR();
    r.lang = "es-MX";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e: any) => {
      const text = Array.from(e.results)
        .map((res: any) => res[0].transcript)
        .join(" ")
        .trim();
      if (text) onTranscript(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognitionRef.current = r;
    return () => {
      try { r.stop(); } catch {}
    };
  }, [onTranscript]);

  if (!supported) return null;

  const toggle = () => {
    const r = recognitionRef.current;
    if (!r) return;
    if (listening) {
      r.stop();
      setListening(false);
    } else {
      try {
        r.start();
        setListening(true);
      } catch {}
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={ariaLabel}
      aria-pressed={listening}
      className={`btn-icon ${listening ? "btn-primary" : "btn-secondary"} ${className ?? ""}`}
      title={listening ? "Detener" : "Dictar"}
    >
      {listening ? (
        <MicOff size={16} strokeWidth={1.5} />
      ) : (
        <Mic size={16} strokeWidth={1.5} />
      )}
    </button>
  );
}
