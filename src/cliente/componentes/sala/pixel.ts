// Motor de dibujo pixel art de la Sala de Juntas.
// Todo se dibuja con fillRect sobre un lienzo lógico de 320x180 y se escala con
// image-rendering: pixelated, así no hay assets que servir ni versionar.

export const ANCHO = 320;
export const ALTO = 180;
/** Borde trasero de la mesa: los personajes sentados quedan ocultos debajo. */
export const MESA_Y = 116;

type Ctx = CanvasRenderingContext2D;
type Tono = [luz: string, base: string, sombra: string];

export type Animo = 'neutral' | 'feliz' | 'enojado' | 'preocupado' | 'sorpresa';
export type EstiloPelo = 'corto' | 'calvo' | 'chongo' | 'rizado' | 'fleco' | 'peinado';
export type Vestimenta = 'traje' | 'blazer' | 'sastre' | 'cardigan' | 'camisa';

export interface Personaje {
  id: string;
  nombre: string;
  rol: string;
  cx: number;
  sentado: boolean;
  piel: Tono;
  labio: string;
  pelo: { estilo: EstiloPelo; tono: Tono };
  ropa: { tipo: Vestimenta; tono: Tono; interior: string; corbata?: [string, string] };
  ancho: number;
  lentes?: string;
  bigote?: boolean;
  sillaTono?: Tono;
  fase: number;
}

export interface EstadoPersonaje {
  parpadeo: boolean;
  habla: boolean;
  animo: Animo;
  respiro: number;
  resaltado: boolean;
}

export interface Caja { x0: number; y0: number; x1: number; y1: number }

// --- Personajes ---

export const PERSONAJES: Personaje[] = [
  {
    id: 'diego', nombre: 'Diego', rol: 'Analista CrOP', cx: 20, sentado: false, fase: 300,
    piel: ['#e0b08a', '#cf9a72', '#a87553'], labio: '#a8624f',
    pelo: { estilo: 'fleco', tono: ['#6b4a32', '#4a3020', '#2e1d13'] },
    ropa: { tipo: 'camisa', tono: ['#cfe1f2', '#a9c6e3', '#7f9fc2'], interior: '#a9c6e3' },
    ancho: 12,
  },
  {
    id: 'bernardo', nombre: 'Bernardo', rol: 'Gerente Regional', cx: 72, sentado: true, fase: 0,
    piel: ['#e8bc95', '#d6a47c', '#b07f5c'], labio: '#a5604c',
    pelo: { estilo: 'calvo', tono: ['#9a8f84', '#776c62', '#544b44'] },
    ropa: { tipo: 'traje', tono: ['#7a5a40', '#5e4430', '#402d1f'], interior: '#f1ede4', corbata: ['#8c2f2f', '#5e1f1f'] },
    ancho: 16, bigote: true,
  },
  {
    id: 'oscar', nombre: 'Óscar', rol: 'Director de Sistemas', cx: 116, sentado: true, fase: 520,
    piel: ['#d9a37d', '#c38d67', '#9b6a4a'], labio: '#9a5a48',
    pelo: { estilo: 'corto', tono: ['#3a3330', '#24201e', '#141211'] },
    ropa: { tipo: 'blazer', tono: ['#7d838c', '#5f656e', '#454a52'], interior: '#25282e' },
    ancho: 14, lentes: '#2b2b30',
  },
  {
    id: 'ramon', nombre: 'Ramón Betancourt', rol: 'Consejo', cx: 160, sentado: true, fase: 900,
    piel: ['#ecc19d', '#dcab86', '#b98a67'], labio: '#a8665a',
    pelo: { estilo: 'peinado', tono: ['#f6f3ec', '#d2cdc3', '#a19a8e'] },
    ropa: { tipo: 'traje', tono: ['#3b4556', '#28303d', '#1a2029'], interior: '#f4f2ee', corbata: ['#7a1f33', '#521424'] },
    ancho: 15, sillaTono: ['#6e3434', '#4f2323', '#351616'],
  },
  {
    id: 'paulina', nombre: 'Paulina', rol: 'Contralora', cx: 204, sentado: true, fase: 140,
    piel: ['#f0c9a8', '#e2b391', '#c18f6f'], labio: '#b4606a',
    pelo: { estilo: 'chongo', tono: ['#5c3b28', '#3e271a', '#26170f'] },
    ropa: { tipo: 'sastre', tono: ['#2c3e5c', '#1f2d45', '#141e30'], interior: '#efe6da' },
    ancho: 13, lentes: '#7a2e3a',
  },
  {
    id: 'silvia', nombre: 'Silvia', rol: 'Gerente de Capacitación', cx: 248, sentado: true, fase: 680,
    piel: ['#b98159', '#a26d48', '#7f5134'], labio: '#86453a',
    pelo: { estilo: 'rizado', tono: ['#3b2a22', '#241914', '#140d0a'] },
    ropa: { tipo: 'cardigan', tono: ['#e0ac44', '#c8922a', '#9c6e1c'], interior: '#f6f1e7' },
    ancho: 13,
  },
];

// --- Utilidades ---

function r(c: Ctx, x: number, y: number, w: number, h: number, color: string) {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function p(c: Ctx, x: number, y: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), 1, 1);
}

function aleatorio(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Relleno tramado entre dos colores, típico del pixel art para degradados. */
function trama(c: Ctx, x: number, y: number, w: number, h: number, a: string, b: string, densidad = 0.5) {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const umbral = ((i + j) % 2 === 0 ? 0.25 : 0.75) - ((j % 2) * 0.125);
      p(c, x + i, y + j, densidad > umbral ? b : a);
    }
  }
}

