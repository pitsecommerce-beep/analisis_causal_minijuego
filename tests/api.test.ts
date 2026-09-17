import { describe, it, expect } from 'vitest';
import { serializarDialogo, deserializarDialogo } from '../src/servidor/db/serializar.js';
import { crearEstadoDialogo } from '../src/servidor/dialogos/motor-dialogos.js';

describe('Serialización de estado de diálogo', () => {
  it('Serializa y deserializa sin perder datos', () => {
    const estado = crearEstadoDialogo();
    estado.verificaciones.add('medianas_iguales');
    estado.verificaciones.add('error_captura_frecuente');
    estado.refutaciones.add('medianas_iguales');
    estado.convencidos.add('bernardo');
    estado.accionesAceptadas.push(1, 4, 5);
    estado.postergados.add('oscar');

    const json = serializarDialogo(estado);
    expect(json.verificaciones).toEqual(['medianas_iguales', 'error_captura_frecuente']);
    expect(json.refutaciones).toEqual(['medianas_iguales']);
    expect(json.convencidos).toEqual(['bernardo']);
    expect(json.accionesAceptadas).toEqual([1, 4, 5]);
    expect(json.postergados).toEqual(['oscar']);

    const restaurado = deserializarDialogo(json);
    expect(restaurado.verificaciones.has('medianas_iguales')).toBe(true);
    expect(restaurado.verificaciones.has('error_captura_frecuente')).toBe(true);
    expect(restaurado.refutaciones.has('medianas_iguales')).toBe(true);
    expect(restaurado.convencidos.has('bernardo')).toBe(true);
    expect(restaurado.accionesAceptadas).toEqual([1, 4, 5]);
    expect(restaurado.postergados.has('oscar')).toBe(true);
  });

  it('Deserializa datos vacíos sin errores', () => {
    const json = {
      verificaciones: [],
      refutaciones: [],
      convencidos: [],
      accionesAceptadas: [],
      postergados: [],
    };
    const estado = deserializarDialogo(json);
    expect(estado.verificaciones.size).toBe(0);
    expect(estado.accionesAceptadas.length).toBe(0);
  });
});

describe('Migración SQL', () => {
  it('El archivo de migración existe y tiene las tablas requeridas', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const ruta = path.resolve('supabase/migrations/001_esquema_inicial.sql');
    const contenido = fs.readFileSync(ruta, 'utf-8');

    expect(contenido).toContain('sesiones_juego');
    expect(contenido).toContain('jugadores');
    expect(contenido).toContain('partidas');
    expect(contenido).toContain('verificaciones_jugador');
    expect(contenido).toContain('gen_random_uuid()');
    expect(contenido).toContain('ROW LEVEL SECURITY');
  });
});

describe('Configuración de verificaciones', () => {
  it('Todas las verificaciones tienen id y campo requerido', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const ruta = path.resolve('config/verificaciones.json');
    const reglas = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    const claves = Object.keys(reglas);

    expect(claves.length).toBeGreaterThanOrEqual(5);
    for (const clave of claves) {
      expect(typeof clave).toBe('string');
      expect(reglas[clave].descripcion).toBeDefined();
      expect(reglas[clave].condiciones).toBeDefined();
    }
  });
});
