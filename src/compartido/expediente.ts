// Vocabulario de la bitácora del expediente (columna Comments / Comentarios).
// Lo comparten el cargador del servidor y las herramientas de análisis del cliente.

export type TipoError = 'captura' | 'incompletos' | 'ilegibles' | 'otros';
export type TipoCierre = 'autorizado' | 'rechazo_buro' | 'rechazo_score' | 'envio_plastico';
export type TipoEvento = TipoError | TipoCierre;

export interface DefEvento {
  tipo: TipoEvento;
  esError: boolean;
  patron: RegExp;
}

// En R2 se respeta el diccionario con que se verificó la base: "invalid id" no suma a los errores.
// En las bases originales "invalid id" e "identificación no válida" van a Otros errores.
export type Vocabulario = 'R2' | 'original';

const CAPTURA = /input error|error de catura|error de captura|error captura|erro en captura/gi;
const INCOMPLETOS = /incomplete documents|documentaci[oó]n incompleta|documentos incompletos/gi;
const ILEGIBLES = /illegible document|documentaci[oó]n ilegible|documentos ilegibles|ife ilegible/gi;
const OTROS = /identificaci[oó]n no v[aá]lida|documentaci[oó]n no corresponde a folio|invalid id/gi;

const CIERRES: DefEvento[] = [
  { tipo: 'autorizado', esError: false, patron: /authori[sz]ed|de autoriza|se autoriza|autorizaci[oó]n|aprobad[oa]|aprobaci[oó]n/gi },
  { tipo: 'rechazo_buro', esError: false, patron: /bureau rejected|rechazo (?:del )?bur[oó]/gi },
  { tipo: 'rechazo_score', esError: false, patron: /score rejected|rechazo score/gi },
  { tipo: 'envio_plastico', esError: false, patron: /env[ií]o de pl[aá]s?tico/gi },
];

export function eventosDe(vocabulario: Vocabulario): DefEvento[] {
  const errores: DefEvento[] = [
    { tipo: 'captura', esError: true, patron: CAPTURA },
    { tipo: 'incompletos', esError: true, patron: INCOMPLETOS },
    { tipo: 'ilegibles', esError: true, patron: ILEGIBLES },
  ];
  if (vocabulario === 'original') errores.push({ tipo: 'otros', esError: true, patron: OTROS });
  return [...errores, ...CIERRES];
}

export function contarCoincidencias(texto: string, patron: RegExp): number {
  return texto.match(patron)?.length ?? 0;
}

// Cuenta cada evento del texto por separado: "error de captura. documentación incompleta. se autoriza" son tres
export function contarEventos(texto: string, vocabulario: Vocabulario): Record<TipoEvento, number> {
  const out = {} as Record<TipoEvento, number>;
  for (const e of eventosDe(vocabulario)) out[e.tipo] = contarCoincidencias(texto ?? '', e.patron);
  return out;
}
