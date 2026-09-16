import { parsearErrores } from './parseo.js';
import type { SolicitudCruda, ErrorParseado } from './parseo.js';

export interface SolicitudDerivada extends SolicitudCruda {
  ventanaCaptura: number;
  cicloTotal: number | null;
  errores: ErrorParseado[];
  erroresPorCaso: number;
  erroresCaptura: number;
  erroresIncompletos: number;
  erroresIlegibles: number;
  tieneReproceso: boolean;
  estaAtorado: boolean;
  trabajoPerdido: number | null;
  mes: string;
}

function diffDias(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function formatMes(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function calcularDerivados(solicitudes: SolicitudCruda[]): SolicitudDerivada[] {
  return solicitudes.map((s) => {
    const errores = parsearErrores(s.comments);
    const erroresCaptura = errores.filter((e) => e.tipo === 'captura').length;
    const erroresIncompletos = errores.filter((e) => e.tipo === 'incompletos').length;
    const erroresIlegibles = errores.filter((e) => e.tipo === 'ilegibles').length;

    const ventanaCaptura = diffDias(s.dateFirstInput, s.dateLastInput);
    const cicloTotal = s.datePlasticSent
      ? diffDias(s.dateFirstInput, s.datePlasticSent)
      : null;

    const estaAtorado =
      s.etfBankScoreResult?.toLowerCase() === 'accepted' && s.datePlasticSent == null;

    const esRechazadoPorBuro = s.creditBureauResult?.toLowerCase() === 'rejected';
    const trabajoPerdido = esRechazadoPorBuro ? ventanaCaptura : null;

    return {
      ...s,
      ventanaCaptura,
      cicloTotal,
      errores,
      erroresPorCaso: errores.length,
      erroresCaptura,
      erroresIncompletos,
      erroresIlegibles,
      tieneReproceso: errores.length >= 1,
      estaAtorado,
      trabajoPerdido,
      mes: formatMes(s.dateFirstInput),
    };
  });
}

export interface EstadisticasVerificacion {
  filas: number;
  sucursales: number;
  estados: number;
  mesesDistintos: number;
  erroresTotales: number;
  erroresCaptura: number;
  erroresIncompletos: number;
  erroresIlegibles: number;
  casosConError: number;
  intentosMedia: number;
  intentosDesviacion: number;
  ventanaCapturaMedia: number;
  ventanaCapturaMediana: number;
  correlacionIntentoCaptura: number;
  buroCorrido: number;
  buroAceptado: number;
  scoreAceptado: number;
  plasticoEnviado: number;
  atorados: number;
  diasPerdidosRechazados: number;
  top3SucursalesPorErrores: number[];
  pctErroresTop3: number;
}

function mediana(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function media(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function desviacion(arr: number[]): number {
  const m = media(arr);
  const sumSq = arr.reduce((s, x) => s + (x - m) ** 2, 0);
  return Math.sqrt(sumSq / (arr.length - 1));
}

function correlacion(xs: number[], ys: number[]): number {
  const n = xs.length;
  const mx = media(xs);
  const my = media(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  return num / Math.sqrt(dx2 * dy2);
}

export function calcularEstadisticas(datos: SolicitudDerivada[]): EstadisticasVerificacion {
  const sucursales = new Set(datos.map((d) => d.branchNum));
  const estados = new Set(datos.map((d) => d.state));
  const meses = new Set(datos.map((d) => d.mes));

  const erroresTotales = datos.reduce((s, d) => s + d.erroresPorCaso, 0);
  const erroresCaptura = datos.reduce((s, d) => s + d.erroresCaptura, 0);
  const erroresIncompletos = datos.reduce((s, d) => s + d.erroresIncompletos, 0);
  const erroresIlegibles = datos.reduce((s, d) => s + d.erroresIlegibles, 0);
  const casosConError = datos.filter((d) => d.tieneReproceso).length;

  const intentos = datos.map((d) => d.numTries);
  const ventanas = datos.map((d) => d.ventanaCaptura);

  const buroCorrido = datos.filter((d) => d.creditBureauResult != null).length;
  const buroAceptado = datos.filter(
    (d) => d.creditBureauResult?.toLowerCase() === 'accepted'
  ).length;
  const scoreAceptado = datos.filter(
    (d) => d.etfBankScoreResult?.toLowerCase() === 'accepted'
  ).length;
  const plasticoEnviado = datos.filter((d) => d.datePlasticSent != null).length;
  const atorados = scoreAceptado - plasticoEnviado;

  const diasPerdidosRechazados = datos
    .filter((d) => d.trabajoPerdido != null)
    .reduce((s, d) => s + d.trabajoPerdido!, 0);

  const erroresPorSucursal = new Map<number, number>();
  for (const d of datos) {
    erroresPorSucursal.set(d.branchNum, (erroresPorSucursal.get(d.branchNum) || 0) + d.erroresPorCaso);
  }
  const ranking = [...erroresPorSucursal.entries()]
    .sort((a, b) => b[1] - a[1]);
  const top3 = ranking.slice(0, 3).map(([suc]) => suc);
  const erroresTop3 = ranking.slice(0, 3).reduce((s, [, e]) => s + e, 0);

  return {
    filas: datos.length,
    sucursales: sucursales.size,
    estados: estados.size,
    mesesDistintos: meses.size,
    erroresTotales,
    erroresCaptura,
    erroresIncompletos,
    erroresIlegibles,
    casosConError,
    intentosMedia: Math.round(media(intentos) * 100) / 100,
    intentosDesviacion: Math.round(desviacion(intentos) * 100) / 100,
    ventanaCapturaMedia: Math.floor(media(ventanas) * 10) / 10,
    ventanaCapturaMediana: mediana(ventanas),
    correlacionIntentoCaptura: Math.round(correlacion(intentos, ventanas) * 1000) / 1000,
    buroCorrido,
    buroAceptado,
    scoreAceptado,
    plasticoEnviado,
    atorados,
    diasPerdidosRechazados,
    top3SucursalesPorErrores: top3,
    pctErroresTop3: Math.round((erroresTop3 / erroresTotales) * 1000) / 10,
  };
}
