"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  cotizacionId: string;
  initialValue: string;
};

/**
 * Título editable con clic — reemplaza al viejo card "Detalle > Editar >
 * Nombre". Clic en el texto lo vuelve un input; Enter o blur guarda (POST
 * /editar), Escape cancela sin guardar.
 */
export default function InlineHeading({ cotizacionId, initialValue }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const guardar = async () => {
    const nuevo = value.trim();
    if (!nuevo || nuevo === initialValue) {
      setValue(initialValue);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/editar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nuevo }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setValue(initialValue);
        setEditing(false);
      }
    } catch {
      setValue(initialValue);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="text-display"
        style={{
          background: "transparent",
          border: "none",
          borderBottom: "2px solid var(--action-primary-bg)",
          outline: "none",
          width: "100%",
          padding: 0,
        }}
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            guardar();
          }
          if (e.key === "Escape") {
            setValue(initialValue);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <h1
      className="text-display"
      onClick={() => setEditing(true)}
      title="Clic para editar el nombre"
      style={{ cursor: "text" }}
    >
      {initialValue}
    </h1>
  );
}
