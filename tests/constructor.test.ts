import { describe, it, expect } from 'vitest';
import { cargarCombinacion } from '../src/servidor/datos/cargador.js';
import { agregarCalculadas, columnasCalculadas, cruzar } from '../src/cliente/analisis.js';
import type { Columna } from '../src/cliente/analisis.js';
import {
  ajustarSpec, calcular, calcularControl, calcularPareto, specInicial, tablaDatos, tituloSpec, herramientaDe,
} from '../src/cliente/constructor.js';
import type { Contexto, ResultadoComparativo, ResultadoDispersion, ResultadoPareto, Spec } from '../src/cliente/constructor.js';
import { traductor, DICCIONARIOS } from '../src/compartido/i18n/index.js';
import type { ClaveDatos, Idioma } from '../src/compartido/configuracion.js';

const BASE_COLS: Columna[] = [
  { campo: 'applicationNum', nombre: 'Solicitud', tipo: 'numero' },
  { campo: 'branchNum', nombre: 'Sucursal', tipo: 'numero' },
  { campo: 'state', nombre: 'Estado', tipo: 'texto' },
  { campo: 'numTries', nombre: 'Intentos', tipo: 'numero' },
  { campo: 'lastStatus', nombre: 'Estatus', tipo: 'texto' },
  { campo: 'dateFirstInput', nombre: 'Inicio', tipo: 'fecha' },
  { campo: 'comments', nombre: 'Bitácora', tipo: 'texto' },
];

// Prepara una base igual que el cliente: JSON del servidor, columnas calculadas y cruce con comentarios
function preparar(clave: ClaveDatos, idioma: Idioma = 'es') {
  const d = cargarCombinacion(clave);
  const vocabulario = clave === 'R2' ? 'R2' as const : 'original' as const;
  const t = traductor(idioma);
  const sol = cruzar(agregarCalculadas(JSON.parse(JSON.stringify(d.solicitudes)), vocabulario), JSON.parse(JSON.stringify(d.comentarios))).solicitudes;
  const ctx: Contexto = { columnas: [...BASE_COLS, ...columnasCalculadas('solicitudes', t, vocabulario)], t, vocabulario };
  return { sol, ctx, spec: (c: Partial<Spec>) => ({ ...specInicial(), ...c }) };
}

const filas = [
  { branchNum: 110, erroresComentario: 3, state: 'Edo Mex' },
  { branchNum: 110, erroresComentario: 1, state: 'Edo Mex' },
  { branchNum: 676, erroresComentario: 2, state: 'D.F.' },
  { branchNum: 728, erroresComentario: 0, state: 'Jalisco' },
  { branchNum: 728, erroresComentario: 0, state: 'Jalisco' },
  { branchNum: 728, erroresComentario: 1, state: 'Jalisco' },
];
const t = traductor('es');
const ctxSimple: Contexto = { columnas: BASE_COLS.concat([{ campo: 'erroresComentario', nombre: 'Errores', tipo: 'numero', calculada: true }]), t, vocabulario: 'R2' };

describe('Pareto: orden y acumulado', () => {
  it('ordena de mayor a menor y el acumulado termina en 100%', () => {
    const r = calcularPareto(filas, { ...specInicial(), variable: 'branchNum' }, ctxSimple);
    expect(r.barras.map(b => b.etiqueta)).toEqual(['728', '110', '676']);
    expect(r.barras.map(b => b.valor)).toEqual([3, 2, 1]);
    expect(r.barras.map(b => Math.round(b.acumulado!))).toEqual([50, 83, 100]);
    expect(r.aditiva).toBe(true);
  });

  it('agrupa en Otros lo que queda después de las primeras N', () => {
    const r = calcularPareto(filas, { ...specInicial(), variable: 'branchNum', topN: 1 }, ctxSimple);
    expect(r.barras.map(b => [b.etiqueta, b.valor])).toEqual([['728', 3], ['Otros', 3]]);
    expect(r.barras[1]!.acumulado).toBeCloseTo(100);
  });
});

