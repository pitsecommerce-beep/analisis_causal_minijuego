// Comentarios de clientes para las bases originales A y B (muestra de 103 solicitudes, 2015).
// Cada comentario apunta a una solicitud real de su base y no contradice sus datos.
// En A las quejas se concentran en las sucursales 110 y 676; en B, en la 637 (captura) y la 336 (documentos).

export interface DefComentario {
  id: string;
  solicitud: number;
  canal: 'Encuesta post-venta' | 'Queja escrita' | 'Llamada a call center' | 'Redes sociales';
  fecha: string;
  primaria: string;
  secundaria: string;
  texto: string;
}

// Textos compartidos: A y B comparten solicitudes y bitácora, así que el mismo cliente puede decir lo mismo
const T: Record<string, { es: string; en: string }> = {
  a01: { es: 'En la sucursal 110 me regresaron la solicitud porque faltaba un documento que nadie me había pedido. Al final la tarjeta llegó, pero el trámite tomó 24 días.', en: 'At branch 110 they sent my application back because of a document nobody had asked me for. The card arrived in the end, but the process took 24 days.' },
  a02: { es: 'Capturaron mal mi fecha de nacimiento y tuve que volver a la sucursal. Fueron 2 intentos y 21 días para que después me dijeran que no.', en: 'They entered my date of birth wrong and I had to go back to the branch. It took 2 tries and 21 days, only to be told no afterwards.' },
  a03: { es: 'Seis intentos en la sucursal 110. Tres errores de captura, un papel faltante y una copia ilegible. La captura tomó 86 días.', en: 'Six tries at branch 110. Three input errors, one missing paper and one unreadable copy. Data entry took 86 days.' },
  a04: { es: 'Me devolvieron el expediente dos veces por documentos incompletos y otra vez porque capturaron mal un dato. Van 4 intentos en la sucursal 110.', en: 'My file was returned two times for incomplete documents and again because they entered a field wrong. That is 4 tries at branch 110.' },
  a05: { es: 'Tres intentos y 45 días de captura: primero un error en mis datos y luego un papel que faltaba. Ningún ejecutivo revisó todo junto.', en: 'Three tries and 45 days of data entry: first an error in my data, then a missing paper. No officer checked everything together.' },
  a06: { es: 'Dijeron que mi identificación no se leía y además escribieron mal mi dirección. Son 3 vueltas a la sucursal 110 en 20 días.', en: 'They said my ID was unreadable and they also misspelled my address. That is 3 trips to branch 110 in 20 days.' },
  a07: { es: 'Faltó un comprobante que no venía en la lista que me dieron. Tuve que volver a la sucursal 676 y la tarjeta tardó 33 días.', en: 'A proof of address was missing and it was not on the list they gave me. I had to go back to branch 676 and the card took 33 days.' },
  a08: { es: 'Llevo 20 días de captura por un documento que faltaba. En la sucursal 676 cada persona me dice algo distinto.', en: '20 days of data entry because one document was missing. At branch 676 every person tells me something different.' },
  a09: { es: '54 días de captura entre un dato mal escrito y una copia borrosa, para que luego el buró me rechazara. Pudieron revisar eso primero.', en: '54 days of data entry between a misspelled field and a blurry copy, and then the credit bureau rejected me. They could have checked that first.' },
  a10: { es: 'El ejecutivo de la sucursal 676 tecleó mal mi número de cliente y tuve que regresar. Son 2 intentos por un error que no fue mío.', en: 'The officer at branch 676 mistyped my customer number and I had to come back. That is 2 tries because of a mistake that was not mine.' },
  a11: { es: 'Cinco intentos en la sucursal 676: dos errores de captura y dos veces por documentos incompletos. 76 días perdidos.', en: 'Five tries at branch 676: two input errors and two times for incomplete documents. 76 days lost.' },
  a12: { es: 'Me avisaron que había un error en la captura de mis datos. Todavía no sé si ya lo corrigieron en la sucursal 676.', en: 'They told me there was an error entering my data. I still don\'t know whether branch 676 has fixed it.' },
  a13: { es: '93 días desde que empecé hasta recibir la tarjeta. Un error, un papel faltante y una copia ilegible. Tres intentos en total.', en: '93 days from the start until I got my card. One error, one missing paper and one unreadable copy. Three tries in total.' },
  a14: { es: 'Tuve que ir 3 veces a la sucursal: una por un papel y otra por un dato mal capturado. La captura tomó 40 días.', en: 'I had to go to the branch 3 times: one for a paper and another for a field entered wrong. Data entry took 40 days.' },
  a15: { es: 'Tengo 16 años como cliente y la tarjeta tardó 79 días. Hubo 3 intentos de captura por cosas que se pudieron revisar desde el inicio.', en: 'I have been a customer for 16 years and the card took 79 days. There were 3 tries at data entry for things that could have been checked from the start.' },
  a16: { es: 'Hubo dos errores de captura en mi solicitud y la captura se alargó a 42 días. Revisen lo que teclean.', en: 'There were two input errors on my application and data entry stretched to 42 days. Check what you type.' },
  a17: { es: 'Me aprobaron, pero antes hubo dos errores de captura y una copia ilegible. Van 64 días y la tarjeta no ha llegado.', en: 'I was approved, but first there were two input errors and an unreadable copy. It has been 64 days and the card hasn\'t arrived.' },
  a18: { es: 'Tengo 19 años con el banco. Tres intentos de captura y al final me rechazaron sin decirme por qué.', en: 'I have 19 years with the bank. Three tries at data entry and in the end they rejected me without saying why.' },
  a19: { es: 'Cuatro intentos por dos errores de captura y un papel que faltaba. Ya tengo la tarjeta, pero fueron 73 días.', en: 'Four tries because of two input errors and a missing paper. I have the card now, but it took 73 days.' },
  a20: { es: 'Dos errores de captura y 34 días después me autorizaron solo 26,700 pesos. Esperaba más.', en: 'Two input errors and 34 days later they authorized only 26,700 pesos. I expected more.' },
  a21: { es: 'Primero faltó un documento y luego dijeron que otro no se leía. Fueron 3 entregas en 28 días.', en: 'First a document was missing and then they said another one was unreadable. It took 3 submissions in 28 days.' },
  a22: { es: 'Me pidieron un papel más y corrigieron un dato que ellos mismos capturaron mal. Tres intentos para una tarjeta.', en: 'They asked me for one more paper and fixed a field they had entered wrong themselves. Three tries for one card.' },
  a23: { es: 'Me aprobaron una línea de 12,000 pesos después de 4 intentos, y la tarjeta todavía no llega.', en: 'They approved a 12,000 pesos line after 4 tries, and the card still has not come.' },
  a24: { es: 'Dos veces por documentos incompletos y una copia ilegible. Ya me aprobaron, pero sigo sin tarjeta.', en: 'Two times for incomplete documents and one unreadable copy. I\'m already approved, but I still have no card.' },
  a25: { es: 'Me hicieron volver 3 veces a la sucursal por papeles. 41 días de captura y ni siquiera procedió.', en: 'They made me come back to the branch 3 times for papers. 41 days of data entry and it did not even go through.' },
  a26: { es: '107 días solo en la captura de mi solicitud. Cuatro intentos y al final el buró me rechazó.', en: '107 days just to enter my application. Four tries and in the end the credit bureau rejected me.' },
  a27: { es: 'Dos errores de captura seguidos en mi solicitud. No es tan difícil escribir bien un nombre.', en: 'Two input errors in a row on my application. Writing a name correctly is not that hard.' },
  a28: { es: 'Me autorizaron hace días y nadie me dice cuándo sale la tarjeta. Antes de eso faltó un papel y tardaron 45 días en capturar.', en: 'They authorized me days ago and nobody tells me when the card will be sent. Before that a paper was missing and data entry took 45 days.' },
  b01: { es: 'En la sucursal 637 hubo dos errores de captura seguidos en mi solicitud. Tres intentos y 25 días para algo que debió salir a la primera.', en: 'At branch 637 there were two input errors in a row on my application. Three tries and 25 days for something that should have worked the first time.' },
  b02: { es: 'Apenas entregué mi solicitud en la sucursal 637 y ya me avisaron de un error en la captura. Empezamos mal.', en: 'I had just handed in my application at branch 637 and they already told me about a data entry error. Not a good start.' },
  b03: { es: 'En la sucursal 637 escribieron mal mi nombre y luego dijeron que mi copia no se leía. 54 días de captura para que el buró me rechazara.', en: 'At branch 637 they misspelled my name and then said my copy was unreadable. 54 days of data entry for the credit bureau to reject me.' },
  b04: { es: 'Un error de captura en la sucursal 637 me hizo volver. La captura terminó rápido, pero la tarjeta no ha llegado y ya van 33 días.', en: 'An input error at branch 637 made me come back. Data entry finished quickly, but the card hasn\'t arrived and it has been 33 days.' },
  b05: { es: 'En la sucursal 336 me pidieron un documento que no estaba en la lista. Por eso la captura se fue a 69 días.', en: 'At branch 336 they asked me for a document that was not on the list. That is why data entry dragged on for 69 days.' },
  b06: { es: 'Me devolvieron el expediente dos veces por documentos incompletos en la sucursal 336. Nadie me dio la lista completa desde el principio. Van 4 intentos.', en: 'My file was returned two times for incomplete documents at branch 336. Nobody gave me the full list from the start. That makes 4 tries.' },
  b07: { es: 'En la sucursal 336 cada vez faltaba un papel distinto. Cuatro intentos y 93 días de captura.', en: 'At branch 336 a different paper was missing every time. Four tries and 93 days of data entry.' },
  b24: { es: 'Seis intentos. Tres errores de captura, un papel faltante y una copia ilegible. La captura tomó 86 días.', en: 'Six tries. Three input errors, one missing paper and one unreadable copy. Data entry took 86 days.' },
  b26: { es: 'Cinco intentos: dos errores de captura y dos veces por documentos incompletos. 76 días perdidos.', en: 'Five tries: two input errors and two times for incomplete documents. 76 days lost.' },
  b28: { es: 'Faltó un comprobante que no venía en la lista que me dieron. Tuve que volver y la tarjeta tardó 33 días.', en: 'A proof of address was missing and it was not on the list they gave me. I had to come back and the card took 33 days.' },
};