function lienzo(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

// --- Cabello (rejillas de 16 columnas: x = cx - 8 + columna) ---

const PELO: Record<EstiloPelo, { desde: number; filas: string[] }> = {
  corto: {
    desde: -2,
    filas: [
      '.....hhhhh......',
      '...lhhhhhhhhh...',
      '..lhhhhhhhhhhs..',
      '.lhhhhhhhhhhhhs.',
      '.hhhhhhhhh.hhhs.',
      '.hhh.......hhs..',
      '..h..........s..',
      '..h..........s..',
    ],
  },
  calvo: {
    desde: 2,
    filas: [
      '................',
      '.hh..........hs.',
      '.hh..........hs.',
      '.h............s.',
    ],
  },
  chongo: {
    desde: -5,
    filas: [
      '......lhhs......',
      '.....lhhhhs.....',
      '.....hhhhhs.....',
      '......hhhs......',
      '....lhhhhhhs....',
      '..lhhhhhhhhhhs..',
      '.lhhhhhl.hhhhhs.',
      '.hhhhh....hhhhs.',
      '.hhh........hhs.',
      '.hh..........hs.',
      '.h............s.',
    ],
  },
  rizado: {
    desde: -3,
    filas: [
      '....hhlhhlh.....',
      '..hhlhhhhhlhh...',
      '.hhhhhhlhhhhlhh.',
      'hhlhhhhhhhhhhhhs',
      'hhhhhlhhhhhhlhhs',
      'hhlhhh....hhhhhs',
      'hhhh........hhss',
      'hhh..........hhs',
      'hlh..........hhs',
      'hh............hs',
      'hh............hs',
      'hhh..........hhs',
      'hlh..........hss',
      'hhh..........hss',
      'hhhh........hhss',
      'hhhs........shss',
      'shhs........shs.',
      '.hss........ss..',
      '.ss..........s..',
    ],
  },
  fleco: {
    desde: -2,
    filas: [
      '....hhhhhh......',
      '..lhhhhhhhhh....',
      '..lhhhhhhhhhhs..',
      '.lhhhhhhhhhhhhs.',
      '.hhhhhhhhhhhhhs.',
      '.hhh.hh.hh.hhs..',
      '..h..........s..',
      '..h..........s..',
    ],
  },
  peinado: {
    desde: -1,
    filas: [
      '....lllhhhh.....',
      '..lllhhhhhhhs...',
      '.lhhhhhhhhhhhs..',
      '.hhh.....hhhhs..',
      '.hh..........hs.',
      '.h............s.',
      '.h............s.',
    ],
  },
};

const ANCHOS_CABEZA = [6, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 8, 6];

function cabeza(c: Ctx, per: Personaje, cx: number, H: number, est: EstadoPersonaje) {
  const [luz, base, sombra] = per.piel;

  // Orejas
  for (const [x, interior] of [[cx - 7, cx - 7], [cx + 6, cx + 6]] as const) {
    r(c, x, H + 6, 1, 3, base);
    p(c, interior, H + 7, sombra);
  }

  // Óvalo de la cara con luz a la izquierda y sombra a la derecha
  ANCHOS_CABEZA.forEach((w, fila) => {
    const x0 = cx - w / 2;
    r(c, x0, H + fila, w, 1, base);
    if (fila >= 2 && fila <= 10) p(c, x0, H + fila, luz);
    if (fila >= 1) r(c, x0 + w - 2, H + fila, 2, 1, sombra);
  });
  r(c, cx - 3, H + 13, 6, 1, sombra);
  r(c, cx - 4, H + 12, 1, 1, sombra);

  // Cuello con sombra bajo la barbilla
  r(c, cx - 3, H + 14, 6, 3, base);
  r(c, cx - 3, H + 14, 6, 1, sombra);
  p(c, cx + 2, H + 15, sombra);

  // Cabello
  const pelo = PELO[per.pelo.estilo];
  const [pl, pb, ps] = per.pelo.tono;
  pelo.filas.forEach((fila, j) => {
    for (let i = 0; i < fila.length; i++) {
      const ch = fila[i];
      if (ch === 'h') p(c, cx - 8 + i, H + pelo.desde + j, pb);
      else if (ch === 'l') p(c, cx - 8 + i, H + pelo.desde + j, pl);
      else if (ch === 's') p(c, cx - 8 + i, H + pelo.desde + j, ps);
    }
  });
  if (per.pelo.estilo === 'calvo') {
    p(c, cx - 2, H + 1, luz);
    p(c, cx - 1, H + 1, '#f3d2b2');
  }

  // Cejas según el ánimo
  const ceja = per.pelo.estilo === 'peinado' ? ps : ps;
  const { animo } = est;
  const filaExt = animo === 'sorpresa' ? 3 : animo === 'preocupado' ? 4 : 4;
  const filaInt = animo === 'enojado' ? 5 : animo === 'preocupado' || animo === 'sorpresa' ? 3 : 4;
  r(c, cx - 4, H + filaExt, 2, 1, ceja);
  p(c, cx - 2, H + filaInt, ceja);
  p(c, cx + 1, H + filaInt, ceja);
  r(c, cx + 2, H + filaExt, 2, 1, ceja);

  // Ojos
  if (est.parpadeo) {
    r(c, cx - 4, H + 6, 2, 1, sombra);
    r(c, cx + 2, H + 6, 2, 1, sombra);
  } else {
    p(c, cx - 4, H + 6, '#f2ece4');
    p(c, cx - 3, H + 6, '#2a1c16');
    p(c, cx + 2, H + 6, '#2a1c16');
    p(c, cx + 3, H + 6, '#f2ece4');
  }

  // Lentes: armazón fino, con los ojos visibles a través del cristal
  if (per.lentes) {
    const l = per.lentes;
    r(c, cx - 5, H + 5, 4, 1, l);
    r(c, cx + 1, H + 5, 4, 1, l);
    p(c, cx - 5, H + 6, l);
    p(c, cx + 4, H + 6, l);
    r(c, cx - 4, H + 7, 2, 1, l);
    r(c, cx + 2, H + 7, 2, 1, l);
    p(c, cx - 1, H + 6, l);
    p(c, cx - 6, H + 6, l);
    p(c, cx + 5, H + 6, l);
    if (!est.parpadeo) {
      p(c, cx - 4, H + 6, '#dfe8ef');
      p(c, cx + 3, H + 6, '#dfe8ef');
    }
  }

  // Nariz
  p(c, cx, H + 8, sombra);
  r(c, cx - 1, H + 9, 2, 1, sombra);
  p(c, cx - 1, H + 8, luz);

  // Boca
  const oscuro = '#4a221c';
  if (est.habla) {
    r(c, cx - 2, H + 11, 4, 1, oscuro);
    r(c, cx - 1, H + 12, 2, 1, per.labio);
  } else if (animo === 'feliz') {
    p(c, cx - 3, H + 10, per.labio);
    p(c, cx + 2, H + 10, per.labio);
    r(c, cx - 2, H + 11, 4, 1, per.labio);
  } else if (animo === 'enojado' || animo === 'preocupado') {
    r(c, cx - 1, H + 11, 2, 1, per.labio);
    p(c, cx - 2, H + 12, per.labio);
    p(c, cx + 1, H + 12, per.labio);
  } else if (animo === 'sorpresa') {
    r(c, cx - 1, H + 11, 2, 2, oscuro);
  } else {
    r(c, cx - 2, H + 11, 4, 1, per.labio);
  }

  // Bigote
  if (per.bigote) {
    r(c, cx - 3, H + 10, 6, 1, pb);
    p(c, cx - 3, H + 11, ps);
    p(c, cx + 2, H + 11, ps);
  }
}

function torso(c: Ctx, per: Personaje, cx: number, S: number, fondo: number) {
  const [luz, base, sombra] = per.ropa.tono;
  const a = per.ancho;
  for (let y = S; y < fondo; y++) {
    const f = y - S;
    const media = f === 0 ? a - 5 : f === 1 ? a - 2 : f === 2 ? a - 1 : a;
    const x0 = cx - media;
    r(c, x0, y, media * 2, 1, base);
    r(c, x0, y, 2, 1, luz);
    r(c, cx + media - 2, y, 2, 1, sombra);
    if (f >= 6) {
      p(c, cx - a + 5, y, sombra);
      p(c, cx + a - 6, y, sombra);
    }
  }
  // Hombros con un brillo
  r(c, cx - a + 3, S + 1, 4, 1, luz);

  const int = per.ropa.interior;
  const tipo = per.ropa.tipo;

  if (tipo === 'camisa') {
    // Camisa de vestir sin saco: tapeta, botones y gafete
    r(c, cx - 1, S + 3, 1, fondo - S - 3, luz);
    for (let y = S + 5; y < fondo; y += 5) p(c, cx, y, '#eef3f8');
    r(c, cx - 4, S, 3, 3, luz);
    r(c, cx + 1, S, 3, 3, luz);
    p(c, cx - 4, S + 2, sombra);
    p(c, cx + 3, S + 2, sombra);
    for (let k = 0; k < 12; k++) {
      p(c, cx - 5 + Math.floor(k / 3), S + k, '#b3262e');
      p(c, cx + 4 - Math.floor(k / 3), S + k, '#b3262e');
    }
    r(c, cx - 2, S + 12, 5, 6, '#f7f7f4');
    r(c, cx - 2, S + 12, 5, 2, '#2563a8');
    r(c, cx - 1, S + 15, 3, 1, '#9aa5b4');
    return;
  }

  if (tipo === 'cardigan') {
    // Cárdigan abierto sobre blusa con collar de cuentas
    for (let y = S; y < fondo; y++) {
      const f = y - S;
      const media = f < 3 ? 5 : 4;
      r(c, cx - media, y, media * 2, 1, int);
      p(c, cx - media - 1, y, sombra);
      p(c, cx + media, y, sombra);
    }
    for (let i = -3; i <= 3; i++) p(c, cx + i, S + 3 + (Math.abs(i) < 2 ? 1 : 0), i % 2 === 0 ? '#2f7f8a' : '#e9d9a8');
    return;
  }

  // Saco: V del interior, solapas y corbata
  const largo = tipo === 'blazer' ? fondo - S : tipo === 'sastre' ? 9 : 12;
  for (let f = 0; f < largo; f++) {
    const v = tipo === 'blazer' ? (f < 2 ? 5 : 4) : Math.max(0, 4 - Math.floor(f / (largo / 4)));
    if (v <= 0) continue;
    r(c, cx - v, S + f, v * 2, 1, int);
    p(c, cx - v - 1, S + f, sombra);
    p(c, cx + v, S + f, sombra);
    if (f > 1) p(c, cx - v - 2, S + f, luz);
  }
  if (tipo === 'traje') {
    r(c, cx - 3, S, 2, 2, '#ffffff');
    r(c, cx + 1, S, 2, 2, '#ffffff');
    const [cb, cs] = per.ropa.corbata ?? ['#333', '#222'];
    r(c, cx - 1, S + 1, 2, 2, cs);
    for (let f = 3; f < largo; f++) {
      r(c, cx - 1, S + f, 2, 1, cb);
      if (f % 3 === 0) p(c, cx, S + f, cs);
    }
  }
  if (tipo === 'blazer') {
    r(c, cx - 3, S, 6, 1, '#3b3f47');
  }
  if (tipo === 'sastre') {
    p(c, cx - 2, S + 3, '#d8b45a');
    p(c, cx - 1, S + 4, '#d8b45a');
    p(c, cx, S + 4, '#f0d488');
    p(c, cx + 1, S + 3, '#d8b45a');
  }
}

function piernas(c: Ctx, per: Personaje, cx: number, cintura: number, piso: number) {
  r(c, cx - per.ancho + 2, cintura, (per.ancho - 2) * 2, 1, '#2b2522');
  p(c, cx - 2, cintura, '#b8a27a');
  for (let y = cintura + 1; y < piso - 2; y++) {
    r(c, cx - per.ancho + 3, y, per.ancho - 3, 1, '#4a4f58');
    r(c, cx + 1, y, per.ancho - 4, 1, '#3d424a');
    p(c, cx - per.ancho + 3, y, '#5a606a');
    p(c, cx, y, '#2f333a');
  }
  r(c, cx - per.ancho + 2, piso - 2, per.ancho - 2, 2, '#1a1716');
  r(c, cx + 1, piso - 2, per.ancho - 2, 2, '#1a1716');
  r(c, cx - per.ancho + 2, piso - 2, 3, 1, '#3a3330');
}

function silla(c: Ctx, cx: number, H: number, fondo: number, tono: Tono, alta: boolean) {
  const [luz, base, sombra] = tono;
  const media = alta ? 14 : 12;
  const top = H - (alta ? 10 : 3);
  for (let y = top; y < fondo; y++) {
    const f = y - top;
    const recorte = f === 0 ? 3 : f === 1 ? 1 : 0;
    r(c, cx - media + recorte, y, (media - recorte) * 2, 1, base);
    p(c, cx - media + recorte, y, luz);
    r(c, cx + media - recorte - 2, y, 2, 1, sombra);
  }
  r(c, cx - media + 4, top + 1, media * 2 - 8, 1, luz);
  if (alta) {
    for (let y = top + 4; y < top + 16; y += 5) {
      for (let x = cx - media + 4; x < cx + media - 3; x += 5) p(c, x, y, sombra);
    }
  }
}

/** Dibuja a una persona. Devuelve su caja de interacción en coordenadas lógicas. */
export function dibujarPersonaje(c: Ctx, per: Personaje, est: EstadoPersonaje, base = MESA_Y, cx = per.cx): Caja {
  const desplazar = est.respiro;
  if (per.sentado) {
    const H = base - 38 + desplazar;
    const S = H + 17;
    silla(c, cx, base - 38, base, per.sillaTono ?? ['#454952', '#2e3138', '#1f2126'], !!per.sillaTono);
    torso(c, per, cx, S, base + 2);
    cabeza(c, per, cx, H, est);
    return { x0: cx - per.ancho - 2, y0: H - 6, x1: cx + per.ancho + 2, y1: base + 10 };
  }
  // De pie, con tableta en la mano
  const H = base - 72 + desplazar;
  const S = H + 17;
  const cintura = S + 28;
  piernas(c, per, cx, cintura, base + 6);
  torso(c, per, cx, S, cintura);
  const [, pb] = per.piel;
  r(c, cx - per.ancho - 2, S + 4, 3, 14, per.ropa.tono[0]);
  r(c, cx + per.ancho - 1, S + 4, 3, 14, per.ropa.tono[2]);
  r(c, cx - per.ancho - 2, S + 18, 3, 8, pb);
  r(c, cx + per.ancho - 1, S + 18, 3, 8, per.piel[2]);
  r(c, cx + per.ancho - 6, S + 19, 8, 11, '#1f2329');
  r(c, cx + per.ancho - 5, S + 20, 6, 9, '#3a6ea5');
  p(c, cx + per.ancho - 4, S + 21, '#9cc3ea');
  cabeza(c, per, cx, H, est);
  return { x0: cx - per.ancho - 3, y0: H - 6, x1: cx + per.ancho + 3, y1: base + 6 };
}

// --- Medio cuerpo para presentar la inducción ---

export const MEDIO_CUERPO = { ancho: 64, alto: 58 };

/** Medio cuerpo sin silla ni fondo. Con `senala`, levanta el brazo derecho apuntando hacia arriba. */
export function dibujarMedioCuerpo(c: Ctx, per: Personaje, est: EstadoPersonaje, senala = false) {
  const cx = 26;
  const H = 4 + est.respiro;
  const S = H + 17;
  const fondo = MEDIO_CUERPO.alto;
  const [, base, sombra] = per.ropa.tono;
  const [, pielBase, pielSombra] = per.piel;
  torso(c, per, cx, S, fondo);
  // Brazo izquierdo a un costado
  r(c, cx - per.ancho - 2, S + 4, 3, fondo - S - 4, base);
  if (senala) {
    // Hombro, antebrazo en diagonal y mano con el índice extendido
    r(c, cx + per.ancho - 1, S + 4, 3, 6, sombra);
    for (let i = 0; i < 10; i++) r(c, cx + per.ancho + i, S + 4 - i, 3, 3, i < 7 ? base : sombra);
    r(c, cx + per.ancho + 9, S - 9, 4, 4, pielBase);
    r(c, cx + per.ancho + 12, S - 12, 2, 4, pielBase);
    p(c, cx + per.ancho + 9, S - 6, pielSombra);
  } else {
    r(c, cx + per.ancho - 1, S + 4, 3, fondo - S - 4, sombra);
  }
  cabeza(c, per, cx, H, est);
}

/** Antebrazos y manos sobre la mesa (se dibujan después de la mesa). */
export function dibujarManos(c: Ctx, per: Personaje, est: EstadoPersonaje) {
  if (!per.sentado || per.id === 'oscar') return;
  const [luz, base, sombra] = per.ropa.tono;
  const [pl, pb, ps] = per.piel;
  const a = per.ancho;
  const alza = est.habla ? 1 : 0;
  const manos: [number, number][] = per.id === 'paulina'
    ? [[per.cx - 6, 0], [per.cx + 1, 0]]
    : [[per.cx - a + 1, 0], [per.cx + a - 7, alza]];
  for (const [x, dy] of manos) {
    const y = MESA_Y + 1 - dy;
    r(c, x, y, 6, 4, base);
    p(c, x, y, luz);
    r(c, x + 5, y, 1, 4, sombra);
    r(c, x, y + 4, 6, 1, '#f1ede4');
    r(c, x, y + 5, 6, 3, pb);
    p(c, x, y + 5, pl);
    r(c, x, y + 7, 6, 1, ps);
  }
  if (per.id === 'paulina') {
    r(c, per.cx - 2, MESA_Y + 4, 1, 6, '#1d1d22');
    p(c, per.cx - 2, MESA_Y + 3, '#d8b45a');
  }
}

// --- Escenario ---

export function pintarFondo(): HTMLCanvasElement {
  const cv = lienzo(ANCHO, ALTO);
  const c = cv.getContext('2d')!;
  const rnd = aleatorio(7);

  // Muro y techo
  r(c, 0, 0, ANCHO, ALTO, '#cdc3b2');
  trama(c, 0, 6, ANCHO, 6, '#c3b8a5', '#cdc3b2', 0.5);
  r(c, 0, 0, ANCHO, 6, '#e8e3d8');
  r(c, 0, 5, ANCHO, 1, '#b3a893');
  for (const x of [40, 120, 200, 280]) {
    r(c, x - 6, 1, 12, 3, '#fffaf0');
    r(c, x - 5, 2, 10, 1, '#ffffff');
  }
  for (let x = 0; x < ANCHO; x += 40) r(c, x, 12, 1, 84, '#c6bba9');

  // Lambrín de madera
  r(c, 0, 92, ANCHO, 24, '#5f4330');
  r(c, 0, 92, ANCHO, 1, '#8a6649');
  r(c, 0, 93, ANCHO, 1, '#463121');
  for (let x = 4; x < ANCHO; x += 26) {
    r(c, x, 96, 22, 16, '#6a4b36');
    r(c, x, 96, 22, 1, '#4b3424');
    r(c, x, 96, 1, 16, '#4b3424');
    r(c, x, 111, 22, 1, '#7d5a41');
  }
  r(c, 0, 114, ANCHO, 2, '#3a291d');
  r(c, 0, 116, ANCHO, ALTO - 116, '#3b4453');
  trama(c, 0, 116, ANCHO, 8, '#333b49', '#3b4453', 0.5);

  // Ventanal con el skyline al atardecer
  const vx = 88, vy = 10, vw = 144, vh = 82;
  const cielo = ['#4e7fb8', '#5d8cc2', '#7aa0c9', '#a3b6cc', '#d6b99a', '#f0b884', '#f6c68f'];
  const banda = vh / cielo.length;
  cielo.forEach((col, i) => {
    r(c, vx, vy + i * banda, vw, banda + 1, col);
    const sig = cielo[i + 1];
    if (sig) trama(c, vx, Math.round(vy + (i + 1) * banda) - 2, vw, 2, col, sig, 0.5);
  });
  r(c, vx + 112, vy + 50, 10, 10, '#fbe2b0');
  r(c, vx + 114, vy + 48, 6, 14, '#fbe2b0');
  r(c, vx + 113, vy + 49, 8, 12, '#fff3d6');
  for (let k = 0; k < 3; k++) r(c, vx + 10 + k * 40, vy + 8 + k * 5, 18 + k * 4, 2, '#8fb0d4');

  const capa = (alto: number, col: string, colLuz: string, ventanas: string | null, paso: number) => {
    let x = vx;
    while (x < vx + vw) {
      const w = 6 + Math.floor(rnd() * paso);
      const h = alto * 0.5 + rnd() * alto;
      const top = vy + vh - h;
      r(c, x, top, w, h, col);
      p(c, x, top, colLuz);
      if (ventanas) {
        for (let wy = top + 3; wy < vy + vh - 2; wy += 3) {
          for (let wx = x + 1; wx < x + w - 1; wx += 2) {
            if (rnd() < 0.35) p(c, wx, wy, ventanas);
          }
        }
      }
      x += w + (rnd() < 0.3 ? 1 : 0);
    }
  };
  capa(34, '#8d9ab0', '#a3aec0', null, 10);
  capa(28, '#5d6a80', '#76829a', '#f5d58f', 12);
  r(c, vx + 46, vy + 14, 9, vh - 14, '#3e4a5e');
  r(c, vx + 46, vy + 14, 2, vh - 14, '#56637a');
  r(c, vx + 50, vy + 8, 1, 6, '#3e4a5e');
  p(c, vx + 50, vy + 7, '#ff6b5a');
  for (let wy = vy + 17; wy < vy + vh; wy += 3) for (let wx = vx + 48; wx < vx + 54; wx += 2) if (rnd() < 0.5) p(c, wx, wy, '#f5d58f');
  capa(16, '#3a4558', '#4c586d', '#ffd98a', 14);

  // Marco y mangueteado del ventanal
  for (let x = vx; x <= vx + vw; x += vw / 4) r(c, x - 1, vy, 2, vh, '#2a2f37');
  r(c, vx - 2, vy - 2, vw + 4, 2, '#2a2f37');
  r(c, vx - 2, vy + vh, vw + 4, 3, '#3c424c');
  r(c, vx - 2, vy + vh, vw + 4, 1, '#59616d');
  r(c, vx - 2, vy - 2, 2, vh + 4, '#2a2f37');
  r(c, vx + vw, vy - 2, 2, vh + 4, '#2a2f37');
  for (let k = 0; k < 4; k++) {
    const x = vx + 6 + k * (vw / 4);
    for (let j = 0; j < 10; j++) p(c, x + j, vy + 4 + j, 'rgba(255,255,255,0.18)');
  }

  // Pantalla con el tablero del proceso
  const sx = 28, sy = 18, sw = 54, sh = 34;
  r(c, sx - 2, sy - 2, sw + 4, sh + 4, '#16181c');
  r(c, sx, sy, sw, sh, '#0f2b4a');
  r(c, sx, sy, sw, 5, '#15385f');
  r(c, sx + 2, sy + 2, 10, 1, '#c8922a');
  r(c, sx + 40, sy + 2, 12, 1, '#7aa0c9');
  const barras = [9, 12, 15, 13, 19, 22];
  barras.forEach((h, i) => {
    r(c, sx + 4 + i * 7, sy + sh - 4 - h, 5, h, i === barras.length - 1 ? '#e05a4a' : '#c8922a');
    r(c, sx + 4 + i * 7, sy + sh - 4 - h, 5, 1, i === barras.length - 1 ? '#f08070' : '#e0b04a');
  });
  r(c, sx + 2, sy + sh - 3, sw - 4, 1, '#4b6a8f');
  for (let i = 0; i < 6; i++) p(c, sx + 6 + i * 7, sy + 14 - (i % 3), '#5ec2a0');
  r(c, sx + sw / 2 - 2, sy + sh + 2, 4, 5, '#2a2d33');

  // Reloj de pared
  const rx = 262, ry = 26;
  for (let y = -6; y <= 6; y++) {
    const w = Math.round(Math.sqrt(36 - y * y));
    r(c, rx - w, ry + y, w * 2 + 1, 1, '#2a2d33');
  }
  for (let y = -5; y <= 5; y++) {
    const w = Math.round(Math.sqrt(25 - y * y));
    r(c, rx - w, ry + y, w * 2 + 1, 1, '#f4efe4');
  }
  r(c, rx, ry - 4, 1, 4, '#1b1d22');
  r(c, rx, ry, 3, 1, '#1b1d22');
  p(c, rx, ry, '#c0392b');

  // Cuadro abstracto
  r(c, 238, 42, 48, 30, '#2a2520');
  r(c, 240, 44, 44, 26, '#e9e2d3');
  r(c, 244, 50, 14, 16, '#c8922a');
  r(c, 256, 46, 10, 10, '#0f2b4a');
  r(c, 266, 54, 14, 12, '#7a9a8a');
  r(c, 260, 60, 8, 6, '#b5543d');

  // Planta de esquina
  r(c, 296, 108, 18, 16, '#2c2a28');
  r(c, 296, 108, 18, 2, '#46423d');
  r(c, 298, 110, 2, 14, '#3a3733');
  const hojas = aleatorio(31);
  const tonos = ['#24502c', '#2f6b3a', '#3e8a4a', '#56a35d'];
  for (let k = 0; k < 26; k++) {
    const ang = -Math.PI / 2 + (hojas() - 0.5) * 2.4;
    const largo = 14 + hojas() * 26;
    const tono = tonos[Math.min(3, Math.floor(hojas() * 4))]!;
    for (let s = 2; s < largo; s++) {
      const curva = s / largo;
      const x = 305 + Math.cos(ang) * s + Math.sign(Math.cos(ang)) * curva * curva * 6;
      const y = 108 + Math.sin(ang) * s + curva * curva * 8;
      const grueso = curva > 0.3 && curva < 0.85 ? 2 : 1;
      r(c, x, y, grueso, grueso, tono);
    }
  }
  return cv;
}

/** Puntos de la mesa en perspectiva: borde trasero recto, frente fuera del lienzo. */
function mesaBorde(y: number): [number, number] {
  const t = (y - MESA_Y) / (ALTO - MESA_Y);
  return [40 - t * 100, 280 + t * 100];
}

export function pintarMesa(): HTMLCanvasElement {
  const cv = lienzo(ANCHO, ALTO);
  const c = cv.getContext('2d')!;
  const rnd = aleatorio(19);

  for (let y = MESA_Y; y < ALTO; y++) {
    const [x0, x1] = mesaBorde(y);
    r(c, x0, y, x1 - x0, 1, '#5a3a26');
  }
  // Veta de la madera
  for (let k = 0; k < 140; k++) {
    const y = MESA_Y + 2 + Math.floor(rnd() * (ALTO - MESA_Y - 2));
    const [x0, x1] = mesaBorde(y);
    const x = x0 + rnd() * (x1 - x0);
    r(c, x, y, 6 + rnd() * 24, 1, rnd() < 0.5 ? '#4e3220' : '#664330');
  }
  // Reflejo del ventanal sobre la cubierta
  for (let y = MESA_Y + 1; y < ALTO; y++) {
    const t = (y - MESA_Y) / (ALTO - MESA_Y);
    const x0 = 96 - t * 30;
    const x1 = 224 + t * 30;
    for (let x = Math.round(x0); x < x1; x++) {
      if ((x + y) % 2 === 0 && y < MESA_Y + 30) p(c, x, y, '#6f4a31');
    }
  }
  for (let y = MESA_Y + 1; y < MESA_Y + 8; y++) {
    for (let x = 100; x < 220; x++) if ((x + y) % 3 === 0) p(c, x, y, '#7c5639');
  }
  for (let y = MESA_Y; y < ALTO; y++) {
    const [x0, x1] = mesaBorde(y);
    p(c, x0, y, '#7d5a40');
    p(c, x1 - 1, y, '#3d281a');
  }
  r(c, 40, MESA_Y, 240, 1, '#8f6747');

  // Objetos sobre la mesa
  const taza = (x: number, y: number, col = '#f4f1ea') => {
    r(c, x, y, 5, 6, col);
    r(c, x + 4, y, 1, 6, '#c9c3b8');
    r(c, x, y, 5, 1, '#5b3a22');
    r(c, x + 5, y + 2, 1, 2, col);
    r(c, x - 1, y + 6, 7, 1, 'rgba(0,0,0,0.25)');
  };
  const hojasPapel = (x: number, y: number, w: number, h: number) => {
    r(c, x + 1, y + 1, w, h, 'rgba(0,0,0,0.25)');
    r(c, x, y, w, h, '#f2efe8');
    for (let j = y + 2; j < y + h - 1; j += 2) r(c, x + 2, j, w - 4 - ((j * 7) % 5), 1, '#b9b4aa');
  };
  const botella = (x: number, y: number) => {
    r(c, x, y, 4, 9, '#a9d4e6');
    r(c, x + 1, y - 2, 2, 2, '#3a7fc0');
    p(c, x, y + 1, '#e1f2f9');
    r(c, x, y + 4, 4, 2, '#3a7fc0');
    r(c, x - 1, y + 9, 6, 1, 'rgba(0,0,0,0.25)');
  };

  // Bernardo: celular y reporte
  hojasPapel(60, 128, 16, 10);
  r(c, 84, 124, 5, 8, '#1b1d22');
  r(c, 85, 125, 3, 6, '#2d4a6b');
  taza(52, 122);
  // Óscar: laptop abierta de espaldas
  r(c, 103, 100, 26, 17, '#9aa3ad');
  r(c, 103, 100, 26, 1, '#c3cad2');
  r(c, 103, 100, 1, 17, '#b5bcc4');
  r(c, 128, 100, 1, 17, '#79818b');
  r(c, 114, 106, 4, 4, '#d9dee4');
  r(c, 101, 117, 30, 2, '#6a727c');
  taza(132, 122, '#2f343c');
  // Ramón: portafolios de piel y vaso
  r(c, 149, 123, 22, 12, '#3b2216');
  r(c, 150, 124, 20, 10, '#5a3420');
  r(c, 150, 124, 20, 1, '#744630');
  r(c, 160, 124, 1, 10, '#3b2216');
  r(c, 165, 127, 1, 6, '#d8b45a');
  r(c, 176, 120, 4, 7, '#cfe5ee');
  r(c, 176, 122, 4, 4, '#b0d4e2');
  r(c, 175, 127, 6, 1, 'rgba(0,0,0,0.25)');
  // Paulina: carpeta y calculadora
  hojasPapel(194, 128, 18, 10);
  r(c, 215, 124, 7, 9, '#2a2d33');
  r(c, 216, 125, 5, 2, '#9fc4a8');
  for (let j = 128; j < 132; j += 2) for (let i = 216; i < 221; i += 2) p(c, i, j, '#d6d8dc');
  // Silvia: libreta y café
  r(c, 240, 127, 16, 11, '#0f2b4a');
  r(c, 241, 128, 14, 9, '#f2efe8');
  for (let j = 129; j < 137; j += 2) p(c, 241, j, '#9aa5b4');
  taza(260, 122);
  // Centro: botellas y teléfono de conferencia
  botella(96, 140);
  botella(222, 140);
  r(c, 152, 142, 16, 6, '#22252b');
  r(c, 154, 141, 12, 1, '#3a3e46');
  p(c, 160, 144, '#5ec26a');
  // Libreta del jugador
  r(c, 210, 160, 22, 16, 'rgba(0,0,0,0.25)');
  r(c, 208, 158, 22, 16, '#f6f3ea');
  for (let j = 162; j < 172; j += 2) r(c, 211, j, 16, 1, '#c9d5e3');
  r(c, 228, 156, 2, 18, '#c8922a');
  taza(96, 160, '#0f2b4a');

  return cv;
}

// --- Laptop del jugador ---

export const LAPTOP_CERRADA = { x0: 130, y0: 158, x1: 190, y1: 178 };

interface Trapecio { arriba: number; abajo: number; izqA: number; derA: number; izqB: number; derB: number }

function trapecio(c: Ctx, t: Trapecio, color: string) {
  for (let y = Math.round(t.arriba); y < t.abajo; y++) {
    const k = (y - t.arriba) / Math.max(1, t.abajo - t.arriba);
    const x0 = t.izqA + (t.izqB - t.izqA) * k;
    const x1 = t.derA + (t.derB - t.derA) * k;
    r(c, x0, y, x1 - x0, 1, color);
  }
}

const LAP_GRANDE: Trapecio = { arriba: 140, abajo: 182, izqA: 46, derA: 274, izqB: 22, derB: 298 };
const LAP_CHICA: Trapecio = { arriba: 159, abajo: 177, izqA: 134, derA: 186, izqB: 130, derB: 190 };

function mezclar(a: Trapecio, b: Trapecio, k: number): Trapecio {
  const m = (x: number, y: number) => x + (y - x) * k;
  return {
    arriba: m(a.arriba, b.arriba), abajo: m(a.abajo, b.abajo),
    izqA: m(a.izqA, b.izqA), derA: m(a.derA, b.derA),
    izqB: m(a.izqB, b.izqB), derB: m(a.derB, b.derB),
  };
}

function laptopCerrada(c: Ctx, t: Trapecio, resaltada: boolean) {
  const ext = { ...t, arriba: t.arriba + 2, abajo: t.abajo + 2, izqA: t.izqA - 1, derA: t.derA + 1, izqB: t.izqB - 1, derB: t.derB + 1 };
  trapecio(c, ext, 'rgba(0,0,0,0.35)');
  if (resaltada) {
    const halo = { ...t, arriba: t.arriba - 1, abajo: t.abajo + 1, izqA: t.izqA - 1, derA: t.derA + 1, izqB: t.izqB - 1, derB: t.derB + 1 };
    trapecio(c, halo, '#f2c14e');
  }
  trapecio(c, t, '#b9c0c8');
  const alto = t.abajo - t.arriba;
  trapecio(c, { ...t, arriba: t.arriba, abajo: t.arriba + 1 }, '#dde2e7');
  trapecio(c, { ...t, arriba: t.abajo - Math.max(1, alto * 0.12), abajo: t.abajo }, '#8d959f');
  const cx = (t.izqA + t.derA + t.izqB + t.derB) / 4;
  const cy = t.arriba + alto * 0.45;
  const s = Math.max(1, Math.round(alto / 9));
  r(c, cx - s, cy - s, s * 2, s * 2, '#eef1f4');
}

let pantallaCache: HTMLCanvasElement | null = null;
function pantallaHoja(): HTMLCanvasElement {
  if (pantallaCache) return pantallaCache;
  const cv = lienzo(216, 112);
  const c = cv.getContext('2d')!;
  r(c, 0, 0, 216, 112, '#f8f9fb');
  r(c, 0, 0, 216, 9, '#0f2b4a');
  r(c, 4, 3, 30, 3, '#c8922a');
  r(c, 180, 3, 30, 3, '#3d6a99');
  r(c, 0, 9, 216, 7, '#e8f0fa');
  for (let i = 0; i < 6; i++) r(c, 4 + i * 22, 11, 14, 2, '#6b7a90');
  for (let y = 16; y < 112; y += 6) {
    r(c, 0, y, 136, 1, '#e0e4eb');
    for (let i = 0; i < 6; i++) r(c, 4 + i * 22, y + 2, 6 + ((y * (i + 3)) % 9), 2, '#9aa5b4');
  }
  for (let i = 0; i < 6; i++) r(c, i * 22 + 1, 9, 1, 103, '#e0e4eb');
  r(c, 140, 18, 72, 60, '#ffffff');
  r(c, 140, 18, 72, 1, '#e0e4eb');
  const hs = [12, 20, 30, 24, 38, 16, 10];
  hs.forEach((h, i) => r(c, 146 + i * 9, 72 - h, 6, h, i === 4 ? '#c0392b' : '#2563a8'));
  r(c, 144, 72, 66, 1, '#6b7a90');
  r(c, 140, 84, 72, 22, '#fdf6e8');
  r(c, 144, 88, 40, 2, '#c8922a');
  r(c, 144, 93, 60, 2, '#9aa5b4');
  r(c, 144, 98, 52, 2, '#9aa5b4');
  r(c, 60, 50, 1, 6, '#1b2332');
  pantallaCache = cv;
  return cv;
}

/**
 * Laptop en primera persona. k=0 abierta frente al jugador, k=1 cerrada y ya
 * colocada sobre la mesa. Entre 0 y 0.55 la pantalla se abate; después se aleja.
 */
export function dibujarLaptop(c: Ctx, k: number, resaltada = false) {
  const kTapa = Math.min(1, k / 0.55);
  const kViaje = Math.max(0, (k - 0.55) / 0.45);

  if (kTapa >= 1) {
    const facil = kViaje * kViaje * (3 - 2 * kViaje);
    laptopCerrada(c, mezclar(LAP_GRANDE, LAP_CHICA, facil), resaltada);
    return;
  }

  // Base con teclado
  trapecio(c, LAP_GRANDE, '#c3c9d0');
  trapecio(c, { ...LAP_GRANDE, abajo: LAP_GRANDE.arriba + 2 }, '#9aa2ab');
  for (let fila = 0; fila < 4; fila++) {
    const y = 146 + fila * 6;
    const k2 = (y - LAP_GRANDE.arriba) / (LAP_GRANDE.abajo - LAP_GRANDE.arriba);
    const x0 = LAP_GRANDE.izqA + (LAP_GRANDE.izqB - LAP_GRANDE.izqA) * k2 + 14;
    const x1 = LAP_GRANDE.derA + (LAP_GRANDE.derB - LAP_GRANDE.derA) * k2 - 14;
    for (let x = x0; x < x1 - 8; x += 13) r(c, x, y, 11, 4, '#2a2e35');
  }
  r(c, 136, 172, 48, 9, '#b1b8c0');
  r(c, 136, 172, 48, 1, '#9aa2ab');

  // Tapa abatiéndose sobre la bisagra
  const angulo = kTapa * Math.PI / 2;
  const alto = Math.round(126 * Math.cos(angulo));
  if (alto > 1) {
    const top = 140 - alto;
    r(c, 50, top, 220, alto, '#1d2126');
    const interior = alto - 8;
    if (interior > 0) {
      c.imageSmoothingEnabled = false;
      c.drawImage(pantallaHoja(), 0, 0, 216, 112, 52, top + 4, 216, interior);
      if (kTapa > 0) {
        c.fillStyle = `rgba(10,16,28,${(kTapa * 0.8).toFixed(2)})`;
        c.fillRect(52, top + 4, 216, interior);
      }
    }
    if (alto > 6) p(c, 160, top + 2, '#3a3f47');
  }
  r(c, 50, 139, 220, 2, '#8d959f');
}

// --- Indicadores sobre los personajes ---

export function dibujarIndicador(c: Ctx, x: number, y: number, tipo: 'pendiente' | 'nuevo', t: number) {
  const bob = Math.floor(t / 300) % 2;
  const yy = y - bob;
  if (tipo === 'pendiente') {
    r(c, x - 3, yy, 7, 9, '#2a1d08');
    r(c, x - 2, yy + 1, 5, 7, '#f2c14e');
    r(c, x - 3, yy + 1, 1, 7, '#2a1d08');
    p(c, x - 2, yy + 1, '#ffe39a');
    r(c, x, yy + 2, 1, 3, '#2a1d08');
    p(c, x, yy + 6, '#2a1d08');
    p(c, x, yy + 9, '#2a1d08');
  } else {
    r(c, x - 5, yy, 11, 7, '#1b2332');
    r(c, x - 4, yy + 1, 9, 5, '#f4f1ea');
    p(c, x - 2, yy + 3, '#1b2332');
    p(c, x, yy + 3, '#1b2332');
    p(c, x + 2, yy + 3, '#1b2332');
    p(c, x - 3, yy + 7, '#1b2332');
  }
}

/** Contorno de 1 px alrededor de lo que haya en la capa (para el personaje enfocado). */
export function contorno(destino: Ctx, capa: HTMLCanvasElement, color: string) {
  const sil = lienzo(capa.width, capa.height);
  const s = sil.getContext('2d')!;
  s.drawImage(capa, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = color;
  s.fillRect(0, 0, sil.width, sil.height);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) destino.drawImage(sil, dx, dy);
}

// --- Retrato para el cuadro de diálogo ---

export function dibujarRetrato(c: Ctx, per: Personaje, est: EstadoPersonaje) {
  const w = c.canvas.width;
  const h = c.canvas.height;
  r(c, 0, 0, w, h, '#1a3354');
  trama(c, 0, h - 14, w, 14, '#1a3354', '#142a47', 0.5);
  r(c, 0, 0, w, 1, '#2a4a72');
  const sentado: Personaje = { ...per, sentado: true };
  dibujarPersonaje(c, sentado, { ...est, respiro: 0 }, Math.round(h * 0.25) + 38, w / 2);
}

export function animoDe(expresion: string | undefined): Animo {
  const e = (expresion ?? '').toLowerCase();
  if (/contento|satisfech|aliviad|entusias|animad|emocionad|orgullos|vindicad|campechan|impresionad|esperanzad|reconociendo|tranquil/.test(e)) return 'feliz';
  if (/molest|irritad|frustrad|cortante|amenazante|insist|sever|impacient|defensiv|critic|cinic|fri[ao]|seca/.test(e)) return 'enojado';
  if (/preocupad|nervios|alarmad|confundid|dudos|timid|trist|decepcionad|resignad|atrevi|esceptic/.test(e)) return 'preocupado';
  if (/sorprendid|intrigad/.test(e)) return 'sorpresa';
  return 'neutral';
}
