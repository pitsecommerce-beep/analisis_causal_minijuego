import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { cargarCombinacion } from '../src/servidor/datos/cargador.js';
import { leerDialogosCrudos, resolverDialogos, variablesDialogo, testimonios } from '../src/servidor/dialogos/textos.js';

const DIR = path.resolve('datos/dialogos');
const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
const R2 = cargarCombinacion('R2');
const resueltosR2 = resolverDialogos(leerDialogosCrudos('es'), variablesDialogo('R2', R2, 'es'));
// Nodos ya resueltos con las cifras de R2, como los recibe el modo completo
const leer = (archivo: string) => resueltosR2[archivo.replace('.json', '')] as unknown as NodoDialogo[];

const MULETILLAS_PROHIBIDAS = [
  'el dato duro es',
  'no es x, es y',
  'aquí está lo interesante',
  'déjame ser claro',
  'la realidad es que',
  'en pocas palabras',
  'lo que esto significa es',
  'y eso, director, es justamente el punto',
  'sinergia',
  'accionable',
  'robusto',
  'alinear',
  'holístico',
  'holistica',
];

interface NodoDialogo {
  id: string;
  personaje: string;
  ciclo: number;
  fase: string;
  lineas: string[];
  respuestas: { texto: string }[];
}

function extraerTextos(nodo: NodoDialogo): string[] {
  const textos = [...nodo.lineas];
  for (const r of nodo.respuestas) {
    textos.push(r.texto);
  }
  return textos;
}

describe('Dialogos', () => {
  it('No contienen muletillas prohibidas', () => {
    const violaciones: string[] = [];

    for (const archivo of archivos) {
      const ruta = path.join(DIR, archivo);
      const nodos: NodoDialogo[] = leer(path.basename(ruta));

      for (const nodo of nodos) {
        const textos = extraerTextos(nodo);
        for (const texto of textos) {
          const lower = texto.toLowerCase();
          for (const muletilla of MULETILLAS_PROHIBIDAS) {
            if (lower.includes(muletilla)) {
              violaciones.push(`${archivo}/${nodo.id}: "${muletilla}" en "${texto.substring(0, 80)}"`);
            }
          }
        }
      }
    }

    expect(violaciones).toEqual([]);
  });

  it('Cada asesor tiene al menos 12 nodos', () => {
    const asesores = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego'];
    for (const asesor of asesores) {
      const ruta = path.join(DIR, `${asesor}.json`);
      const nodos: NodoDialogo[] = leer(path.basename(ruta));
      expect(nodos.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('Cada asesor tiene apertura en ciclo 1', () => {
    const asesores = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego'];
    for (const asesor of asesores) {
      const ruta = path.join(DIR, `${asesor}.json`);
      const nodos: NodoDialogo[] = leer(path.basename(ruta));
      const apertura = nodos.find((n) => n.ciclo === 1 && n.fase === 'apertura');
      expect(apertura).toBeDefined();
    }
  });

  it('Las lineas tienen maximo 3 frases por turno', () => {
    const violaciones: string[] = [];

    for (const archivo of archivos) {
      const ruta = path.join(DIR, archivo);
      const nodos: NodoDialogo[] = leer(path.basename(ruta));

      for (const nodo of nodos) {
        if (nodo.lineas.length > 3) {
          violaciones.push(`${archivo}/${nodo.id}: ${nodo.lineas.length} lineas (max 3)`);
        }
      }
    }

    expect(violaciones).toEqual([]);
  });

  it('Todos los nodos tienen ID unico global', () => {
    const todosIds: string[] = [];

    for (const archivo of archivos) {
      const ruta = path.join(DIR, archivo);
      const nodos: NodoDialogo[] = leer(path.basename(ruta));
      for (const nodo of nodos) {
        todosIds.push(nodo.id);
      }
    }

    const duplicados = todosIds.filter((id, i) => todosIds.indexOf(id) !== i);
    expect(duplicados).toEqual([]);
  });

  it('Ramon Betancourt tiene dialogos de retro y destitucion', () => {
    const ruta = path.join(DIR, 'ramon.json');
    const nodos: NodoDialogo[] = leer(path.basename(ruta));

    expect(nodos.find((n) => n.fase === 'retro')).toBeDefined();
    expect(nodos.find((n) => n.fase === 'destitucion')).toBeDefined();
    expect(nodos.find((n) => n.fase === 'vida_perdida')).toBeDefined();
  });
});

describe('Diálogos parametrizados por base', () => {
  it('R2 muestra exactamente los mismos textos que antes de parametrizar', () => {
    let original: Record<string, NodoDialogo[]>;
    try {
      // Último commit con los diálogos escritos a mano
      original = Object.fromEntries(['bernardo', 'oscar', 'paulina', 'silvia', 'diego', 'ramon'].map((p) => [p,
        JSON.parse(execSync(`git show c9660f2:datos/dialogos/${p}.json`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString())]));
    } catch {
      return; // sin ese historial no hay contra qué comparar
    }
    for (const [p, nodos] of Object.entries(original)) {
      expect(resueltosR2[p]!.map((n) => [n.id, n.lineas, n.pendiente, n.respuestas.map((r) => r.texto)]))
        .toEqual(nodos.map((n: any) => [n.id, n.lineas, n.pendiente, n.respuestas.map((r: any) => r.texto)]));
    }
  });

  it('las bases originales no muestran marcadores ni cifras de R2', () => {
    for (const clave of ['A_es', 'B_es'] as const) {
      const d = cargarCombinacion(clave);
      const t = testimonios(resolverDialogos(leerDialogosCrudos('es'), variablesDialogo(clave, d, 'es')));
      expect(t.length).toBe(7);
      const texto = t.flatMap((x) => x.lineas).join(' ');
      expect(texto).not.toMatch(/\{\{|\}\}/);
      expect(texto).not.toMatch(/\b(142|728|18 sucursales|40%)\b/);
    }
  });

  it('cada base cita sus propias sucursales', () => {
    const linea = (clave: 'A_es' | 'B_es') => testimonios(resolverDialogos(leerDialogosCrudos('es'), variablesDialogo(clave, cargarCombinacion(clave), 'es')))
      .find((x) => x.nodoId === 'diego_c1_segundo')!.lineas.join(' ');
    expect(linea('A_es')).toContain('la 110 y la 676');
    expect(linea('B_es')).toContain('la 336 y la 637');
  });
});
