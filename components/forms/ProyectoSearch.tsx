"use client";

// Selector de proyecto — dropdown nativo que muestra TODOS los proyectos
// de una vez (antes era un buscador tipo "escribe para filtrar" que
// escondía la lista hasta que se tecleaba algo).

type Proyecto = { id: string; nombre: string; emoji?: string };

type Props = {
  proyectos: Proyecto[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

export default function ProyectoSearch({ proyectos, value, onChange, disabled }: Props) {
  const ordenados = [...proyectos].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );

  return (
    <select
      className="input"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{disabled ? "—" : "Selecciona un proyecto…"}</option>
      {ordenados.map((p) => (
        <option key={p.id} value={p.id}>
          {p.emoji ? `${p.emoji} ` : ""}
          {p.nombre}
        </option>
      ))}
    </select>
  );
}
