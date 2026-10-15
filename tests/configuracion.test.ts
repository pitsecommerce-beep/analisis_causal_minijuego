import { describe, it, expect, vi } from 'vitest';
import { validarConfig, vincular, configDeSesion, claveDatos, CONFIG_POR_DEFECTO } from '../src/compartido/configuracion.js';
import { soloModoCompleto } from '../src/servidor/api/middleware.js';

describe('vinculación de parámetros de sesión', () => {
  it('informativo implica original y original implica informativo', () => {
    expect(vincular(CONFIG_POR_DEFECTO, { modo: 'informativo' })).toMatchObject({ modo: 'informativo', version: 'original' });
    expect(vincular(CONFIG_POR_DEFECTO, { version: 'original' })).toMatchObject({ modo: 'informativo', version: 'original' });
    const info = vincular(CONFIG_POR_DEFECTO, { modo: 'informativo', base: 'B' });
    expect(vincular(info, { modo: 'completo' })).toEqual({ modo: 'completo', version: 'extendida', base: 'A', idioma: 'es' });
  });

  it('la versión extendida fija la base A', () => {
    const b = vincular(CONFIG_POR_DEFECTO, { version: 'original', base: 'B' });
    expect(b.base).toBe('B');
    expect(vincular(b, { version: 'extendida' }).base).toBe('A');
  });

  it('el servidor rechaza combinaciones contradictorias', () => {
    expect(validarConfig({ modo: 'informativo', version: 'extendida' }).ok).toBe(false);
    expect(validarConfig({ modo: 'completo', version: 'original' }).ok).toBe(false);
    expect(validarConfig({ modo: 'completo', base: 'B' }).ok).toBe(false);
    expect(validarConfig({ idioma: 'fr' }).ok).toBe(false);
    expect(validarConfig({ modo: 'raro' }).ok).toBe(false);
  });

  it('completa los parámetros ausentes según el vínculo', () => {
    expect(validarConfig({})).toEqual({ ok: true, config: CONFIG_POR_DEFECTO });
    expect(validarConfig({ modo: 'informativo', base: 'B', idioma: 'en' }))
      .toEqual({ ok: true, config: { modo: 'informativo', version: 'original', base: 'B', idioma: 'en' } });
    expect(validarConfig({ version: 'original' })).toMatchObject({ ok: true, config: { modo: 'informativo', base: 'A' } });
  });

  it('una sesión anterior a la migración se lee como completo en español', () => {
    expect(configDeSesion({ id: 'x', nombre: 'vieja' })).toEqual(CONFIG_POR_DEFECTO);
    expect(configDeSesion(null)).toEqual(CONFIG_POR_DEFECTO);
  });

  it('cada configuración apunta a su base de datos', () => {
    expect(claveDatos(CONFIG_POR_DEFECTO)).toBe('R2');
    expect(claveDatos({ ...CONFIG_POR_DEFECTO, idioma: 'en' })).toBe('R2');
    expect(claveDatos({ modo: 'informativo', version: 'original', base: 'B', idioma: 'en' })).toBe('B_en');
    expect(claveDatos({ modo: 'informativo', version: 'original', base: 'A', idioma: 'es' })).toBe('A_es');
  });
});

describe('bloqueo de rutas de juego en modo informativo', () => {
  function probar(modo: 'completo' | 'informativo') {
    const req = { jugador: { config: { ...CONFIG_POR_DEFECTO, modo } } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
    const next = vi.fn();
    soloModoCompleto(req, res, next);
    return { res, next };
  }

  it('rechaza con 403 en modo informativo', () => {
    const { res, next } = probar('informativo');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar en modo completo', () => {
    const { res, next } = probar('completo');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('protege acciones, avanzar, compromiso, votación y cierre en el servidor', async () => {
    const fs = await import('node:fs');
    const fuente = fs.readFileSync('src/servidor/api/servidor.ts', 'utf-8');
    for (const ruta of ['acciones', 'avanzar', 'compromiso', 'votacion', 'cierre']) {
      expect(fuente).toMatch(new RegExp(`'/api/partida/${ruta}', autenticarJugador, soloModoCompleto`));
    }
  });
});