type Fila = [string, number, DefComentario['canal'], string, string, string, string];

const RD = 'Reproceso documental', EC = 'Error de captura', TC = 'Tiempo de ciclo', CA = 'Caso atorado', RE = 'Rechazo', ML = 'Monto de linea';
const EP = 'Encuesta post-venta', QE = 'Queja escrita', LL = 'Llamada a call center', RS = 'Redes sociales';

const FILAS_A: Fila[] = [
  ['A-01', 23, EP, '2015-10-20', RD, '', 'a01'],
  ['A-02', 17, QE, '2015-08-10', EC, RE, 'a02'],
  ['A-03', 27, RS, '2015-10-25', EC, TC, 'a03'],
  ['A-04', 13, QE, '2015-10-20', RD, '', 'a04'],
  ['A-05', 93, LL, '2015-10-15', RD, TC, 'a05'],
  ['A-06', 43, RS, '2015-10-22', RD, '', 'a06'],
  ['A-07', 12, EP, '2015-10-12', RD, '', 'a07'],
  ['A-08', 26, LL, '2015-09-30', RD, '', 'a08'],
  ['A-09', 5, QE, '2015-09-20', RD, RE, 'a09'],
  ['A-10', 42, LL, '2015-09-12', EC, '', 'a10'],
  ['A-11', 33, QE, '2015-10-15', EC, RD, 'a11'],
  ['A-12', 57, LL, '2015-10-05', EC, '', 'a12'],
  ['A-13', 73, EP, '2015-10-24', TC, RD, 'a13'],
  ['A-14', 31, RS, '2015-10-01', RD, '', 'a14'],
  ['A-15', 11, EP, '2015-10-02', TC, '', 'a15'],
  ['A-16', 44, QE, '2015-09-20', EC, '', 'a16'],
  ['A-17', 62, LL, '2015-10-20', EC, CA, 'a17'],
  ['A-18', 76, QE, '2015-10-28', RE, '', 'a18'],
  ['A-19', 103, EP, '2015-10-26', EC, TC, 'a19'],
  ['A-20', 25, EP, '2015-10-16', EC, ML, 'a20'],
  ['A-21', 15, RS, '2015-09-05', RD, '', 'a21'],
  ['A-22', 64, EP, '2015-09-03', RD, EC, 'a22'],
  ['A-23', 22, LL, '2015-10-30', ML, CA, 'a23'],
  ['A-24', 50, RS, '2015-10-29', CA, RD, 'a24'],
  ['A-25', 52, QE, '2015-10-10', RD, '', 'a25'],
  ['A-26', 77, QE, '2015-09-30', TC, RE, 'a26'],
  ['A-27', 56, RS, '2015-10-09', EC, '', 'a27'],
  ['A-28', 87, LL, '2015-10-27', CA, '', 'a28'],
];

