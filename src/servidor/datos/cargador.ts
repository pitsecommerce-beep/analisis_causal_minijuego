import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { cargarSolicitudes, cargarComentarios } from './parseo.js';
import { calcularDerivados, calcularEstadisticas } from './derivados.js';
import type { SolicitudDerivada, EstadisticasVerificacion } from './derivados.js';
import type { ComentarioCliente } from './parseo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATOS_DIR = path.resolve(__dirname, '../../../datos');

export interface DatosCargados {
  solicitudes: SolicitudDerivada[];
  comentarios: ComentarioCliente[];
  estadisticas: EstadisticasVerificacion;
  verdadOculta: Record<string, unknown>;
}

export function cargarTodo(): DatosCargados {
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
