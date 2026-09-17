import { describe, it, expect } from 'vitest';
import { generarRecomendacion } from '../src/servidor/experimento/asesor-algoritmico.js';
import type { EstadoPartida } from '../src/servidor/motor/ciclos.js';

const accionesConfig = [
  { id: 1, costo: 15, nombre: 'Accion 1' },
  { id: 2, costo: 10, nombre: 'Accion 2' },
  { id: 3, costo: 20, nombre: 'Accion 3' },
  { id: 7, costo: 25, nombre: 'Accion 7' },
];

function crearEstadoBase(): EstadoPartida {
  return {
    cicloActual: 1,
    vidas: 3,
    credibilidad: 50,
    presupuestoDisponible: 100,
    accionesElegidas: [],
    kpis: {
      cicloTotalMediana: 30,
      ventanaCapturaMedia: 15,
      quejasPct: 35,
      conversionPct: 70,
      presupuestoGastado: 0,
    },
    resultadosCiclo: [],
    compromisos: [],
    eventosActivos: [],
    destituido: false,
    terminada: false,
    semilla: 12345,
  };
}

describe('Asesor algoritmico', () => {
  it('genera recomendacion cuando hay acciones disponibles', () => {
    const estado = crearEstadoBase();
    const rec = generarRecomendacion(estado, accionesConfig);

    expect(rec).toBeDefined();
    expect(rec.accionRecomendada).not.toBeNull();
    expect(rec.metricaPrioritaria).toBeTruthy();
    expect(rec.explicacion).toBeTruthy();
    expect(rec.confianza).toBeGreaterThan(0);
  });

  it('devuelve null cuando no hay presupuesto', () => {
    const estado = crearEstadoBase();
    estado.presupuestoDisponible = 0;
    const rec = generarRecomendacion(estado, accionesConfig);

    expect(rec.accionRecomendada).toBeNull();
    expect(rec.confianza).toBeLessThan(0.5);
  });

  it('no recomienda acciones ya elegidas', () => {
    const estado = crearEstadoBase();
    estado.accionesElegidas = [
      { accionId: 1, cicloElegido: 1 },
      { accionId: 3, cicloElegido: 1 },
    ];
    const rec = generarRecomendacion(estado, accionesConfig);

    expect(rec.accionRecomendada).not.toBe(1);
    expect(rec.accionRecomendada).not.toBe(3);
  });

  it('prioriza metrica con peor estado', () => {
    const estado = crearEstadoBase();
    estado.kpis.cicloTotalMediana = 10;
    estado.kpis.quejasPct = 50;
    const rec = generarRecomendacion(estado, accionesConfig);

    expect(rec.metricaPrioritaria).toBe('quejasPct');
  });
});
