// Traducción de la base B al español. Solo cambia encabezados, estatus y el vocabulario
// de la bitácora; valores, fechas y filas quedan intactos. La tabla está en datos/original/README.md.

export const ENCABEZADOS_B_ES: Record<string, string> = {
  'Application #': '# Solicitud',
  'Customer #': '# Cliente',
  'Age': 'Edad',
  'Marital Status': 'Edo. Civil',
  'Gender': 'Genero',
  'State': 'Estado',
  'Branch #': '# Sucursal',
  'Years as customer': 'Años como cliente',
  'Credit Bureau Score': 'Score Buró crédito',
  'ETFBank Score': 'Score ETFBank',
  'Date of first data input': 'Fecha de primer captura',
  'Date of last data input': 'Fecha última captura',
  '# of tries': '# intentos',
  'Time passes': 'Tiempo transcurrido',
  'Crop+delivery time': 'Tiempo CrOP y entrega',
  'Date documents sent': 'Fecha envio documentos',
  'Executive time': 'Tiempo del ejecutivo',
  'Date documents Received at CrOP': 'Fecha recepción de documentos CrOP',
  'Credit Bureau result': 'Resultado Buró crédito',
  'Credit Bureau run date': 'Fecha de consulta a Buró ',
  'ETFBank Score result': 'Resultado score ETFBank',
  'ETFB Score Date': 'Fecha consulta score ETFB',
  'Date Plastic Sent': 'Fecha envío plástico',
  'CROP Time': 'Tiempo CrOP',
  'Last Status': 'último status',
  'Credit Line Granted': 'Monto de línea otorgada',
  'Comments': 'Comentarios',
};

// Los mismos estatus que usa A_es
export const ESTATUS_ES: Record<string, string> = {
  'Card Sent': 'Tarjeta enviada',
  'Score Rejected': 'Rechazo Score',
  'Score Accepted': 'Aceptado Score',
  'Bureau Rejected': 'Rechazo Buró',
  'Documents received': 'Documentos recibidos',
  'Authorized': 'Autorizada',
  'Branch Executive task': 'Tarea Ejecutivo Sucursal',
};

// Vocabulario de la bitácora, con la redacción más frecuente en A_es. Se aplica en este orden.
export const VOCABULARIO_ES: [RegExp, string][] = [
  [/authorized for loan for/gi, 'se autoriza crédito por'],
  [/de autoriza el loan for/gi, 'de autoriza el crédito por'],
  [/authorized for/gi, 'se autoriza el crédito por'],
  [/authorized/gi, 'se autoriza'],
  [/aprobación for/gi, 'aprobación por'],
  [/incomplete documents/gi, 'documentación incompleta'],
  [/illegible documents/gi, 'documentos ilegibles'],
  [/illegible document/gi, 'documentación ilegible'],
  [/input error/gi, 'error de captura'],
  [/bureau rejected/gi, 'Rechazo Buró'],
  [/score rejected/gi, 'Rechazo Score'],
  [/invalid id/gi, 'identificación no valida'],
];

export function traducirComentario(texto: string): string {
  let t = texto;
  for (const [patron, reemplazo] of VOCABULARIO_ES) {
    t = t.replace(patron, (m) => (m[0] === m[0]!.toUpperCase() ? reemplazo[0]!.toUpperCase() + reemplazo.slice(1) : reemplazo));
  }
  return t;
}
