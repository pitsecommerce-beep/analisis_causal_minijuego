import { describe, it, expect } from 'vitest';
import { estaConectado, MS_CONECTADO } from '../src/servidor/api/presencia.js';

describe('Presencia de participantes', () => {
  const ahora = Date.parse('2026-10-02T12:00:00Z');

  it('considera conectado a quien reportó actividad reciente', () => {
    expect(estaConectado(new Date(ahora - 10_000).toISOString(), ahora)).toBe(true);
  });

  it('considera desconectado a quien superó el intervalo', () => {
    expect(estaConectado(new Date(ahora - MS_CONECTADO - 1).toISOString(), ahora)).toBe(false);
  });

  it('trata la actividad vacía o inválida como desconectado', () => {
    expect(estaConectado(null, ahora)).toBe(false);
    expect(estaConectado('no-es-fecha', ahora)).toBe(false);
  });

  it('devuelve null cuando la base no registra presencia', () => {
    expect(estaConectado(undefined, ahora)).toBeNull();
  });
});
