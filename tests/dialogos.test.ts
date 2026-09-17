import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const DIR = path.resolve('datos/dialogos');
const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));

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
      const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));

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
      const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
      expect(nodos.length).toBeGreaterThanOrEqual(12);
    }
  });

  it('Cada asesor tiene apertura en ciclo 1', () => {
    const asesores = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego'];
    for (const asesor of asesores) {
      const ruta = path.join(DIR, `${asesor}.json`);
      const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
      const apertura = nodos.find((n) => n.ciclo === 1 && n.fase === 'apertura');
      expect(apertura).toBeDefined();
    }
  });

  it('Las lineas tienen maximo 3 frases por turno', () => {
    const violaciones: string[] = [];

    for (const archivo of archivos) {
      const ruta = path.join(DIR, archivo);
      const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));

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
      const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
      for (const nodo of nodos) {
        todosIds.push(nodo.id);
      }
    }

    const duplicados = todosIds.filter((id, i) => todosIds.indexOf(id) !== i);
    expect(duplicados).toEqual([]);
  });

  it('Ramon Betancourt tiene dialogos de retro y destitucion', () => {
    const ruta = path.join(DIR, 'ramon.json');
    const nodos: NodoDialogo[] = JSON.parse(fs.readFileSync(ruta, 'utf-8'));

    expect(nodos.find((n) => n.fase === 'retro')).toBeDefined();
    expect(nodos.find((n) => n.fase === 'destitucion')).toBeDefined();
    expect(nodos.find((n) => n.fase === 'vida_perdida')).toBeDefined();
  });
});
