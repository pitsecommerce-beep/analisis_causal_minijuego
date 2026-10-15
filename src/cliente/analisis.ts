import { contarEventos } from '../compartido/expediente.js';
import type { Vocabulario } from '../compartido/expediente.js';
// Cálculos de las herramientas de análisis de la pestaña Datos. Funciones puras para poder probarlas.

export type TipoColumna = 'numero' | 'texto' | 'fecha';

export interface Columna {
  campo: string;
  nombre: string;
  tipo: TipoColumna;
  calculada?: boolean;
}

export type Fila = Record<string, unknown>;

const MS_DIA = 86_400_000;

// Formato de números y fechas según el idioma de la sesión
let LOCALE = 'es-MX';
export function fijarLocale(locale: string) { LOCALE = locale; }
export function localeActual() { return LOCALE; }

// Columnas calculadas de cada tabla. El nombre visible sale del diccionario del idioma.
export const CAMPOS_CALCULADOS_SOLICITUDES: { campo: string; tipo: TipoColumna; soloOriginal?: boolean }[] = [
  { campo: 'ventanaCaptura', tipo: 'numero' },
  { campo: 'diasEnvioCrop', tipo: 'numero' },
  { campo: 'diasEnCrop', tipo: 'numero' },
  { campo: 'diasHastaBuro', tipo: 'numero' },
  { campo: 'diasTotales', tipo: 'numero' },
  { campo: 'erroresComentario', tipo: 'numero' },
  { campo: 'erroresCaptura', tipo: 'numero' },
  { campo: 'erroresIncompletos', tipo: 'numero' },
  { campo: 'erroresIlegibles', tipo: 'numero' },
  { campo: 'erroresOtros', tipo: 'numero', soloOriginal: true },
  { campo: 'tieneReproceso', tipo: 'texto' },
  { campo: 'mes', tipo: 'texto' },
  { campo: 'rechazoBuroTrasReproceso', tipo: 'texto' },
  { campo: 'aprobadaSinTarjeta', tipo: 'texto' },
  { campo: 'quejas', tipo: 'numero' },
  { campo: 'categoriaQueja', tipo: 'texto' },
];

// Datos de la solicitud que se agregan a cada comentario
export const CAMPOS_CALCULADOS_COMENTARIOS: { campo: string; tipo: TipoColumna; clave: string }[] = [
  { campo: 'mes', tipo: 'texto', clave: 'mesComentario' },
  { campo: 'solicitudVentanaCaptura', tipo: 'numero', clave: 'solicitudVentanaCaptura' },
  { campo: 'solicitudErrores', tipo: 'numero', clave: 'solicitudErrores' },
  { campo: 'solicitudUltimoEstatus', tipo: 'texto', clave: 'solicitudUltimoEstatus' },
];

export function columnasCalculadas(tabla: 'solicitudes' | 'comentarios', t: (c: string) => string, vocabulario: Vocabulario): Columna[] {
  if (tabla === 'comentarios') {
    return CAMPOS_CALCULADOS_COMENTARIOS.map(c => ({ campo: c.campo, tipo: c.tipo, nombre: t(`calculadas.${c.clave}`), calculada: true }));
  }
  return CAMPOS_CALCULADOS_SOLICITUDES
    .filter(c => !c.soloOriginal || vocabulario === 'original')
    .map(c => ({ campo: c.campo, tipo: c.tipo, nombre: t(`calculadas.${c.campo}`), calculada: true }));
}

