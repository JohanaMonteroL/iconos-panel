// Línea que marca dónde caerá la tarjeta al soltarla en un tablero kanban.
// Va posicionada en absoluto dentro de la tarjeta vecina (padre `relative`)
// para no mover el layout del carril mientras se arrastra: centrada en el
// hueco de 9px entre tarjetas, con un punto en cada extremo.

export default function LineaInsercion({ posicion }: { posicion: "arriba" | "abajo" }) {
  const punto: React.CSSProperties = {
    position: "absolute",
    top: -3,
    width: 10,
    height: 10,
    borderRadius: "50%",
    border: "2px solid var(--accent)",
    background: "var(--bg-surface)",
  };
  return (
    <div
      aria-hidden
      data-linea-insercion={posicion}
      style={{
        position: "absolute",
        left: -4,
        right: -4,
        [posicion === "arriba" ? "top" : "bottom"]: -8,
        height: 4,
        borderRadius: 2,
        background: "var(--accent)",
        boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent)",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <span style={{ ...punto, left: -6 }} />
      <span style={{ ...punto, right: -6 }} />
    </div>
  );
}
