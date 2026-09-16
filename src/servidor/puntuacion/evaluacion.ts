import type { EstadoPartida } from '../motor/ciclos.js';
import type { KPIs } from '../motor/kpis.js';

export interface CausaDeclarada {
  id: string;
  nombre: string;
}

const CAUSAS_REALES: Record<string, number> = {
  ventana_captura_cuello: 110,
  reproceso_documental: 90,
  fuga_aprobados_sin_plastico: 60,
  secuencia_tardia_buro: 40,
};

export interface Desglose {
  diagnostico: number;
  criterio: number;
  impacto: number;
  metodo: number;
  compromisos: number;
  penalizaciones: number;
  total: number;
  detalles: string[];
}

export interface Desenlace {
  id: string;
  nombre: string;
}

export function evaluarDiagnostico(
  causasDeclaradas: CausaDeclarada[],
  config: Record<string, number>
): { puntos: number; detalles: string[] } {
  let puntos = 0;
  const detalles: string[] = [];

  for (const causa of causasDeclaradas) {
    const valor = CAUSAS_REALES[causa.id];
    if (valor != null) {
      puntos += valor;
      detalles.push(`${causa.nombre}: +${valor}`);
    } else {
      const penalizacion = config.penalizacionCausaEspuria ?? -40;
      puntos += penalizacion;
      detalles.push(`${causa.nombre} (espuria): ${penalizacion}`);
    }
  }

  return { puntos: Math.max(0, puntos), detalles };
}

export function evaluarCriterio(
  afirmacionesVerificadas: number,
  refutacionesConDatos: number,
  accionesSinVerificar: number,
  config: Record<string, number>
): { puntos: number; detalles: string[] } {
  const detalles: string[] = [];

  const ptsVerificadas = afirmacionesVerificadas * (config.afirmacionVerificada ?? 30);
  detalles.push(`${afirmacionesVerificadas} afirmaciones verificadas: +${ptsVerificadas}`);

  const ptsRefutaciones = refutacionesConDatos * (config.refutacionConDatos ?? 50);
  detalles.push(`${refutacionesConDatos} refutaciones con datos: +${ptsRefutaciones}`);

  const ptsSinVerificar = accionesSinVerificar * (config.accionSinVerificar ?? -40);
  detalles.push(`${accionesSinVerificar} acciones sin verificar: ${ptsSinVerificar}`);

  const puntos = Math.max(0, Math.min(250, ptsVerificadas + ptsRefutaciones + ptsSinVerificar));
  return { puntos, detalles };
}

export function evaluarImpacto(
  kpisIniciales: KPIs,
  kpisFinales: KPIs,
  config: Record<string, number>
): { puntos: number; detalles: string[] } {
  const detalles: string[] = [];
  let puntos = 0;

  const reduccionCiclo = kpisIniciales.cicloTotalMediana - kpisFinales.cicloTotalMediana;
  const maxReduccionCiclo = kpisIniciales.cicloTotalMediana * 0.5;
  const ptsCiclo = Math.round(
    Math.min(1, Math.max(0, reduccionCiclo / maxReduccionCiclo)) * (config.reduccionCiclo ?? 100)
  );
  puntos += ptsCiclo;
  detalles.push(`Reduccion ciclo: ${reduccionCiclo} dias -> +${ptsCiclo}`);

  const reduccionQuejas = kpisIniciales.quejasPct - kpisFinales.quejasPct;
  const ptsQuejas = Math.round(
    Math.min(1, Math.max(0, reduccionQuejas / 50)) * (config.reduccionQuejas ?? 60)
  );
  puntos += ptsQuejas;
  detalles.push(`Reduccion quejas: ${reduccionQuejas}% -> +${ptsQuejas}`);

  const conversionPreservada = kpisFinales.conversionPct / kpisIniciales.conversionPct;
  const ptsConversion = Math.round(
    Math.min(1, Math.max(0, conversionPreservada)) * (config.conversionPreservada ?? 50)
  );
  puntos += ptsConversion;
  detalles.push(`Conversion preservada: ${Math.round(conversionPreservada * 100)}% -> +${ptsConversion}`);

  const presupuestoSobrante = 100 - kpisFinales.presupuestoGastado;
  const ptsPpto = Math.round((presupuestoSobrante / 100) * (config.presupuestoSobrante ?? 40));
  puntos += ptsPpto;
  detalles.push(`Presupuesto sobrante: ${presupuestoSobrante} -> +${ptsPpto}`);

  return { puntos: Math.min(250, puntos), detalles };
}

