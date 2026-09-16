import type { KPIs } from './kpis.js';
import { clonarKPIs, recalcularDerivados, formatearKPIs } from './kpis.js';
import type { AccionConfig, AccionElegida, ResultadoAccion } from './acciones.js';
import { aplicarAccion } from './acciones.js';
import type { EventoConfig, EventoActivo } from './eventos.js';
import { sortearEvento, aplicarEvento } from './eventos.js';

export interface Compromiso {
  metrica: string;
  valorActual: number;
  valorPrometido: number;
}

export interface ResultadoCiclo {
  ciclo: number;
  kpisAntes: KPIs;
  kpisDespues: KPIs;
  accionesAplicadas: ResultadoAccion[];
  evento: EventoConfig | null;
  cambiosEvento: string[];
  compromiso: Compromiso | null;
  cumplioCompromiso: boolean;
  fraccionCumplimiento: number;
  vidaPerdida: boolean;
  motivoVidaPerdida: string | null;
  credibilidadDespues: number;
}

export interface EstadoPartida {
  cicloActual: number;
  kpis: KPIs;
  vidas: number;
  credibilidad: number;
  presupuestoDisponible: number;
  accionesElegidas: AccionElegida[];
  compromisos: Compromiso[];
  resultadosCiclo: ResultadoCiclo[];
  eventosOcurridos: string[];
  destituido: boolean;
  terminada: boolean;
  semilla: number;
}

export function crearPartida(kpisIniciales: KPIs, semilla: number): EstadoPartida {
  return {
    cicloActual: 0,
    kpis: clonarKPIs(kpisIniciales),
    vidas: 3,
    credibilidad: 60,
    presupuestoDisponible: 100,
    accionesElegidas: [],
    compromisos: [],
    resultadosCiclo: [],
    eventosOcurridos: [],
    destituido: false,
    terminada: false,
    semilla,
  };
}

export function elegirAcciones(
  partida: EstadoPartida,
  acciones: AccionElegida[],
  catalogoAcciones: AccionConfig[]
): { ok: boolean; error?: string } {
  let costoTotal = 0;
  for (const a of acciones) {
    const config = catalogoAcciones.find((c) => c.id === a.accionId);
    if (!config) return { ok: false, error: `Accion ${a.accionId} no existe` };

    const yaElegida = partida.accionesElegidas.some((e) => e.accionId === a.accionId);
    if (yaElegida) return { ok: false, error: `Accion ${a.accionId} ya fue elegida` };

    costoTotal += config.costo;
  }

  if (costoTotal > partida.presupuestoDisponible) {
    return {
      ok: false,
      error: `Presupuesto insuficiente: necesitas ${costoTotal}, tienes ${partida.presupuestoDisponible}`,
    };
  }

  for (const a of acciones) {
    const config = catalogoAcciones.find((c) => c.id === a.accionId)!;
    partida.presupuestoDisponible -= config.costo;
    partida.kpis.presupuestoGastado += config.costo;
    partida.accionesElegidas.push({ ...a, cicloElegido: partida.cicloActual });
  }

  return { ok: true };
}

export function declararCompromiso(
  partida: EstadoPartida,
  metrica: string,
  valorPrometido: number
): void {
  const valorActual = obtenerValorMetrica(partida.kpis, metrica);
  partida.compromisos.push({ metrica, valorActual, valorPrometido });
}

function obtenerValorMetrica(kpis: KPIs, metrica: string): number {
  const mapa: Record<string, number> = {
    ventanaCapturaMedia: kpis.ventanaCapturaMedia,
    cicloTotalMediana: kpis.cicloTotalMediana,
    tasaReproceso: kpis.tasaReproceso,
    atorados: kpis.atorados,
    conversionPct: kpis.conversionPct,
    quejasPct: kpis.quejasPct,
    erroresPor100: kpis.erroresPor100,
    backOfficeDias: kpis.backOfficeDias,
  };
  return mapa[metrica] ?? 0;
}

export const METRICAS_DISPONIBLES = [
  { id: 'ventanaCapturaMedia', nombre: 'Ventana de captura (media)', unidad: 'dias' },
  { id: 'cicloTotalMediana', nombre: 'Ciclo total (mediana)', unidad: 'dias' },
  { id: 'tasaReproceso', nombre: 'Tasa de reproceso', unidad: '%' },
  { id: 'atorados', nombre: 'Expedientes atorados', unidad: '' },
  { id: 'conversionPct', nombre: 'Conversion', unidad: '%' },
  { id: 'quejasPct', nombre: 'Quejas (indice)', unidad: '%' },
  { id: 'erroresPor100', nombre: 'Errores por 100 solicitudes', unidad: '' },
  { id: 'backOfficeDias', nombre: 'Back office', unidad: 'dias' },
];

