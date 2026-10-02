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

// Eventos que aparecen en el texto libre de la columna Comments
export const EVENTOS_COMENTARIO: { etiqueta: string; patron: RegExp; esError: boolean }[] = [
  { etiqueta: 'input error', patron: /input error/gi, esError: true },
  { etiqueta: 'incomplete documents', patron: /incomplete/gi, esError: true },
  { etiqueta: 'illegible document', patron: /illegible|ilegible/gi, esError: true },
  { etiqueta: 'bureau rejected', patron: /bureau rejected/gi, esError: false },
  { etiqueta: 'score rejected', patron: /score rejected/gi, esError: false },
  { etiqueta: 'authorized', patron: /authori[sz]ed/gi, esError: false },
];

export const COLUMNAS_CALCULADAS: Columna[] = [
  { campo: 'ventanaCaptura', nombre: 'Días de captura (calculado)', tipo: 'numero', calculada: true },
  { campo: 'erroresComentario', nombre: 'Errores en comentarios (calculado)', tipo: 'numero', calculada: true },
];

function contarCoincidencias(texto: string, patron: RegExp): number {
  return texto.match(patron)?.length ?? 0;
}

// Agrega a cada solicitud las columnas calculadas que no vienen en el archivo original
export function agregarCalculadas(filas: Fila[]): Fila[] {
  return filas.map(f => {
    const inicio = aNumero(f['dateFirstInput'], 'fecha');
    const fin = aNumero(f['dateLastInput'], 'fecha');
    const comentario = String(f['comments'] ?? '');
    const errores = EVENTOS_COMENTARIO
      .filter(e => e.esError)
      .reduce((s, e) => s + contarCoincidencias(comentario, e.patron), 0);
    return {
      ...f,
      ventanaCaptura: inicio != null && fin != null ? Math.round((fin - inicio) / MS_DIA) : null,
      erroresComentario: errores,
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

// Conteo por categoría. En Comments se cuentan los eventos mencionados en el texto.
export function contarCategorias(filas: Fila[], col: Columna): Categoria[] {
  const conteos = new Map<string, number>();
  if (col.campo === 'comments') {
    for (const f of filas) {
      const texto = String(f['comments'] ?? '');
      for (const e of EVENTOS_COMENTARIO) {
        const c = contarCoincidencias(texto, e.patron);
        if (c > 0) conteos.set(e.etiqueta, (conteos.get(e.etiqueta) ?? 0) + c);
      }
    }
  } else {
    for (const f of filas) {
      const v = f[col.campo];
      const etiqueta = v == null || v === '' ? '(vacío)' : col.tipo === 'fecha' ? formatoFecha(aNumero(v, 'fecha')) : String(v);
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
    const clave = v == null || v === '' ? '(vacío)' : grupo.tipo === 'fecha' ? formatoMes(aNumero(v, 'fecha')) : String(v);
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
  return new Date(ms).toLocaleDateString('es-MX', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatoMes(ms: number | null): string {
  if (ms == null) return '';
  return new Date(ms).toLocaleDateString('es-MX', { timeZone: 'UTC', month: 'short', year: 'numeric' });
}

export function formatoNumero(n: number, decimales = 2): string {
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? n.toLocaleString('es-MX') : n.toLocaleString('es-MX', { maximumFractionDigits: decimales });
}
