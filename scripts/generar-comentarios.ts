// Escribe los archivos de comentarios de clientes:
// - R2 en español: corrige los textos que contradecían su evidencia (la evidencia no cambia)
// - R2 en inglés: traducción fiel con los mismos ID
// - Bases originales A y B, en español e inglés
// Uso: npx tsx scripts/generar-comentarios.ts
import * as path from 'node:path';
import XLSX from 'xlsx';
import { TEXTOS_R2, CATEGORIAS_EN, CANALES_EN } from './comentarios/r2.js';
import { comentariosOriginales } from './comentarios/originales.js';
import { cargarCombinacion, rutaComentarios } from '../src/servidor/datos/cargador.js';
import { ENCABEZADOS_COMENTARIOS } from '../src/servidor/datos/parseo.js';
import type { SolicitudDerivada } from '../src/servidor/datos/derivados.js';
import type { ClaveDatos } from '../src/compartido/configuracion.js';

const CAMPOS = ['id', 'solicitudNum', 'estado', 'sucursalNum', 'intentos', 'canalCaptacion', 'fechaComentario', 'categoriaPrimaria', 'categoriaSecundaria', 'comentarioCliente'];

function evidencia(s: SolicitudDerivada, idioma: 'es' | 'en'): string {
  const otros = s.erroresOtros > 0 ? (idioma === 'es' ? `, ${s.erroresOtros} otros` : `, ${s.erroresOtros} other`) : '';
  return idioma === 'es'
    ? `${s.numTries} intentos. Errores: ${s.erroresCaptura} captura, ${s.erroresIncompletos} incompletos, ${s.erroresIlegibles} ilegibles${otros}. Ventana de captura ${s.ventanaCaptura} dias. Estatus: ${s.lastStatus}. Sucursal ${s.branchNum}.`
    : `${s.numTries} tries. Errors: ${s.erroresCaptura} input, ${s.erroresIncompletos} incomplete, ${s.erroresIlegibles} illegible${otros}. Capture window ${s.ventanaCaptura} days. Status: ${s.lastStatus}. Branch ${s.branchNum}.`;
}

function traducirEvidencia(ev: string): string {
  return ev
    .replace(/(\d+) intentos\./, '$1 tries.')
    .replace('Errores:', 'Errors:')
    .replace(/(\d+) captura/, '$1 input')
    .replace(/(\d+) incompletos/, '$1 incomplete')
    .replace(/(\d+) ilegibles/, '$1 illegible')
    .replace(/Ventana de captura (\d+) dias/, 'Capture window $1 days')
    .replace('Estatus:', 'Status:')
    .replace('Sucursal', 'Branch');
}

function escribir(ruta: string, idioma: 'es' | 'en', titulo: string, nota: string, columnaEvidencia: string, filas: unknown[][]) {
  const encabezados = [...CAMPOS.map((c) => ENCABEZADOS_COMENTARIOS[c]![idioma]), columnaEvidencia];
  const ws = XLSX.utils.aoa_to_sheet([[titulo], [nota], [], encabezados, ...filas], { cellDates: true });
  ws['!cols'] = encabezados.map((_, i) => ({ wch: i === 9 ? 90 : i === 10 ? 70 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, idioma === 'es' ? 'Comentarios' : 'Comments');
  XLSX.writeFile(wb, ruta);
  console.log(`${path.basename(ruta)}: ${filas.length} comentarios`);
}

function generarR2() {
  // Español: se reescribe solo la columna del texto, en el libro original
  const rutaEs = rutaComentarios('R2');
  const wb = XLSX.readFile(rutaEs, { cellStyles: true, cellNF: true });
  const ws = wb.Sheets['Comentarios']!;
  const rango = XLSX.utils.decode_range(ws['!ref']!);
  const filasEn: unknown[][] = [];
  for (let r = 4; r <= rango.e.r; r++) {
    const id = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v as string | undefined;
    if (!id) continue;
    const textos = TEXTOS_R2[id];
    if (!textos) throw new Error(`Sin texto para ${id}`);
    const celda = ws[XLSX.utils.encode_cell({ r, c: 9 })]!;
    celda.v = textos.es;
    delete celda.w;
    delete celda.h;
    delete celda.r;
    const v = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v ?? '';
    const fecha = ws[XLSX.utils.encode_cell({ r, c: 6 })];
    filasEn.push([
      id, v(1), v(2), v(3), v(4),
      CANALES_EN[String(v(5))] ?? v(5),
      typeof fecha?.v === 'number' ? new Date(Date.UTC(1899, 11, 30) + fecha.v * 86400000) : '',
      CATEGORIAS_EN[String(v(7))] ?? v(7),
      CATEGORIAS_EN[String(v(8))] ?? v(8),
      textos.en,
      traducirEvidencia(String(v(10))),
    ]);
  }
  XLSX.writeFile(wb, rutaEs, { cellStyles: true });
  console.log(`${path.basename(rutaEs)}: textos actualizados`);
  escribir(rutaComentarios('R2_en'), 'en',
    'Synthetic customer comments  |  ETF Bank case (P 16 C 03)  |  Base R2',
    'Each comment is anchored to a real record of the MX CAMPUS sheet in R2. The Evidence column must not be given to participants.',
    'Evidence in base R2', filasEn);
}

function generarOriginal(clave: Exclude<ClaveDatos, 'R2'>) {
  const [base, idioma] = clave.split('_') as ['A' | 'B', 'es' | 'en'];
  const datos = cargarCombinacion(clave);
  const porNum = new Map(datos.solicitudes.map((s) => [s.applicationNum, s]));
  const filas = comentariosOriginales(base, idioma).map((c) => {
    const s = porNum.get(c.solicitud);
    if (!s) throw new Error(`${c.id}: la solicitud ${c.solicitud} no existe en ${clave}`);
    const tr = (t: string) => (idioma === 'en' ? CATEGORIAS_EN[t] ?? t : t);
    return [
      c.id, s.applicationNum, s.state, s.branchNum, s.numTries,
      idioma === 'en' ? CANALES_EN[c.canal] : c.canal,
      new Date(`${c.fecha}T00:00:00Z`), tr(c.primaria), tr(c.secundaria), c.texto, evidencia(s, idioma),
    ];
  });
  escribir(rutaComentarios(clave), idioma,
    idioma === 'es' ? `Verbalizaciones sinteticas de clientes  |  Caso ETF Bank (P 16 C 03)  |  Base ${base}` : `Synthetic customer comments  |  ETF Bank case (P 16 C 03)  |  Base ${base}`,
    idioma === 'es' ? `Cada comentario esta anclado a una solicitud real de la base ${base}. La columna Evidencia no debe entregarse a los participantes.` : `Each comment is anchored to a real application of base ${base}. The Evidence column must not be given to participants.`,
    idioma === 'es' ? `Evidencia en la base ${base}` : `Evidence in base ${base}`, filas);
}

generarR2();
for (const c of ['A_es', 'A_en', 'B_es', 'B_en'] as const) generarOriginal(c);
