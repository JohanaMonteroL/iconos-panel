"use client";

// Drag & drop de los tableros kanban (Cotizaciones y Cobros):
//  - soltar en otro carril cambia el estado (POST {rutaApi}/cambiar-estado);
//  - si `reordenable`, la tarjeta queda en la posición donde se suelta, en
//    el mismo carril o en otro (POST {rutaApi}/reordenar con sus vecinas).
//    Ver lib/tableros/orden.ts.
//
// Actualiza la UI de inmediato y revierte si la API rechaza el cambio.

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; estado: string };
type Destino = { estado: string; index: number | null };

export function useTableroKanban<T extends Item>({
  columnas,
  itemsIniciales,
  rutaApi,
  reordenable,
  validarDestino,
}: {
  columnas: string[];
  itemsIniciales: T[];
  rutaApi: (id: string) => string;
  reordenable: boolean;
  // Devuelve un mensaje de error si no se puede soltar en ese estado.
  validarDestino?: (estado: string) => string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(itemsIniciales);
  const [dragId, setDragId] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Tras router.refresh() el server manda datos nuevos (p. ej. el pago
  // automático al pasar a Facturado): se adoptan si no hay un movimiento en
  // curso, para no pisar el estado optimista.
  useEffect(() => {
    if (pendingIds.size === 0) setItems(itemsIniciales);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsIniciales]);

  const porEstado = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const e of columnas) map.set(e, []);
    for (const it of items) {
      if (!map.has(it.estado)) map.set(it.estado, []);
      map.get(it.estado)!.push(it);
    }
    return map;
  }, [items, columnas]);

  // Posición de inserción según el puntero: cuántas tarjetas del carril
  // (sin contar la arrastrada) tienen su centro por encima del cursor.
  function indexEnCarril(carril: HTMLElement, clientY: number): number {
    let index = 0;
    carril.querySelectorAll<HTMLElement>("[data-tarjeta-id]").forEach((el) => {
      if (el.dataset.tarjetaId === dragId) return;
      const r = el.getBoundingClientRect();
      if (r.top + r.height / 2 < clientY) index++;
    });
    return index;
  }

  // null si salió bien; si no, el mensaje de error. Un `aviso` en una
  // respuesta OK (el cambio se guardó pero algo secundario falló) se
  // muestra igual en el banner.
  async function post(url: string, body: unknown): Promise<string | null> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data?.aviso) setError(data.aviso);
        return null;
      }
      return data?.error || "No se pudo guardar el cambio.";
    } catch {
      return "No se pudo guardar el cambio (sin conexión).";
    }
  }

  async function soltar(id: string, estado: string, index: number | null) {
    const actual = items.find((it) => it.id === id);
    if (!actual || pendingIds.has(id)) return;
    const cambiaEstado = actual.estado !== estado;

    // Vecinas en el carril destino, sin contar la propia tarjeta.
    const carril = (porEstado.get(estado) ?? []).filter((it) => it.id !== id);
    const reordena = reordenable && index !== null;
    const antes = reordena ? carril[index - 1] ?? null : null;
    const despues = reordena ? carril[index] ?? null : null;

    if (!cambiaEstado) {
      if (!reordena) return;
      const pos = (porEstado.get(estado) ?? []).findIndex((it) => it.id === id);
      if (pos === index) return; // soltó en el mismo lugar
    }
    if (cambiaEstado) {
      const msg = validarDestino?.(estado);
      if (msg) {
        setError(msg);
        return;
      }
    }

    setError(null);
    const previo = items;
    setItems((prev) => {
      const sin = prev.filter((it) => it.id !== id);
      const movido = { ...actual, estado };
      if (!reordena) return prev.map((it) => (it.id === id ? movido : it));
      let at = sin.length;
      if (despues) at = sin.findIndex((it) => it.id === despues.id);
      else if (antes) at = sin.findIndex((it) => it.id === antes.id) + 1;
      return [...sin.slice(0, at), movido, ...sin.slice(at)];
    });
    setPendingIds((prev) => new Set(prev).add(id));

    try {
      if (cambiaEstado) {
        const err = await post(`${rutaApi(id)}/cambiar-estado`, { estado });
        if (err) {
          setItems(previo);
          setError(err);
          return;
        }
      }
      if (reordena) {
        const err = await post(`${rutaApi(id)}/reordenar`, {
          antes_id: antes?.id ?? null,
          despues_id: despues?.id ?? null,
        });
        if (err) {
          // Si el estado sí se guardó, no se revierte: solo la posición
          // puede quedar distinta. El refresh trae el orden real.
          if (!cambiaEstado) setItems(previo);
          setError(err);
        }
      }
      router.refresh();
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function terminarArrastre() {
    setDragId(null);
    setDestino(null);
  }

  // Props para el contenedor de cada carril.
  function propsCarril(estado: string) {
    return {
      onDragOver: (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        const index = reordenable && dragId ? indexEnCarril(e.currentTarget, e.clientY) : null;
        if (destino?.estado !== estado || destino.index !== index) setDestino({ estado, index });
      },
      onDragLeave: (e: React.DragEvent<HTMLElement>) => {
        // Ignora el dragleave que dispara pasar sobre un hijo del carril.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDestino((cur) => (cur?.estado === estado ? null : cur));
      },
      onDrop: (e: React.DragEvent<HTMLElement>) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        const index = reordenable ? indexEnCarril(e.currentTarget, e.clientY) : null;
        terminarArrastre();
        if (id) soltar(id, estado, index);
      },
    };
  }

  // Props para cada tarjeta arrastrable.
  function propsTarjeta(id: string) {
    return {
      "data-tarjeta-id": id,
      dragging: dragId === id,
      pending: pendingIds.has(id),
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
        setDragId(id);
      },
      onDragEnd: terminarArrastre,
    };
  }

  // Dónde dibujar la línea de inserción en la tarjeta `id`: arriba de la
  // tarjeta que quedará debajo de la soltada, o abajo de la última si cae
  // al final del carril.
  function lineaEn(estado: string, id: string): "arriba" | "abajo" | null {
    if (!reordenable || !dragId || id === dragId) return null;
    if (destino?.estado !== estado || destino.index === null) return null;
    const carril = (porEstado.get(estado) ?? []).filter((it) => it.id !== dragId);
    if (carril[destino.index]?.id === id) return "arriba";
    if (destino.index === carril.length && carril.at(-1)?.id === id) return "abajo";
    return null;
  }

  // true si se está arrastrando sobre un carril sin otras tarjetas: el
  // placeholder "Sin ..." se resalta como zona donde caerá.
  function carrilVacioActivo(estado: string): boolean {
    if (!dragId || destino?.estado !== estado) return false;
    return (porEstado.get(estado) ?? []).every((it) => it.id === dragId);
  }

  return {
    items,
    porEstado,
    error,
    setError,
    carrilActivo: destino?.estado ?? null,
    propsCarril,
    propsTarjeta,
    lineaEn,
    carrilVacioActivo,
  };
}
