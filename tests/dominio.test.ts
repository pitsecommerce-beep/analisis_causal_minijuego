import { describe, it, expect } from 'vitest';
import { esCorreoProfesor } from '../src/servidor/api/dominio.js';

describe('Dominio de correo del profesor', () => {
  it('acepta correos @ipade.mx sin importar mayúsculas ni espacios', () => {
    expect(esCorreoProfesor('ana@ipade.mx')).toBe(true);
    expect(esCorreoProfesor('  Ana.Lopez@IPADE.MX ')).toBe(true);
  });

  it('rechaza otros dominios y subdominios engañosos', () => {
    expect(esCorreoProfesor('ana@gmail.com')).toBe(false);
    expect(esCorreoProfesor('ana@ipade.mx.com')).toBe(false);
    expect(esCorreoProfesor('ana@noipade.mx')).toBe(false);
    expect(esCorreoProfesor('ipade.mx')).toBe(false);
    expect(esCorreoProfesor(undefined)).toBe(false);
  });
});
