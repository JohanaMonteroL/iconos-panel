import Link from "next/link";
import { Users, KeyRound, ChevronRight } from "lucide-react";

const sections = [
  {
    href: "/panel/settings/programadores",
    icon: Users,
    title: "Programadores",
    desc: "Agrega, edita o desactiva programadores y sus precios por hora.",
  },
  {
    href: "/panel/settings/password",
    icon: KeyRound,
    title: "Contraseña",
    desc: "Cambia la contraseña de acceso al panel.",
  },
];

export default function SettingsHome() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-display">Settings</h1>
        <p className="text-body text-text-secondary">
          Configuración del panel y los datos del sistema.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(({ href, icon: Icon, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="card hover:border-border-strong transition-colors block"
          >
            <div className="flex items-start gap-3">
              <Icon size={20} strokeWidth={1.5} className="text-text-secondary mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-heading-2">{title}</h2>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-text-tertiary" />
                </div>
                <p className="text-caption text-text-secondary mt-1">{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
