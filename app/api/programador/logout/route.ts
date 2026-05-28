// POST /api/programador/logout — borra la cookie de sesión del programador.

import { NextResponse } from "next/server";
import { PROG_SESSION_COOKIE_NAME } from "@/lib/programador/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PROG_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
