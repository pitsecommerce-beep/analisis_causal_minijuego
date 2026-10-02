import { describe, it, expect } from 'vitest';
import {
  agregarCalculadas, contarCategorias, correlacion, histograma, pareto, pivote, resumir, valoresNumericos,
} from '../src/cliente/analisis.js';
import type { Columna } from '../src/cliente/analisis.js';

const comentarios: Columna = { campo: 'comments', nombre: 'Comments', tipo: 'texto' };
const sucursal: Columna = { campo: 'branchNum', nombre: 'Branch #', tipo: 'numero' };
const ventana: Columna = { campo: 'ventanaCaptura', nombre: 'Días de captura', tipo: 'numero' };
const errores: Columna = { campo: 'erroresComentario', nombre: 'Errores', tipo: 'numero' };

const filas = agregarCalculadas([
  { branchNum: 110, dateFirstInput: '2015-06-01T00:00:00.000Z', dateLastInput: '2015-06-11T00:00:00.000Z', comments: '5 jun input error. 8 jun input error. 10 jun Bureau Rejected.' },
  { branchNum: 110, dateFirstInput: '2015-06-01T00:00:00.000Z', dateLastInput: '2015-06-03T00:00:00.000Z', comments: '2 jun incomplete documents' },
  { branchNum: 453, dateFirstInput: '2015-06-08T00:00:00.000Z', dateLastInput: '2015-06-08T00:00:00.000Z', comments: '12 jun authorized for loan' },
]);

describe('Herramientas de análisis', () => {
  it('calcula los días de captura y los errores de cada comentario', () => {
    expect(filas.map(f => f['ventanaCaptura'])).toEqual([10, 2, 0]);
    expect(filas.map(f => f['erroresComentario'])).toEqual([2, 1, 0]);
  });

  it('cuenta los eventos mencionados en Comments en lugar del texto completo', () => {
    const cats = contarCategorias(filas, comentarios);
    expect(cats[0]).toEqual({ etiqueta: 'input error', conteo: 2 });
    expect(cats.map(c => c.etiqueta)).toContain('bureau rejected');
  });

  it('el Pareto termina en 100% acumulado', () => {
    const barras = pareto(contarCategorias(filas, sucursal));
    expect(barras[0]!.etiqueta).toBe('110');
    expect(barras[barras.length - 1]!.acumulado).toBeCloseTo(100);
  });

  it('el histograma conserva todos los registros', () => {
    const nums = valoresNumericos(filas, ventana);
    expect(histograma(nums).reduce((s, b) => s + b.conteo, 0)).toBe(nums.length);
  });

  it('resume con mediana, percentiles y desviación muestral', () => {
    const r = resumir([1, 2, 3, 4, 100])!;
    expect(r.mediana).toBe(3);
    expect(r.max).toBe(100);
    expect(r.desviacion).toBeGreaterThan(40);
  });

  it('el pivote suma la columna elegida por grupo', () => {
    const p = pivote(filas, sucursal, errores);
    expect(p[0]).toMatchObject({ grupo: '110', conteo: 2, suma: 3 });
  });

  it('la correlación de una relación lineal perfecta es 1', () => {
    expect(correlacion([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });
});
