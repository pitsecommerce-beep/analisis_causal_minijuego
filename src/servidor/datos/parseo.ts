import XLSX from 'xlsx';
import { eventosDe } from '../../compartido/expediente.js';
import type { TipoError, Vocabulario } from '../../compartido/expediente.js';

const MESES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

export interface SolicitudCruda {
  applicationNum: number;
  customerNum: number;
  age: number;
  maritalStatus: string;
  gender: string;
  state: string;
  branchNum: number;
  yearsAsCustomer: number;
  creditBureauScore: number | null;
  etfBankScore: number | null;
  dateFirstInput: Date;
  dateLastInput: Date;
  numTries: number;
  dateDocsSent: Date;
  dateDocsReceived: Date;
  creditBureauResult: string | null;
  creditBureauRunDate: Date | null;
  etfBankScoreResult: string | null;
  etfbScoreDate: Date | null;
  datePlasticSent: Date | null;
  lastStatus: string;
  creditLineGranted: number | null;
  comments: string;
  // Columnas adicionales que trae el archivo original de la base B
  extras?: Record<string, number | null>;
}

export interface ErrorParseado {
  tipo: TipoError;
  textoOriginal: string;
}

export interface ComentarioCliente {
  id: string;
  solicitudNum: number;
  estado: string;
  sucursalNum: number;
  intentos: number;
  canalCaptacion: string;
  fechaComentario: Date | null;
  categoriaPrimaria: string;
  categoriaSecundaria: string;
  comentarioCliente: string;
}

function excelDateToJS(serial: number): Date {
  const epoch = new Date(Date.UTC(1899, 11, 30));
  return new Date(epoch.getTime() + serial * 86400000);
}

function parseExcelDate(val: unknown): Date | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return excelDateToJS(val);
  const s = String(val).trim().toLowerCase();
  if (s === 'na' || s === 'n/a' || s === '') return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function limpiarTexto(val: unknown): string {
  if (val == null) return '';
  return String(val).trim();
}

function limpiarNumero(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export function parsearErrores(comments: string, vocabulario: Vocabulario = 'R2'): ErrorParseado[] {
  if (!comments || comments.trim() === '') return [];
  const errores: ErrorParseado[] = [];
  for (const e of eventosDe(vocabulario)) {
    if (!e.esError) continue;
    for (const m of comments.match(e.patron) ?? []) errores.push({ tipo: e.tipo as ErrorParseado['tipo'], textoOriginal: m.toLowerCase() });
  }
  return errores;
}

// Encabezados de cada campo en los Excel del caso, en inglés y en español
export const ENCABEZADOS: Record<string, { en: string; es: string }> = {
  applicationNum: { en: 'Application #', es: '# Solicitud' },
  customerNum: { en: 'Customer #', es: '# Cliente' },
  age: { en: 'Age', es: 'Edad' },
  maritalStatus: { en: 'Marital Status', es: 'Edo. Civil' },
  gender: { en: 'Gender', es: 'Genero' },
  state: { en: 'State', es: 'Estado' },
  branchNum: { en: 'Branch #', es: '# Sucursal' },
  yearsAsCustomer: { en: 'Years as customer', es: 'Años como cliente' },
  creditBureauScore: { en: 'Credit Bureau Score', es: 'Score Buró crédito' },
  etfBankScore: { en: 'ETFBank Score', es: 'Score ETFBank' },
  dateFirstInput: { en: 'Date of first data input', es: 'Fecha de primer captura' },
  dateLastInput: { en: 'Date of last data input', es: 'Fecha última captura' },
  numTries: { en: '# of tries', es: '# intentos' },
  timePasses: { en: 'Time passes', es: 'Tiempo transcurrido' },
  cropDeliveryTime: { en: 'Crop+delivery time', es: 'Tiempo CrOP y entrega' },
  dateDocsSent: { en: 'Date documents sent', es: 'Fecha envio documentos' },
  executiveTime: { en: 'Executive time', es: 'Tiempo del ejecutivo' },
  dateDocsReceived: { en: 'Date documents Received at CrOP', es: 'Fecha recepción de documentos CrOP' },
  creditBureauResult: { en: 'Credit Bureau result', es: 'Resultado Buró crédito' },
  creditBureauRunDate: { en: 'Credit Bureau run date', es: 'Fecha de consulta a Buró' },
  etfBankScoreResult: { en: 'ETFBank Score result', es: 'Resultado score ETFBank' },
  etfbScoreDate: { en: 'ETFB Score Date', es: 'Fecha consulta score ETFB' },
  datePlasticSent: { en: 'Date Plastic Sent', es: 'Fecha envío plástico' },
  cropTime: { en: 'CROP Time', es: 'Tiempo CrOP' },
  lastStatus: { en: 'Last Status', es: 'último status' },
  creditLineGranted: { en: 'Credit Line Granted', es: 'Monto de línea otorgada' },
  comments: { en: 'Comments', es: 'Comentarios' },
};

// Columnas que solo trae la base B en su archivo original
export const CAMPOS_EXTRA_B = ['timePasses', 'cropDeliveryTime', 'executiveTime', 'cropTime'] as const;

// Encuentra cada campo por su encabezado, sin importar idioma, mayúsculas ni espacios sobrantes
function lectorDeFila(encabezados: string[]): (r: Record<string, unknown>, campo: string) => unknown {
  const norm = (t: string) => t.trim().toLowerCase();
  const indice = new Map<string, string>();
  for (const h of encabezados) indice.set(norm(h), h);
  return (r, campo) => {
    const e = ENCABEZADOS[campo]!;
    const h = indice.get(norm(e.en)) ?? indice.get(norm(e.es));
    return h == null ? undefined : r[h];
  };
}

export function cargarSolicitudes(rutaArchivo: string): SolicitudCruda[] {
  const wb = XLSX.readFile(rutaArchivo);
  // R2 trae la hoja "MX CAMPUS"; las bases originales usan la primera hoja del libro
  const ws = wb.Sheets['MX CAMPUS'] ?? wb.Sheets[wb.SheetNames[0]!];
  if (!ws) throw new Error(`Hoja de solicitudes no encontrada en ${rutaArchivo}`);
  const encabezados = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] ?? []) as string[];
  const leer = lectorDeFila(encabezados.map(String));
  const filas = (XLSX.utils.sheet_to_json(ws, { raw: true }) as Record<string, unknown>[])
    .filter((r) => leer(r, 'applicationNum') != null);
  const tieneExtras = CAMPOS_EXTRA_B.some((c) => encabezados.some((h) => String(h).trim() === ENCABEZADOS[c]!.en || String(h).trim() === ENCABEZADOS[c]!.es));

  return filas.map((r) => {
    const s: SolicitudCruda = {
      applicationNum: Number(leer(r, 'applicationNum')),
      customerNum: Number(leer(r, 'customerNum')),
      age: Number(leer(r, 'age')),
      maritalStatus: limpiarTexto(leer(r, 'maritalStatus')),
      gender: limpiarTexto(leer(r, 'gender')),
      state: limpiarTexto(leer(r, 'state')),
      branchNum: Number(leer(r, 'branchNum')),
      yearsAsCustomer: Number(leer(r, 'yearsAsCustomer')),
      creditBureauScore: limpiarNumero(leer(r, 'creditBureauScore')),
      etfBankScore: limpiarNumero(leer(r, 'etfBankScore')),
      dateFirstInput: excelDateToJS(Number(leer(r, 'dateFirstInput'))),
      dateLastInput: excelDateToJS(Number(leer(r, 'dateLastInput'))),
      numTries: Number(leer(r, 'numTries')),
      dateDocsSent: excelDateToJS(Number(leer(r, 'dateDocsSent'))),
      dateDocsReceived: excelDateToJS(Number(leer(r, 'dateDocsReceived'))),
      creditBureauResult: limpiarTexto(leer(r, 'creditBureauResult')) || null,
      creditBureauRunDate: parseExcelDate(leer(r, 'creditBureauRunDate')),
      etfBankScoreResult: limpiarTexto(leer(r, 'etfBankScoreResult')) || null,
      etfbScoreDate: parseExcelDate(leer(r, 'etfbScoreDate')),
      datePlasticSent: parseExcelDate(leer(r, 'datePlasticSent')),
      lastStatus: limpiarTexto(leer(r, 'lastStatus')),
      creditLineGranted: limpiarNumero(leer(r, 'creditLineGranted')),
      comments: limpiarTexto(leer(r, 'comments')),
    };
    if (tieneExtras) {
      s.extras = {};
      for (const c of CAMPOS_EXTRA_B) s.extras[c] = limpiarNumero(leer(r, c));
    }
    return s;
  });
}

