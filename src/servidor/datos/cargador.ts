import * as path from 'path';
import * as fs from 'fs';
import { cargarSolicitudes, cargarComentarios } from './parseo.js';
import { calcularDerivados, calcularEstadisticas } from './derivados.js';
import type { SolicitudDerivada, EstadisticasVerificacion } from './derivados.js';
import type { ComentarioCliente } from './parseo.js';
import { RAIZ } from '../raiz.js';

const DATOS_DIR = path.join(RAIZ, 'datos');
// Generado en el build (scripts/precalcular-datos.ts) para no parsear los Excel en cada arranque
export const RUTA_PRECALCULADOS = path.join(RAIZ, 'dist', 'datos-precalculados.json');

export interface DatosCargados {
  solicitudes: SolicitudDerivada[];
  comentarios: ComentarioCliente[];
  estadisticas: EstadisticasVerificacion;
  verdadOculta: Record<string, unknown>;
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// JSON convierte las fechas inválidas del Excel en null; se marcan para restaurarlas tal cual
const FECHA_INVALIDA = '__fecha_invalida__';

export function serializarDatos(datos: DatosCargados): string {
  return JSON.stringify(datos, function (this: Record<string, unknown>, clave, valor) {
    const original = this[clave];
    return original instanceof Date && Number.isNaN(original.getTime()) ? FECHA_INVALIDA : valor;
  });
}

export function deserializarDatos(texto: string): DatosCargados {
  return JSON.parse(texto, (_clave, valor) => {
    if (valor === FECHA_INVALIDA) return new Date(NaN);
    return typeof valor === 'string' && FECHA_ISO.test(valor) ? new Date(valor) : valor;
  });
}

export function cargarTodo(): DatosCargados {
  if (fs.existsSync(RUTA_PRECALCULADOS)) {
    return deserializarDatos(fs.readFileSync(RUTA_PRECALCULADOS, 'utf-8'));
  }
  return cargarDesdeExcel();
}

export function cargarDesdeExcel(): DatosCargados {
  const solicitudesCrudas = cargarSolicitudes(
    path.join(DATOS_DIR, 'R2_MX_ETF_Bank_Causal_Analysis_MBA.xlsx')
  );
  const solicitudes = calcularDerivados(solicitudesCrudas);
  const comentarios = cargarComentarios(
    path.join(DATOS_DIR, 'R2_ETF_Bank_Comentarios_Clientes.xlsx')
  );
  const estadisticas = calcularEstadisticas(solicitudes);

  const verdadOculta = JSON.parse(
    fs.readFileSync(path.join(DATOS_DIR, 'R2_verdad_oculta.json'), 'utf-8')
  );

  return { solicitudes, comentarios, estadisticas, verdadOculta };
}
