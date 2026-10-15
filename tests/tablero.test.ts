import { describe, it, expect } from 'vitest';
import { normalizarTablero, tableroVacio, MAX_GRAFICOS } from '../src/compartido/tablero.js';

describe('tablero del equipo', () => {
  it('conserva gráficos, secciones y textos válidos', () => {
    const t = normalizarTablero({
      graficos: [{ id: 'x1', spec: { tipo: 'pareto' }, titulo: 'Pareto', conclusion: 'Dos causas pesan más', seccion: 'situacion' }],
      textos: { antecedentes: 'A', meta: 'M', propuesta: 'P', plan: 'L', extra: 'no' },
    });
    expect(t.graficos[0]).toEqual({ id: 'x1', spec: { tipo: 'pareto' }, titulo: 'Pareto', conclusion: 'Dos causas pesan más', seccion: 'situacion' });
    expect(t.textos).toEqual({ antecedentes: 'A', meta: 'M', propuesta: 'P', plan: 'L' });
  });

  it('descarta lo inválido y acota tamaños', () => {
    const t = normalizarTablero({
      graficos: [null, { spec: null }, { spec: {}, titulo: 'x'.repeat(500), seccion: 'otra' }, ...Array.from({ length: 60 }, () => ({ spec: {} }))],
    });
    expect(t.graficos.length).toBeLessThanOrEqual(MAX_GRAFICOS);
    expect(t.graficos[0]!.titulo.length).toBe(160);
    expect(t.graficos[0]!.seccion).toBe('analisis');
    expect(normalizarTablero('basura')).toEqual(tableroVacio());
  });
});
