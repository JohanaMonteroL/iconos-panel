"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  FileText,
  Inbox,
  Menu,
  X,
  Settings,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";

const items = [
  { href: "/panel", label: "Inicio", icon: Home, badgeKey: null as null | "estimaciones" },
  { href: "/panel/cotizaciones", label: "Cotizaciones", icon: FileText, badgeKey: null },
  { href: "/panel/estimaciones", label: "Estimaciones", icon: Inbox, badgeKey: "estimaciones" as const },
  { href: "/panel/settings", label: "Settings", icon: Settings, badgeKey: null },
];

type Badges = { estimaciones: number };

function NavList({
  pathname,
  badges,
  onNavigate,
}: {
  pathname: string;
  badges: Badges;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, badgeKey }) => {
        const active = pathname === href || (href !== "/panel" && pathname.startsWith(href));
        const count = badgeKey ? badges[badgeKey] : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`nav-item ${active ? "nav-item-active" : ""}`}
          >
            <Icon size={16} strokeWidth={1.5} />
            <span className="flex-1">{label}</span>
            {count > 0 && (
              <span
                className="num-tabular"
                style={{
                  background: "#0066FF",
                  color: "white",
                  padding: "1px 7px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: "16px",
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ badges }: { badges: Badges }) {
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
        <Link href="/panel" className="text-body-medium font-semibold">
          ICONOS Panel
        </Link>
        <ThemeToggle />
      </header>

      {/* Drawer (mobile) */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 p-4 flex flex-col gap-4 border-r"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-subtle)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-heading-2">ICONOS Panel</span>
              <button
                onClick={() => setOpen(false)}
                className="btn-icon btn-ghost"
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <NavList pathname={pathname} badges={badges} onNavigate={() => setOpen(false)} />
            <div className="mt-auto pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <LogoutButton />
            </div>
          </aside>
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
        <div className="flex items-center justify-between mb-6 px-2">
          <Link href="/panel" className="text-heading-2 font-semibold">
            ICONOS
          </Link>
          <ThemeToggle />
        </div>
        <NavList pathname={pathname} badges={badges} />
        <div
          className="mt-auto pt-4 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
