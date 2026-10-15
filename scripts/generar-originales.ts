// Genera los archivos derivados de las bases originales que no existen en el caso.
// Uso: npx tsx scripts/generar-originales.ts
import * as path from 'node:path';
import XLSX from 'xlsx';
import { ENCABEZADOS_B_ES, ESTATUS_ES, traducirComentario } from '../src/servidor/datos/traduccion-b.js';

const DIR = path.resolve('datos/original');

function generarBEs() {
  const wb = XLSX.readFile(path.join(DIR, 'B_en.xlsx'), { cellStyles: true, cellNF: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rango = XLSX.utils.decode_range(ws['!ref']!);
  const columnaDe: Record<string, number> = {};
  for (let c = rango.s.c; c <= rango.e.c; c++) {
    const celda = ws[XLSX.utils.encode_cell({ r: rango.s.r, c })];
    if (!celda) continue;
    const original = String(celda.v);
    columnaDe[original] = c;
    const traducido = ENCABEZADOS_B_ES[original];
    if (!traducido) throw new Error(`Encabezado sin traducción: ${original}`);
    fijar(celda, traducido);
  }
  for (let r = rango.s.r + 1; r <= rango.e.r; r++) {
    const estatus = ws[XLSX.utils.encode_cell({ r, c: columnaDe['Last Status']! })];
    if (estatus && typeof estatus.v === 'string') {
      const t = ESTATUS_ES[estatus.v.trim()];
      if (!t) throw new Error(`Estatus sin traducción: ${estatus.v}`);
      fijar(estatus, estatus.v.replace(estatus.v.trim(), t));
    }
    const comentario = ws[XLSX.utils.encode_cell({ r, c: columnaDe['Comments']! })];
    if (comentario && typeof comentario.v === 'string') fijar(comentario, traducirComentario(comentario.v));
  }
  XLSX.writeFile(wb, path.join(DIR, 'B_es.xlsx'), { cellStyles: true });
  console.log('B_es.xlsx generado');
}

function fijar(celda: XLSX.CellObject, valor: string) {
  celda.v = valor;
  celda.t = 's';
  delete celda.w;
  delete celda.h;
  delete celda.r;
}

generarBEs();