describe('medidas por estrato', () => {
  it('conteo y tasa por solicitud ordenan distinto', () => {
    const conteo = calcularPareto(filas, { ...specInicial(), variable: 'branchNum' }, ctxSimple);
    const tasa = calcularPareto(filas, { ...specInicial(), variable: 'branchNum', medida: 'tasa', campoMedida: 'erroresComentario', minSolicitudes: 1 }, ctxSimple);
    expect(conteo.barras[0]!.etiqueta).toBe('728');
    // Empate en 2: desempata la categoría con más solicitudes
    expect(tasa.barras.map(b => [b.etiqueta, b.valor])).toEqual([['110', 2], ['676', 2], ['728', 1 / 3]]);
    expect(tasa.aditiva).toBe(false);
    expect(tasa.referencia).toBeCloseTo(7 / 6);
  });

  it('el mínimo de solicitudes deja fuera las categorías chicas y lo reporta', () => {
    const tasa = calcularPareto(filas, { ...specInicial(), variable: 'branchNum', medida: 'tasa', campoMedida: 'erroresComentario', minSolicitudes: 2 }, ctxSimple);
    expect(tasa.barras.map(b => b.etiqueta)).toEqual(['110', '728']);
    expect(tasa.excluidas).toBe(1);
  });

  it('suma, promedio, mediana y porcentaje', () => {
    const m = (medida: Spec['medida']) => calcularPareto(filas, { ...specInicial(), variable: 'state', medida, campoMedida: 'erroresComentario', minSolicitudes: 1 }, ctxSimple).barras;
    expect(m('suma')[0]).toMatchObject({ etiqueta: 'Edo Mex', valor: 4 });
    expect(m('promedio').map(b => [b.etiqueta, b.valor])).toEqual([['Edo Mex', 2], ['D.F.', 2], ['Jalisco', 1 / 3]]);
    expect(m('mediana').find(b => b.etiqueta === 'Jalisco')!.valor).toBe(0);
    expect(m('porcentaje')[0]).toMatchObject({ etiqueta: 'Jalisco', valor: 50 });
  });
});

describe('eventos del expediente', () => {
  for (const [clave, idioma] of [['A_es', 'es'], ['A_en', 'en'], ['B_es', 'es'], ['B_en', 'en']] as const) {
    it(`${clave}: cada evento cuenta por separado y se puede elegir cuáles incluir`, () => {
      const { sol, ctx, spec } = preparar(clave, idioma);
      const errores = calcular(sol, spec({ tipo: 'pareto_eventos', eventos: ['captura', 'incompletos', 'ilegibles'] }), ctx) as ResultadoPareto;
      const esperado = clave === 'A_es' ? [49, 42, 18] : [49, 43, 20];
      expect(errores.barras.map(b => b.valor)).toEqual(esperado);
      const todos = calcular(sol, spec({ tipo: 'pareto_eventos' }), ctx) as ResultadoPareto;
      const nombres = todos.barras.map(b => b.etiqueta);
      expect(nombres).toContain(DICCIONARIOS[idioma].eventos.autorizado);
      expect(nombres).toContain(DICCIONARIOS[idioma].eventos.rechazo_buro);
    });
  }
});

