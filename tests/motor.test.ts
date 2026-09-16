import { describe, it, expect } from 'vitest';
import { crearPartida, elegirAcciones, declararCompromiso, procesarCiclo } from '../src/servidor/motor/ciclos.js';
import { evaluarPartida, determinarDesenlace } from '../src/servidor/puntuacion/evaluacion.js';
import type { KPIs } from '../src/servidor/motor/kpis.js';
import config from '../config/simulador.json' with { type: 'json' };

const kpisBase: KPIs = { ...config.kpisIniciales };

function jugarPartida(opts: {
  accionesCiclo1: number[];
  accionesCiclo2?: number[];
  sucursales?: number[];
}): ReturnType<typeof crearPartida> {
  const partida = crearPartida(kpisBase, 20260825);

  for (let ciclo = 1; ciclo <= 4; ciclo++) {
    let acciones: { accionId: number; cicloElegido: number; sucursalesNombradas?: number[] }[] = [];

    if (ciclo === 1) {
      acciones = opts.accionesCiclo1.map((id) => ({
        accionId: id,
        cicloElegido: ciclo,
        sucursalesNombradas: opts.sucursales,
      }));
    } else if (ciclo === 2 && opts.accionesCiclo2) {
      acciones = opts.accionesCiclo2.map((id) => ({
        accionId: id,
        cicloElegido: ciclo,
      }));
    }

    if (acciones.length > 0) {
      elegirAcciones(partida, acciones, config.acciones);
    }

    const meta = partida.kpis.ventanaCapturaMedia;
    declararCompromiso(partida, 'ventanaCapturaMedia', meta);
    procesarCiclo(partida, config.acciones, config.eventos);

    if (partida.terminada) break;
  }

  return partida;
}

describe('Desenlaces', () => {
  it('Reconversion: acciones 1, 4, 5 con diagnostico completo', () => {
    const partida = jugarPartida({ accionesCiclo1: [1, 4, 5] });

    const desglose = evaluarPartida(
      partida,
      kpisBase,
      [
        { id: 'ventana_captura_cuello', nombre: 'Ventana de captura como cuello' },
        { id: 'reproceso_documental', nombre: 'Reproceso documental' },
        { id: 'fuga_aprobados_sin_plastico', nombre: 'Fuga de aprobados sin plastico' },
        { id: 'secuencia_tardia_buro', nombre: 'Secuencia tardia del buro' },
      ],
      5, 3, 0,
      ['histograma', 'pareto', 'diagrama_corrida', 'dispersion'],
      true, true,
      config.puntuacion
    );
    const desenlace = determinarDesenlace(desglose.total, partida.destituido, config.desenlaces);
    expect(desenlace.id).toBe('reconversion');
    expect(desglose.total).toBeGreaterThanOrEqual(850);
  });

  it('Buen trabajo incompleto: checklist y diagnostico parcial', () => {
    const partida = jugarPartida({ accionesCiclo1: [1] });

    const desglose = evaluarPartida(
      partida,
      kpisBase,
      [
        { id: 'ventana_captura_cuello', nombre: 'Ventana de captura' },
        { id: 'reproceso_documental', nombre: 'Reproceso documental' },
        { id: 'fuga_aprobados_sin_plastico', nombre: 'Fuga de aprobados sin plastico' },
      ],
      4, 2, 0,
      ['histograma', 'pareto', 'diagrama_corrida'],
      true, false,
      config.puntuacion
    );
    const desenlace = determinarDesenlace(desglose.total, partida.destituido, config.desenlaces);
    expect(desenlace.id).toBe('buen_trabajo');
    expect(desglose.total).toBeGreaterThanOrEqual(650);
    expect(desglose.total).toBeLessThanOrEqual(849);
  });

  it('Sobreviviste: accion de back office y diagnostico debil', () => {
    const partida = jugarPartida({ accionesCiclo1: [6] });

    const desglose = evaluarPartida(
      partida,
      kpisBase,
      [
        { id: 'ventana_captura_cuello', nombre: 'Ventana de captura' },
        { id: 'reproceso_documental', nombre: 'Reproceso documental' },
      ],
      3, 1, 1,
      ['pareto', 'histograma'],
      false, false,
      config.puntuacion
    );
    const desenlace = determinarDesenlace(desglose.total, partida.destituido, config.desenlaces);
    expect(desenlace.id).toBe('sobreviviste');
    expect(desglose.total).toBeGreaterThanOrEqual(450);
    expect(desglose.total).toBeLessThanOrEqual(649);
  });

  it('En la mira: accion inutil y causa unica', () => {
    const partida = jugarPartida({ accionesCiclo1: [7] });

    const desglose = evaluarPartida(
      partida,
      kpisBase,
      [{ id: 'ventana_captura_cuello', nombre: 'Ventana de captura' }],
      1, 0, 2,
      ['pareto'],
      false, false,
      config.puntuacion
    );
    const desenlace = determinarDesenlace(desglose.total, partida.destituido, config.desenlaces);
    expect(desenlace.id).toBe('en_la_mira');
    expect(desglose.total).toBeGreaterThanOrEqual(250);
    expect(desglose.total).toBeLessThanOrEqual(449);
  });

  it('Destituido: no toma acciones y promete imposibles', () => {
    const partida = crearPartida(kpisBase, 20260825);

    for (let ciclo = 1; ciclo <= 4; ciclo++) {
      declararCompromiso(partida, 'ventanaCapturaMedia', -100);
      procesarCiclo(partida, config.acciones, config.eventos);
      if (partida.terminada) break;
    }

    const desenlace = determinarDesenlace(0, partida.destituido, config.desenlaces);
    expect(partida.destituido).toBe(true);
    expect(desenlace.id).toBe('destituido');
  });

  it('El motor respeta los 4 ciclos', () => {
    const partida = jugarPartida({ accionesCiclo1: [1, 4, 5] });
    expect(partida.resultadosCiclo.length).toBe(4);
    expect(partida.terminada).toBe(true);
  });
});
