"use client";

import { usePathname } from "next/navigation";
import { Bell, Home, FileText, Settings, Briefcase, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const TITLES: { prefix: string; label: string; icon: LucideIcon }[] = [
  { prefix: "/panel/cotizaciones/nueva", label: "Cotización rápida", icon: FileText },
  { prefix: "/panel/cotizaciones", label: "Cotizaciones", icon: FileText },
  { prefix: "/panel/proyectos/nuevo", label: "Nuevo proyecto", icon: Briefcase },
  { prefix: "/panel/proyectos", label: "Proyectos", icon: Briefcase },
  { prefix: "/panel/tickets/nuevo", label: "Nuevo ticket", icon: FileText },
  { prefix: "/panel/tickets/desde-cotizacion", label: "Ticket desde cotización", icon: FileText },
  { prefix: "/panel/tickets", label: "Tickets", icon: FileText },
  { prefix: "/panel/contactos", label: "Contactos", icon: FileText },
  { prefix: "/panel/settings/password", label: "Cambiar contraseña", icon: Settings },
  { prefix: "/panel/settings/programadores", label: "Programadores", icon: Settings },
  { prefix: "/panel/settings", label: "Settings", icon: Settings },
  { prefix: "/panel", label: "Inicio", icon: Home },
];

function sectionFor(pathname: string) {
  return TITLES.find((t) => pathname === t.prefix || pathname.startsWith(t.prefix + "/")) ?? TITLES[TITLES.length - 1];
}

export default function PanelHeader({ badgeCount = 0 }: { badgeCount?: number }) {
  const pathname = usePathname();
  const { label: title, icon: ScreenIcon } = sectionFor(pathname);

  return (
    <header
      className="hidden md:flex sticky top-0 z-20 items-center gap-3 border-b"
      style={{
        background: "color-mix(in srgb, var(--bg-surface) 85%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderColor: "var(--border-default)",
        padding: "12px 26px",
      }}
    >
      <div
        className="grid place-items-center flex-shrink-0"
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          border: "1px solid var(--border-default)",
          background: "var(--bg-elevated)",
          color: "var(--text-secondary)",
        }}
      >
        <ScreenIcon size={14} strokeWidth={1.7} />
      </div>
      <div className="text-caption" style={{ color: "var(--text-tertiary)" }}>
        ICONOS Panel <span style={{ color: "var(--border-strong)" }}>/</span>{" "}
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{title}</span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div
          className="grid place-items-center relative"
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            border: "1px solid var(--border-default)",
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
          }}
          title={badgeCount > 0 ? `${badgeCount} estimaciones pendientes` : "Sin pendientes"}
        >
          <Bell size={15} strokeWidth={1.7} />
          {badgeCount > 0 && (
            <span
              className="num-tabular"
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--action-danger-bg)",
                color: "#fff",
                fontSize: 9,
                fontWeight: 600,
                display: "grid",
                placeItems: "center",
              }}
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
