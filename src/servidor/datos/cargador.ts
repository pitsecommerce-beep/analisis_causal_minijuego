import * as path from 'path';
import * as fs from 'fs';
import { cargarSolicitudes, cargarComentarios } from './parseo.js';
import { calcularDerivados, calcularEstadisticas } from './derivados.js';
import type { SolicitudDerivada, EstadisticasVerificacion } from './derivados.js';
import type { ComentarioCliente } from './parseo.js';
import { CLAVES_DATOS } from '../../compartido/configuracion.js';
import type { ClaveDatos } from '../../compartido/configuracion.js';
import { RAIZ } from '../raiz.js';

const DATOS_DIR = path.join(RAIZ, 'datos');
const ORIGINAL_DIR = path.join(DATOS_DIR, 'original');
// Generado en el build (scripts/precalcular-datos.ts) para no parsear los Excel en cada arranque
export const RUTA_PRECALCULADOS = path.join(RAIZ, 'dist', 'datos-precalculados.json');

export interface DatosCargados {
  solicitudes: SolicitudDerivada[];
  comentarios: ComentarioCliente[];
  estadisticas: EstadisticasVerificacion;
  verdadOculta: Record<string, unknown>;
}

export type TodosLosDatos = Record<ClaveDatos, DatosCargados>;

// Archivos de cada combinación. La descarga de Excel entrega estos archivos tal cual.
export function rutaSolicitudes(clave: ClaveDatos): string {
  return clave === 'R2'
    ? path.join(DATOS_DIR, 'R2_MX_ETF_Bank_Causal_Analysis_MBA.xlsx')
    : path.join(ORIGINAL_DIR, `${clave}.xlsx`);
}

export function rutaComentarios(clave: ClaveDatos): string {
  return clave === 'R2'
    ? path.join(DATOS_DIR, 'R2_ETF_Bank_Comentarios_Clientes.xlsx')
    : path.join(ORIGINAL_DIR, `comentarios_${clave}.xlsx`);
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// JSON convierte las fechas inválidas del Excel en null; se marcan para restaurarlas tal cual
const FECHA_INVALIDA = '__fecha_invalida__';

export function serializarDatos(datos: unknown): string {
  return JSON.stringify(datos, function (this: Record<string, unknown>, clave, valor) {
    const original = this[clave];
    return original instanceof Date && Number.isNaN(original.getTime()) ? FECHA_INVALIDA : valor;
  });
}

export function deserializarDatos<T = TodosLosDatos>(texto: string): T {
  return JSON.parse(texto, (_clave, valor) => {
    if (valor === FECHA_INVALIDA) return new Date(NaN);
    return typeof valor === 'string' && FECHA_ISO.test(valor) ? new Date(valor) : valor;
  });
}

export function cargarTodo(): TodosLosDatos {
  if (fs.existsSync(RUTA_PRECALCULADOS)) {
    const datos = deserializarDatos<Partial<TodosLosDatos>>(fs.readFileSync(RUTA_PRECALCULADOS, 'utf-8'));
    // Un precalculado de una versión anterior (solo R2) se descarta
    if (CLAVES_DATOS.every((c) => datos[c])) return datos as TodosLosDatos;
  }
  return cargarDesdeExcel();
}

export function cargarCombinacion(clave: ClaveDatos): DatosCargados {
  const solicitudes = calcularDerivados(cargarSolicitudes(rutaSolicitudes(clave)), clave === 'R2' ? 'R2' : 'original');
  const rutaCom = rutaComentarios(clave);
  const comentarios = fs.existsSync(rutaCom) ? cargarComentarios(rutaCom) : [];
  const estadisticas = calcularEstadisticas(solicitudes);
  // La verdad oculta solo existe para la versión extendida, que es la única con motor de juego
  const verdadOculta = clave === 'R2'
    ? JSON.parse(fs.readFileSync(path.join(DATOS_DIR, 'R2_verdad_oculta.json'), 'utf-8'))
    : {};
  return { solicitudes, comentarios, estadisticas, verdadOculta };
}

export function cargarDesdeExcel(): TodosLosDatos {
  return Object.fromEntries(CLAVES_DATOS.map((c) => [c, cargarCombinacion(c)])) as TodosLosDatos;
}
