import * as fs from 'node:fs';
import * as path from 'node:path';
import { cargarDesdeExcel, serializarDatos, RUTA_PRECALCULADOS } from '../src/servidor/datos/cargador.js';

const datos = cargarDesdeExcel();
fs.mkdirSync(path.dirname(RUTA_PRECALCULADOS), { recursive: true });
fs.writeFileSync(RUTA_PRECALCULADOS, serializarDatos(datos));
const resumen = Object.entries(datos).map(([c, d]) => `${c}: ${d.solicitudes.length}`).join(', ');
console.log(`Datos precalculados (${resumen}) → ${RUTA_PRECALCULADOS}`);
