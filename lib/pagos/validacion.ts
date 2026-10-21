// Validación compartida (cliente y servidor) para Pagos.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function esCorreoValido(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}
