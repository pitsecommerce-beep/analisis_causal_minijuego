// Constructor de gráficos: una especificación (tabla, tipo, variable, medida, estrato, filtros y opciones)
// se convierte en los datos de un gráfico y en la tabla que lo genera. Funciones puras para poder probarlas.
import { aNumero, claveMes, formatoNumero, percentil, resumir, correlacion } from './analisis.js';
import type { Columna, Fila, Resumen } from './analisis.js';
import { eventosDe, contarCoincidencias } from '../compartido/expediente.js';
import type { TipoEvento, Vocabulario } from '../compartido/expediente.js';
import type { Traductor } from '../compartido/i18n/index.js';

export type Tabla = 'solicitudes' | 'comentarios';
export type TipoGrafico = 'pareto' | 'pareto_eventos' | 'pareto_etapas' | 'pareto_comparativo'
  | 'histograma' | 'dispersion' | 'corrida' | 'control' | 'caja' | 'pivote';
export type Medida = 'conteo' | 'suma' | 'promedio' | 'mediana' | 'porcentaje' | 'tasa';

export const TIPOS: TipoGrafico[] = ['pareto', 'pareto_eventos', 'pareto_etapas', 'pareto_comparativo', 'histograma', 'dispersion', 'corrida', 'control', 'caja', 'pivote'];
export const TIPOS_SOLO_SOLICITUDES: TipoGrafico[] = ['pareto_eventos', 'pareto_etapas'];
export const MEDIDAS: Medida[] = ['conteo', 'suma', 'promedio', 'mediana', 'porcentaje', 'tasa'];
// Medidas que se pueden sumar entre categorías y por eso tienen porcentaje acumulado
const ADITIVAS: Medida[] = ['conteo', 'suma', 'porcentaje'];
export const necesitaCampoMedida = (m: Medida) => m !== 'conteo' && m !== 'porcentaje';

export interface Filtro { campo: string; valor: string }

export interface Spec {
  tabla: Tabla;
  tipo: TipoGrafico;
  variable: string;
  variableY: string;
  medida: Medida;
  campoMedida: string;
  estrato: string;
  filtros: Filtro[];
  topN: number;
  linea80: boolean;
  minSolicitudes: number;
  intervalos: number;
  estadistico: 'media' | 'mediana';
  eventos: TipoEvento[];
  periodo: 'semana' | 'mes';
  grupoValor: string;
  valoresComparar: string[];
  formatoCondicional: boolean;
}

export const CAMPO_EVENTOS = 'comments';
export const TODOS_LOS_EVENTOS: TipoEvento[] = ['captura', 'incompletos', 'ilegibles', 'otros', 'autorizado', 'rechazo_buro', 'rechazo_score', 'envio_plastico'];

export function specInicial(tabla: Tabla = 'solicitudes'): Spec {
  return {
    tabla,
    tipo: 'pareto',
    variable: tabla === 'solicitudes' ? 'lastStatus' : 'categoriaPrimaria',
    variableY: '',
    medida: 'conteo',
    campoMedida: '',
    estrato: '',
    filtros: [],
    topN: 15,
    linea80: true,
    minSolicitudes: 2,
    intervalos: 0,
    estadistico: 'mediana',
    eventos: [...TODOS_LOS_EVENTOS],
    periodo: 'mes',
    grupoValor: '',
    valoresComparar: [],
    formatoCondicional: true,
  };
}

