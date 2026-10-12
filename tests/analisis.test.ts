import { describe, it, expect } from 'vitest';
import {
  agregarCalculadas, cartaControl, contarCategorias, correlacion, cruzar, histograma, pareto, pivote, resumir, valoresEstrato, valoresNumericos,
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

describe('Cruce, estratos y gráfica de control', () => {
  const sols = [
    { applicationNum: 1, ventanaCaptura: 10, erroresComentario: 2, creditBureauResult: 'Accepted', lastStatus: 'Card Sent', mes: '2015-01', branchNum: 110 },
    { applicationNum: 2, ventanaCaptura: 30, erroresComentario: 0, creditBureauResult: 'Rejected', lastStatus: 'Bureau Rejected', mes: '2015-01', branchNum: 676 },
    { applicationNum: 3, ventanaCaptura: 20, erroresComentario: 1, creditBureauResult: null, lastStatus: 'Authorized', mes: '2015-02', branchNum: 110 },
  ];
  const coms = [
    { solicitudNum: 2, categoriaPrimaria: 'Tiempo de ciclo', fechaComentario: '2015-03-04T00:00:00.000Z' },
    { solicitudNum: 2, categoriaPrimaria: 'Rechazo', fechaComentario: '2015-03-05T00:00:00.000Z' },
    { solicitudNum: 9, categoriaPrimaria: 'Caso atorado', fechaComentario: null },
  ];

  it('cruza comentarios con su solicitud y cuenta quejas por solicitud', () => {
    const c = cruzar(sols, coms);
    expect(c.solicitudes.map(s => s['quejas'])).toEqual([0, 2, 0]);
    expect(c.solicitudes[1]!['categoriaQueja']).toBe('Tiempo de ciclo');
    expect(c.comentarios[0]!['solicitudVentanaCaptura']).toBe(30);
    expect(c.comentarios[0]!['mes']).toBe('2015-03');
    expect(c.comentarios[2]!['solicitudUltimoEstatus']).toBeNull();
  });

  it('lista los valores de un estrato en orden numérico', () => {
    expect(valoresEstrato([{ s: 728 }, { s: 110 }, { s: 676 }, { s: 110 }], 's')).toEqual(['110', '676', '728']);
  });

  it('calcula la gráfica de control por mes con límites a 3 sigmas', () => {
    const carta = cartaControl(sols, { campo: 'ventanaCaptura', nombre: 'Días', tipo: 'numero' })!;
    expect(carta.centro).toBe(20);
    expect(carta.sigma).toBe(10);
    expect(carta.puntos.map(p => p.mes)).toEqual(['2015-01', '2015-02']);
    expect(carta.puntos[0]!.media).toBe(20);
    expect(carta.puntos[0]!.lcs).toBeCloseTo(20 + 30 / Math.sqrt(2));
    expect(carta.puntos[1]!.lci).toBeCloseTo(-10);
    expect(carta.puntos.some(p => p.fuera)).toBe(false);
  });
});