// Mes en formato AAAA-MM; ordena bien como texto
export function claveMes(v: unknown): string | null {
  const t = aNumero(v, 'fecha');
  if (t == null) return null;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Cruza solicitudes y comentarios por número de solicitud, en ambos sentidos
export function cruzar(solicitudes: Fila[], comentarios: Fila[]): { solicitudes: Fila[]; comentarios: Fila[] } {
  const porSolicitud = new Map<number, Fila>();
  for (const s of solicitudes) porSolicitud.set(Number(s['applicationNum']), s);
  const quejas = new Map<number, Fila[]>();
  for (const c of comentarios) {
    const n = Number(c['solicitudNum']);
    quejas.set(n, [...(quejas.get(n) ?? []), c]);
  }
  return {
    solicitudes: solicitudes.map(s => {
      const qs = quejas.get(Number(s['applicationNum'])) ?? [];
      return { ...s, quejas: qs.length, categoriaQueja: qs[0]?.['categoriaPrimaria'] ?? null };
    }),
    comentarios: comentarios.map(c => {
      const s = porSolicitud.get(Number(c['solicitudNum']));
      return {
        ...c,
        mes: claveMes(c['fechaComentario']),
        solicitudVentanaCaptura: s?.['ventanaCaptura'] ?? null,
        solicitudErrores: s?.['erroresComentario'] ?? null,
        solicitudResultadoBuro: s?.['creditBureauResult'] ?? null,
        solicitudUltimoEstatus: s?.['lastStatus'] ?? null,
      };
    }),
  };
}

export function valoresEstrato(filas: Fila[], campo: string): string[] {
  const set = new Set<string>();
  for (const f of filas) {
    const v = f[campo];
    if (v != null && v !== '') set.add(String(v));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

export interface PuntoControl { mes: string; media: number; n: number; lcs: number; lci: number; fuera: boolean }
export interface CartaControl { centro: number; sigma: number; puntos: PuntoControl[] }

// Gráfica de control de medias por mes: línea central y límites a 3 sigmas ajustados al tamaño de cada mes
export function cartaControl(filas: Fila[], col: Columna): CartaControl | null {
  const grupos = new Map<string, number[]>();
  const todos: number[] = [];
  for (const f of filas) {
    const mes = typeof f['mes'] === 'string' ? f['mes'] : null;
    const v = aNumero(f[col.campo], col.tipo);
    if (!mes || v == null) continue;
    grupos.set(mes, [...(grupos.get(mes) ?? []), v]);
    todos.push(v);
  }
  const r = resumir(todos);
  if (!r || grupos.size === 0) return null;
  const puntos = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, vs]) => {
    const media = vs.reduce((a, b) => a + b, 0) / vs.length;
    const margen = (3 * r.desviacion) / Math.sqrt(vs.length);
    const lcs = r.media + margen;
    const lci = r.media - margen;
    return { mes, media, n: vs.length, lcs, lci, fuera: media > lcs || media < lci };
  });
  return { centro: r.media, sigma: r.desviacion, puntos };
}

const diasEntre = (f: Fila, desde: string, hasta: string): number | null => {
  const a = aNumero(f[desde], 'fecha');
  const b = aNumero(f[hasta], 'fecha');
  return a != null && b != null ? Math.round((b - a) / MS_DIA) : null;
};

// Agrega a cada solicitud las columnas calculadas que no vienen en el archivo original
export function agregarCalculadas(filas: Fila[], vocabulario: Vocabulario = 'R2'): Fila[] {
  return filas.map(f => {
    const ev = contarEventos(String(f['comments'] ?? ''), vocabulario);
    const errores = ev.captura + ev.incompletos + ev.ilegibles + (ev.otros ?? 0);
    const finCrop = aNumero(f['datePlasticSent'], 'fecha') != null ? 'datePlasticSent'
      : aNumero(f['etfbScoreDate'], 'fecha') != null ? 'etfbScoreDate' : 'creditBureauRunDate';
    const enviada = aNumero(f['datePlasticSent'], 'fecha') != null;
    return {
      ...f,
      ventanaCaptura: diasEntre(f, 'dateFirstInput', 'dateLastInput'),
      diasEnvioCrop: diasEntre(f, 'dateLastInput', 'dateDocsReceived'),
      diasEnCrop: diasEntre(f, 'dateDocsReceived', finCrop),
      diasHastaBuro: diasEntre(f, 'dateFirstInput', 'creditBureauRunDate'),
      diasTotales: diasEntre(f, 'dateFirstInput', 'datePlasticSent'),
      erroresComentario: errores,
      erroresCaptura: ev.captura,
      erroresIncompletos: ev.incompletos,
      erroresIlegibles: ev.ilegibles,
      ...(vocabulario === 'original' ? { erroresOtros: ev.otros ?? 0 } : {}),
      tieneReproceso: errores > 0,
      mes: claveMes(f['dateFirstInput']),
      rechazoBuroTrasReproceso: String(f['creditBureauResult'] ?? '').trim().toLowerCase() === 'rejected' && errores > 0,
      aprobadaSinTarjeta: String(f['etfBankScoreResult'] ?? '').trim().toLowerCase() === 'accepted' && !enviada,
    };
  });
}

