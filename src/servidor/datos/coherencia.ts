// Revisa que el texto de un comentario de cliente no contradiga su solicitud:
// intentos, errores, días, fechas, montos, sucursal, antigüedad y estatus.
import type { SolicitudDerivada } from './derivados.js';
import type { ComentarioCliente } from './parseo.js';

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, once: 1, twice: 2,
};
const NUM = '(\\d+|un|una|uno|dos|tres|cuatro|cinco|seis|one|two|three|four|five|six)';
const aNum = (t: string) => NUMEROS[t.toLowerCase()] ?? Number(t.replace(/,/g, ''));

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const APROBADOS = ['card sent', 'score accepted', 'authorized', 'tarjeta enviada', 'aceptado score', 'autorizada'];
const RECHAZO_BURO = ['bureau rejected', 'rechazo buró'];
const RECHAZO_SCORE = ['score rejected', 'rechazo score'];

const DIA = 86_400_000;
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DIA);
const valida = (d: Date | null | undefined): d is Date => !!d && !Number.isNaN(d.getTime());

export function problemasComentario(c: ComentarioCliente, s: SolicitudDerivada | undefined): string[] {
  if (!s) return [`${c.id}: la solicitud ${c.solicitudNum} no existe en la base`];
  const p: string[] = [];
  const t = c.comentarioCliente.toLowerCase();
  const estatus = s.lastStatus.trim().toLowerCase();
  const err = (m: string) => p.push(`${c.id}: ${m}`);

  // Datos redundantes del comentario contra la base
  if (c.sucursalNum !== s.branchNum) err(`sucursal ${c.sucursalNum} y la base dice ${s.branchNum}`);
  if (c.intentos !== s.numTries) err(`intentos ${c.intentos} y la base dice ${s.numTries}`);
  if (c.estado.trim() !== s.state.trim()) err(`estado ${c.estado} y la base dice ${s.state}`);
  if (valida(c.fechaComentario) && valida(s.dateFirstInput) && c.fechaComentario < s.dateFirstInput) {
    err('la fecha del comentario es anterior a la primera captura');
  }

  // Errores específicos, que se revisan antes que el conteo general de intentos
  let resto = t;
  const especificos: [RegExp, number, string][] = [
    [new RegExp(`${NUM}\\s+(?:veces|ocasiones)\\s+por\\s+(?:documentos|documentación|papeles)\\s+incomplet`, 'g'), s.erroresIncompletos, 'incompletos'],
    [new RegExp(`${NUM}\\s+times\\s+(?:for|because of)\\s+incomplete`, 'g'), s.erroresIncompletos, 'incompletos'],
    [new RegExp(`${NUM}\\s+(?:errores? de captura|errores? al capturar|input errors?|data entry errors?|typing errors?)`, 'g'), s.erroresCaptura, 'errores de captura'],
    [new RegExp(`${NUM}\\s+(?:veces|times)\\s+(?:por|for|because of)\\s+(?:documentos? ilegibles?|illegible)`, 'g'), s.erroresIlegibles, 'ilegibles'],
  ];
  for (const [re, real, nombre] of especificos) {
    for (const m of t.matchAll(re)) {
      if (aNum(m[1]!) !== real) err(`dice ${m[1]} ${nombre} y la base marca ${real}`);
      resto = resto.replace(m[0], ' ');
    }
  }

  // Singular con plural, como "1 rondas"
  for (const m of t.matchAll(/\b1\s+(rondas|intentos|veces|vueltas|entregas|días|rounds|tries|times|days)\b/g)) err(`dice "${m[0]}"`);

  // Intentos de captura, en cualquiera de sus formas
  const reIntentos = new RegExp(`${NUM}\\s+(?:intentos|vueltas|rondas|entregas|veces|ocasiones|tries|attempts|trips|rounds|times|visits|submissions)\\b`, 'g');
  for (const m of resto.matchAll(reIntentos)) {
    const n = aNum(m[1]!);
    if (n !== s.numTries) err(`dice ${m[0]} y la solicitud tiene ${s.numTries} intentos`);
  }
  if (/\b(once|twice)\b/.test(resto) && !/at once/.test(resto)) {
    const n = /twice/.test(resto) ? 2 : 1;
    if (n !== s.numTries) err(`dice ${n} vez/veces y la solicitud tiene ${s.numTries} intentos`);
  }

  // Días: deben ser la ventana de captura, el ciclo total o el tiempo transcurrido al comentar
  const transcurridos = valida(c.fechaComentario) && valida(s.dateFirstInput) ? dias(s.dateFirstInput, c.fechaComentario) : null;
  for (const m of t.matchAll(/(\d+)\s+(?:días|dias|days)/g)) {
    const n = Number(m[1]);
    const ok = [s.ventanaCaptura, s.cicloTotal, transcurridos].some((v) => v != null && Math.abs(v - n) <= 1);
    if (!ok) err(`dice ${n} días y la captura tomó ${s.ventanaCaptura}, el ciclo ${s.cicloTotal ?? 'sin dato'} y al comentar llevaba ${transcurridos ?? 'sin dato'}`);
  }

  // Fecha de inicio mencionada
  for (const m of t.matchAll(/(?:el|desde el)\s+(\d{1,2})\s+de\s+([a-z]+)/g)) comprobarFecha(Number(m[1]), m[2]!);
  for (const m of t.matchAll(/(?:on|since)\s+([a-z]+)\s+(\d{1,2})\b/g)) comprobarFecha(Number(m[2]), m[1]!);
  function comprobarFecha(dia: number, mes: string) {
    if (!(mes in MESES) || !valida(s!.dateFirstInput)) return;
    const d = s!.dateFirstInput;
    if (d.getUTCDate() !== dia || d.getUTCMonth() !== MESES[mes]) err(`menciona el ${dia} de ${mes} y la primera captura fue ${d.toISOString().slice(0, 10)}`);
  }

  // Montos de línea
  for (const m of t.matchAll(/\$?\s?(\d{1,3}(?:,\d{3})+|\d{4,6})\s*(?:pesos|mxn)?/g)) {
    if (!/pesos|mxn|\$/.test(m[0])) continue;
    const n = aNum(m[1]!);
    if (n !== s.creditLineGranted) err(`menciona ${n} pesos y la línea otorgada es ${s.creditLineGranted ?? 'sin dato'}`);
  }

  // Sucursal y antigüedad
  for (const m of t.matchAll(/(?:sucursal|branch)\s+(\d+)(?!\s+(?:times|veces))/g)) {
    if (Number(m[1]) !== s.branchNum) err(`menciona la sucursal ${m[1]} y la solicitud es de la ${s.branchNum}`);
  }
  for (const m of t.matchAll(new RegExp(`${NUM}\\s+(?:años|years)\\s+(?:con|como|with|as)`, 'g'))) {
    if (aNum(m[1]!) !== s.yearsAsCustomer) err(`dice ${m[1]} años como cliente y la base marca ${s.yearsAsCustomer}`);
  }

  // Estatus
  const hablaBuro = /bur[oó]|bureau|credit history check/.test(t);
  const rechazo = /rechaz|rejected|turned down|me dijeron que no|told me no|denied/.test(t);
  const categoriaRechazo = /rechazo|rejection/i.test(`${c.categoriaPrimaria} ${c.categoriaSecundaria}`);
  if ((rechazo || categoriaRechazo) && hablaBuro && !RECHAZO_BURO.includes(estatus)) err(`culpa al buró y el estatus es ${s.lastStatus}`);
  if (rechazo && !hablaBuro && !RECHAZO_BURO.includes(estatus) && !RECHAZO_SCORE.includes(estatus)) err(`habla de rechazo y el estatus es ${s.lastStatus}`);
  const aprobado = /autoriz|aprob|approved|authorized|me dieron una l[ií]nea|gave me a (?:credit )?line/.test(t) && !/no (?:me )?(?:han )?autoriz|not (?:been )?approved/.test(t);
  if (aprobado && !APROBADOS.includes(estatus)) err(`habla de aprobación y el estatus es ${s.lastStatus}`);

  // Tarjeta: no puede decir que no llegó si se envió antes del comentario, ni lo contrario
  const enviada = valida(s.datePlasticSent) && (!valida(c.fechaComentario) || s.datePlasticSent <= c.fechaComentario);
  if (/sin tarjeta|no hay tarjeta|nunca lleg|no ha llegado|no me ha llegado|no aparece enviada|still no card|never arrived|hasn'?t arrived|no card/.test(t) && enviada) {
    err('dice que no tiene tarjeta y la base registra el envío antes del comentario');
  }
  if (/me lleg[oó] la tarjeta|ya tengo (?:la|mi) tarjeta|recib[ií] (?:la|mi) tarjeta|card (?:finally )?arrived|got (?:the|my) card|received (?:the|my) card/.test(t) && !enviada) {
    err('dice que recibió la tarjeta y la base no registra el envío antes del comentario');
  }
  return p;
}

export function problemasComentarios(comentarios: ComentarioCliente[], solicitudes: SolicitudDerivada[]): string[] {
  const porNum = new Map(solicitudes.map((s) => [s.applicationNum, s]));
  return comentarios.flatMap((c) => problemasComentario(c, porNum.get(c.solicitudNum)));
}
