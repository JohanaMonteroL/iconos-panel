"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import CostoHoraField, { type Moneda } from "../CostoHoraField";
import ColorPicker from "../ColorPicker";
import EmojiPicker from "../EmojiPicker";
import { COLOR_PROYECTO_DEFAULT } from "@/lib/proyectos/colores";
import { EMOJI_PROYECTO_DEFAULT } from "@/lib/proyectos/emojis";

type ContactoDraft = { key: string; correo: string; nombre: string };

export default function NuevoProyectoForm() {
  const router = useRouter();
  const genKey = useId();
  const [nombre, setNombre] = useState("");
  const [contacto, setContacto] = useState("");
  const [rfc, setRfc] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [costoHora, setCostoHora] = useState("");
  const [monedaHora, setMonedaHora] = useState<Moneda>("MXN");
  const [color, setColor] = useState(COLOR_PROYECTO_DEFAULT);
  const [emoji, setEmoji] = useState(EMOJI_PROYECTO_DEFAULT);
  const [notas, setNotas] = useState("");
  const [contactosFacturacion, setContactosFacturacion] = useState<ContactoDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const puedeGuardar = nombre.trim() && contacto.trim() && !saving;

  const agregarContacto = () => {
    setContactosFacturacion((prev) => [
      ...prev,
      { key: `${genKey}-${prev.length}-${Date.now()}`, correo: "", nombre: "" },
    ]);
  };

  const actualizarContacto = (key: string, campo: "correo" | "nombre", valor: string) => {
    setContactosFacturacion((prev) =>
      prev.map((c) => (c.key === key ? { ...c, [campo]: valor } : c))
    );
  };

  const quitarContacto = (key: string) => {
    setContactosFacturacion((prev) => prev.filter((c) => c.key !== key));
  };

  const guardar = async () => {
    if (!puedeGuardar) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          contacto_principal: contacto.trim(),
          rfc: rfc.trim() || null,
          correo: correo.trim() || null,
          telefono: telefono.trim() || null,
          precio_hora_venta: costoHora.trim() ? Number(costoHora) : 0,
          moneda_hora: monedaHora,
          color,
          emoji,
          notas: notas.trim() || null,
          contactos_facturacion: contactosFacturacion
            .filter((c) => c.correo.trim())
            .map((c) => ({ correo: c.correo.trim(), nombre: c.nombre.trim() || null })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se pudo crear el proyecto");
        return;
      }
      router.push(`/panel/proyectos/${json.id}`);
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-display">Nuevo proyecto</h1>
          <p className="text-body text-text-secondary">
            Solo el nombre y el contacto principal son obligatorios.
          </p>
        </div>
        <button type="button" onClick={guardar} disabled={!puedeGuardar} className="btn-primary">
          {saving ? "Guardando…" : "Crear proyecto"}
        </button>
      </header>

      {error && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="card space-y-4">
          <div>
            <label className="field-label">Nombre del proyecto *</label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Frutería Nenas"
              autoFocus
            />
          </div>
          <div>
            <label className="field-label">Contacto principal *</label>
            <input
              className="input"
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Ej. Regina Ávila"
            />
          </div>
          <div>
            <label className="field-label">RFC</label>
            <input
              className="input"
              value={rfc}
              onChange={(e) => setRfc(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="field-label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="field-label">Teléfono</label>
            <input
              className="input"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="field-label">Precio de Desarrollo (por hora)</label>
            <CostoHoraField
              valor={costoHora}
              moneda={monedaHora}
              onValorChange={setCostoHora}
              onMonedaChange={setMonedaHora}
            />
            <span className="field-hint">
              Se usa para calcular cotizaciones y estimaciones. El precio de Soporte se
              configura aparte, ya con el proyecto creado.
            </span>
          </div>
          <div>
            <label className="field-label">Color de etiqueta</label>
            <ColorPicker valor={color} onChange={setColor} />
          </div>
          <div>
            <label className="field-label">Emoji</label>
            <EmojiPicker valor={emoji} onChange={setEmoji} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3">
            <div>
              <div className="text-heading-2">Contactos de facturación</div>
              <p className="text-caption text-text-secondary mt-1">
                Correos a los que se les manda la factura o documento de cobro. Puedes agregar varios (opcional).
              </p>
            </div>

            {contactosFacturacion.map((c) => (
              <div key={c.key} className="space-y-2">
                <input
                  className="input"
                  value={c.nombre}
                  onChange={(e) => actualizarContacto(c.key, "nombre", e.target.value)}
                  placeholder="Nombre (opcional)"
                />
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    type="email"
                    value={c.correo}
                    onChange={(e) => actualizarContacto(c.key, "correo", e.target.value)}
                    placeholder="correo@proyecto.com"
                  />
                  <button
                    type="button"
                    onClick={() => quitarContacto(c.key)}
                    className="btn-ghost btn-icon btn-sm"
                    aria-label="Quitar"
                    title="Quitar"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}

            <button type="button" onClick={agregarContacto} className="btn-secondary btn-sm">
              <Plus size={14} strokeWidth={1.75} />
              <span>Agregar correo de facturación</span>
            </button>
          </div>

          <div className="card">
            <div className="text-heading-2 mb-2">Notas</div>
            <textarea
              className="textarea"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Opcional — condiciones especiales, horarios, preferencias, etc."
              rows={6}
            />
          </div>
        </div>
      </div>

      <p className="field-hint">
        Todo excepto nombre y contacto principal se puede completar después desde la ficha del proyecto.
      </p>
    </div>
  );
}
