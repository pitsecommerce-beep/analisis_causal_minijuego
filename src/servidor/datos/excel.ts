import XLSX from 'xlsx';
import { ENCABEZADOS_COMENTARIOS } from './parseo.js';
import type { ComentarioCliente } from './parseo.js';
import type { Idioma } from '../../compartido/configuracion.js';

const CAMPOS: (keyof ComentarioCliente)[] = [
  'id', 'solicitudNum', 'estado', 'sucursalNum', 'intentos', 'canalCaptacion',
  'fechaComentario', 'categoriaPrimaria', 'categoriaSecundaria', 'comentarioCliente',
];

// Libro de comentarios para descargar: encabezados del caso en el idioma de la sesión y sin evidencia
export function libroComentarios(comentarios: ComentarioCliente[], idioma: Idioma): Buffer {
  const encabezados = CAMPOS.map((c) => ENCABEZADOS_COMENTARIOS[c]![idioma]);
  const filas = comentarios.map((c) => CAMPOS.map((campo) => c[campo] ?? ''));
  const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas], { cellDates: true, dateNF: 'yyyy-mm-dd' });
  ws['!cols'] = CAMPOS.map((c) => ({ wch: c === 'comentarioCliente' ? 90 : 16 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, idioma === 'en' ? 'Comments' : 'Comentarios');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
