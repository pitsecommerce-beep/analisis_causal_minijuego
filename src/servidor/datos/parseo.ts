import XLSX from 'xlsx';

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
}

export interface ErrorParseado {
  tipo: 'captura' | 'incompletos' | 'ilegibles';
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

export function parsearErrores(comments: string): ErrorParseado[] {
  if (!comments || comments.trim() === '') return [];
  const lower = comments.toLowerCase();
  const errores: ErrorParseado[] = [];

  const patronesCaptura = ['input error', 'error de catura'];
  const patronesIncompletos = ['incomplete documents'];
  const patronesIlegibles = ['illegible document'];

  for (const p of patronesCaptura) {
    let idx = 0;
    while ((idx = lower.indexOf(p, idx)) !== -1) {
      errores.push({ tipo: 'captura', textoOriginal: p });
      idx += p.length;
    }
  }

  for (const p of patronesIncompletos) {
    let idx = 0;
    while ((idx = lower.indexOf(p, idx)) !== -1) {
      errores.push({ tipo: 'incompletos', textoOriginal: p });
      idx += p.length;
    }
  }

  for (const p of patronesIlegibles) {
    let idx = 0;
    while ((idx = lower.indexOf(p, idx)) !== -1) {
      errores.push({ tipo: 'ilegibles', textoOriginal: p });
      idx += p.length;
    }
  }

  return errores;
}

export function cargarSolicitudes(rutaArchivo: string): SolicitudCruda[] {
  const wb = XLSX.readFile(rutaArchivo);
  const ws = wb.Sheets['MX CAMPUS'];
  if (!ws) throw new Error('Hoja "MX CAMPUS" no encontrada');
  const filas = XLSX.utils.sheet_to_json(ws, { raw: true }) as Record<string, unknown>[];

  return filas.map((r) => ({
    applicationNum: Number(r['Application #']),
    customerNum: Number(r['Customer #']),
    age: Number(r['Age']),
    maritalStatus: limpiarTexto(r['Marital Status']),
    gender: limpiarTexto(r['Gender']),
    state: limpiarTexto(r['State']),
    branchNum: Number(r['Branch #']),
    yearsAsCustomer: Number(r['Years as customer']),
    creditBureauScore: limpiarNumero(r['Credit Bureau Score']),
    etfBankScore: limpiarNumero(r['ETFBank Score']),
    dateFirstInput: excelDateToJS(Number(r['Date of first data input'])),
    dateLastInput: excelDateToJS(Number(r['Date of last data input'])),
    numTries: Number(r['# of tries']),
    dateDocsSent: excelDateToJS(Number(r['Date documents sent'])),
    dateDocsReceived: excelDateToJS(Number(r['Date documents Received at CrOP'])),
    creditBureauResult: limpiarTexto(r['Credit Bureau result']) || null,
    creditBureauRunDate: parseExcelDate(r['Credit Bureau run date']),
    etfBankScoreResult: limpiarTexto(r['ETFBank Score result']) || null,
    etfbScoreDate: parseExcelDate(r['ETFB Score Date']),
    datePlasticSent: parseExcelDate(r['Date Plastic Sent']),
    lastStatus: limpiarTexto(r['Last Status']),
    creditLineGranted: limpiarNumero(r['Credit Line Granted']),
    comments: limpiarTexto(r['Comments']),
  }));
}

export function cargarComentarios(rutaArchivo: string): ComentarioCliente[] {
  const wb = XLSX.readFile(rutaArchivo);
  const ws = wb.Sheets['Comentarios'];
  if (!ws) throw new Error('Hoja "Comentarios" no encontrada');
  const filas = XLSX.utils.sheet_to_json(ws, { raw: true, range: 3 }) as Record<string, unknown>[];

  return filas
    .filter((r) => r['ID'] != null && String(r['ID']).trim() !== '')
    .map((r) => ({
      id: limpiarTexto(r['ID']),
      solicitudNum: Number(r['Solicitud #']),
      estado: limpiarTexto(r['Estado']),
      sucursalNum: Number(r['Sucursal #']),
      intentos: Number(r['Intentos']),
      canalCaptacion: limpiarTexto(r['Canal de captacion']),
      fechaComentario: parseExcelDate(r['Fecha del comentario']),
      categoriaPrimaria: limpiarTexto(r['Categoria primaria']),
      categoriaSecundaria: limpiarTexto(r['Categoria secundaria']),
      comentarioCliente: limpiarTexto(r['Comentario del cliente']),
    }));
}
