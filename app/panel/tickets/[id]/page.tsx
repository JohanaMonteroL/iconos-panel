import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import TicketEditor from "./TicketEditor";
import { formatFechaLarga } from "@/lib/dates";

export const dynamic = "force-dynamic";

async function getTicket(id: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const supa = createSupabaseServiceClient();
  const { data, error } = await supa
    .from("tickets_jira")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export default async function TicketDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const ticket = await getTicket(params.id);
  if (!ticket) notFound();

  return (
    <>
      <Link
        href="/panel/tickets"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver a tickets
      </Link>

      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="text-caption text-text-tertiary num-tabular">
              {ticket.jira_key}
            </div>
            <h1 className="text-display mt-1">{ticket.titulo}</h1>
          </div>
          <a
            href={ticket.jira_url}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary whitespace-nowrap"
          >
            <ExternalLink size={16} strokeWidth={1.75} />
            <span>Abrir en JIRA</span>
          </a>
        </div>
        <p className="text-caption text-text-secondary">
          {ticket.proyecto_jira_nombre} · creado {formatFechaLarga(ticket.created_at)}
        </p>
      </header>

      <TicketEditor ticket={ticket} />
    </>
  );
}
