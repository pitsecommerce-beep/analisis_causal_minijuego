import { describe, it, expect } from 'vitest';
import { normalizarEspina, validarVotacion, causasDesdeEspina, ESPINA_VACIA } from '../src/compartido/espina.js';
import type { Espina } from '../src/compartido/espina.js';
import { evaluarDiagnostico } from '../src/servidor/puntuacion/evaluacion.js';

const ev = (id: string, verificacionId: string | null) => ({ id, herramienta: 'pareto', hoja: 'solicitudes', columna: 'x', resumen: 'r', estrato: null, verificacionId, ciclo: 1, creada: '' });
const tar = (id: string, estado: string, evidencias: string[], rama = 'metodo') => ({ id, rama, texto: `Causa ${id}`, origen: 'propio', estado, evidencias, pendienteId: null, ciclo: 1, creada: '' });

describe('Espina de pescado', () => {
  it('no deja una tarjeta verificada sin evidencia', () => {
    const e = normalizarEspina({ tarjetas: [tar('a', 'verificada', [])], evidencias: [] }, []);
    expect(e.tarjetas[0]!.estado).toBe('hipotesis');
  });

  it('quita verificaciones que el jugador no registró y evidencias inexistentes', () => {
    const e = normalizarEspina({
      evidencias: [ev('e1', 'medianas_iguales'), ev('e2', 'atorados_sin_plastico')],
      tarjetas: [tar('a', 'verificada', ['e1', 'e2', 'fantasma'])],
    }, ['medianas_iguales']);
    expect(e.evidencias.map(x => x.verificacionId)).toEqual(['medianas_iguales', null]);
    expect(e.tarjetas[0]!.evidencias).toEqual(['e1', 'e2']);
  });

  it('conserva las votaciones previas y normaliza ramas desconocidas', () => {
    const previa: Espina = { ...ESPINA_VACIA, votaciones: [{ ciclo: 1, causas: ['a'], porques: ['1', '2', '3', '4', '5'] }] };
    const e = normalizarEspina({ tarjetas: [tar('a', 'hipotesis', [], 'otra')], votaciones: [] }, [], previa);
    expect(e.votaciones).toHaveLength(1);
    expect(e.tarjetas[0]!.rama).toBe('metodo');
  });

  it('exige 3 causas existentes y 5 porqués para votar', () => {
    const e = normalizarEspina({ tarjetas: ['a', 'b', 'c', 'd'].map(id => tar(id, 'hipotesis', [])) }, []);
    const porques = ['1', '2', '3', '4', '5'];
    expect(validarVotacion(e, ['a', 'b'], porques).ok).toBe(false);
    expect(validarVotacion(e, ['a', 'b', 'c'], ['1', '2', '3', '4', '']).ok).toBe(false);
    expect(validarVotacion(e, ['a', 'b', 'x'], porques).ok).toBe(false);
    expect(validarVotacion(e, ['a', 'b', 'c'], porques).ok).toBe(true);
    expect(validarVotacion(ESPINA_VACIA, [], porques).ok).toBe(false);
  });

  it('evalúa el diagnóstico con las causas votadas y verificadas', () => {
    const espina = normalizarEspina({
      evidencias: [ev('e1', 'medianas_iguales'), ev('e2', 'concentracion_sucursales'), ev('e3', 'quejas_reproceso_documental'), ev('e4', null)],
      tarjetas: [tar('a', 'verificada', ['e1']), tar('b', 'verificada', ['e2']), tar('c', 'verificada', ['e3']), tar('d', 'hipotesis', []), tar('f', 'verificada', ['e4'])],
    }, ['medianas_iguales', 'concentracion_sucursales', 'quejas_reproceso_documental']);
    // b y c respaldan la misma causa raíz: cuenta una sola vez
    espina.votaciones = [{ ciclo: 1, causas: ['a', 'b', 'c'], porques: [] }];
    expect(evaluarDiagnostico(causasDesdeEspina(espina), {}).puntos).toBe(110 + 90);
    // la votación del último ciclo es la que cuenta; d está sin verificar y f no respalda una causa raíz
    espina.votaciones.push({ ciclo: 2, causas: ['a', 'd', 'f'], porques: [] });
    const r = evaluarDiagnostico(causasDesdeEspina(espina), {});
    expect(r.puntos).toBe(110 - 40);
    expect(r.detalles.some(d => d.includes('sin relación'))).toBe(true);
  });
});
