import * as fs from 'node:fs';
import * as path from 'node:path';
import { cargarDesdeExcel, serializarDatos, RUTA_PRECALCULADOS } from '../src/servidor/datos/cargador.js';

const datos = cargarDesdeExcel();
fs.mkdirSync(path.dirname(RUTA_PRECALCULADOS), { recursive: true });
fs.writeFileSync(RUTA_PRECALCULADOS, serializarDatos(datos));
console.log(`Datos precalculados: ${datos.solicitudes.length} solicitudes → ${RUTA_PRECALCULADOS}`);