// Convierte un valor a número. Las fechas se expresan en milisegundos.
export function aNumero(v: unknown, tipo: TipoColumna): number | null {
  if (v == null || v === '') return null;
  if (tipo === 'fecha') {
    const t = new Date(String(v)).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function valoresNumericos(filas: Fila[], col: Columna): number[] {
  const out: number[] = [];
  for (const f of filas) {
    const n = aNumero(f[col.campo], col.tipo);
    if (n != null) out.push(n);
  }
  return out;
}

export function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return NaN;
  const i = (ordenados.length - 1) * p;
  const bajo = Math.floor(i);
  const alto = Math.ceil(i);
  return ordenados[bajo]! + (ordenados[alto]! - ordenados[bajo]!) * (i - bajo);
}

export interface Resumen {
  n: number;
  media: number;
  mediana: number;
  desviacion: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
}

export function resumir(nums: number[]): Resumen | null {
  if (nums.length === 0) return null;
  const ord = [...nums].sort((a, b) => a - b);
  const media = nums.reduce((a, b) => a + b, 0) / nums.length;
  const varianza = nums.length > 1 ? nums.reduce((s, v) => s + (v - media) ** 2, 0) / (nums.length - 1) : 0;
  return {
    n: nums.length,
    media,
    mediana: percentil(ord, 0.5),
    desviacion: Math.sqrt(varianza),
    p10: percentil(ord, 0.1),
    p90: percentil(ord, 0.9),
    min: ord[0]!,
    max: ord[ord.length - 1]!,
  };
}

export interface Contenedor { desde: number; hasta: number; conteo: number }

// Histograma con intervalos de ancho "redondo" según la regla de Sturges
export function histograma(nums: number[], esFecha = false): Contenedor[] {
  if (nums.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const n of nums) { if (n < min) min = n; if (n > max) max = n; }
  if (esFecha) {
    // Agrupación mensual para fechas
    const meses = new Map<number, number>();
    for (const n of nums) {
      const d = new Date(n);
      const clave = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      meses.set(clave, (meses.get(clave) ?? 0) + 1);
    }
    return [...meses.entries()].sort((a, b) => a[0] - b[0]).map(([desde, conteo]) => {
      const d = new Date(desde);
      return { desde, hasta: Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1), conteo };
    });
  }
  if (min === max) return [{ desde: min, hasta: max + 1, conteo: nums.length }];
  const k = Math.min(30, Math.max(6, Math.ceil(Math.log2(nums.length) + 1)));
  const crudo = (max - min) / k;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const ancho = [1, 2, 2.5, 5, 10].map(m => m * potencia).find(w => w >= crudo) ?? crudo;
  const inicio = Math.floor(min / ancho) * ancho;
  const total = Math.max(1, Math.ceil((max - inicio) / ancho + 1e-9));
  const bins: Contenedor[] = Array.from({ length: total }, (_, i) => ({ desde: inicio + i * ancho, hasta: inicio + (i + 1) * ancho, conteo: 0 }));
  for (const n of nums) {
    const i = Math.min(total - 1, Math.floor((n - inicio) / ancho));
    bins[i]!.conteo++;
  }
  return bins;
}

export interface Categoria { etiqueta: string; conteo: number }

// Conteo por categoría. En la bitácora se cuentan los eventos mencionados en el texto.
export function contarCategorias(filas: Fila[], col: Columna, vocabulario: Vocabulario = 'R2', sinDato = 'Sin dato'): Categoria[] {
  const conteos = new Map<string, number>();
  if (col.campo === 'comments') {
    for (const f of filas) {
      for (const [tipo, c] of Object.entries(contarEventos(String(f['comments'] ?? ''), vocabulario))) {
        if (c > 0) conteos.set(tipo, (conteos.get(tipo) ?? 0) + c);
      }
    }
  } else {
    for (const f of filas) {
      const v = f[col.campo];
      const etiqueta = v == null || v === '' ? sinDato : col.tipo === 'fecha' ? formatoFecha(aNumero(v, 'fecha')) : String(v);
      conteos.set(etiqueta, (conteos.get(etiqueta) ?? 0) + 1);
    }
  }
  return [...conteos.entries()]
    .map(([etiqueta, conteo]) => ({ etiqueta, conteo }))
    .sort((a, b) => b.conteo - a.conteo || a.etiqueta.localeCompare(b.etiqueta));
}

export interface BarraPareto extends Categoria { pct: number; acumulado: number }

export function pareto(categorias: Categoria[], maximo = 15): BarraPareto[] {
  const total = categorias.reduce((s, c) => s + c.conteo, 0);
  if (total === 0) return [];
  let visibles = categorias.slice(0, maximo);
  const resto = categorias.slice(maximo).reduce((s, c) => s + c.conteo, 0);
  if (resto > 0) visibles = [...visibles, { etiqueta: 'Otros', conteo: resto }];
  let acumulado = 0;
  return visibles.map(c => {
    acumulado += c.conteo;
    return { ...c, pct: (c.conteo / total) * 100, acumulado: (acumulado / total) * 100 };
  });
}

