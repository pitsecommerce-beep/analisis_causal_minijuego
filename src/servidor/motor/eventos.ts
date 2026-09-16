import type { KPIs } from './kpis.js';
import { redondear, recalcularDerivados } from './kpis.js';

export interface EventoConfig {
  id: string;
  nombre: string;
  efecto: Record<string, number>;
  duracion: number;
  mensaje: string;
}

export interface EventoActivo {
  evento: EventoConfig;
  cicloInicio: number;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sortearEvento(
  semilla: number,
  ciclo: number,
  eventosDisponibles: EventoConfig[],
  eventosOcurridos: string[]
): EventoConfig | null {
  const rng = mulberry32(semilla + ciclo * 7919);
  const prob = rng();

  if (ciclo === 1 || ciclo === 4) {
    if (prob > 0.35) return null;
  } else {
    if (prob > 0.50) return null;
  }

  const noUsados = eventosDisponibles.filter((e) => !eventosOcurridos.includes(e.id));
  if (noUsados.length === 0) return null;

  const idx = Math.floor(rng() * noUsados.length);
  return noUsados[idx];
}

export function aplicarEvento(
  kpis: KPIs,
  evento: EventoConfig,
  accionesAplicadas: number[]
): string[] {
  const cambios: string[] = [];
  const e = evento.efecto;

  if (e.backOffice != null) {
    kpis.backOfficeDias += e.backOffice;
    cambios.push(`Back office: +${e.backOffice} dias`);
  }

  if (e.revertirCapacitacion != null && accionesAplicadas.some((a) => a === 2 || a === 3)) {
    const reversion = Math.round(kpis.erroresCaptura * e.revertirCapacitacion * -1);
    kpis.erroresCaptura -= reversion;
    cambios.push(`Efecto de capacitacion revertido parcialmente: errores +${Math.abs(reversion)}`);
  }

  if (e.conversionCondicional != null && e.umbralCiclo != null) {
    if (kpis.cicloTotalMediana > e.umbralCiclo) {
      kpis.conversionPct = redondear(kpis.conversionPct * (1 + e.conversionCondicional), 1);
      cambios.push(`Conversion: ${Math.round(e.conversionCondicional * 100)}% (ciclo > ${e.umbralCiclo} dias)`);
    } else {
      cambios.push(`Sin efecto: ciclo dentro del umbral`);
    }
  }

  if (e.volumen != null) {
    const erroresExtra = e.erroresExtra ?? 0;
    const nuevosErrores = Math.round(
      (kpis.erroresCaptura + kpis.erroresIncompletos) * erroresExtra
    );
    kpis.erroresCaptura += Math.round(nuevosErrores * 0.6);
    kpis.erroresIncompletos += Math.round(nuevosErrores * 0.4);
    kpis.tasaReproceso = redondear(kpis.tasaReproceso * (1 + erroresExtra * 0.3), 1);
    cambios.push(`Volumen: +${Math.round(e.volumen * 100)}%, errores extra: +${nuevosErrores}`);
  }

  if (e.credibilidad != null) {
    cambios.push(`Credibilidad: ${e.credibilidad}`);
  }

  if (e.capacidadCrop != null) {
    kpis.backOfficeDias += Math.abs(e.capacidadCrop);
    cambios.push(`Capacidad CrOP reducida: back office +${Math.abs(e.capacidadCrop)} dias`);
  }

  recalcularDerivados(kpis);
  return cambios;
}
