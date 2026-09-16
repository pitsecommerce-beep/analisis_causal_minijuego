import { crearPartida, elegirAcciones, declararCompromiso, procesarCiclo } from '../src/servidor/motor/ciclos.js';
import { evaluarPartida, determinarDesenlace } from '../src/servidor/puntuacion/evaluacion.js';
import config from '../config/simulador.json' with { type: 'json' };

const kpisBase = { ...config.kpisIniciales };

// Test: acciones 1, 4, 5 con meta conservadora
const partida = crearPartida(kpisBase, 20260825);

elegirAcciones(partida, [
  { accionId: 1, cicloElegido: 1 },
  { accionId: 4, cicloElegido: 1 },
  { accionId: 5, cicloElegido: 1 },
], config.acciones);

for (let ciclo = 1; ciclo <= 4; ciclo++) {
  const actual = partida.kpis.ventanaCapturaMedia;
  const meta = actual; // conservadora: prometo mantener
  declararCompromiso(partida, 'ventanaCapturaMedia', meta);
  const r = procesarCiclo(partida, config.acciones, config.eventos);
  console.log(`Ciclo ${ciclo}:`, {
    vidaPerdida: r.vidaPerdida,
    motivo: r.motivoVidaPerdida,
    vidas: partida.vidas,
    credibilidad: partida.credibilidad,
    ventana: r.kpisDespues.ventanaCapturaMedia,
    meta,
    fraccion: r.fraccionCumplimiento,
    destituido: partida.destituido,
  });
  if (partida.terminada) break;
}

console.log('\n--- Evaluacion ---');
const desglose = evaluarPartida(
  partida, kpisBase,
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
console.log('Desglose:', desglose);
const desenlace = determinarDesenlace(desglose.total, partida.destituido, config.desenlaces);
console.log('Desenlace:', desenlace);
