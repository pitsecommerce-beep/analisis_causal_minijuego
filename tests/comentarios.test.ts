import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import XLSX from 'xlsx';
import { cargarDesdeExcel } from '../src/servidor/datos/cargador.js';
import { problemasComentario, problemasComentarios } from '../src/servidor/datos/coherencia.js';
import { CLAVES_DATOS } from '../src/compartido/configuracion.js';

const todos = cargarDesdeExcel();

describe('coherencia entre comentario y evidencia', () => {
  for (const clave of CLAVES_DATOS) {
    it(`${clave}: ningún comentario contradice su solicitud`, () => {
      const d = todos[clave];
      expect(d.comentarios.length).toBeGreaterThan(0);
      expect(problemasComentarios(d.comentarios, d.solicitudes)).toEqual([]);
      if (d.comentariosEn) expect(problemasComentarios(d.comentariosEn, d.solicitudes)).toEqual([]);
    });
  }

  it('el validador detecta las contradicciones que tenía R2', () => {
    const r2 = todos.R2;
    const s = (n: number) => r2.solicitudes.find((x) => x.applicationNum === n)!;
    const c = (id: string, solicitudNum: number, texto: string, primaria = 'Reproceso documental') => {
      const base = r2.comentarios.find((x) => x.id === id)!;
      return { ...base, solicitudNum, categoriaPrimaria: primaria, comentarioCliente: texto };
    };
    // C-004: incompletos en dos ocasiones, con 0 incompletos
    expect(problemasComentario(c('C-004', 434, 'Me pidieron documentos incompletos en dos ocasiones distintas.'), s(434))).not.toEqual([]);
    // C-030: dos veces por incompletos, con 1
    expect(problemasComentario(c('C-030', 473, 'Mi expediente lo devolvieron dos veces por documentos incompletos.'), s(473))).not.toEqual([]);
    // C-080: tres veces con 2 intentos, y culpa al buró con Score Rejected
    const c080 = problemasComentario(c('C-080', 1023, 'Si el buro era el problema, pudieron consultarlo antes de pedirme tres veces los mismos papeles.', 'Rechazo'), s(1023));
    expect(c080.length).toBe(2);
    // C-087: "1 rondas"
    expect(problemasComentario(c('C-087', 277, '1 rondas de documentos.'), s(277))).not.toEqual([]);
  });

  it('R2 ya no repite plantillas', () => {
    expect(new Set(todos.R2.comentarios.map((c) => c.comentarioCliente)).size).toBe(todos.R2.comentarios.length);
  });

  it('la evidencia de R2 no cambió', () => {
    const evidencia = (wb: XLSX.WorkBook) =>
      (XLSX.utils.sheet_to_json(wb.Sheets['Comentarios']!, { header: 1, range: 4 }) as unknown[][]).map((f) => [f[0], f[10]]);
    let original: Buffer;
    try {
      // Último commit antes de corregir los textos
      original = execSync('git show 7085d3c:datos/R2_ETF_Bank_Comentarios_Clientes.xlsx', { maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return; // sin ese historial no hay contra qué comparar
    }
    expect(evidencia(XLSX.readFile('datos/R2_ETF_Bank_Comentarios_Clientes.xlsx'))).toEqual(evidencia(XLSX.read(original)));
  });
});

describe('comentarios de las bases originales', () => {
  const originales = ['A_es', 'A_en', 'B_es', 'B_en'] as const;

  it('tienen entre 25 y 30 comentarios y fechas dentro de la ventana de la base', () => {
    for (const c of originales) {
      const com = todos[c].comentarios;
      expect(com.length).toBeGreaterThanOrEqual(25);
      expect(com.length).toBeLessThanOrEqual(30);
      for (const x of com) {
        expect(x.fechaComentario!.getTime()).toBeGreaterThanOrEqual(Date.UTC(2015, 5, 1));
        expect(x.fechaComentario!.getTime()).toBeLessThan(Date.UTC(2015, 11, 1));
      }
    }
  });

  it('las versiones en inglés tienen los mismos ID y solicitudes', () => {
    for (const b of ['A', 'B']) {
      const es = todos[`${b}_es` as 'A_es'].comentarios.map((c) => `${c.id}|${c.solicitudNum}`);
      const en = todos[`${b}_en` as 'A_en'].comentarios.map((c) => `${c.id}|${c.solicitudNum}`);
      expect(en).toEqual(es);
    }
  });

  it('dominan reproceso documental y error de captura', () => {
    for (const c of originales) {
      const com = todos[c].comentarios;
      const principales = com.filter((x) => /reproceso|rework|captura|input error/i.test(x.categoriaPrimaria)).length;
      expect(principales / com.length).toBeGreaterThan(0.65);
    }
  });

  function topSucursales(c: (typeof originales)[number]) {
    const conteo = new Map<number, number>();
    for (const x of todos[c].comentarios) conteo.set(x.sucursalNum, (conteo.get(x.sucursalNum) ?? 0) + 1);
    return [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s).sort();
  }

  it('en A las quejas apuntan a las sucursales 110 y 676', () => {
    expect(topSucursales('A_es')).toEqual([110, 676]);
    expect(topSucursales('A_en')).toEqual([110, 676]);
  });

  it('en B las quejas apuntan a las sucursales 336 y 637', () => {
    expect(topSucursales('B_es')).toEqual([336, 637]);
    expect(topSucursales('B_en')).toEqual([336, 637]);
  });
});