// Valores por defecto al cambiar de tabla o de tipo, para que salga un gráfico útil sin configurar nada
export function ajustarSpec(actual: Spec, cambio: Partial<Spec>, columnas: Columna[]): Spec {
  let s: Spec = { ...actual, ...cambio };
  const existe = (c: string) => columnas.some(x => x.campo === c);
  const numericas = columnas.filter(c => c.tipo !== 'texto');
  const esNum = (c: string) => numericas.some(x => x.campo === c);
  const primeraNum = (prefs: string[]) => prefs.find(existe) ?? numericas[0]?.campo ?? '';
  const sol = s.tabla === 'solicitudes';

  if (cambio.tabla && cambio.tabla !== actual.tabla) {
    s = { ...specInicial(cambio.tabla), tipo: TIPOS_SOLO_SOLICITUDES.includes(actual.tipo) && !sol ? 'pareto' : actual.tipo };
  }
  if (!sol && TIPOS_SOLO_SOLICITUDES.includes(s.tipo)) s.tipo = 'pareto';

  const cambioTipo = (cambio.tipo && cambio.tipo !== actual.tipo) || (cambio.tabla && cambio.tabla !== actual.tabla);
  if (cambioTipo || !existe(s.variable) && s.variable !== CAMPO_EVENTOS) {
    const capt = sol ? ['ventanaCaptura'] : ['solicitudVentanaCaptura', 'intentos'];
    switch (s.tipo) {
      case 'pareto':
        if (!existe(s.variable) || esNum(s.variable) && !['branchNum', 'sucursalNum'].includes(s.variable)) {
          s.variable = sol ? 'lastStatus' : 'categoriaPrimaria';
        }
        break;
      case 'pareto_eventos':
        s.variable = CAMPO_EVENTOS;
        break;
      case 'pareto_comparativo':
        if (!existe(s.variable) && s.variable !== CAMPO_EVENTOS) s.variable = sol ? CAMPO_EVENTOS : 'categoriaPrimaria';
        if (!s.estrato) s.estrato = sol ? 'branchNum' : 'sucursalNum';
        break;
      case 'histograma':
      case 'corrida':
      case 'control':
        if (!esNum(s.variable)) s.variable = primeraNum(capt);
        break;
      case 'dispersion':
        if (!esNum(s.variable)) s.variable = primeraNum(sol ? ['numTries'] : ['intentos']);
        if (!esNum(s.variableY) || s.variableY === s.variable) s.variableY = primeraNum(capt);
        break;
      case 'caja':
        if (!esNum(s.variable)) s.variable = primeraNum(capt);
        if (!s.estrato) s.estrato = sol ? 'state' : 'estado';
        break;
      case 'pivote':
        if (!existe(s.variable) || esNum(s.variable) && !['branchNum', 'sucursalNum'].includes(s.variable)) s.variable = sol ? 'state' : 'categoriaPrimaria';
        break;
      case 'pareto_etapas':
        break;
    }
  }
  if (necesitaCampoMedida(s.medida) && !esNum(s.campoMedida)) s.campoMedida = primeraNum(sol ? ['erroresComentario'] : ['solicitudErrores']);
  if (s.variable === CAMPO_EVENTOS && !['conteo', 'porcentaje', 'tasa'].includes(s.medida)) s.medida = 'conteo';
  if (cambio.estrato !== undefined && cambio.estrato !== actual.estrato) { s.grupoValor = ''; s.valoresComparar = []; }
  return s;
}

// ── Valores y filtros ──

export interface Contexto { columnas: Columna[]; t: Traductor; vocabulario: Vocabulario }

export function columnaDe(ctx: Contexto, campo: string): Columna | undefined {
  return ctx.columnas.find(c => c.campo === campo);
}

export function nombreDe(ctx: Contexto, campo: string): string {
  if (campo === CAMPO_EVENTOS) return ctx.t('graficos.pareto_eventos.nombre');
  return columnaDe(ctx, campo)?.nombre ?? campo;
}

// Etiqueta de categoría de un valor. Los datos se muestran como vienen, sin normalizar.
export function valorCategoria(v: unknown, col: Columna | undefined, t: Traductor): string {
  if (v == null || v === '') return t('comun.sinDato');
  if (typeof v === 'boolean') return v ? t('comun.si') : t('comun.no');
  if (col?.tipo === 'fecha') return claveMes(v) ?? t('comun.sinDato');
  return String(v);
}

// Número de un valor para medidas: los sí/no cuentan como 1/0
export function valorNumero(v: unknown, col: Columna | undefined): number | null {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return aNumero(v, col?.tipo ?? 'numero');
}

export function valoresDistintos(filas: Fila[], campo: string, ctx: Contexto): { valor: string; n: number }[] {
  const col = columnaDe(ctx, campo);
  const m = new Map<string, number>();
  for (const f of filas) {
    const v = valorCategoria(f[campo], col, ctx.t);
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([valor, n]) => ({ valor, n }))
    .sort((a, b) => a.valor.localeCompare(b.valor, undefined, { numeric: true }));
}

export function aplicarFiltros(filas: Fila[], filtros: Filtro[], ctx: Contexto): Fila[] {
  if (filtros.length === 0) return filas;
  const cols = filtros.map(f => columnaDe(ctx, f.campo));
  return filas.filter(r => filtros.every((f, i) => valorCategoria(r[f.campo], cols[i], ctx.t) === f.valor));
}

function agrupar(filas: Fila[], campo: string, ctx: Contexto): Map<string, Fila[]> {
  const col = columnaDe(ctx, campo);
  const m = new Map<string, Fila[]>();
  for (const f of filas) {
    const k = valorCategoria(f[campo], col, ctx.t);
    const g = m.get(k);
    if (g) g.push(f); else m.set(k, [f]);
  }
  return m;
}

