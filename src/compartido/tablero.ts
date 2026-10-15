// Tablero del equipo: gráficos fijados desde el constructor y los textos del A3.
// Se guarda la especificación de cada gráfico, no la imagen, y se vuelve a dibujar con los datos de la sesión.

export const SECCIONES_A3 = ['situacion', 'analisis', 'seguimiento'] as const;
export type SeccionA3 = typeof SECCIONES_A3[number];
export const TEXTOS_A3 = ['antecedentes', 'meta', 'propuesta', 'plan'] as const;
export type TextoA3 = typeof TEXTOS_A3[number];

export interface GraficoTablero {
  id: string;
  spec: Record<string, unknown>;
  titulo: string;
  conclusion: string;
  seccion: SeccionA3;
}

export interface Tablero {
  graficos: GraficoTablero[];
  textos: Record<TextoA3, string>;
}

export const MAX_GRAFICOS = 40;
const MAX_TITULO = 160;
const MAX_CONCLUSION = 400;
const MAX_TEXTO = 2000;
const MAX_SPEC = 8000;

export function tableroVacio(): Tablero {
  return { graficos: [], textos: { antecedentes: '', meta: '', propuesta: '', plan: '' } };
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

// Limpia lo que llega del navegador: tamaños acotados y solo campos conocidos
export function normalizarTablero(entrada: unknown): Tablero {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const textosEntrada = (e['textos'] && typeof e['textos'] === 'object' ? e['textos'] : {}) as Record<string, unknown>;
  const graficos = (Array.isArray(e['graficos']) ? e['graficos'] : []).slice(0, MAX_GRAFICOS).flatMap((g): GraficoTablero[] => {
    if (!g || typeof g !== 'object') return [];
    const x = g as Record<string, unknown>;
    const spec = x['spec'] && typeof x['spec'] === 'object' ? (x['spec'] as Record<string, unknown>) : null;
    if (!spec || JSON.stringify(spec).length > MAX_SPEC) return [];
    const seccion = SECCIONES_A3.includes(x['seccion'] as SeccionA3) ? (x['seccion'] as SeccionA3) : 'analisis';
    return [{ id: texto(x['id'], 40) || Math.random().toString(36).slice(2, 10), spec, titulo: texto(x['titulo'], MAX_TITULO), conclusion: texto(x['conclusion'], MAX_CONCLUSION), seccion }];
  });
  const textos = Object.fromEntries(TEXTOS_A3.map(k => [k, texto(textosEntrada[k], MAX_TEXTO)])) as Tablero['textos'];
  return { graficos, textos };
}
