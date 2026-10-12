import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Raíz del proyecto (donde vive package.json). Funciona igual con tsx desde src/
// que con el servidor empaquetado en dist/servidor/.
function buscarRaiz(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const padre = path.dirname(dir);
    if (padre === dir) throw new Error('No se encontró package.json para ubicar la raíz del proyecto');
    dir = padre;
  }
  return dir;
}

export const RAIZ = buscarRaiz();
