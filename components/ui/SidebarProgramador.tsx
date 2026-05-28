"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Home,
  ClipboardList,
  Plus,
  LogOut,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const items = [
  { href: "/programador", label: "Inicio", icon: Home, exact: true },
  { href: "/programador/estimaciones", label: "Mis estimaciones", icon: ClipboardList },
  { href: "/programador/estimaciones/nueva", label: "Nueva estimación", icon: Plus },
];

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = exact
          ? pathname === href
          : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`nav-item ${active ? "nav-item-active" : ""}`}
          >
            <Icon size={16} strokeWidth={1.5} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AccountActions() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/programador/logout", { method: "POST" });
      router.push("/programador/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/programador/cambiar-password"
        className="nav-item"
        title="Cambiar contraseña"
      >
        <KeyRound size={16} strokeWidth={1.5} />
        <span>Cambiar contraseña</span>
      </Link>
      <button
        onClick={logout}
        disabled={loggingOut}
        className="nav-item text-left w-full"
        style={{ color: "var(--state-error)" }}
      >
        <LogOut size={16} strokeWidth={1.5} />
        <span>{loggingOut ? "Saliendo…" : "Cerrar sesión"}</span>
      </button>
    </div>
  );
}

export default function SidebarProgramador({
  nombre,
}: {
  nombre: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Topbar (mobile) */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center justify-between h-12 px-4 border-b"
        style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="btn-icon btn-ghost"
          aria-label="Abrir menú"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
        <Link href="/programador" className="text-body-medium font-semibold">
          ICONOS
        </Link>
        <ThemeToggle />
      </header>

      {/* Drawer top-down (mobile) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute left-0 right-0 bottom-0 max-h-[90vh] flex flex-col overflow-y-auto p-5 pb-8 gap-4 rounded-t-3xl shadow-2xl animate-[slideUp_180ms_ease-out]"
            style={{
              background: "var(--bg-elevated)",
              borderTop: "1px solid var(--border-subtle)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-heading-2 font-semibold">ICONOS</span>
              <button
                onClick={() => setOpen(false)}
                className="btn-icon btn-ghost"
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <div className="text-caption text-text-tertiary">
              Hola, <strong className="text-text-primary">{nombre}</strong>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <div
              className="pt-4 border-t"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <AccountActions />
            </div>
          </aside>
          <style jsx>{`
            @keyframes slideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Sidebar (desktop) */}
      <aside
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 w-60 p-4 border-r"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <div className="flex items-center justify-between mb-4 px-2">
          <Link href="/programador" className="text-heading-2 font-semibold">
            ICONOS
          </Link>
          <ThemeToggle />
        </div>
        <div className="px-2 mb-4 text-caption text-text-tertiary">
          Hola, <strong className="text-text-primary">{nombre}</strong>
        </div>
        <NavList pathname={pathname} />
        <div
          className="mt-auto pt-4 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <AccountActions />
        </div>
      </aside>
    </>
  );
}
