// Lista de barras horizontales — top-N genérico (sin estado, se puede usar
// directo desde un Server Component). Usado en el dashboard de Inicio para
// los distintos "top" (proyectos con soporte, clientes, etc.).

export type FilaBarra = {
  key: string;
  label: string;
  sublabel?: string | null;
  valor: number;
  color?: string;
};

export default function BarrasHorizontales({
  filas,
  formatear,
}: {
  filas: FilaBarra[];
  formatear: (n: number) => string;
}) {
  if (filas.length === 0) {
    return <p className="text-caption text-text-tertiary">Sin datos todavía.</p>;
  }
  const max = Math.max(...filas.map((f) => f.valor), 1);

  return (
    <div className="space-y-3">
      {filas.map((f) => (
        <div key={f.key}>
          <div className="flex items-center justify-between gap-2 text-caption mb-1">
            <span className="min-w-0 flex-1">
              <span className="text-text-primary font-medium truncate">{f.label}</span>
              {f.sublabel && <span className="text-text-tertiary"> · {f.sublabel}</span>}
            </span>
            <span className="num-tabular text-text-secondary shrink-0">{formatear(f.valor)}</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 7, background: "var(--bg-overlay)" }}>
            <div
              style={{
                width: `${Math.max(3, (f.valor / max) * 100)}%`,
                height: "100%",
                background: f.color ?? "var(--accent)",
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
