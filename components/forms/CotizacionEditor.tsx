"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  RefreshCcw,
  Archive,
  Ticket,
  FileStack,
  Layers,
  Trash2,
  Check,
  CheckCircle2,
} from "lucide-react";
import ConfirmAccionModal from "@/components/ui/ConfirmAccionModal";
import Modal from "@/components/ui/Modal";
import EnviarPdfModal from "@/components/forms/EnviarPdfModal";
import {
  ORDEN_FLUJO_COTIZACION,
  labelEstado,
  badgeEstado,
} from "@/lib/estados";

// ─── Acciones rápidas para vista de lectura ─────────────────────────────

type ActionsProps = {
  cotizacionId: string;
  estado: string;
  // Para el preview de EnviarPdfModal (horas totales × costo interno).
  horasEnvio?: number;
  precioHora?: number;
};

export function CotizacionAcciones({
  cotizacionId,
  estado,
  horasEnvio = 0,
  precioHora = 0,
}: ActionsProps) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "archivar" | "eliminar">(null);
  const [generarTicketsAbierto, setGenerarTicketsAbierto] = useState(false);
  const [notificarUpdateAbierto, setNotificarUpdateAbierto] = useState(false);
  const [notaCambios, setNotaCambios] = useState("");
  const [cambioEstadoAbierto, setCambioEstadoAbierto] = useState(false);
  const [nuevoEstado, setNuevoEstado] = useState<string>("");
  const [comentarioEstado, setComentarioEstado] = useState("");
  const [enviarPdfAbierto, setEnviarPdfAbierto] = useState(false);

  const archivar = async () => {
    const res = await fetch(`/api/cotizaciones/${cotizacionId}/cambiar-estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "archivada" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "No se pudo archivar");
    setModal(null);
    router.refresh();
  };

  const eliminar = async () => {
    const res = await fetch(`/api/cotizaciones/${cotizacionId}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "No se pudo eliminar");
    setModal(null);
    router.replace("/panel/cotizaciones");
  };

  const cambiarEstado = async (
    nuevo: string,
    extra: { aprobadoPor?: string; comentario?: string } = {}
  ) => {
    setWorking(nuevo);
    setMsg(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/cambiar-estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: nuevo,
          aprobado_por: extra.aprobadoPor,
          comentario: extra.comentario,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo cambiar el estado");
        return;
      }
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(null);
    }
  };

  const reenviarSlack = async (opts?: {
    comoActualizacion?: boolean;
    notaCambios?: string;
  }) => {
    setWorking(opts?.comoActualizacion ? "notify-update" : "resend-slack");
    setMsg(null);
    setSuccess(null);
    setWarning(null);
    try {
      const res = await fetch(
        `/api/cotizaciones/${cotizacionId}/reenviar-slack`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            como_actualizacion: !!opts?.comoActualizacion,
            nota_cambios: opts?.notaCambios ?? null,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "No se pudo reenviar");
        return;
      }
      setSuccess(
        opts?.comoActualizacion
          ? "✓ Notificación de actualización enviada al jefe"
          : "✓ Mensaje reenviado al canal admin"
      );
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } catch {
      setMsg("Error de red");
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="card space-y-3">
      <h2 className="text-heading-2">Acciones</h2>
      <div className="flex flex-wrap gap-2.5">
        <button
          disabled={working !== null}
          onClick={() => {
            setNuevoEstado("");
            setComentarioEstado("");
            setCambioEstadoAbierto(true);
          }}
          className={`estado-trigger ${badgeEstado(estado)}`}
          title="Mover esta cotización a cualquier otro estado del flujo"
        >
          <span className="estado-trigger-dot" />
          <span>{labelEstado(estado)}</span>
          <ChevronDown size={14} strokeWidth={2.25} />
        </button>

        <button
          disabled={working !== null}
          onClick={() => reenviarSlack()}
          className="btn-secondary"
        >
          <RefreshCcw size={16} strokeWidth={1.75} />
          <span>{working === "resend-slack" ? "Reenviando…" : "Reenviar Slack"}</span>
        </button>

        <button
          disabled={working !== null}
          onClick={() => {
            setNotaCambios("");
            setNotificarUpdateAbierto(true);
          }}
          className="btn-secondary"
          title="Avisa al jefe que la cotización tuvo cambios y debe revisarla otra vez"
        >
          <RefreshCcw size={16} strokeWidth={1.75} />
          <span>
            {working === "notify-update"
              ? "Enviando…"
              : "Notificar actualización al jefe"}
          </span>
        </button>

        {(estado === "enviada" ||
          estado === "aprobada" ||
          estado === "en_desarrollo" ||
          estado === "en_espera_de_cobro" ||
          estado === "pendiente_por_cobrar" ||
          estado === "cobrada") && (
          <button
            disabled={working !== null}
            onClick={() => setGenerarTicketsAbierto(true)}
            className="btn-secondary"
          >
            <Ticket size={16} strokeWidth={1.75} />
            <span>Generar tickets</span>
          </button>
        )}

        {estado !== "archivada" && (
          <button
            disabled={working !== null}
            onClick={() => setModal("archivar")}
            className="btn-secondary"
          >
            <Archive size={16} strokeWidth={1.75} />
            <span>Archivar</span>
          </button>
        )}

        <button
          disabled={working !== null}
          onClick={() => setModal("eliminar")}
          className="btn-secondary"
          style={{ color: "var(--state-error)" }}
        >
          <Trash2 size={16} strokeWidth={1.75} />
          <span>Eliminar permanente</span>
        </button>
      </div>
      {success && (
        <p className="text-caption" style={{ color: "var(--state-success)" }}>
          {success}
        </p>
      )}
      {msg && (
        <p className="text-caption" style={{ color: "var(--state-error)" }}>
          {msg}
        </p>
      )}
      {warning && (
        <p className="text-caption" style={{ color: "var(--state-warning)" }}>
          ⚠️ {warning}
        </p>
      )}

      {/* Modal cambio de estado libre con confirmación */}
      <Modal
        open={cambioEstadoAbierto}
        onClose={() => !working && setCambioEstadoAbierto(false)}
        title="Cambiar estado de la cotización"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCambioEstadoAbierto(false)}
              disabled={!!working}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!nuevoEstado || nuevoEstado === estado || !!working}
              onClick={async () => {
                // "Enviada" exige subir el PDF que se mandó al cliente —
                // en vez de llamar a cambiar-estado, abrimos ese flujo.
                if (nuevoEstado === "enviada") {
                  setCambioEstadoAbierto(false);
                  setEnviarPdfAbierto(true);
                  return;
                }
                await cambiarEstado(nuevoEstado, {
                  comentario: comentarioEstado.trim() || undefined,
                });
                setCambioEstadoAbierto(false);
              }}
              className="btn-primary"
            >
              <CheckCircle2 size={14} strokeWidth={1.75} />
              <span>
                {working
                  ? "Aplicando…"
                  : nuevoEstado === "enviada"
                  ? "Continuar — subir PDF"
                  : `Cambiar a "${labelEstado(nuevoEstado || estado)}"`}
              </span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="text-overline text-text-tertiary mb-1">
              Estado actual
            </div>
            <span className={`badge-lg ${badgeEstado(estado)}`}>
              <span className="badge-dot" />
              {labelEstado(estado)}
            </span>
          </div>

          <div>
            <label className="field-label">Nuevo estado *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {ORDEN_FLUJO_COTIZACION.map((e) => {
                const esActual = e === estado;
                const seleccionado = nuevoEstado === e;
                return (
                  <button
                    key={e}
                    type="button"
                    disabled={esActual}
                    onClick={() => setNuevoEstado(e)}
                    className={`estado-chip ${badgeEstado(e)} ${
                      seleccionado ? "is-selected" : ""
                    }`}
                    title={esActual ? "Estado actual" : `Cambiar a "${labelEstado(e)}"`}
                  >
                    {seleccionado && <Check size={13} strokeWidth={2.5} />}
                    <span>{labelEstado(e)}</span>
                  </button>
                );
              })}
            </div>
            <span className="field-hint">
              Puedes moverla a cualquier estado del flujo.{" "}
              {nuevoEstado === "enviada" &&
                "Para \"Enviada\" te vamos a pedir el PDF que se le mandó al cliente."}
            </span>
          </div>

          <div>
            <label className="field-label">
              Comentario (opcional, queda en el historial)
            </label>
            <input
              className="input"
              value={comentarioEstado}
              onChange={(e) => setComentarioEstado(e.target.value)}
              placeholder="Ej: Cliente confirmó por correo el 27 may"
            />
          </div>

          {nuevoEstado && nuevoEstado !== estado && (
            <div
              className="flex items-center flex-wrap gap-2 rounded-[10px] p-3 text-caption"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
              }}
            >
              <span>Vas a cambiar de</span>
              <span className={`badge ${badgeEstado(estado)}`}>
                {labelEstado(estado)}
              </span>
              <span>a</span>
              <span className={`badge ${badgeEstado(nuevoEstado)}`}>
                {labelEstado(nuevoEstado)}
              </span>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={notificarUpdateAbierto}
        onClose={() => working !== "notify-update" && setNotificarUpdateAbierto(false)}
        title="Notificar actualización al jefe"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNotificarUpdateAbierto(false)}
              disabled={working === "notify-update"}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await reenviarSlack({
                  comoActualizacion: true,
                  notaCambios: notaCambios.trim() || undefined,
                });
                setNotificarUpdateAbierto(false);
              }}
              disabled={working === "notify-update"}
              className="btn-primary"
            >
              <RefreshCcw size={14} strokeWidth={1.75} />
              <span>
                {working === "notify-update"
                  ? "Enviando…"
                  : "Enviar al jefe"}
              </span>
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-body text-text-secondary">
            Se manda un nuevo mensaje al canal del jefe con un banner que dice{" "}
            <strong>🔄 Cotización actualizada</strong> arriba, junto con los datos
            vigentes (horas, tareas, descripción). La cotización vuelve al estado{" "}
            <strong>Esperando jefe</strong>.
          </p>
          <div>
            <label className="field-label">
              Nota de los cambios (opcional)
            </label>
            <textarea
              className="textarea min-h-[100px]"
              rows={4}
              value={notaCambios}
              onChange={(e) => setNotaCambios(e.target.value)}
              placeholder="Ej: ajustamos horas a 60h porque el cliente pidió incluir el módulo de reportes."
              maxLength={240}
            />
            <span className="field-hint">
              Si la dejas vacía, se manda un mensaje genérico. Si pones algo,
              aparece resaltado en el banner para que el jefe sepa qué cambió.
            </span>
          </div>
        </div>
      </Modal>

      <Modal
        open={generarTicketsAbierto}
        onClose={() => setGenerarTicketsAbierto(false)}
        title="Generar tickets"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-body text-text-secondary">
            Elige cómo quieres trasladar esta cotización a tickets de desarrollo.
          </p>
          <a
            href={`/panel/tickets/nuevo?desde_cotizacion=${cotizacionId}`}
            className="block rounded-[12px] p-4 transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
            }}
            onClick={() => setGenerarTicketsAbierto(false)}
          >
            <div className="flex items-start gap-3">
              <FileStack
                size={22}
                strokeWidth={1.75}
                className="text-text-secondary shrink-0 mt-1"
              />
              <div>
                <div className="text-body-medium">Un ticket completo</div>
                <div className="text-caption text-text-secondary mt-1">
                  Crea un solo ticket en ClickUp que abarca toda la cotización,
                  con todas las tareas listadas en la descripción y las horas
                  totales. Ideal cuando un solo programador hace todo.
                </div>
              </div>
            </div>
          </a>
          <a
            href={`/panel/tickets/desde-cotizacion/${cotizacionId}`}
            className="block rounded-[12px] p-4 transition-colors"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
            }}
            onClick={() => setGenerarTicketsAbierto(false)}
          >
            <div className="flex items-start gap-3">
              <Layers
                size={22}
                strokeWidth={1.75}
                className="text-text-secondary shrink-0 mt-1"
              />
              <div>
                <div className="text-body-medium">Un ticket por cada tarea</div>
                <div className="text-caption text-text-secondary mt-1">
                  Un ticket independiente en ClickUp por cada tarea de la
                  cotización (con sus horas distribuidas). Útil cuando puedes
                  asignar a programadores distintos o trackear avance por
                  tarea.
                </div>
              </div>
            </div>
          </a>
        </div>
      </Modal>

      <ConfirmAccionModal
        open={modal === "archivar"}
        onClose={() => setModal(null)}
        onConfirm={archivar}
        titulo="Archivar cotización"
        descripcion={
          <>
            La cotización dejará de aparecer en el listado activo. Podrás
            restaurarla cambiándole el estado más adelante.
          </>
        }
        palabraClave="archivar"
        textoBoton="Sí, archivar"
      />

      <ConfirmAccionModal
        open={modal === "eliminar"}
        onClose={() => setModal(null)}
        onConfirm={eliminar}
        titulo="Eliminar cotización permanentemente"
        descripcion={
          <>
            Esta acción es <strong>irreversible</strong>. Se borrará la cotización
            de la base de datos junto con sus tareas y el historial. La estimación
            origen quedará libre para reprocesarse.
          </>
        }
        palabraClave="eliminar"
        textoBoton="Eliminar definitivamente"
        peligroso
      />

      <EnviarPdfModal
        cotizacionId={cotizacionId}
        horasEnvio={horasEnvio}
        precioHora={precioHora}
        open={enviarPdfAbierto}
        onClose={() => setEnviarPdfAbierto(false)}
        onEnviado={() => {
          setEnviarPdfAbierto(false);
          router.refresh();
        }}
      />
    </section>
  );
}

