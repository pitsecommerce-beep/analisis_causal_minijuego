// Diálogos de los asesores con cifras de la base activa.
// Las líneas pueden traer marcadores {{variable}} y condiciones: si la cifra no aplica a la base,
// se usa la versión alternativa o la línea se omite. Los marcadores nunca llegan a la pantalla.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RAIZ } from '../raiz.js';
import type { NodoDialogo } from './motor-dialogos.js';
import type { DatosCargados } from '../datos/cargador.js';
import type { ClaveDatos, Idioma } from '../../compartido/configuracion.js';

export const PERSONAJES_DIALOGO = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego', 'ramon'];

// Línea condicional: "texto" si la variable "si" aplica a la base; si no, "sino" (u omitida)
export interface LineaCondicional { si: string; texto: string; sino?: string }
type LineaCruda = string | LineaCondicional;
type NodoCrudo = Omit<NodoDialogo, 'lineas'> & { lineas: LineaCruda[] };

export interface VariablesDialogo {
  valores: Record<string, string>;
  // Variables cuya cifra aplica a la base activa
  activas: Set<string>;
}

const dirDialogos = (idioma: Idioma) => path.join(RAIZ, 'datos', 'dialogos', ...(idioma === 'en' ? ['en'] : []));

export function leerDialogosCrudos(idioma: Idioma): Record<string, NodoCrudo[]> {
  return Object.fromEntries(PERSONAJES_DIALOGO.map((p) => [p, JSON.parse(fs.readFileSync(path.join(dirDialogos(idioma), `${p}.json`), 'utf-8'))]));
}

function sustituir(texto: string, v: VariablesDialogo): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    if (!(k in v.valores)) throw new Error(`Variable de diálogo sin valor: ${k}`);
    return v.valores[k]!;
  });
}

export function resolverLineas(lineas: LineaCruda[], v: VariablesDialogo): string[] {
  return lineas.flatMap((l) => {
    if (typeof l === 'string') return [sustituir(l, v)];
    const texto = v.activas.has(l.si) ? l.texto : l.sino;
    return texto == null ? [] : [sustituir(texto, v)];
  });
}

export function resolverDialogos(crudos: Record<string, NodoCrudo[]>, v: VariablesDialogo): Record<string, NodoDialogo[]> {
  return Object.fromEntries(Object.entries(crudos).map(([p, nodos]) => [p, nodos.map((n) => ({
    ...n,
    lineas: resolverLineas(n.lineas, v),
    ...(n.pendiente ? { pendiente: sustituir(n.pendiente, v) } : {}),
    respuestas: n.respuestas.map((r) => ({ ...r, texto: sustituir(r.texto, v) })),
  }))]));
}

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  if (o.length === 0) return NaN;
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
};
const fmt = (n: number, idioma: Idioma) => n.toLocaleString(idioma === 'en' ? 'en-US' : 'es-MX', { maximumFractionDigits: 1 });

// Cifras que citan los asesores, calculadas de la base. En R2 reproducen los textos originales del simulador.
export function variablesDialogo(clave: ClaveDatos, datos: DatosCargados, idioma: Idioma): VariablesDialogo {
  const e = datos.estadisticas;
  const r2 = clave === 'R2';
  const porSucursal = new Map<number, number>();
  for (const s of datos.solicitudes) porSucursal.set(s.branchNum, (porSucursal.get(s.branchNum) ?? 0) + s.erroresPorCaso);
  const ranking = [...porSucursal.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => String(s));
  const tipos = [e.erroresCaptura, e.erroresIncompletos, e.erroresIlegibles].sort((a, b) => b - a);
  const pctCaptura = e.erroresTotales ? (e.erroresCaptura / e.erroresTotales) * 100 : 0;
  const fraccion = Math.abs(pctCaptura - 50) <= 3
    ? (idioma === 'en' ? 'Half' : 'La mitad')
    : pctCaptura >= 38 && pctCaptura < 50
      ? (idioma === 'en' ? 'Almost half' : 'Casi la mitad')
      : `${idioma === 'en' ? '' : 'El '}${Math.round(pctCaptura)}%`;
  const backOffice = datos.solicitudes
    .filter((s) => s.datePlasticSent && !Number.isNaN(s.datePlasticSent.getTime()))
    .map((s) => Math.round((s.datePlasticSent!.getTime() - s.dateLastInput.getTime()) / 86_400_000));

  const valores: Record<string, string> = {
    atorados: fmt(e.atorados, idioma),
    num_sucursales: String(e.sucursales),
    top3_a: ranking[0] ?? '', top3_b: ranking[1] ?? '', top3_c: ranking[2] ?? '',
    top2_a: ranking[0] ?? '', top2_b: ranking[1] ?? '',
    pct_top3: String(Math.round(e.pctErroresTop3)),
    fraccion_captura: fraccion,
    // En R2 Bernardo compara medianas que coinciden: es una afirmación cierta pero engañosa
    med_captura: r2 ? '11' : fmt(e.ventanaCapturaMediana, idioma),
    med_backoffice: r2 ? '11' : fmt(mediana(backOffice), idioma),
  };
  const activas = new Set<string>(['fraccion_captura', 'top2']);
  if (r2) for (const k of ['atorados', 'num_sucursales', 'top3', 'medianas_iguales']) activas.add(k);
  if (tipos[0] === e.erroresCaptura && tipos[0]! >= 1.3 * (tipos[1] ?? 0)) activas.add('captura_por_mucho');
  return { valores, activas };
}

// Lo que dicen los asesores en la Sala de Juntas de solo lectura: las afirmaciones del primer ciclo
export const NODOS_TESTIMONIO = [
  'bernardo_c1_apertura', 'oscar_c1_apertura', 'paulina_c1_apertura', 'silvia_c1_apertura',
  'diego_c1_apertura', 'diego_c1_segundo', 'diego_c1_tercero',
];

export function testimonios(dialogos: Record<string, NodoDialogo[]>) {
  return NODOS_TESTIMONIO.flatMap((id) => {
    const n = Object.values(dialogos).flat().find((x) => x.id === id);
    return n && n.lineas.length ? [{ personaje: n.personaje, nodoId: n.id, expresion: n.expresion, lineas: n.lineas, afirmacion: n.afirmacion ?? null, respuestas: [] }] : [];
  });
}