describe('criterios de aceptación con la base A original', () => {
  const { sol, ctx, spec } = preparar('A_es');

  it('correlación intentos contra días de captura de 0.80', () => {
    const r = calcular(sol, spec({ tipo: 'dispersion', variable: 'numTries', variableY: 'ventanaCaptura' }), ctx) as ResultadoDispersion;
    expect(r.r).toBeCloseTo(0.805, 3);
    expect(r.puntos).toHaveLength(103);
  });

  it('Pareto de errores: 49 de captura, 42 incompletos y 18 ilegibles', () => {
    const r = calcular(sol, spec({ tipo: 'pareto_eventos', eventos: ['captura', 'incompletos', 'ilegibles'] }), ctx) as ResultadoPareto;
    expect(r.barras.map(b => [b.etiqueta, b.valor])).toEqual([['Error de captura', 49], ['Documentos incompletos', 42], ['Documentos ilegibles', 18]]);
  });

  it('en el Pareto por conteo la 110 y la 676 son las dos primeras', () => {
    const r = calcular(sol, spec({ variable: 'branchNum' }), ctx) as ResultadoPareto;
    expect(r.barras.slice(0, 2).map(b => b.etiqueta).sort()).toEqual(['110', '676']);
    const errores = calcular(sol, spec({ variable: 'branchNum', medida: 'suma', campoMedida: 'erroresComentario' }), ctx) as ResultadoPareto;
    expect(errores.barras.slice(0, 2).map(b => b.etiqueta)).toEqual(['110', '676']);
  });

  it('con tasa y mínimo 2 la 110 queda primera y la 676 por encima del promedio', () => {
    const r = calcular(sol, spec({ variable: 'branchNum', medida: 'tasa', campoMedida: 'erroresComentario', minSolicitudes: 2 }), ctx) as ResultadoPareto;
    expect(r.barras[0]!.etiqueta).toBe('110');
    const b676 = r.barras.find(b => b.etiqueta === '676')!;
    expect(b676.n).toBe(6);
    expect(b676.valor).toBeGreaterThan(r.referencia!);
  });

  it('el Pareto comparativo separa la 110, la 676 y el resto', () => {
    const r = calcular(sol, spec({ tipo: 'pareto_comparativo', variable: 'comments', estrato: 'branchNum', valoresComparar: ['110', '676'], eventos: ['captura', 'incompletos', 'ilegibles'] }), ctx) as ResultadoComparativo;
    expect(r.paneles.map(p => p.n)).toEqual([6, 6, 91]);
  });
});

describe('carta de control en R2', () => {
  it('hace visible el cambio del mes 10 como racha sobre la media', () => {
    const { sol, ctx, spec } = preparar('R2');
    const r = calcularControl(sol, spec({ tipo: 'control', variable: 'numTries' }), ctx)!;
    expect(r.puntos).toHaveLength(18);
    const despues = r.puntos.slice(10);
    expect(despues.every(p => p.media > r.centro && p.racha)).toBe(true);
    expect(r.puntos.some(p => p.fuera)).toBe(true);
  });
});

describe('especificación', () => {
  it('cada tipo arranca con una selección útil', () => {
    const { sol, ctx } = preparar('A_es');
    for (const tipo of ['pareto', 'pareto_eventos', 'pareto_etapas', 'pareto_comparativo', 'histograma', 'dispersion', 'corrida', 'control', 'caja', 'pivote'] as const) {
      const s = ajustarSpec(specInicial(), { tipo }, ctx.columnas);
      const r = calcular(sol, s, ctx);
      expect(r, tipo).not.toBeNull();
      expect(tablaDatos(r!, ctx.t).filas.length, tipo).toBeGreaterThan(0);
      expect(tituloSpec(s, ctx)).not.toMatch(/\(|undefined|[a-z][A-Z]/);
      expect(herramientaDe(tipo)).toBeTruthy();
    }
  });

  it('los filtros se combinan', () => {
    const { sol, ctx, spec } = preparar('A_es');
    const r = calcular(sol, spec({ variable: 'lastStatus', filtros: [{ campo: 'lastStatus', valor: 'Rechazo Buró' }, { campo: 'state', valor: 'D.F.' }] }), ctx) as ResultadoPareto;
    const esperado = sol.filter(f => f['lastStatus'] === 'Rechazo Buró' && f['state'] === 'D.F.').length;
    expect(r.barras[0]!.valor).toBe(esperado);
    expect(esperado).toBeGreaterThan(0);
  });
});

describe('diccionarios', () => {
  it('español e inglés tienen las mismas claves y ningún texto con guion largo', () => {
    const claves = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [`${p}${k}`] : claves(v, `${p}${k}.`)));
    expect(claves(DICCIONARIOS.en).sort()).toEqual(claves(DICCIONARIOS.es).sort());
    const textos = (o: object): string[] => Object.values(o).flatMap(v => (typeof v === 'string' ? [v] : textos(v)));
    for (const x of [...textos(DICCIONARIOS.es), ...textos(DICCIONARIOS.en)]) expect(x).not.toMatch(/—/);
  });
});
