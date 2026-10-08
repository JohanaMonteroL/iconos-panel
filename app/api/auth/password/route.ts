import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminPassword,
  getCurrentAdmin,
  saveAdminPassword,
} from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { findAdministradorByCorreo, hashPassword, verifyPassword } from "@/lib/admin/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const actual = String(body?.actual ?? "");
  const nueva = String(body?.nueva ?? "");
  const confirma = String(body?.confirma ?? "");

  if (!actual || !nueva || !confirma) {
    return NextResponse.json(
      { error: "Llena los 3 campos" },
      { status: 422 }
    );
  }
  if (nueva.length < 8) {
    return NextResponse.json(
      { error: "La nueva debe tener al menos 8 caracteres" },
      { status: 422 }
    );
  }
  if (nueva !== confirma) {
    return NextResponse.json(
      { error: "La confirmación no coincide" },
      { status: 422 }
    );
  }

  // Pequeño delay anti fuerza bruta
  await new Promise((r) => setTimeout(r, 250));

  // Login legacy de Johana → sigue guardando en `settings`, sin tocar nada.
  if (admin.id === null) {
    const ok = await checkAdminPassword(actual);
    if (!ok) {
      return NextResponse.json(
        { error: "Contraseña actual incorrecta" },
        { status: 401 }
      );
    }
    try {
      await saveAdminPassword(nueva);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "No se pudo guardar" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // Administrador adicional → guarda en su propia fila de `administradores`.
  if (!admin.correo) {
    return NextResponse.json({ error: "Cuenta sin correo" }, { status: 500 });
  }
  const fila = await findAdministradorByCorreo(admin.correo);
  if (!fila || !fila.activo || !fila.password_hash) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  const ok = await verifyPassword(actual, fila.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: "Contraseña actual incorrecta" },
      { status: 401 }
    );
  }
  const nuevoHash = await hashPassword(nueva);
  const supa = createSupabaseServiceClient();
  const { error } = await supa
    .from("administradores")
    .update({ password_hash: nuevoHash, must_change_password: false })
    .eq("id", admin.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