// ─── Log timeline ──────────────────────────────────────────────────────

type LogAccion = {
  id: string;
  tipo_accion: string;
  metadata: Record<string, any> | null;
  created_at: string;
};

const LABEL_ACCION: Record<string, string> = {
  creada_desde_estimacion: "Cotización creada desde estimación",
  creada_desde_formulario: "Estimación recibida del formulario",
  creada_manual: "Estimación creada manualmente",
  editada: "Cotización editada",
  estado_por_estimar: "📝 Por estimar",
  estado_pendiente_revision_interna: "📋 Revisión interna",
  estado_esperando_aprobacion: "⏳ Esperando aprobación",
  estado_cambios_solicitados: "✏️ Cambios solicitados",
  estado_enviada: "📤 Enviada al cliente",
  estado_aprobada: "✅ Aprobada por cliente",
  estado_en_desarrollo: "🚧 En desarrollo",
  estado_en_espera_de_cobro: "🕒 En espera de cobro",
  estado_pendiente_por_cobrar: "💰 Pendiente por cobrar",
  estado_rechazada: "❌ Rechazada",
  estado_cobrada: "🏁 Cobrada",
  estado_archivada: "📦 Archivada",
  jefe_aprobacion_recibida: "✅ Visto bueno de Iván recibido",
  slack_reenviado: "↻ Mensaje reenviado en Slack",
  slack_notificada_actualizacion: "🔄 Actualización notificada al jefe",
};

