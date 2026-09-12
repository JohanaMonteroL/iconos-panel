// "Salud financiera" de un proyecto — métricas derivadas del historial de
// cobros (períodos + sus pagos) de ESE proyecto. Puramente informativo, no
// se usa para bloquear ni validar nada.

export type CobroSaludInput = {
  etiqueta: string;
  estado: string;
  monto: number;
  moneda: string;
  created_at: string;
  pagos: { monto: number; fecha: string }[];
};

export type SaludFinanciera = {
  duracionPromedioDias: number | null;
  clasificacionPago: "rapido" | "normal" | "lento" | "sin_datos";
  frecuenciaPorMes: number | null;
  mesesActivo: number;
  totalPeriodos: number;
  topFacturas: { etiqueta: string; monto: number; moneda: string }[];
  distribucionEstado: { estado: string; count: number; monto: number }[];
  // Cobrado por mes del año en curso (1=enero..12=diciembre) — para ver
  // qué tan constante es el cliente pagando mes a mes.
  porMes: { mes: number; monto: number }[];
  mesesConActividadEsteAnio: number;
  mesesTranscurridosEsteAnio: number;
};

export function calcularSaludFinanciera(cobros: CobroSaludInput[]): SaludFinanciera {
  const anioActual = new Date().getFullYear();
  const porMesVacio = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, monto: 0 }));

  if (cobros.length === 0) {
    return {
      duracionPromedioDias: null,
      clasificacionPago: "sin_datos",
      frecuenciaPorMes: null,
      mesesActivo: 0,
      totalPeriodos: 0,
      topFacturas: [],
      distribucionEstado: [],
      porMes: porMesVacio,
      mesesConActividadEsteAnio: 0,
      mesesTranscurridosEsteAnio: new Date().getMonth() + 1,
    };
  }

  // Duración de pago: para períodos ya cubiertos por completo, días entre
  // la creación del período y el pago que terminó de cubrirlo.
  const duraciones: number[] = [];
  for (const c of cobros) {
    const pagado = c.pagos.reduce((acc, p) => acc + p.monto, 0);
    if (c.monto > 0 && pagado >= c.monto && c.pagos.length > 0) {
      const pagosOrdenados = [...c.pagos].sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );
      let acumulado = 0;
      let fechaCompleta = new Date(pagosOrdenados[pagosOrdenados.length - 1].fecha).getTime();
      for (const p of pagosOrdenados) {
        acumulado += p.monto;
        if (acumulado >= c.monto) {
          fechaCompleta = new Date(p.fecha).getTime();
          break;
        }
      }
      const creado = new Date(c.created_at).getTime();
      const dias = Math.max(0, Math.round((fechaCompleta - creado) / 86400000));
      duraciones.push(dias);
    }
  }
  const duracionPromedioDias =
    duraciones.length > 0
      ? Math.round(duraciones.reduce((a, b) => a + b, 0) / duraciones.length)
      : null;

  const clasificacionPago: SaludFinanciera["clasificacionPago"] =
    duracionPromedioDias == null
      ? "sin_datos"
      : duracionPromedioDias <= 30
      ? "rapido"
      : duracionPromedioDias <= 60
      ? "normal"
      : "lento";

  // Frecuencia: períodos por mes desde el primer cobro registrado.
  const primero = Math.min(...cobros.map((c) => new Date(c.created_at).getTime()));
  const mesesActivo = Math.max(1, Math.round((Date.now() - primero) / (86400000 * 30)));
  const frecuenciaPorMes = Math.round((cobros.length / mesesActivo) * 10) / 10;

  const topFacturas = [...cobros]
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 5)
    .map((c) => ({ etiqueta: c.etiqueta, monto: c.monto, moneda: c.moneda }));

  const porEstadoMap = new Map<string, { count: number; monto: number }>();
  for (const c of cobros) {
    const cur = porEstadoMap.get(c.estado) ?? { count: 0, monto: 0 };
    cur.count += 1;
    cur.monto += c.monto;
    porEstadoMap.set(c.estado, cur);
  }
  const distribucionEstado = Array.from(porEstadoMap.entries()).map(([estado, v]) => ({
    estado,
    ...v,
  }));

  // Cobrado por mes del año en curso — basado en la fecha real de cada
  // pago (no en cuándo se creó el período), que es lo que refleja cuándo
  // efectivamente entró el dinero.
  const porMes = porMesVacio.map((m) => ({ ...m }));
  for (const c of cobros) {
    for (const p of c.pagos) {
      const fecha = new Date(p.fecha);
      if (fecha.getFullYear() === anioActual) {
        porMes[fecha.getMonth()].monto += p.monto;
      }
    }
  }
  const mesActualIdx = new Date().getMonth(); // 0-11
  const mesesConActividadEsteAnio = porMes
    .slice(0, mesActualIdx + 1)
    .filter((m) => m.monto > 0).length;

  return {
    duracionPromedioDias,
    clasificacionPago,
    frecuenciaPorMes,
    mesesActivo,
    totalPeriodos: cobros.length,
    topFacturas,
    distribucionEstado,
    porMes,
    mesesConActividadEsteAnio,
    mesesTranscurridosEsteAnio: mesActualIdx + 1,
  };
}
