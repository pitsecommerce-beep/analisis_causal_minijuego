import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import XLSX from 'xlsx';
import { cargarDesdeExcel, cargarCombinacion, serializarDatos, deserializarDatos, rutaSolicitudes } from '../src/servidor/datos/cargador.js';
import { compararEsperados } from '../src/servidor/datos/esperados.js';
import { libroComentarios } from '../src/servidor/datos/excel.js';
import { claveDatos, CLAVES_DATOS } from '../src/compartido/configuracion.js';
import { contarEventos } from '../src/compartido/expediente.js';
import { traducirComentario } from '../src/servidor/datos/traduccion-b.js';

const todos = cargarDesdeExcel();

describe('datos precalculados', () => {
  it('equivalen a parsear los Excel', () => {
    expect(deserializarDatos(serializarDatos(todos))).toEqual(todos);
  });
});

describe('valores de verificación por base', () => {
  for (const clave of CLAVES_DATOS) {
    it(`${clave} reproduce sus valores esperados`, () => {
      const fallos = compararEsperados(clave, todos[clave].estadisticas).filter((r) => !r.ok);
      expect(fallos).toEqual([]);
    });
  }
});

describe('selección de datos por sesión', () => {
  it('cada configuración recibe su propia base', () => {
    const b = todos[claveDatos({ modo: 'informativo', version: 'original', base: 'B', idioma: 'en' })];
    const a = todos[claveDatos({ modo: 'informativo', version: 'original', base: 'A', idioma: 'es' })];
    const r2 = todos[claveDatos({ modo: 'completo', version: 'extendida', base: 'A', idioma: 'en' })];
    expect(r2.solicitudes).toHaveLength(1500);
    expect(a.solicitudes).toHaveLength(103);
    expect(b.solicitudes.some((s) => s.branchNum === 637)).toBe(true);
    expect(a.solicitudes.some((s) => s.branchNum === 637)).toBe(false);
    expect(a.solicitudes.find((s) => s.applicationNum === 25)!.lastStatus).toBe('Tarjeta enviada');
    expect(b.solicitudes.find((s) => s.applicationNum === 25)!.lastStatus).toBe('Card Sent');
  });

  it('las bases originales no traen verdad oculta', () => {
    expect(Object.keys(todos.A_en.verdadOculta)).toHaveLength(0);
    expect(Object.keys(todos.R2.verdadOculta).length).toBeGreaterThan(0);
  });

  it('la base B conserva las columnas derivadas de su archivo', () => {
    expect(todos.B_en.solicitudes[0]!.extras).toHaveProperty('timePasses');
    expect(todos.A_en.solicitudes[0]!.extras).toBeUndefined();
  });

  it('B_es solo traduce encabezados, estatus y bitácora', () => {
    const leer = (c: 'B_en' | 'B_es') => {
      const wb = XLSX.readFile(rutaSolicitudes(c));
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: true }) as unknown[][];
    };
    const en = leer('B_en');
    const es = leer('B_es');
    expect(es).toHaveLength(en.length);
    const ultimaCol = en[0]!.length - 1;
    for (let i = 1; i < en.length; i++) {
      for (let j = 0; j < en[0]!.length; j++) {
        if (en[0]![j] === 'Last Status' || j === ultimaCol) continue;
        expect(es[i]![j]).toEqual(en[i]![j]);
      }
    }
    expect(traducirComentario('3 sep input error. 10 oct authorized for loan for 26700.'))
      .toBe('3 sep error de captura. 10 oct se autoriza crédito por 26700.');
  });
});

describe('eventos del expediente en español e inglés', () => {
  it('cuenta cada evento por separado', () => {
    const es = contarEventos('5 ago error de captura. 18 ago documentación incompleta. 11 sep se autoriza el crédito por 56000.', 'original');
    expect(es).toMatchObject({ captura: 1, incompletos: 1, autorizado: 1, ilegibles: 0 });
    const en = contarEventos('5 ago input error. 18 ago incomplete documents. 11 sep authorized for 56000.', 'original');
    expect(en).toMatchObject({ captura: 1, incompletos: 1, autorizado: 1, ilegibles: 0 });
  });

  it('reconoce las variantes de captura de A_es', () => {
    const t = 'error captura. error de captura. erro en captura. error de catura. IFE ilegible. identificación no valida. Rechazo Buró.';
    expect(contarEventos(t, 'original')).toMatchObject({ captura: 4, ilegibles: 1, otros: 1, rechazo_buro: 1 });
  });

  it('invalid id es Otros errores solo en las bases originales', () => {
    expect(contarEventos('invalid id', 'original').otros).toBe(1);
    expect(contarEventos('invalid id', 'R2').otros).toBeUndefined();
  });
});

describe('descarga de Excel', () => {
  it('las solicitudes se descargan del archivo original', () => {
    for (const c of CLAVES_DATOS) expect(fs.existsSync(rutaSolicitudes(c))).toBe(true);
  });

  it('los comentarios llevan encabezados del idioma y no traen evidencia', () => {
    const comentarios = cargarCombinacion('R2').comentarios;
    for (const idioma of ['es', 'en'] as const) {
      const wb = XLSX.read(libroComentarios(comentarios, idioma));
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { header: 1 }) as unknown[][];
      expect(filas).toHaveLength(comentarios.length + 1);
      const encabezados = filas[0]!.map(String);
      expect(encabezados).toContain(idioma === 'en' ? 'Customer comment' : 'Comentario del cliente');
      expect(encabezados.some((h) => /evidenc/i.test(h))).toBe(false);
    }
  });
});