// Encabezados de la hoja de comentarios, en español (R2 y bases originales) y en inglés
export const ENCABEZADOS_COMENTARIOS: Record<string, { es: string; en: string }> = {
  id: { es: 'ID', en: 'ID' },
  solicitudNum: { es: 'Solicitud #', en: 'Application #' },
  estado: { es: 'Estado', en: 'State' },
  sucursalNum: { es: 'Sucursal #', en: 'Branch #' },
  intentos: { es: 'Intentos', en: 'Tries' },
  canalCaptacion: { es: 'Canal de captacion', en: 'Channel' },
  fechaComentario: { es: 'Fecha del comentario', en: 'Comment date' },
  categoriaPrimaria: { es: 'Categoria primaria', en: 'Primary category' },
  categoriaSecundaria: { es: 'Categoria secundaria', en: 'Secondary category' },
  comentarioCliente: { es: 'Comentario del cliente', en: 'Customer comment' },
};

export function cargarComentarios(rutaArchivo: string): ComentarioCliente[] {
  const wb = XLSX.readFile(rutaArchivo);
  const ws = wb.Sheets['Comentarios'] ?? wb.Sheets['Comments'];
  if (!ws) throw new Error(`Hoja de comentarios no encontrada en ${rutaArchivo}`);
  const filas = XLSX.utils.sheet_to_json(ws, { raw: true, range: 3 }) as Record<string, unknown>[];
  const leer = (r: Record<string, unknown>, campo: string) => {
    const e = ENCABEZADOS_COMENTARIOS[campo]!;
    return r[e.es] ?? r[e.en];
  };

  return filas
    .filter((r) => leer(r, 'id') != null && String(leer(r, 'id')).trim() !== '')
    .map((r) => ({
      id: limpiarTexto(leer(r, 'id')),
      solicitudNum: Number(leer(r, 'solicitudNum')),
      estado: limpiarTexto(leer(r, 'estado')),
      sucursalNum: Number(leer(r, 'sucursalNum')),
      intentos: Number(leer(r, 'intentos')),
      canalCaptacion: limpiarTexto(leer(r, 'canalCaptacion')),
      fechaComentario: parseExcelDate(leer(r, 'fechaComentario')),
      categoriaPrimaria: limpiarTexto(leer(r, 'categoriaPrimaria')),
      categoriaSecundaria: limpiarTexto(leer(r, 'categoriaSecundaria')),
      comentarioCliente: limpiarTexto(leer(r, 'comentarioCliente')),
    }));
}
