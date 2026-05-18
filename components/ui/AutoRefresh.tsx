"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/**
 * Re-renderiza la página padre (server component) cada `intervalSeconds`.
 * - Usa una ref para mantener una `refresh` estable.
 * - Pausa cuando la pestaña está oculta y vuelve a arrancar al regresar.
 * - También se dispara al ganar foco la ventana (recovery anti-stuck).
 */
type Props = {
  intervalSeconds?: number;
  showButton?: boolean;
};

export default function AutoRefresh({
  intervalSeconds = 10,
  showButton = true,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Mantener una referencia estable al router para usarla dentro del interval
  const routerRef = useRef(router);
  routerRef.current = router;

  const doRefresh = useCallback((manual = false) => {
    if (manual) setRefreshing(true);
    startTransition(() => {
      routerRef.current.refresh();
      setLastSync(new Date());
      if (manual) setTimeout(() => setRefreshing(false), 400);
    });
  }, []);

  // Timer principal + listeners (montaje único)
  useEffect(() => {
    let tick: number | null = null;
    const ms = Math.max(2000, intervalSeconds * 1000);

    const start = () => {
      if (tick != null) return;
      tick = window.setInterval(() => {
        if (!document.hidden) doRefresh(false);
      }, ms);
    };
    const stop = () => {
      if (tick != null) {
        clearInterval(tick);
        tick = null;
      }
    };

    start();

    const onVis = () => {
      if (document.hidden) {
        stop();
      } else {
        doRefresh(false);
        start();
      }
    };
    const onFocus = () => {
      // Defensa anti-stuck: cada vez que la ventana gana foco, refresh + restart
      doRefresh(false);
      stop();
      start();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalSeconds, doRefresh]);

  if (!showButton) return null;

  const fmtHora = (d: Date) =>
    d.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="flex items-center gap-3">
      {lastSync && (
        <span className="text-caption text-text-tertiary num-tabular">
          Última sync: {fmtHora(lastSync)}
        </span>
      )}
      <button
        type="button"
        onClick={() => doRefresh(true)}
        className="btn-secondary btn-sm"
        aria-label="Actualizar"
        title="Actualizar ahora"
      >
        <RefreshCw
          size={14}
          strokeWidth={1.75}
          className={refreshing ? "animate-spin" : ""}
        />
        <span>Actualizar</span>
      </button>
    </div>
  );
}
