import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminPassword,
  getSessionFromCookies,
  saveAdminPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!getSessionFromCookies().ok) {
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
