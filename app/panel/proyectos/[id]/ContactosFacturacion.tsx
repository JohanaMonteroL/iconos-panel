"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, X } from "lucide-react";

export type ContactoFacturacion = {
  id: string;
  correo: string;
  nombre: string | null;
};

export default function ContactosFacturacion({
  proyectoId,
  contactosIniciales,
}: {
  proyectoId: string;
  contactosIniciales: ContactoFacturacion[];
}) {
  const router = useRouter();
  const [contactos, setContactos] = useState(contactosIniciales);
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const agregar = async () => {
    const correoLimpio = correo.trim();
    if (!correoLimpio) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/contactos-facturacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correoLimpio, nombre: nombre.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo agregar el correo");
        return;
      }
      setContactos((prev) => [...prev, json.item]);
      setCorreo("");
      setNombre("");
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const quitar = async (id: string) => {
    setRemovingId(id);
    setError(null);
    const previos = contactos;
    setContactos((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/contactos-facturacion/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setContactos(previos);
        setError(json.error || "No se pudo quitar el correo");
        return;
      }
      router.refresh();
    } catch {
      setContactos(previos);
      setError("Error de red");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="card space-y-4">
      <div>
        <div className="text-heading-2">Contactos de facturación</div>
        <p className="text-caption text-text-secondary mt-1">
          Correos a los que se les manda la factura o documento de cobro. Puedes agregar varios.
        </p>
      </div>

      {contactos.length > 0 && (
        <ul className="space-y-2">
          {contactos.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-[9px]"
              style={{ border: "1px solid var(--border-default)", padding: "9px 11px" }}
            >
              <Mail size={14} strokeWidth={1.75} className="text-text-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                {c.nombre && <div className="text-body break-words">{c.nombre}</div>}
                <div className={c.nombre ? "text-caption text-text-tertiary break-words" : "text-body break-words"}>
                  {c.correo}
                </div>
              </div>
              <button
                type="button"
                onClick={() => quitar(c.id)}
                disabled={removingId === c.id}
                className="btn-ghost btn-icon btn-sm"
                aria-label="Quitar correo"
                title="Quitar"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <input
          className="input flex-1"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre (opcional)"
          onKeyDown={(e) => {
            if (e.key === "Enter") agregar();
          }}
        />
        <input
          className="input flex-1"
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="correo@proyecto.com"
          onKeyDown={(e) => {
            if (e.key === "Enter") agregar();
          }}
        />
        <button
          type="button"
          onClick={agregar}
          disabled={!correo.trim() || saving}
          className="btn-secondary whitespace-nowrap"
        >
          <Plus size={16} strokeWidth={1.75} />
          <span>Agregar</span>
        </button>
      </div>

      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
