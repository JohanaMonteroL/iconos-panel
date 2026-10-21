"use client";

// Recorrer un tablero horizontalmente manteniendo apretada la barra
// espaciadora y arrastrando con el mouse — como la herramienta de "mano" en
// Figma/Miro. Sin espacio presionado todo es 100% nativo (scrollbar, drag de
// tarjetas, clics) — probamos antes a interceptar el clic-y-arrastrar directo
// sobre el fondo del carril, pero chocaba con el scroll normal y casi no hay
// espacio vacío entre tarjetas para agarrarlo. Con espacio presionado sí se
// puede arrastrar desde cualquier parte, incluso sobre una tarjeta, sin
// abrirla ni disparar su drag-and-drop nativo.

import { useCallback, useEffect, useRef, useState } from "react";

export function useArrastrarParaDesplazar<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [espacioPresionado, setEspacioPresionado] = useState(false);
  const arrastrando = useRef(false);
  const inicioX = useRef(0);
  const scrollInicial = useRef(0);

  // Detecta mantener Espacio — pero no si se está escribiendo en un campo.
  useEffect(() => {
    const enUnCampo = (target: EventTarget | null) =>
      (target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable='true']");

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || enUnCampo(e.target)) return;
      // Hay que llamar preventDefault en CADA keydown mientras se mantiene
      // apretado (no solo el primero) — si no, el navegador hace scroll de
      // página hacia abajo en cada repetición del keydown nativo de Espacio.
      e.preventDefault();
      if (!e.repeat) setEspacioPresionado(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      setEspacioPresionado(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!arrastrando.current || !ref.current) return;
      e.preventDefault();
      const dx = e.pageX - inicioX.current;
      ref.current.scrollLeft = scrollInicial.current - dx;
    };
    const onUp = () => {
      if (!arrastrando.current) return;
      arrastrando.current = false;
      // Sin fijar un cursor fijo aquí: que lo decida la className según si
      // Espacio sigue presionado o no (si no, un "grab" fijo por estilo
      // inline se quedaría pegado aunque ya se soltó Espacio).
      if (ref.current) ref.current.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!espacioPresionado || e.button !== 0) return;
      // Evita el drag-and-drop nativo de la tarjeta y la selección de texto.
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      arrastrando.current = true;
      inicioX.current = e.pageX;
      scrollInicial.current = el.scrollLeft;
      el.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [espacioPresionado]
  );

  return {
    ref,
    onMouseDown,
    className: espacioPresionado ? "cursor-grab" : "",
  };
}
