"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import ConfirmAccionModal from "@/components/ui/ConfirmAccionModal";

type Props = {
  estimacionId: string;
  estado: string;
};

type ModalOpen = null | "archivar" | "eliminar";

export default function EstimacionAcciones({ estimacionId, estado }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalOpen>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restaurar = async () => {
    setWorking("restaurar");
    setError(null);
    try {
      const res = await fetch(`/api/estimaciones/${estimacionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "recibida" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Error al restaurar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red");
    } finally {
      setWorking(null);
    }
  };

  const archivar = async (_: { checkboxMarcado: boolean }) => {
    const res = await fetch(`/api/estimaciones/${estimacionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "descartada" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo archivar");
    setModal(null);
    router.refresh();
  };

  const eliminar = async (_: { checkboxMarcado: boolean }) => {
    const res = await fetch(`/api/estimaciones/${estimacionId}`, {
      method: "DELETE",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "No se pudo eliminar");
    setModal(null);
    router.replace("/panel/estimaciones");
  };

  const archivada = estado === "descartada";

  return (
    <>
      <section className="card space-y-3">
        <h2 className="text-heading-2">Acciones</h2>
        <div className="flex flex-wrap gap-3">
          {!archivada && (
            <button
              disabled={working !== null}
              onClick={() => setModal("archivar")}
              className="btn-secondary"
            >
              <Archive size={16} strokeWidth={1.75} />
              <span>Archivar</span>
            </button>
          )}
          {archivada && (
            <button
              disabled={working !== null}
              onClick={restaurar}
              className="btn-secondary"
            >
              <ArchiveRestore size={16} strokeWidth={1.75} />
              <span>{working === "restaurar" ? "Restaurando…" : "Restaurar"}</span>
            </button>
          )}
          <button
            disabled={working !== null}
            onClick={() => setModal("eliminar")}
            className="btn-ghost"
            style={{ color: "var(--state-error)" }}
          >
            <Trash2 size={16} strokeWidth={1.75} />
            <span>Eliminar permanente</span>
          </button>
        </div>
        {error && (
          <p className="text-caption" style={{ color: "var(--state-error)" }}>
            {error}
          </p>
        )}
        {archivada && (
          <p className="text-caption text-text-tertiary">
            Esta estimación está archivada — no aparece en el listado por defecto.
          </p>
        )}
      </section>

      <ConfirmAccionModal
        open={modal === "archivar"}
        onClose={() => setModal(null)}
        onConfirm={archivar}
        titulo="Archivar estimación"
        descripcion={
          <>
            La estimación dejará de aparecer en el listado activo. Podrás verla
            en la pestaña <strong>Archivadas</strong> y restaurarla si la necesitas.
          </>
        }
        palabraClave="archivar"
        textoBoton="Sí, archivar"
      />

      <ConfirmAccionModal
        open={modal === "eliminar"}
        onClose={() => setModal(null)}
        onConfirm={eliminar}
        titulo="Eliminar estimación permanentemente"
        descripcion={
          <>
            Esta acción es <strong>irreversible</strong>. Se borrará el registro
            de la base de datos y no podrás recuperarlo. Si solo quieres ocultarla
            del listado, mejor archívala.
          </>
        }
        palabraClave="eliminar"
        textoBoton="Eliminar definitivamente"
        peligroso
      />
    </>
  );
}