export function correlacion(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]!; sy += ys[i]!; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx, dy = ys[i]! - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return dx2 === 0 || dy2 === 0 ? NaN : num / Math.sqrt(dx2 * dy2);
}

export function pares(filas: Fila[], x: Columna, y: Columna): { x: number; y: number; fila: Fila }[] {
  const out: { x: number; y: number; fila: Fila }[] = [];
  for (const f of filas) {
    const vx = aNumero(f[x.campo], x.tipo);
    const vy = aNumero(f[y.campo], y.tipo);
    if (vx != null && vy != null) out.push({ x: vx, y: vy, fila: f });
  }
  return out;
}

export interface FilaPivote { grupo: string; conteo: number; pct: number; suma: number | null; promedio: number | null }

export function pivote(filas: Fila[], grupo: Columna, valor: Columna | null, maximo = 25): FilaPivote[] {
  const mapa = new Map<string, { conteo: number; suma: number; n: number }>();
  for (const f of filas) {
    const v = f[grupo.campo];
    const clave = v == null || v === '' ? 'Sin dato' : grupo.tipo === 'fecha' ? formatoMes(aNumero(v, 'fecha')) : String(v);
    const acc = mapa.get(clave) ?? { conteo: 0, suma: 0, n: 0 };
    acc.conteo++;
    if (valor) {
      const n = aNumero(f[valor.campo], valor.tipo);
      if (n != null) { acc.suma += n; acc.n++; }
    }
    mapa.set(clave, acc);
  }
  const total = filas.length || 1;
  return [...mapa.entries()]
    .map(([g, a]) => ({
      grupo: g,
      conteo: a.conteo,
      pct: (a.conteo / total) * 100,
      suma: valor ? a.suma : null,
      promedio: valor && a.n > 0 ? a.suma / a.n : null,
    }))
    .sort((a, b) => (valor ? (b.suma ?? 0) - (a.suma ?? 0) : 0) || b.conteo - a.conteo)
    .slice(0, maximo);
}

export function formatoFecha(ms: number | null): string {
  if (ms == null) return '';
  return new Date(ms).toLocaleDateString(LOCALE, { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatoMes(ms: number | null): string {
  if (ms == null) return '';
  return new Date(ms).toLocaleDateString(LOCALE, { timeZone: 'UTC', month: 'short', year: 'numeric' });
}

export function formatoNumero(n: number, decimales = 2): string {
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? n.toLocaleString(LOCALE) : n.toLocaleString(LOCALE, { maximumFractionDigits: decimales });
}

// ── Vista del proceso (Anexo 1) ──

export type ActorProceso = 'cliente' | 'sucursal' | 'crop';

export interface EtapaProceso {
  id: string;
  actor: ActorProceso;
  // Fechas de la base que delimitan la etapa; sin ellas la etapa no tiene registro de tiempo
  desde?: string;
  hasta?: string;
}

// Nombres y notas de cada etapa y actor: diccionario del idioma, sección "proceso"
export const ACTORES_PROCESO: { id: ActorProceso }[] = [{ id: 'cliente' }, { id: 'sucursal' }, { id: 'crop' }];

export const ETAPAS_PROCESO: EtapaProceso[] = [
  { id: 'visita', actor: 'cliente' },
  { id: 'documentos', actor: 'cliente' },
  { id: 'captura', actor: 'sucursal', desde: 'dateFirstInput', hasta: 'dateLastInput' },
  { id: 'envio', actor: 'sucursal', desde: 'dateLastInput', hasta: 'dateDocsReceived' },
  { id: 'revision', actor: 'crop', desde: 'dateDocsReceived', hasta: 'creditBureauRunDate' },
  { id: 'buro', actor: 'crop' },
  { id: 'score', actor: 'crop', desde: 'creditBureauRunDate', hasta: 'etfbScoreDate' },
  { id: 'linea', actor: 'crop' },
  { id: 'tarjeta', actor: 'crop', desde: 'etfbScoreDate', hasta: 'datePlasticSent' },
  { id: 'recibe', actor: 'cliente' },
];

// Días que tarda cada solicitud en una etapa; solo cuenta registros con ambas fechas
export function duracionesEtapa(filas: Fila[], etapa: EtapaProceso): number[] {
  if (!etapa.desde || !etapa.hasta) return [];
  const out: number[] = [];
  for (const f of filas) {
    const a = aNumero(f[etapa.desde], 'fecha');
    const b = aNumero(f[etapa.hasta], 'fecha');
    if (a != null && b != null) out.push(Math.round((b - a) / MS_DIA));
  }
  return out;
}