function numeros(filas: Fila[], campo: string, ctx: Contexto): number[] {
  const col = columnaDe(ctx, campo);
  const out: number[] = [];
  for (const f of filas) {
    const n = valorNumero(f[campo], col);
    if (n != null) out.push(n);
  }
  return out;
}

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function medir(filas: Fila[], medida: Medida, campoMedida: string, total: number, ctx: Contexto): number | null {
  switch (medida) {
    case 'conteo': return filas.length;
    case 'porcentaje': return total > 0 ? (filas.length / total) * 100 : null;
    case 'suma': return suma(numeros(filas, campoMedida, ctx));
    case 'tasa': return filas.length > 0 ? suma(numeros(filas, campoMedida, ctx)) / filas.length : null;
    case 'promedio': { const xs = numeros(filas, campoMedida, ctx); return xs.length ? suma(xs) / xs.length : null; }
    case 'mediana': { const xs = numeros(filas, campoMedida, ctx).sort((a, b) => a - b); return xs.length ? percentil(xs, 0.5) : null; }
  }
}

// ── Pareto ──

export interface Barra { etiqueta: string; valor: number; n: number; acumulado: number | null; ayuda?: string }
export interface ResultadoPareto {
  clase: 'pareto';
  barras: Barra[];
  aditiva: boolean;
  // Valor de todo el conjunto, como referencia para medidas que no se suman (tasa, promedio, mediana)
  referencia: number | null;
  excluidas: number;
  etiquetaValor: string;
  linea80: boolean;
}

function etiquetaMedida(spec: Spec, ctx: Contexto): string {
  const m = ctx.t(`medidas.${spec.medida}`);
  return necesitaCampoMedida(spec.medida) ? `${m} ${ctx.t('medidas.de')} ${nombreDe(ctx, spec.campoMedida).toLowerCase()}` : m;
}

function cerrarPareto(cats: { etiqueta: string; valor: number; n: number; ayuda?: string }[], aditiva: boolean, linea80: boolean, referencia: number | null, excluidas: number, etiquetaValor: string, otros: { etiqueta: string; valor: number; n: number } | null): ResultadoPareto {
  const barras = cats.map(c => ({ ...c, acumulado: null as number | null }));
  if (otros) barras.push({ ...otros, acumulado: null });
  if (aditiva) {
    const total = suma(barras.map(b => b.valor));
    let acc = 0;
    for (const b of barras) { acc += b.valor; b.acumulado = total > 0 ? (acc / total) * 100 : 0; }
  }
  return { clase: 'pareto', barras, aditiva, referencia, excluidas, etiquetaValor, linea80: linea80 && aditiva };
}

export function calcularPareto(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoPareto {
  if (spec.variable === CAMPO_EVENTOS) return paretoEventos(filas, spec, ctx);
  const aditiva = ADITIVAS.includes(spec.medida);
  const grupos = agrupar(filas, spec.variable, ctx);
  let cats = [...grupos.entries()].map(([etiqueta, g]) => ({ etiqueta, g, n: g.length, valor: medir(g, spec.medida, spec.campoMedida, filas.length, ctx) }))
    .filter((c): c is typeof c & { valor: number } => c.valor != null);
  let excluidas = 0;
  if (!aditiva && spec.minSolicitudes > 1) {
    excluidas = cats.filter(c => c.n < spec.minSolicitudes).length;
    cats = cats.filter(c => c.n >= spec.minSolicitudes);
  }
  cats.sort((a, b) => b.valor - a.valor || b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, undefined, { numeric: true }));
  let otros: { etiqueta: string; valor: number; n: number } | null = null;
  if (spec.topN > 0 && cats.length > spec.topN + 1) {
    const resto = cats.slice(spec.topN);
    const filasResto = resto.flatMap(c => c.g);
    const v = aditiva ? suma(resto.map(c => c.valor)) : medir(filasResto, spec.medida, spec.campoMedida, filas.length, ctx);
    if (v != null) otros = { etiqueta: ctx.t('comun.otros'), valor: v, n: filasResto.length };
    cats = cats.slice(0, spec.topN);
  }
  const referencia = aditiva ? null : medir(filas, spec.medida, spec.campoMedida, filas.length, ctx);
  return cerrarPareto(cats.map(({ etiqueta, valor, n }) => ({ etiqueta, valor, n })), aditiva, spec.linea80, referencia, excluidas, etiquetaMedida(spec, ctx), otros);
}

