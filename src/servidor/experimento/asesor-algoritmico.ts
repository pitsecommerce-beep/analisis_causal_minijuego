import type { EstadoPartida } from '../motor/ciclos.js';
import type { KPIs } from '../motor/kpis.js';

export interface RecomendacionAlgoritmica {
  accionRecomendada: number | null;
  metricaPrioritaria: string;
  explicacion: string;
  confianza: number;
}

const PRIORIDAD_METRICAS: { metrica: keyof KPIs; umbralMalo: number; direccion: 'menor' | 'mayor' }[] = [
  { metrica: 'cicloTotalMediana', umbralMalo: 25, direccion: 'menor' },
  { metrica: 'quejasPct', umbralMalo: 30, direccion: 'menor' },
  { metrica: 'conversionPct', umbralMalo: 60, direccion: 'mayor' },
];

const ACCIONES_POR_METRICA: Record<string, number[]> = {
  cicloTotalMediana: [1, 3, 5, 8],
  quejasPct: [2, 4, 6, 9],
  conversionPct: [7, 10],
};

export function generarRecomendacion(
  estado: EstadoPartida,
  accionesConfig: { id: number; costo: number; nombre: string }[]
): RecomendacionAlgoritmica {
  const yaElegidas = new Set(estado.accionesElegidas.map(a => a.accionId));

  let metricaPrioritaria = 'cicloTotalMediana';
  for (const p of PRIORIDAD_METRICAS) {
    const valor = estado.kpis[p.metrica] as number;
    if (p.direccion === 'menor' && valor > p.umbralMalo) {
      metricaPrioritaria = p.metrica;
      break;
    }
    if (p.direccion === 'mayor' && valor < p.umbralMalo) {
      metricaPrioritaria = p.metrica;
      break;
    }
  }

  const candidatas = (ACCIONES_POR_METRICA[metricaPrioritaria] ?? [])
    .filter(id => !yaElegidas.has(id))
    .filter(id => {
      const ac = accionesConfig.find(a => a.id === id);
      return ac && ac.costo <= estado.presupuestoDisponible;
    });

  if (candidatas.length === 0) {
    return {
      accionRecomendada: null,
      metricaPrioritaria,
      explicacion: `Los datos sugieren enfocarse en ${metricaPrioritaria}, pero no hay acciones disponibles dentro del presupuesto.`,
      confianza: 0.3,
    };
  }

  const mejorId = candidatas[0]!;
  const accion = accionesConfig.find(a => a.id === mejorId);

  return {
    accionRecomendada: mejorId,
    metricaPrioritaria,
    explicacion: `Basandome en el analisis de los datos, la metrica "${metricaPrioritaria}" necesita atencion. Recomiendo la accion "${accion?.nombre ?? mejorId}" como siguiente paso.`,
    confianza: 0.75,
  };
}
