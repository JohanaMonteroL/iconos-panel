-- Checklist de "pasos para realizar el pago" dentro del detalle de cada
-- Pago — instrucciones propias de Johana (ej. "entrar a banca en línea",
-- "ir a pagos de servicios", "capturar referencia"), marcables una por una.
-- Vive como jsonb en la misma fila: es una lista corta y propia de cada
-- pago, no necesita tabla aparte.
--
-- Forma de cada elemento: { id: string, texto: string, hecho: boolean }.

alter table pagos_proveedores add column if not exists pasos jsonb not null default '[]'::jsonb;