const FILAS_B: Fila[] = [
  ['B-01', 29, QE, '2015-09-10', EC, '', 'b01'],
  ['B-02', 46, LL, '2015-10-20', EC, '', 'b02'],
  ['B-03', 5, QE, '2015-09-20', EC, RE, 'b03'],
  ['B-04', 61, RS, '2015-10-20', EC, TC, 'b04'],
  ['B-05', 60, EP, '2015-10-06', RD, TC, 'b05'],
  ['B-06', 13, QE, '2015-10-20', RD, '', 'b06'],
  ['B-07', 2, LL, '2015-10-08', RD, TC, 'b07'],
  ['B-08', 73, EP, '2015-10-24', TC, RD, 'a13'],
  ['B-09', 11, EP, '2015-10-02', TC, '', 'a15'],
  ['B-10', 44, QE, '2015-09-20', EC, '', 'a16'],
  ['B-11', 76, QE, '2015-10-28', RE, '', 'a18'],
  ['B-12', 15, RS, '2015-09-05', RD, '', 'a21'],
  ['B-13', 77, QE, '2015-09-30', TC, RE, 'a26'],
  ['B-14', 103, EP, '2015-10-26', EC, TC, 'a19'],
  ['B-15', 25, EP, '2015-10-16', EC, ML, 'a20'],
  ['B-16', 62, LL, '2015-10-20', EC, CA, 'a17'],
  ['B-17', 50, RS, '2015-10-29', CA, RD, 'a24'],
  ['B-18', 22, LL, '2015-10-30', ML, CA, 'a23'],
  ['B-19', 31, RS, '2015-10-01', RD, '', 'a14'],
  ['B-20', 64, EP, '2015-09-03', RD, EC, 'a22'],
  ['B-21', 56, RS, '2015-10-09', EC, '', 'a27'],
  ['B-22', 87, LL, '2015-10-27', CA, '', 'a28'],
  ['B-23', 52, QE, '2015-10-10', RD, '', 'a25'],
  ['B-24', 27, RS, '2015-10-25', EC, TC, 'b24'],
  ['B-25', 93, LL, '2015-10-15', RD, TC, 'a05'],
  ['B-26', 33, QE, '2015-10-15', EC, RD, 'b26'],
  ['B-27', 17, QE, '2015-08-10', EC, RE, 'a02'],
  ['B-28', 12, EP, '2015-10-12', RD, '', 'b28'],
];

export function comentariosOriginales(base: 'A' | 'B', idioma: 'es' | 'en'): DefComentario[] {
  return (base === 'A' ? FILAS_A : FILAS_B).map(([id, solicitud, canal, fecha, primaria, secundaria, clave]) => ({
    id, solicitud, canal, fecha, primaria, secundaria, texto: T[clave]![idioma],
  }));
}