function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", {
      timeZone: "America/Tijuana",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function CotizacionLog({ acciones }: { acciones: LogAccion[] }) {
  if (acciones.length === 0) return null;
  return (
    <section className="card space-y-3">
      <h2 className="text-heading-2">Historial</h2>
      <ol className="relative pl-4 space-y-3">
        {acciones.map((a, i) => {
          const label = LABEL_ACCION[a.tipo_accion] ?? a.tipo_accion;
          const isLast = i === acciones.length - 1;
          return (
            <li key={a.id} className="relative pl-4">
              <span
                className="absolute left-0 top-2 w-2 h-2 rounded-full"
                style={{
                  background: "var(--text-primary)",
                  boxShadow: "0 0 0 3px var(--bg-elevated)",
                }}
              />
              {!isLast && (
                <span
                  className="absolute left-[3px] top-3 bottom-[-12px] w-px"
                  style={{ background: "var(--border-subtle)" }}
                />
              )}
              <div className="text-body-medium">{label}</div>
              <div className="text-caption text-text-tertiary num-tabular">
                {fmtFecha(a.created_at)}
              </div>
              {a.metadata?.comentario && (
                <p className="text-caption text-text-secondary mt-1">
                  💬 {a.metadata.comentario}
                </p>
              )}
              {a.metadata?.cambios && (
                <div className="text-caption text-text-secondary mt-1">
                  {Object.keys(a.metadata.cambios).join(", ")}
                </div>
              )}
              {a.metadata?.aprobado_por && (
                <p className="text-caption text-text-tertiary mt-1">
                  por {a.metadata.aprobado_por}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
