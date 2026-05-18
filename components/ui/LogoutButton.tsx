"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="btn-icon btn-ghost"
        aria-label="Salir"
        title="Salir"
      >
        <LogOut size={16} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button onClick={onClick} className="nav-item w-full text-left">
      <LogOut size={16} strokeWidth={1.5} />
      <span>{loading ? "Saliendo…" : "Salir"}</span>
    </button>
  );
}
