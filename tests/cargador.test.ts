import { describe, it, expect } from 'vitest';
import { cargarDesdeExcel, serializarDatos, deserializarDatos } from '../src/servidor/datos/cargador.js';

describe('datos precalculados', () => {
  it('equivalen a parsear los Excel', () => {
    const datos = cargarDesdeExcel();
    expect(deserializarDatos(serializarDatos(datos))).toEqual(datos);
  });
});
