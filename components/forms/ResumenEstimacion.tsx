"use client";

type Tarea = {
  nombre: string;
  descripcion: string;
  hrs_min: number;
  hrs_max: number;
};

type Props = {
  programador: string;
  proyecto?: string;
  nombreSolicitud: string;
  notas?: string;
  tareas: Tarea[];
  bufferPct: number;
  totales: { totalMin: number; totalEsperado: number; totalMax: number };
  totalesConBuffer: { totalMin: number; totalEsperado: number; totalMax: number };
};

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-caption text-text-tertiary">{label}</div>
      <div
        className="num-tabular mt-1"
        style={{ fontSize: 20, fontWeight: emphasis ? 700 : 600 }}
      >
        {value}
      </div>
    </div>
  );
}

export default function ResumenEstimacion({
  programador,
  proyecto,
  nombreSolicitud,
  notas,
  tareas,
  bufferPct,
  totales,
  totalesConBuffer,
}: Props) {
  return (
    <div className="space-y-5">
      <p className="text-body text-text-secondary">
        Revisa que todo esté correcto. Una vez enviada no podrás editarla.
      </p>

      {/* Datos generales */}
      <section
        className="rounded-[10px] p-4 space-y-3"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div>
          <div className="text-overline text-text-tertiary mb-1">Solicitud</div>
          <div className="text-body-medium">{nombreSolicitud || "—"}</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-overline text-text-tertiary mb-1">Estimador</div>
            <div className="text-body">{programador}</div>
          </div>
          <div>
            <div className="text-overline text-text-tertiary mb-1">Proyecto</div>
            <div className="text-body">{proyecto || "—"}</div>
          </div>
        </div>
      </section>

      {/* Tareas */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-heading-2">Tareas ({tareas.length})</h3>
        </div>
        <ul
          className="rounded-[10px] divide-y"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {tareas.map((t, i) => (
            <li
              key={i}
              className="p-3 grid grid-cols-[24px_1fr_auto] gap-3 items-start"
              style={{ borderColor: "var(--border-subtle)" } as React.CSSProperties}
            >
              <span className="text-caption text-text-tertiary num-tabular pt-0.5">
                {i + 1}.
              </span>
              <div className="min-w-0">
                <div className="text-body-medium">
                  {t.nombre || <span className="text-text-tertiary">(sin nombre)</span>}
                </div>
                {t.descripcion && (
                  <p className="text-caption text-text-secondary whitespace-pre-wrap mt-1">
                    {t.descripcion}
                  </p>
                )}
              </div>
              <span className="text-caption num-tabular text-text-secondary whitespace-nowrap pt-0.5">
                {t.hrs_min}–{t.hrs_max} h
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Totales */}
      <section className="space-y-3">
        <div
          className="rounded-[10px] p-4"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="text-overline text-text-tertiary mb-3">Horas originales</div>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Mínimo" value={`${totales.totalMin}h`} />
            <Stat label="PERT esperado" value={`${totales.totalEsperado}h`} />
            <Stat label="Máximo" value={`${totales.totalMax}h`} />
          </div>
        </div>

        {bufferPct > 0 && (
          <div
            className="rounded-[10px] p-4"
            style={{
              background: "var(--bg-overlay)",
              border: "1px solid var(--border-default)",
            }}
          >
            <div className="text-overline text-text-tertiary mb-3">
              Con buffer (+{bufferPct}%)
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Mínimo" value={`${totalesConBuffer.totalMin}h`} emphasis />
              <Stat
                label="PERT esperado"
                value={`${totalesConBuffer.totalEsperado}h`}
                emphasis
              />
              <Stat label="Máximo" value={`${totalesConBuffer.totalMax}h`} emphasis />
            </div>
          </div>
        )}
      </section>

      {notas && (
        <section
          className="rounded-[10px] p-4"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="text-overline text-text-tertiary mb-2">Notas</div>
          <p className="text-body whitespace-pre-wrap">{notas}</p>
        </section>
      )}
    </div>
  );
}