export function evaluarMetodo(
  herramientasUsadas: string[],
  consultoGuia: boolean,
  pasosEnOrden: boolean,
  config: Record<string, number>
): { puntos: number; detalles: string[] } {
  const detalles: string[] = [];
  let puntos = 0;

  const HERRAMIENTAS_BOHN = [
    'histograma',
    'pareto',
    'diagrama_corrida',
    'carta_control',
    'dispersion',
    'tabla_dinamica',
    'filtro',
  ];

  const usadasValidas = herramientasUsadas.filter((h) => HERRAMIENTAS_BOHN.includes(h));
  const ptsHerramientas = Math.min(
    config.maxHerramientas ?? 100,
    usadasValidas.length * (config.herramientaBohn ?? 25)
  );
  puntos += ptsHerramientas;
  detalles.push(`${usadasValidas.length} herramientas de Bohn: +${ptsHerramientas}`);

  if (consultoGuia) {
    const ptsGuia = config.consultaGuia ?? 20;
    puntos += ptsGuia;
    detalles.push(`Consulto guia/nota: +${ptsGuia}`);
  }

  if (pasosEnOrden) {
    const ptsPasos = config.pasosEnOrden ?? 30;
    puntos += ptsPasos;
    detalles.push(`Pasos en orden: +${ptsPasos}`);
  }

  return { puntos: Math.min(150, puntos), detalles };
}

export function evaluarCompromisos(partida: EstadoPartida): { puntos: number; detalles: string[] } {
  const detalles: string[] = [];
  if (partida.resultadosCiclo.length === 0) return { puntos: 0, detalles };

  let sumFraccion = 0;
  let count = 0;
  for (const r of partida.resultadosCiclo) {
    if (r.compromiso) {
      sumFraccion += Math.max(0, Math.min(1, r.fraccionCumplimiento));
      count++;
      detalles.push(
        `Ciclo ${r.ciclo}: ${Math.round(r.fraccionCumplimiento * 100)}% cumplido`
      );
    }
  }

  const promedio = count > 0 ? sumFraccion / count : 0;
  const puntos = Math.round(promedio * 50);
  return { puntos, detalles };
}

export function calcularPenalizaciones(partida: EstadoPartida): { puntos: number; detalles: string[] } {
  const detalles: string[] = [];
  let puntos = 0;

  const vidasPerdidas = 3 - partida.vidas;
  if (vidasPerdidas > 0) {
    const penVidas = vidasPerdidas * -60;
    puntos += penVidas;
    detalles.push(`${vidasPerdidas} vida(s) perdida(s): ${penVidas}`);
  }

  if (partida.destituido) {
    puntos += -100;
    detalles.push('Destitucion: -100');
  }

  const gastoSinEfecto = partida.resultadosCiclo.some(
    (r) =>
      r.kpisAntes.presupuestoGastado < r.kpisDespues.presupuestoGastado &&
      r.kpisDespues.presupuestoGastado >= 100 &&
      r.kpisDespues.ventanaCapturaMedia >= r.kpisAntes.ventanaCapturaMedia
  );
  if (gastoSinEfecto) {
    puntos += -80;
    detalles.push('Presupuesto agotado sin efecto: -80');
  }

  return { puntos, detalles };
}

export function evaluarPartida(
  partida: EstadoPartida,
  kpisIniciales: KPIs,
  causasDeclaradas: CausaDeclarada[],
  afirmacionesVerificadas: number,
  refutacionesConDatos: number,
  accionesSinVerificar: number,
  herramientasUsadas: string[],
  consultoGuia: boolean,
  pasosEnOrden: boolean,
  configPuntuacion: Record<string, Record<string, number>>
): Desglose {
  const diag = evaluarDiagnostico(causasDeclaradas, configPuntuacion.diagnostico ?? {});
  const crit = evaluarCriterio(
    afirmacionesVerificadas,
    refutacionesConDatos,
    accionesSinVerificar,
    configPuntuacion.criterio ?? {}
  );
  const imp = evaluarImpacto(kpisIniciales, partida.kpis, configPuntuacion.impacto ?? {});
  const met = evaluarMetodo(herramientasUsadas, consultoGuia, pasosEnOrden, configPuntuacion.metodo ?? {});
  const comp = evaluarCompromisos(partida);
  const pen = calcularPenalizaciones(partida);

  const total = Math.max(
    0,
    diag.puntos + crit.puntos + imp.puntos + met.puntos + comp.puntos + pen.puntos
  );

  return {
    diagnostico: diag.puntos,
    criterio: crit.puntos,
    impacto: imp.puntos,
    metodo: met.puntos,
    compromisos: comp.puntos,
    penalizaciones: pen.puntos,
    total,
    detalles: [
      '=== DIAGNOSTICO ===',
      ...diag.detalles,
      '=== CRITERIO ===',
      ...crit.detalles,
      '=== IMPACTO ===',
      ...imp.detalles,
      '=== METODO ===',
      ...met.detalles,
      '=== COMPROMISOS ===',
      ...comp.detalles,
      '=== PENALIZACIONES ===',
      ...pen.detalles,
    ],
  };
}

export function determinarDesenlace(
  puntos: number,
  destituido: boolean,
  desenlaces: { id: string; nombre: string; minPuntos: number; maxPuntos: number }[]
): Desenlace {
  if (destituido) return { id: 'destituido', nombre: 'Destituido' };

  for (const d of desenlaces) {
    if (puntos >= d.minPuntos && puntos <= d.maxPuntos) {
      return { id: d.id, nombre: d.nombre };
    }
  }

  return { id: 'en_la_mira', nombre: 'En la mira' };
}
