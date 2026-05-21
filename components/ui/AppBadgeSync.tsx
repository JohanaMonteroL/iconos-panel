"use client";

import { useEffect } from "react";

// Sincroniza el contador con el badge nativo del PWA cuando el navegador lo
// soporta (Badging API). Funciona en Chrome/Edge instalado en desktop y en
// Android Chrome. En iOS no está soportado todavía.
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/setAppBadge

export default function AppBadgeSync({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;
    if (count > 0) {
      nav.setAppBadge(count).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
  }, [count]);

  return null;
}