// Cada evento de la bitácora cuenta por separado; el participante decide cuáles incluir
function paretoEventos(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoPareto {
  const defs = eventosDe(ctx.vocabulario).filter(e => spec.eventos.includes(e.tipo));
  const total = filas.length;
  const cats = defs.map(e => {
    let valor = 0;
    let n = 0;
    for (const f of filas) {
      const c = contarCoincidencias(String(f[CAMPO_EVENTOS] ?? ''), e.patron);
      valor += c;
      if (c > 0) n++;
    }
    return { etiqueta: ctx.t(`eventos.${e.tipo}`), valor, n };
  }).filter(c => c.valor > 0);
  const totalEventos = suma(cats.map(c => c.valor));
  const conMedida = cats.map(c => ({
    ...c,
    valor: spec.medida === 'porcentaje' ? (totalEventos ? (c.valor / totalEventos) * 100 : 0) : spec.medida === 'tasa' ? (total ? c.valor / total : 0) : c.valor,
  })).sort((a, b) => b.valor - a.valor);
  const aditiva = spec.medida !== 'tasa';
  const etiqueta = spec.medida === 'tasa' ? ctx.t('medidas.tasa') : ctx.t(`medidas.${spec.medida}`);
  return cerrarPareto(conMedida, aditiva, spec.linea80, null, 0, etiqueta, null);
}

// Etapas del proceso con las fechas que las delimitan
export const ETAPAS: { id: string; desde: string; hasta: string }[] = [
  { id: 'captura', desde: 'dateFirstInput', hasta: 'dateLastInput' },
  { id: 'envio', desde: 'dateLastInput', hasta: 'dateDocsSent' },
  { id: 'revision', desde: 'dateDocsSent', hasta: 'dateDocsReceived' },
  { id: 'buro', desde: 'dateDocsReceived', hasta: 'creditBureauRunDate' },
  { id: 'score', desde: 'creditBureauRunDate', hasta: 'etfbScoreDate' },
  { id: 'plastico', desde: 'etfbScoreDate', hasta: 'datePlasticSent' },
];

export function calcularEtapas(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoPareto {
  const cats = ETAPAS.map(e => {
    const xs: number[] = [];
    for (const f of filas) {
      const a = aNumero(f[e.desde], 'fecha');
      const b = aNumero(f[e.hasta], 'fecha');
      if (a != null && b != null) xs.push(Math.round((b - a) / 86_400_000));
    }
    xs.sort((a, b) => a - b);
    const valor = xs.length === 0 ? 0 : spec.estadistico === 'media' ? suma(xs) / xs.length : percentil(xs, 0.5);
    return { etiqueta: ctx.t(`etapas.${e.id}`), valor, n: xs.length, ayuda: ctx.t(`etapas.ayuda.${e.id}`) };
  }).filter(c => c.n > 0).sort((a, b) => b.valor - a.valor);
  return cerrarPareto(cats, true, spec.linea80, null, 0, ctx.t(spec.estadistico === 'media' ? 'graficos.media' : 'graficos.mediana'), null);
}

// ── Pareto comparativo ──

export interface Panel { titulo: string; n: number; pareto: ResultadoPareto }
export interface ResultadoComparativo { clase: 'comparativo'; paneles: Panel[] }

export function gruposPorDefecto(filas: Fila[], campo: string, ctx: Contexto, cuantos = 2): string[] {
  return [...agrupar(filas, campo, ctx).entries()].sort((a, b) => b[1].length - a[1].length).slice(0, cuantos).map(([k]) => k);
}

export function calcularComparativo(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoComparativo | null {
  if (!spec.estrato) return null;
  const valores = spec.valoresComparar.length ? spec.valoresComparar : gruposPorDefecto(filas, spec.estrato, ctx);
  const col = columnaDe(ctx, spec.estrato);
  const nombre = nombreDe(ctx, spec.estrato);
  const base: Spec = { ...spec, estrato: '' };
  const paneles: Panel[] = valores.map(v => {
    const g = filas.filter(f => valorCategoria(f[spec.estrato], col, ctx.t) === v);
    return { titulo: `${nombre} ${v}`, n: g.length, pareto: calcularPareto(g, base, ctx) };
  });
  const resto = filas.filter(f => !valores.includes(valorCategoria(f[spec.estrato], col, ctx.t)));
  if (resto.length) paneles.push({ titulo: ctx.t('comun.resto'), n: resto.length, pareto: calcularPareto(resto, base, ctx) });
  return { clase: 'comparativo', paneles };
}

// ── Histograma ──

export interface SerieHistograma { etiqueta: string; conteos: number[]; resumen: Resumen }
export interface ResultadoHistograma { clase: 'histograma'; bordes: number[]; series: SerieHistograma[]; esFecha: boolean; etiquetaX: string }

export function bordesHistograma(xs: number[], intervalos: number): number[] {
  let min = Infinity, max = -Infinity;
  for (const x of xs) { if (x < min) min = x; if (x > max) max = x; }
  if (min === max) return [min, min + 1];
  if (intervalos > 0) {
    const w = (max - min) / intervalos;
    return Array.from({ length: intervalos + 1 }, (_, i) => min + i * w);
  }
  // Regla de Sturges con un ancho "redondo"
  const k = Math.min(30, Math.max(6, Math.ceil(Math.log2(xs.length) + 1)));
  const crudo = (max - min) / k;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const ancho = [1, 2, 2.5, 5, 10].map(m => m * p).find(w => w >= crudo) ?? crudo;
  const inicio = Math.floor(min / ancho) * ancho;
  const total = Math.max(1, Math.ceil((max - inicio) / ancho + 1e-9));
  return Array.from({ length: total + 1 }, (_, i) => inicio + i * ancho);
}

function contarEnBordes(xs: number[], bordes: number[]): number[] {
  const c = new Array(bordes.length - 1).fill(0) as number[];
  for (const x of xs) {
    // El último intervalo incluye su borde superior
    let i = 0;
    while (i < c.length - 1 && x >= bordes[i + 1]!) i++;
    c[i]!++;
  }
  return c;
}

export function calcularHistograma(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoHistograma | null {
  const col = columnaDe(ctx, spec.variable);
  const todos = numeros(filas, spec.variable, ctx);
  if (todos.length === 0) return null;
  const bordes = bordesHistograma(todos, spec.intervalos);
  const series: SerieHistograma[] = [];
  if (spec.estrato && spec.grupoValor) {
    const colE = columnaDe(ctx, spec.estrato);
    const a = filas.filter(f => valorCategoria(f[spec.estrato], colE, ctx.t) === spec.grupoValor);
    const b = filas.filter(f => valorCategoria(f[spec.estrato], colE, ctx.t) !== spec.grupoValor);
    for (const [etiqueta, g] of [[`${nombreDe(ctx, spec.estrato)} ${spec.grupoValor}`, a], [ctx.t('comun.resto'), b]] as const) {
      const xs = numeros(g, spec.variable, ctx);
      const r = resumir(xs);
      if (r) series.push({ etiqueta, conteos: contarEnBordes(xs, bordes), resumen: r });
    }
  } else {
    series.push({ etiqueta: nombreDe(ctx, spec.variable), conteos: contarEnBordes(todos, bordes), resumen: resumir(todos)! });
  }
  return { clase: 'histograma', bordes, series, esFecha: col?.tipo === 'fecha', etiquetaX: nombreDe(ctx, spec.variable) };
}

// ── Dispersión ──

export interface Punto { x: number; y: number; id: string; grupo: number }
export interface ResultadoDispersion {
  clase: 'dispersion';
  puntos: Punto[];
  grupos: string[];
  r: number;
  pendiente: number;
  intercepto: number;
  etiquetaX: string;
  etiquetaY: string;
  xFecha: boolean;
  yFecha: boolean;
}

// Con más de 3 grupos los colores dejan de distinguirse; el resto se agrupa en "Otros"
export const MAX_GRUPOS_COLOR = 3;

export function calcularDispersion(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoDispersion | null {
  const cx = columnaDe(ctx, spec.variable);
  const cy = columnaDe(ctx, spec.variableY);
  if (!cx || !cy) return null;
  const grupos = spec.estrato ? gruposPorDefecto(filas, spec.estrato, ctx, MAX_GRUPOS_COLOR) : [];
  const colE = spec.estrato ? columnaDe(ctx, spec.estrato) : undefined;
  const hayOtros = spec.estrato && agrupar(filas, spec.estrato, ctx).size > grupos.length;
  const etiquetas = hayOtros ? [...grupos, ctx.t('comun.otros')] : grupos;
  const campoId = spec.tabla === 'solicitudes' ? 'applicationNum' : 'id';
  const puntos: Punto[] = [];
  for (const f of filas) {
    const x = valorNumero(f[spec.variable], cx);
    const y = valorNumero(f[spec.variableY], cy);
    if (x == null || y == null) continue;
    let grupo = 0;
    if (spec.estrato) {
      const i = grupos.indexOf(valorCategoria(f[spec.estrato], colE, ctx.t));
      grupo = i >= 0 ? i : grupos.length;
    }
    puntos.push({ x, y, id: String(f[campoId] ?? ''), grupo });
  }
  if (puntos.length === 0) return null;
  const xs = puntos.map(p => p.x), ys = puntos.map(p => p.y);
  const mx = suma(xs) / xs.length, my = suma(ys) / ys.length;
  let sxy = 0, sxx = 0;
  for (const p of puntos) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
  const pendiente = sxx ? sxy / sxx : 0;
  return {
    clase: 'dispersion', puntos, grupos: etiquetas, r: correlacion(xs, ys), pendiente, intercepto: my - pendiente * mx,
    etiquetaX: cx.nombre, etiquetaY: cy.nombre, xFecha: cx.tipo === 'fecha', yFecha: cy.tipo === 'fecha',
  };
}

// ── Corrida y control ──

const campoFecha = (tabla: Tabla) => (tabla === 'solicitudes' ? 'dateFirstInput' : 'fechaComentario');

export interface ResultadoCorrida { clase: 'corrida'; valores: { v: number; id: string; fecha: number }[]; mediana: number; esFecha: boolean; etiquetaY: string; etiquetaX: string }

export function calcularCorrida(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoCorrida | null {
  const col = columnaDe(ctx, spec.variable);
  const cf = campoFecha(spec.tabla);
  const campoId = spec.tabla === 'solicitudes' ? 'applicationNum' : 'id';
  const valores = filas
    .map(f => ({ v: valorNumero(f[spec.variable], col), id: String(f[campoId] ?? ''), fecha: aNumero(f[cf], 'fecha') }))
    .filter((p): p is { v: number; id: string; fecha: number } => p.v != null && p.fecha != null)
    .sort((a, b) => a.fecha - b.fecha);
  if (valores.length === 0) return null;
  const ord = valores.map(p => p.v).sort((a, b) => a - b);
  return {
    clase: 'corrida', valores, mediana: percentil(ord, 0.5), esFecha: col?.tipo === 'fecha', etiquetaY: nombreDe(ctx, spec.variable),
    etiquetaX: ctx.t(spec.tabla === 'solicitudes' ? 'graficos.orden' : 'graficos.ordenComentario'),
  };
}

export interface PuntoControl { periodo: string; media: number; n: number; lcs: number; lci: number; fuera: boolean; racha: boolean }
export interface ResultadoControl { clase: 'control'; centro: number; sigma: number; puntos: PuntoControl[]; etiquetaY: string; periodo: 'semana' | 'mes' }

// Lunes de la semana de una fecha, en formato AAAA-MM-DD
export function claveSemana(ms: number): string {
  const d = new Date(ms);
  const dia = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dia)).toISOString().slice(0, 10);
}

// Racha de puntos del mismo lado de la línea central que se considera señal de cambio en el proceso
export const LARGO_RACHA = 8;

export function calcularControl(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoControl | null {
  const col = columnaDe(ctx, spec.variable);
  if (col?.tipo === 'fecha') return null;
  const cf = campoFecha(spec.tabla);
  const grupos = new Map<string, number[]>();
  const todos: number[] = [];
  for (const f of filas) {
    const t = aNumero(f[cf], 'fecha');
    const v = valorNumero(f[spec.variable], col);
    if (t == null || v == null) continue;
    const k = spec.periodo === 'semana' ? claveSemana(t) : new Date(t).toISOString().slice(0, 7);
    const g = grupos.get(k);
    if (g) g.push(v); else grupos.set(k, [v]);
    todos.push(v);
  }
  const r = resumir(todos);
  if (!r || grupos.size === 0) return null;
  const puntos: PuntoControl[] = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([periodo, vs]) => {
    const media = suma(vs) / vs.length;
    const margen = (3 * r.desviacion) / Math.sqrt(vs.length);
    const lcs = r.media + margen, lci = r.media - margen;
    return { periodo, media, n: vs.length, lcs, lci, fuera: media > lcs || media < lci, racha: false };
  });
  // Rachas: LARGO_RACHA o más periodos seguidos del mismo lado de la media
  let inicio = 0;
  for (let i = 1; i <= puntos.length; i++) {
    const lado = (p: PuntoControl | undefined) => (p ? Math.sign(p.media - r.media) : NaN);
    if (i === puntos.length || lado(puntos[i]) !== lado(puntos[inicio]) || lado(puntos[i]) === 0) {
      if (i - inicio >= LARGO_RACHA && lado(puntos[inicio]) !== 0) for (let j = inicio; j < i; j++) puntos[j]!.racha = true;
      inicio = i;
    }
  }
  return { clase: 'control', centro: r.media, sigma: r.desviacion, puntos, etiquetaY: nombreDe(ctx, spec.variable), periodo: spec.periodo };
}

// ── Caja ──

export interface Caja { grupo: string; n: number; min: number; q1: number; mediana: number; q3: number; max: number; bigoteBajo: number; bigoteAlto: number; atipicos: number[] }
export interface ResultadoCaja { clase: 'caja'; cajas: Caja[]; etiquetaY: string; omitidos: number }

export const MAX_CAJAS = 12;

export function calcularCaja(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoCaja | null {
  if (!spec.estrato) return null;
  const grupos = [...agrupar(filas, spec.estrato, ctx).entries()]
    .map(([grupo, g]) => ({ grupo, xs: numeros(g, spec.variable, ctx).sort((a, b) => a - b) }))
    .filter(g => g.xs.length >= Math.max(1, spec.minSolicitudes))
    .sort((a, b) => b.xs.length - a.xs.length);
  const tope = spec.topN > 0 ? Math.min(spec.topN, MAX_CAJAS) : MAX_CAJAS;
  const cajas = grupos.slice(0, tope).map(({ grupo, xs }) => {
    const q1 = percentil(xs, 0.25), q3 = percentil(xs, 0.75), iqr = q3 - q1;
    const dentro = xs.filter(x => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
    return {
      grupo, n: xs.length, min: xs[0]!, max: xs[xs.length - 1]!, q1, q3, mediana: percentil(xs, 0.5),
      bigoteBajo: dentro[0] ?? q1, bigoteAlto: dentro[dentro.length - 1] ?? q3,
      atipicos: xs.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr),
    };
  }).sort((a, b) => b.mediana - a.mediana);
  if (cajas.length === 0) return null;
  return { clase: 'caja', cajas, etiquetaY: nombreDe(ctx, spec.variable), omitidos: Math.max(0, grupos.length - cajas.length) };
}

// ── Tabla dinámica ──

export interface ResultadoPivote {
  clase: 'pivote';
  etiquetaFilas: string;
  columnas: string[];
  filas: { grupo: string; n: number; valores: (number | null)[]; total: number | null }[];
  totales: (number | null)[];
  total: number | null;
  etiquetaValor: string;
}

export function calcularPivote(filas: Fila[], spec: Spec, ctx: Contexto): ResultadoPivote {
  const total = filas.length;
  const porFila = agrupar(filas, spec.variable, ctx);
  const columnas = spec.estrato ? gruposPorDefecto(filas, spec.estrato, ctx, MAX_CAJAS) : [];
  const colE = spec.estrato ? columnaDe(ctx, spec.estrato) : undefined;
  const enColumna = (g: Fila[], c: string) => g.filter(f => valorCategoria(f[spec.estrato], colE, ctx.t) === c);
  const m = (g: Fila[]) => medir(g, spec.medida, spec.campoMedida, total, ctx);
  const filasP = [...porFila.entries()].map(([grupo, g]) => ({
    grupo, n: g.length, valores: columnas.map(c => { const sub = enColumna(g, c); return sub.length ? m(sub) : null; }), total: m(g),
  })).sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity));
  return {
    clase: 'pivote', etiquetaFilas: nombreDe(ctx, spec.variable), columnas, filas: filasP,
    totales: columnas.map(c => m(enColumna(filas, c))), total: m(filas), etiquetaValor: etiquetaMedida(spec, ctx),
  };
}

// ── Resultado y tabla de datos ──

export type Resultado = ResultadoPareto | ResultadoComparativo | ResultadoHistograma | ResultadoDispersion | ResultadoCorrida | ResultadoControl | ResultadoCaja | ResultadoPivote;

export function calcular(filas: Fila[], spec: Spec, ctx: Contexto): Resultado | null {
  const datos = aplicarFiltros(filas, spec.filtros, ctx);
  switch (spec.tipo) {
    case 'pareto': return spec.estrato ? calcularComparativo(datos, spec, ctx) : calcularPareto(datos, spec, ctx);
    case 'pareto_eventos': return spec.estrato ? calcularComparativo(datos, { ...spec, variable: CAMPO_EVENTOS }, ctx) : calcularPareto(datos, { ...spec, variable: CAMPO_EVENTOS }, ctx);
    case 'pareto_etapas': return calcularEtapas(datos, spec, ctx);
    case 'pareto_comparativo': return calcularComparativo(datos, spec, ctx);
    case 'histograma': return calcularHistograma(datos, spec, ctx);
    case 'dispersion': return calcularDispersion(datos, spec, ctx);
    case 'corrida': return calcularCorrida(datos, spec, ctx);
    case 'control': return calcularControl(datos, spec, ctx);
    case 'caja': return calcularCaja(datos, spec, ctx);
    case 'pivote': return calcularPivote(datos, spec, ctx);
  }
}

export interface TablaDatos { columnas: string[]; filas: (string | number)[][] }

const f1 = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? '' : formatoNumero(v, d));

export function tablaDatos(r: Resultado, t: Traductor, formatoX: (v: number) => string = v => f1(v)): TablaDatos {
  switch (r.clase) {
    case 'pareto':
      return {
        columnas: [t('graficos.grupo'), r.etiquetaValor, t('graficos.n'), ...(r.aditiva ? [t('graficos.acumulado')] : [])],
        filas: r.barras.map(b => [b.etiqueta, f1(b.valor), b.n, ...(r.aditiva ? [`${f1(b.acumulado, 1)}%`] : [])]),
      };
    case 'comparativo':
      return {
        columnas: [t('graficos.grupo'), t('constructor.variable'), r.paneles[0]?.pareto.etiquetaValor ?? '', t('graficos.n')],
        filas: r.paneles.flatMap(p => p.pareto.barras.map(b => [p.titulo, b.etiqueta, f1(b.valor), b.n])),
      };
    case 'histograma':
      return {
        columnas: [r.etiquetaX, ...r.series.map(s => s.etiqueta)],
        filas: r.bordes.slice(0, -1).map((b, i) => [t('graficos.rango', { a: formatoX(b), b: formatoX(r.bordes[i + 1]!) }), ...r.series.map(s => s.conteos[i] ?? 0)]),
      };
    case 'dispersion':
      return {
        columnas: [t('graficos.solicitud'), r.etiquetaX, r.etiquetaY, ...(r.grupos.length ? [t('graficos.grupo')] : [])],
        filas: r.puntos.map(p => [p.id, f1(p.x), f1(p.y), ...(r.grupos.length ? [r.grupos[p.grupo] ?? ''] : [])]),
      };
    case 'corrida':
      return { columnas: ['#', t('graficos.solicitud'), r.etiquetaY], filas: r.valores.map((p, i) => [i + 1, p.id, f1(p.v)]) };
    case 'control':
      return {
        columnas: [t('graficos.periodo'), t('graficos.media'), t('graficos.n'), 'LCI', 'LCS', t('graficos.fueraControl')],
        filas: r.puntos.map(p => [p.periodo, f1(p.media), p.n, f1(p.lci), f1(p.lcs), p.fuera || p.racha ? t('comun.si') : t('comun.no')]),
      };
    case 'caja':
      return {
        columnas: [t('graficos.grupo'), t('graficos.n'), t('graficos.minimo'), t('graficos.q1'), t('graficos.mediana'), t('graficos.q3'), t('graficos.maximo')],
        filas: r.cajas.map(c => [c.grupo, c.n, f1(c.min), f1(c.q1), f1(c.mediana), f1(c.q3), f1(c.max)]),
      };
    case 'pivote':
      return {
        columnas: [r.etiquetaFilas, ...r.columnas, t('medidas.total')],
        filas: r.filas.map(f => [f.grupo, ...f.valores.map(v => f1(v)), f1(f.total)]),
      };
  }
}

// ── Títulos y registro ──

export function tituloSpec(spec: Spec, ctx: Contexto): string {
  const t = ctx.t;
  const tipo = t(`graficos.${spec.tipo}.nombre`);
  if (spec.tipo === 'pareto_etapas' || spec.tipo === 'pareto_eventos') {
    return spec.estrato ? `${tipo} ${t('constructor.porEstrato', { estrato: nombreDe(ctx, spec.estrato).toLowerCase() })}` : tipo;
  }
  if (spec.tipo === 'dispersion') return `${nombreDe(ctx, spec.variableY)} vs. ${nombreDe(ctx, spec.variable).toLowerCase()}`;
  let base = t('constructor.tituloGrafico', { tipo, variable: nombreDe(ctx, spec.variable).toLowerCase() });
  if (['pareto', 'pareto_comparativo', 'pivote'].includes(spec.tipo) && spec.medida !== 'conteo') {
    base = `${base} · ${etiquetaMedida(spec, ctx).toLowerCase()}`;
  }
  if (spec.estrato && spec.tipo !== 'histograma') base = `${base} ${t('constructor.porEstrato', { estrato: nombreDe(ctx, spec.estrato).toLowerCase() })}`;
  return base;
}

// Herramienta con que se registra el análisis, compatible con los hitos del método
export function herramientaDe(tipo: TipoGrafico): string {
  switch (tipo) {
    case 'pareto': case 'pareto_eventos': case 'pareto_etapas': case 'pareto_comparativo': return 'pareto';
    case 'histograma': return 'histograma';
    case 'dispersion': return 'dispersion';
    case 'corrida': return 'diagrama_corrida';
    case 'control': return 'carta_control';
    case 'caja': return 'caja';
    case 'pivote': return 'tabla_dinamica';
  }
}

// Columnas que intervienen en un análisis, para las verificaciones del modo completo
export function columnasDe(spec: Spec): string[] {
  const variable = spec.tipo === 'pareto_eventos' ? CAMPO_EVENTOS : spec.tipo === 'pareto_etapas' ? 'ventanaCaptura' : spec.variable;
  return [...new Set([variable, spec.variableY, necesitaCampoMedida(spec.medida) ? spec.campoMedida : '', spec.estrato, ...spec.filtros.map(f => f.campo)].filter(Boolean))];
}
