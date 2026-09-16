import * as readline from 'node:readline';
import {
  crearPartida,
  elegirAcciones,
  declararCompromiso,
  procesarCiclo,
  METRICAS_DISPONIBLES,
} from '../motor/ciclos.js';
import { formatearKPIs } from '../motor/kpis.js';
import { evaluarPartida, determinarDesenlace } from '../puntuacion/evaluacion.js';
import type { AccionConfig } from '../motor/acciones.js';
import config from '../../../config/simulador.json' with { type: 'json' };

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function preguntar(prompt: string): Promise<string> {
  return new Promise((r) => rl.question(prompt, r));
}

async function main() {
  console.log('\n=== DIRECTOR DE OPERACIONES - ETF Bank ===');
  console.log('Tienes 4 ciclos, 3 vidas, 100 de presupuesto.');
  console.log('Objetivo: mejorar el proceso de tarjetas de credito.\n');

  const semilla = Date.now();
  const partida = crearPartida({ ...config.kpisIniciales }, semilla);
  const catalogo: AccionConfig[] = config.acciones as AccionConfig[];

  for (let ciclo = 1; ciclo <= 4; ciclo++) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  CICLO ${ciclo}/4  |  Vidas: ${partida.vidas}  |  Credibilidad: ${partida.credibilidad}  |  Presupuesto: ${partida.presupuestoDisponible}`);
    console.log('='.repeat(50));

    console.log('\nKPIs actuales:');
    for (const l of formatearKPIs(partida.kpis)) console.log(`  ${l}`);

    console.log('\nAcciones disponibles:');
    const accionesUsadas = partida.accionesElegidas.map((a) => a.accionId);
    for (const a of catalogo) {
      const usada = accionesUsadas.includes(a.id);
      const marca = usada ? ' [YA ELEGIDA]' : '';
      console.log(`  ${a.id}. ${a.nombre} (costo: ${a.costo}, demora: ${a.demora} ciclo(s))${marca}`);
      console.log(`     ${a.descripcion}`);
    }

    const inputAcciones = await preguntar('\nElige acciones (numeros separados por coma, o Enter para ninguna): ');
    const ids = inputAcciones
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (ids.length > 0) {
      const acciones = ids.map((id) => {
        const accion = catalogo.find((a) => a.id === id);
        const necesitaSucursales = accion?.requiereSucursales;
        return { accionId: id, cicloElegido: ciclo, sucursalesNombradas: undefined as number[] | undefined };
      });

      for (const a of acciones) {
        const accionConfig = catalogo.find((c) => c.id === a.accionId);
        if (accionConfig?.requiereSucursales) {
          const inputSuc = await preguntar(`  Accion ${a.accionId} requiere nombres de sucursales. Ingresa numeros: `);
          a.sucursalesNombradas = inputSuc
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
        }
      }

      const resultado = elegirAcciones(partida, acciones, catalogo);
      if (!resultado.ok) {
        console.log(`  ERROR: ${resultado.error}`);
      } else {
        console.log(`  Acciones registradas: ${ids.join(', ')}`);
      }
    }

    console.log('\nMetricas para compromiso:');
    for (let i = 0; i < METRICAS_DISPONIBLES.length; i++) {
      const m = METRICAS_DISPONIBLES[i];
      console.log(`  ${i + 1}. ${m.nombre} (${m.id})`);
    }

    const inputMetrica = await preguntar('Elige metrica para compromiso (numero, o Enter para ventanaCapturaMedia): ');
    const idxMetrica = parseInt(inputMetrica.trim(), 10) - 1;
    const metricaElegida =
      idxMetrica >= 0 && idxMetrica < METRICAS_DISPONIBLES.length
        ? METRICAS_DISPONIBLES[idxMetrica].id
        : 'ventanaCapturaMedia';

    const valorActual = (partida.kpis as Record<string, number>)[metricaElegida] ?? 0;
    console.log(`  Valor actual de ${metricaElegida}: ${valorActual}`);

    const inputMeta = await preguntar(`  Tu meta para este ciclo (numero): `);
    const meta = parseFloat(inputMeta.trim());
    if (isNaN(meta)) {
      console.log('  Meta invalida, se usa el valor actual.');
      declararCompromiso(partida, metricaElegida, valorActual);
    } else {
      declararCompromiso(partida, metricaElegida, meta);
    }

    const resultado = procesarCiclo(partida, catalogo, config.eventos);

    console.log(`\n--- Resultado del ciclo ${ciclo} ---`);

    if (resultado.evento) {
      console.log(`\n  EVENTO: ${resultado.evento.nombre}`);
      console.log(`  ${resultado.evento.mensaje}`);
      for (const c of resultado.cambiosEvento) console.log(`    ${c}`);
    }

    if (resultado.accionesAplicadas.length > 0) {
      console.log('\n  Acciones:');
      for (const a of resultado.accionesAplicadas) {
        if (a.aplicada && a.razon !== 'Ya aplicada en ciclo anterior') {
          console.log(`    ${a.nombre}: APLICADA`);
          for (const c of a.cambios) console.log(`      ${c}`);
        } else if (a.razon && a.razon !== 'Ya aplicada en ciclo anterior') {
          console.log(`    ${a.nombre}: ${a.razon}`);
        }
      }
    }

    if (resultado.compromiso) {
      const pct = Math.round(resultado.fraccionCumplimiento * 100);
      console.log(`\n  Compromiso: ${resultado.cumplioCompromiso ? 'CUMPLIDO' : 'NO CUMPLIDO'} (${pct}%)`);
    }

    if (resultado.vidaPerdida) {
      console.log(`\n  VIDA PERDIDA: ${resultado.motivoVidaPerdida}`);
      console.log(`  Vidas restantes: ${partida.vidas}`);
    }

    console.log(`  Credibilidad: ${partida.credibilidad}`);

    console.log('\n  KPIs despues:');
    for (const l of formatearKPIs(resultado.kpisDespues)) console.log(`    ${l}`);

    if (partida.destituido) {
      console.log('\n  HAS SIDO DESTITUIDO. Fin de la partida.');
      break;
    }

    if (partida.terminada) break;
  }

  if (!partida.destituido) {
    console.log('\n\n=== FIN DE LA PARTIDA ===');
    console.log('Ahora se evalua tu desempeno.\n');

    const inputCausas = await preguntar(
      'Causas raiz que declaras (IDs separados por coma):\n' +
        '  Opciones: ventana_captura_cuello, reproceso_documental, fuga_aprobados_sin_plastico,\n' +
        '  secuencia_tardia_buro, cultura_organizacional, falta_personal, sistema_legacy\n> '
    );
    const causas = inputCausas
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((id) => ({ id, nombre: id }));

    const inputVerif = await preguntar('Afirmaciones verificadas (numero): ');
    const afirmaciones = parseInt(inputVerif.trim(), 10) || 0;

    const inputRefut = await preguntar('Refutaciones con datos (numero): ');
    const refutaciones = parseInt(inputRefut.trim(), 10) || 0;

    const inputSinVerif = await preguntar('Acciones sin verificar (numero): ');
    const sinVerificar = parseInt(inputSinVerif.trim(), 10) || 0;

    const inputHerr = await preguntar(
      'Herramientas de Bohn usadas (separadas por coma):\n' +
        '  Opciones: histograma, pareto, diagrama_corrida, carta_control, dispersion, tabla_dinamica, filtro\n> '
    );
    const herramientas = inputHerr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const inputGuia = await preguntar('Consultaste la guia/nota tecnica? (s/n): ');
    const consultoGuia = inputGuia.trim().toLowerCase() === 's';

    const inputPasos = await preguntar('Seguiste los pasos en orden? (s/n): ');
    const pasosEnOrden = inputPasos.trim().toLowerCase() === 's';

    const desglose = evaluarPartida(
      partida,
      { ...config.kpisIniciales },
      causas,
      afirmaciones,
      refutaciones,
      sinVerificar,
      herramientas,
      consultoGuia,
      pasosEnOrden,
      config.puntuacion
    );

    const desenlace = determinarDesenlace(desglose.total, partida.destituido, config.desenlaces);

    console.log('\n=== EVALUACION FINAL ===');
    for (const d of desglose.detalles) console.log(`  ${d}`);
    console.log(`\n  TOTAL: ${desglose.total}/1000`);
    console.log(`  DESENLACE: ${desenlace.nombre}`);
  } else {
    const desenlace = determinarDesenlace(0, true, config.desenlaces);
    console.log(`\n  TOTAL: 0/1000`);
    console.log(`  DESENLACE: ${desenlace.nombre}`);
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
