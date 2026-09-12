"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  FileText,
  Menu,
  X,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  Ticket,
  Briefcase,
  DollarSign,
} from "lucide-react";
import LogoutButton from "./LogoutButton";
import BuscarGlobal from "./BuscarGlobal";

const items = [
  { href: "/panel", label: "Inicio", icon: Home },
  { href: "/panel/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/panel/cobros", label: "Cobros", icon: DollarSign },
  { href: "/panel/proyectos", label: "Proyectos", icon: Briefcase },
  { href: "/panel/tickets/nuevo", label: "Tickets", icon: Ticket },
  { href: "/panel/settings", label: "Settings", icon: Settings },
];

const SIDEBAR_W_KEY = "sidebar-collapsed";
const SIDEBAR_EXPANDED = "240px";
const SIDEBAR_COLLAPSED = "68px";

function NavList({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/panel" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`nav-item ${active ? "nav-item-active" : ""}`}
            style={collapsed ? { justifyContent: "center", paddingLeft: 0, paddingRight: 0 } : undefined}
          >
            <Icon size={17} strokeWidth={1.7} style={{ opacity: 0.9, flexShrink: 0 }} />
            {!collapsed && <span className="flex-1">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(SIDEBAR_W_KEY) === "1";
    } catch {}
    setCollapsed(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
    );
    try {
      localStorage.setItem(SIDEBAR_W_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed, hydrated]);

  const toggleCollapsed = () => setCollapsed((c) => !c);

  return (
    <>
      {/* Topbar (mobile) */}
      <header
        className="md:hidden sticky top-0 z-30 flex items-center gap-3 h-12 px-4 border-b"
        style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}
      >
        <button
          onClick={() => setOpen(true)}
          className="btn-icon btn-ghost"
          aria-label="Abrir menú"
        >
          <Menu size={18} strokeWidth={1.5} />
        </button>
        <Link href="/panel" className="text-body-medium font-semibold flex-1">
          ICONOS Panel
        </Link>
      </header>

      {/* Drawer top-down (mobile) — estilo "card" desde arriba */}
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
              <span className="text-heading-2 font-semibold">ICONOS Panel</span>
              <button
                onClick={() => setOpen(false)}
                className="btn-icon btn-ghost"
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            <BuscarGlobal />
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="pt-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <LogoutButton />
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
        className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 border-r overflow-x-hidden"
        style={{
          width: "var(--sidebar-w, 240px)",
          background: "var(--bg-surface)",
          borderColor: "var(--border-default)",
          transition: "width 260ms cubic-bezier(.4,0,.2,1)",
        }}
      >
        <div
          className="flex items-center gap-3 px-4 border-b"
          style={{
            minHeight: 68,
            borderColor: "var(--border-subtle)",
            justifyContent: collapsed ? "center" : undefined,
            paddingLeft: collapsed ? 0 : undefined,
            paddingRight: collapsed ? 0 : undefined,
          }}
        >
          <Link
            href="/panel"
            className="grid place-items-center flex-shrink-0"
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "var(--action-primary-bg)",
              color: "var(--action-primary-text)",
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: "-0.5px",
            }}
          >
            IC
          </Link>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-body-medium font-semibold truncate">ICONOS Panel</div>
              <div className="text-caption text-text-tertiary truncate">Finanzas &amp; Proyectos</div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="btn-icon btn-ghost flex-shrink-0"
              style={{ width: 26, height: 26 }}
              aria-label="Colapsar menú"
              title="Colapsar menú"
            >
              <PanelLeftClose size={14} strokeWidth={1.8} />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="flex justify-center py-3 border-b"
            style={{ color: "var(--text-tertiary)", borderColor: "var(--border-subtle)" }}
            aria-label="Expandir menú"
            title="Expandir menú"
          >
            <PanelLeftOpen size={17} strokeWidth={1.7} />
          </button>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <div className="p-3 pb-1.5">
            <BuscarGlobal collapsed={collapsed} />
          </div>

          {!collapsed && (
            <div className="px-4 pt-4 pb-1.5 text-overline text-text-tertiary">Operación</div>
          )}
          <div className="px-3 pb-3">
            <NavList pathname={pathname} collapsed={collapsed} />
          </div>
        </div>

        <div className="relative p-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setProfileOpen(false)}
                aria-hidden
              />
              <div
                className="absolute z-50 left-3 right-3 rounded-[11px] border overflow-hidden"
                style={{
                  bottom: "calc(100% + 6px)",
                  background: "var(--bg-elevated)",
                  borderColor: "var(--border-default)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <div className="px-3 py-2.5 border-b" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="text-caption font-medium truncate">Johana Montero</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Dirección</div>
                </div>
                <div className="p-1.5">
                  <LogoutButton />
                </div>
              </div>
            </>
          )}
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-3 w-full rounded-[9px]"
            style={{
              justifyContent: collapsed ? "center" : undefined,
              padding: collapsed ? 0 : "2px 4px",
            }}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
            title={collapsed ? "Johana Montero · Dirección" : undefined}
          >
            <div
              className="grid place-items-center flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#DBEAFE",
                color: "#1D4ED8",
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              JM
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-caption font-medium truncate">Johana Montero</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Dirección</div>
                </div>
                <ChevronsUpDown size={13} strokeWidth={1.8} style={{ color: "var(--text-disabled)", flexShrink: 0 }} />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
