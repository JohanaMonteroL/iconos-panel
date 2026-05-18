"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { registerServiceWorker, subscribeToPush, unsubscribeFromPush } from "@/lib/push/client";

export default function EnablePushButton() {
  const [status, setStatus] = useState<"idle" | "subscribed" | "unsupported" | "denied" | "loading">(
    "idle"
  );

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

  if (status === "unsupported")
    return (
      <p className="text-caption text-text-tertiary">
        Este navegador no soporta notificaciones push.
      </p>
    );

  if (status === "subscribed")
    return (
      <button
        className="btn-secondary"
        onClick={async () => {
          setStatus("loading");
          await unsubscribeFromPush();
          setStatus("idle");
        }}
      >
        <BellOff size={16} strokeWidth={1.5} />
        <span>Desactivar push</span>
      </button>
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
              ? "Falta configurar la VAPID public key."
              : r.reason === "unsupported"
              ? "Navegador no soportado."
              : "No se pudo activar push."
          );
        }
      }}
    >
      <Bell size={16} strokeWidth={1.5} />
      <span>{status === "loading" ? "Activando…" : "Activar push"}</span>
    </button>
  );
}
