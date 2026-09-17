import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NodoDialogo } from '../dialogos/motor-dialogos.js';

const DIR = path.resolve('datos/dialogos');
const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));

let totalNodos = 0;
let huerfanos = 0;
let sinSalida = 0;
let errores: string[] = [];

for (const archivo of archivos) {
  const ruta = path.join(DIR, archivo);
  const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
  const personaje = archivo.replace('.json', '');

  console.log(`\n=== ${personaje.toUpperCase()} (${nodos.length} nodos) ===`);
  totalNodos += nodos.length;

  const ids = new Set(nodos.map((n) => n.id));
  const ciclos = new Set(nodos.map((n) => n.ciclo));

  for (const nodo of nodos) {
    const prefijo = `  [${nodo.id}]`;
    const faseInfo = `ciclo=${nodo.ciclo} fase=${nodo.fase}`;
    const lineasCortas = nodo.lineas.map((l) => l.substring(0, 60) + (l.length > 60 ? '...' : ''));

    console.log(`${prefijo} ${faseInfo}`);
    for (const l of lineasCortas) {
      console.log(`    "${l}"`);
    }

    if (nodo.respuestas.length > 0) {
      for (const r of nodo.respuestas) {
        const req = r.requiere ? ` [requiere: ${r.requiere}]` : '';
        console.log(`    -> "${r.texto}" (${r.efecto}, cred: ${r.credibilidad})${req}`);
      }
    }

    if (nodo.condicion) {
      console.log(`    condicion: ${JSON.stringify(nodo.condicion)}`);
    }

    if (nodo.afirmacion) {
      console.log(`    afirmacion: ${nodo.afirmacion.id} (${nodo.afirmacion.veredicto})`);
    }
  }

  const aperturaPorCiclo = [1, 2, 3, 4].map((c) =>
    nodos.filter((n) => n.ciclo === c && n.fase === 'apertura')
  );

  for (let i = 0; i < aperturaPorCiclo.length; i++) {
    if (aperturaPorCiclo[i].length === 0 && personaje !== 'ramon') {
      const msg = `${personaje}: sin nodo de apertura para ciclo ${i + 1}`;
      errores.push(msg);
      huerfanos++;
    }
  }

  const nodosConRespuestas = nodos.filter(
    (n) => n.fase === 'apertura' || n.fase === 'segundo' || n.fase === 'tercero'
  );
  for (const n of nodosConRespuestas) {
    if (n.respuestas.length === 0 && n.fase === 'apertura' && n.ciclo !== 4) {
      const msg = `${personaje}: nodo ${n.id} (apertura) sin respuestas`;
      errores.push(msg);
      sinSalida++;
    }
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`RESUMEN`);
console.log(`  Archivos: ${archivos.length}`);
console.log(`  Nodos totales: ${totalNodos}`);
console.log(`  Huerfanos (sin apertura): ${huerfanos}`);
console.log(`  Sin salida: ${sinSalida}`);

if (errores.length > 0) {
  console.log(`\n  PROBLEMAS:`);
  for (const e of errores) {
    console.log(`    - ${e}`);
  }
  process.exit(1);
} else {
  console.log(`\n  Todo correcto.`);
}
