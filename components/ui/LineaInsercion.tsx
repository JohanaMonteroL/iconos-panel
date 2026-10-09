// Línea que marca dónde caerá la tarjeta al soltarla en un tablero kanban.
// Va posicionada en absoluto dentro de la tarjeta vecina (padre `relative`)
// para no mover el layout del carril mientras se arrastra: centrada en el
// hueco de 9px entre tarjetas, con un punto en cada extremo. Color sólido
// --accent, el mismo morado del indicador del menú (.nav-item-active).

export default function LineaInsercion({ posicion }: { posicion: "arriba" | "abajo" }) {
  const punto: React.CSSProperties = {
    position: "absolute",
    top: -3,
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "var(--accent)",
  };
  return (
    <div
      aria-hidden
      data-linea-insercion={posicion}
      className="linea-insercion-anim"
      style={{
        position: "absolute",
        left: -4,
        right: -4,
        [posicion === "arriba" ? "top" : "bottom"]: -8,
        height: 4,
        borderRadius: 2,
        background: "var(--accent)",
        pointerEvents: "none",
        zIndex: 2,
      }}
    >
      <span style={{ ...punto, left: -6 }} />
      <span style={{ ...punto, right: -6 }} />
    </div>
  );
}
