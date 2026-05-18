"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush } from "@/lib/push/client";

type Status = "idle" | "subscribed" | "unsupported" | "denied" | "loading";

export default function EnablePushButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    registerServiceWorker().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      if (sub) setStatus("subscribed");
      if (Notification.permission === "denied") setStatus("denied");
    });
  }, []);

  const enviarPrueba = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setTestResult(`Error: ${json.error || "no se pudo enviar"}`);
        return;
      }
      setTestResult(
        `✓ Enviado a ${json.sent} dispositivo${json.sent === 1 ? "" : "s"}` +
          (json.failed > 0 ? ` (${json.failed} fallaron)` : "")
      );
      setTimeout(() => setTestResult(null), 6000);
    } catch {
      setTestResult("Error de red");
    } finally {
      setTesting(false);
    }
  };

  if (status === "unsupported")
    return (
      <p className="text-caption text-text-tertiary">
        Este navegador no soporta notificaciones push.
      </p>
    );

  if (status === "denied")
    return (
      <p className="text-caption" style={{ color: "var(--state-warning)" }}>
        ⚠ Permiso de notificaciones bloqueado en este navegador. Habilítalo en la
        configuración del sitio.
      </p>
    );

  if (status === "subscribed")
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <button
            className="btn-secondary"
            onClick={async () => {
              setStatus("loading");
              await unsubscribeFromPush();
              setStatus("idle");
            }}
          >
            <BellOff size={16} strokeWidth={1.75} />
            <span>Desactivar push</span>
          </button>
          <button
            className="btn-secondary"
            disabled={testing}
            onClick={enviarPrueba}
          >
            <Send size={16} strokeWidth={1.75} />
            <span>{testing ? "Enviando…" : "Enviar push de prueba"}</span>
          </button>
        </div>
        {testResult && (
          <p
            className="text-caption"
            style={{
              color: testResult.startsWith("✓")
                ? "var(--state-success)"
                : "var(--state-error)",
            }}
          >
            {testResult}
          </p>
        )}
        <p className="text-caption text-text-tertiary">
          Push activado en este dispositivo. Si no te llega la prueba, revisa que el navegador
          no esté en modo silencio y que las notificaciones del sistema estén activas.
        </p>
      </div>
    );

  return (
    <button
      className="btn-primary"
      disabled={status === "loading"}
      onClick={async () => {
        setStatus("loading");
        const r = await subscribeToPush("johana");
        setStatus(r.ok ? "subscribed" : r.reason === "denied" ? "denied" : "idle");
        if (!r.ok && r.reason !== "denied") {
          alert(
            r.reason === "no-vapid"
              ? "Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en Vercel."
              : r.reason === "unsupported"
              ? "Navegador no soportado."
              : "No se pudo activar push."
          );
        }
      }}
    >
      <Bell size={16} strokeWidth={1.75} />
      <span>{status === "loading" ? "Activando…" : "Activar push"}</span>
    </button>
  );
}
