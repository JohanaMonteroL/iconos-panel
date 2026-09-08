import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import WizardTicket from "./WizardTicket";

export const dynamic = "force-dynamic";

export default function NuevoTicketPage() {
  return (
    <>
      <Link
        href="/panel"
        className="inline-flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.5} />
        Volver al inicio
      </Link>

      <header className="space-y-2">
        <h1 className="text-display">Nuevo ticket</h1>
        <p className="text-body text-text-secondary">
          Se crea en ClickUp (Space Desarrollo). Al asignado le llega DM en Slack.
        </p>
      </header>

      <WizardTicket />
    </>
  );
}
