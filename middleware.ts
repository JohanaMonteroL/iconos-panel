import { NextRequest, NextResponse } from "next/server";

// HMAC-SHA256 con Web Crypto (Edge Runtime) — equivalente a lib/auth.ts pero
// portable a Edge donde no hay módulos de Node.
async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [label, expStr, sig] = parts;
  const payload = `${label}.${expStr}`;
  const expected = await hmacHex(secret, payload);
  if (!timingSafeEqualHex(sig, expected)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  return true;
}

export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Sin SESSION_SECRET no podemos validar — dejamos pasar a /login con mensaje en consola.
    console.warn("[middleware] SESSION_SECRET ausente");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const token = req.cookies.get("iconos_session")?.value;
  const ok = await verifyToken(token, secret);
  if (ok) return NextResponse.next();

  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/panel/:path*"],
};
