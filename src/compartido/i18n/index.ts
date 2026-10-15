import { es } from './es.js';
import { en } from './en.js';
import type { Diccionario } from './es.js';
import type { Idioma } from '../configuracion.js';

export type { Diccionario };
export const DICCIONARIOS: Record<Idioma, Diccionario> = { es, en };

export type Traductor = (clave: string, vars?: Record<string, string | number>) => string;

// Busca la clave con puntos ("graficos.pareto.nombre") y sustituye {variables}
export function traductor(idioma: Idioma): Traductor {
  const dic = DICCIONARIOS[idioma] as unknown as Record<string, unknown>;
  return (clave, vars) => {
    let v: unknown = dic;
    for (const parte of clave.split('.')) v = (v as Record<string, unknown> | undefined)?.[parte];
    if (typeof v !== 'string') return clave;
    return vars ? v.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : v;
  };
}

export const LOCALES: Record<Idioma, string> = { es: 'es-MX', en: 'en-US' };
