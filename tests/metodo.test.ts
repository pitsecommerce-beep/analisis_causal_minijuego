import { describe, it, expect } from 'vitest';
import { evaluarHitos, resumirMetodo, avisosPorAcciones } from '../src/compartido/metodo.js';
import type { Evento } from '../src/compartido/metodo.js';
import { ESPINA_VACIA } from '../src/compartido/espina.js';
import type { Espina } from '../src/compartido/espina.js';

let t = 0;
const ev = (tipo: string, datos: Record<string, unknown> = {}): Evento => ({ tipo, datos, momento: new Date(Date.UTC(2026, 0, 1, 0, 0, t++)).toISOString() });
const analisis = (herramienta: string, columna: string, hoja = 'solicitudes', estrato: unknown = null) => ev('analisis', { herramienta, columna, hoja, estrato });

const espinaCon = (verificadas: string[]): Espina => ({
  ...ESPINA_VACIA,
  evidencias: [{ id: 'e', herramienta: 'pareto', hoja: 'solicitudes', columna: 'x', resumen: '', estrato: null, verificacionId: null, ciclo: 1, creada: '' }],
  tarjetas: ['a', 'b'].map(id => ({ id, rama: 'metodo', texto: id, origen: 'propio', estado: verificadas.includes(id) ? 'verificada' : 'hipotesis', evidencias: verificadas.includes(id) ? ['e'] : [], pendienteId: null, ciclo: 1, creada: '' })),
});

describe('Método medido por comportamiento', () => {
  it('reconoce los cinco hitos cuando ocurren en orden', () => {
    const eventos = [
      ev('vista', { vista: 'comentarios' }),
      analisis('pareto', 'categoriaPrimaria', 'comentarios'),
      analisis('pareto', 'erroresComentario'),
      analisis('pareto', 'erroresComentario', 'solicitudes', { campo: 'branchNum', valor: '110' }),
      ev('espina_tarjeta', { rama: 'metodo' }),
      ev('acciones', { acciones: [{ accionId: 2, tarjetaId: 'a', verificada: true }] }),
    ];
    expect(evaluarHitos(eventos, espinaCon(['a']))).toEqual({ percibir: true, definir: true, hipotesis: true, probar: true, estratificar: true });
  });

  it('no los reconoce si el orden o la evidencia no corresponden', () => {
    const eventos = [
      analisis('histograma', 'ventanaCaptura'),
      ev('vista', { vista: 'comentarios' }),
      analisis('pareto', 'state'),
      analisis('histograma', 'erroresComentario', 'solicitudes', { campo: 'branchNum', valor: '110' }),
      ev('acciones', { acciones: [{ accionId: 6, tarjetaId: 'b', verificada: false }] }),
      ev('espina_tarjeta', { rama: 'metodo' }),
    ];
    expect(evaluarHitos(eventos, espinaCon(['a']))).toEqual({ percibir: false, definir: false, hipotesis: false, probar: false, estratificar: false });
  });

  it('penaliza acciones sin causa verificada y capacitar a todas sin estratificar por sucursal', () => {
    const sinEstrato = resumirMetodo([analisis('pareto', 'erroresComentario'), ev('acciones', { acciones: [{ accionId: 3, tarjetaId: null, verificada: false }] })], ESPINA_VACIA);
    expect(sinEstrato.accionesSinVerificar).toBe(1);
    expect(sinEstrato.capacitoSinEstratificar).toBe(true);
    const conEstrato = resumirMetodo([analisis('contar', 'comments', 'solicitudes', { campo: 'branchNum', valor: '676' }), ev('acciones', { acciones: [{ accionId: 3, tarjetaId: 'a', verificada: true }] })], ESPINA_VACIA);
    expect(conEstrato.capacitoSinEstratificar).toBe(false);
    expect(conEstrato.herramientas).toEqual(['contar']);
  });

  it('Betancourt avisa cuando se decide sin sustento', () => {
    const nombres = { 3: 'Capacitación a las 18 sucursales', 5: 'Automatizar el envío del plástico' };
    const avisos = avisosPorAcciones([{ accionId: 3, tarjetaId: null, verificada: false }, { accionId: 5, tarjetaId: 'a', verificada: true }], nombres, []);
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toContain('18 sucursales');
    expect(avisos[1]).toContain('«Capacitación a las 18 sucursales»');
    expect(avisosPorAcciones([{ accionId: 5, tarjetaId: 'a', verificada: true }], nombres, [])).toEqual([]);
  });
});
