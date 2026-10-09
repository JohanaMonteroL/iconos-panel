// Línea que marca dónde caerá la tarjeta al soltarla en un tablero kanban.
// Va posicionada en absoluto dentro de la tarjeta vecina (padre `relative`)
// para no mover el layout del carril mientras se arrastra.

export default function LineaInsercion({ posicion }: { posicion: "arriba" | "abajo" }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [posicion === "arriba" ? "top" : "bottom"]: -6,
        height: 3,
        borderRadius: 2,
        background: "var(--accent)",
        pointerEvents: "none",
      }}
    />
  );
}