export function procesarCiclo(
  partida: EstadoPartida,
  catalogoAcciones: AccionConfig[],
  eventosConfig: EventoConfig[]
): ResultadoCiclo {
  partida.cicloActual++;
  const ciclo = partida.cicloActual;
  const kpisAntes = clonarKPIs(partida.kpis);

  const accionesAplicadas: ResultadoAccion[] = [];
  for (const elegida of partida.accionesElegidas) {
    const config = catalogoAcciones.find((c) => c.id === elegida.accionId)!;
    const resultado = aplicarAccion(partida.kpis, config, elegida, ciclo);
    accionesAplicadas.push(resultado);
  }

  const evento = sortearEvento(partida.semilla, ciclo, eventosConfig, partida.eventosOcurridos);
  let cambiosEvento: string[] = [];
  if (evento) {
    partida.eventosOcurridos.push(evento.id);
    const accionesIds = partida.accionesElegidas.map((a) => a.accionId);
    cambiosEvento = aplicarEvento(partida.kpis, evento, accionesIds);

    if (evento.efecto.credibilidad) {
      partida.credibilidad = Math.max(0, partida.credibilidad + evento.efecto.credibilidad);
    }
  }

  const compromiso = partida.compromisos[ciclo - 1] ?? null;
  let cumplioCompromiso = true;
  let fraccionCumplimiento = 1;

  if (compromiso) {
    const valorReal = obtenerValorMetrica(partida.kpis, compromiso.metrica);
    const mejora = compromiso.valorActual - valorReal;
    const mejoraPrometida = compromiso.valorActual - compromiso.valorPrometido;

    if (mejoraPrometida > 0) {
      fraccionCumplimiento = mejora / mejoraPrometida;
    } else if (mejoraPrometida < 0) {
      fraccionCumplimiento = mejora <= mejoraPrometida ? 1 : 0;
    } else {
      fraccionCumplimiento = 1;
    }

    cumplioCompromiso = fraccionCumplimiento >= 0.5;

    if (cumplioCompromiso) {
      partida.credibilidad = Math.min(100, partida.credibilidad + Math.round(fraccionCumplimiento * 8));
    } else {
      partida.credibilidad = Math.max(0, partida.credibilidad - 10);
    }
  }

  let vidaPerdida = false;
  let motivoVidaPerdida: string | null = null;

  const sinAccionesEnPartida = partida.accionesElegidas.length === 0;

  if (sinAccionesEnPartida && ciclo >= 2) {
    vidaPerdida = true;
    motivoVidaPerdida = 'No decidiste nada en el ciclo. La inaccion tambien se paga.';
  } else if (compromiso && fraccionCumplimiento < 0.5) {
    vidaPerdida = true;
    const valorReal = obtenerValorMetrica(partida.kpis, compromiso.metrica);
    motivoVidaPerdida = `El resultado quedo por debajo de la mitad de lo que prometiste. Prometiste ${compromiso.valorPrometido}, resultado: ${valorReal}.`;
  } else if (partida.credibilidad <= 0) {
    vidaPerdida = true;
    motivoVidaPerdida = 'Tu credibilidad llego a cero.';
    partida.credibilidad = 30;
  }

  const gastoEsteCiclo = partida.accionesElegidas
    .filter((a) => a.cicloElegido === ciclo)
    .reduce((s, a) => {
      const config = catalogoAcciones.find((c) => c.id === a.accionId)!;
      return s + config.costo;
    }, 0);

  const kpisDespues = clonarKPIs(partida.kpis);
  const algunKpiMejoro =
    kpisDespues.ventanaCapturaMedia < kpisAntes.ventanaCapturaMedia ||
    kpisDespues.tasaReproceso < kpisAntes.tasaReproceso ||
    kpisDespues.atorados < kpisAntes.atorados ||
    kpisDespues.quejasPct < kpisAntes.quejasPct ||
    kpisDespues.conversionPct > kpisAntes.conversionPct;

  if (gastoEsteCiclo > 40 && !algunKpiMejoro && !vidaPerdida) {
    vidaPerdida = true;
    motivoVidaPerdida = `Gastaste ${gastoEsteCiclo} unidades de presupuesto y ningun KPI se movio.`;
  }

  if (vidaPerdida) {
    partida.vidas--;
    if (partida.vidas <= 0) {
      partida.destituido = true;
      partida.terminada = true;
    }
  }

  if (ciclo >= 4) {
    partida.terminada = true;
  }

  const resultado: ResultadoCiclo = {
    ciclo,
    kpisAntes,
    kpisDespues,
    accionesAplicadas,
    evento,
    cambiosEvento,
    compromiso,
    cumplioCompromiso,
    fraccionCumplimiento,
    vidaPerdida,
    motivoVidaPerdida,
    credibilidadDespues: partida.credibilidad,
  };

  partida.resultadosCiclo.push(resultado);
  return resultado;
}
