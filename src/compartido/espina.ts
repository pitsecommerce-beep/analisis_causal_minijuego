// Espina de pescado (Ishikawa) del participante. Módulo puro compartido por cliente y servidor.

export const RAMAS_6M = [
  { id: 'personal', nombre: 'Personal' },
  { id: 'metodo', nombre: 'Método' },
  { id: 'maquina', nombre: 'Máquina' },
  { id: 'material', nombre: 'Material' },
  { id: 'medicion', nombre: 'Medición' },
  { id: 'entorno', nombre: 'Entorno' },
] as const;
export type Rama = typeof RAMAS_6M[number]['id'];

export const ORIGENES = {
  propio: 'Hallazgo propio',
  equipo: 'Afirmación del equipo',
  cliente: 'Comentario de cliente',
} as const;
export type Origen = keyof typeof ORIGENES;

export const ESTADOS = {
  hipotesis: 'Hipótesis',
  verificada: 'Verificada',
  refutada: 'Refutada',
} as const;
export type EstadoTarjeta = keyof typeof ESTADOS;

// Gráfica o cálculo hecho en la pestaña Datos
export interface Evidencia {
  id: string;
  herramienta: string;
  hoja: string;
  columna: string;
  resumen: string;
  estrato: string | null;
  // Verificación de config/verificaciones.json que respalda este análisis, si la hay
  verificacionId: string | null;
  ciclo: number;
  creada: string;
}

export interface Tarjeta {
  id: string;
  rama: Rama;
  texto: string;
  origen: Origen;
  estado: EstadoTarjeta;
  evidencias: string[];
  pendienteId: string | null;
  ciclo: number;
  creada: string;
}

export interface Votacion {
  ciclo: number;
  causas: string[];
  porques: string[];
}

export interface Espina {
  tarjetas: Tarjeta[];
  evidencias: Evidencia[];
  votaciones: Votacion[];
}

export const ESPINA_VACIA: Espina = { tarjetas: [], evidencias: [], votaciones: [] };
export const CAUSAS_A_VOTAR = 3;
export const NUM_PORQUES = 5;

const MAX_TARJETAS = 60;
const MAX_EVIDENCIAS = 120;
const MAX_TEXTO = 400;

function texto(v: unknown, max = MAX_TEXTO): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function uno<T extends string>(v: unknown, validos: readonly T[], porDefecto: T): T {
  return validos.includes(v as T) ? (v as T) : porDefecto;
}

// Limpia lo que envía el navegador. Una evidencia solo conserva su verificación si el
// jugador realmente la registró, y una tarjeta solo queda verificada si tiene evidencia.
export function normalizarEspina(entrada: unknown, verificacionesJugador: string[], previa: Espina = ESPINA_VACIA): Espina {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>;
  const crudasEv = Array.isArray(e['evidencias']) ? e['evidencias'] : [];
  const evidencias: Evidencia[] = crudasEv.slice(0, MAX_EVIDENCIAS).flatMap((x): Evidencia[] => {
    const v = (x ?? {}) as Record<string, unknown>;
    const id = texto(v['id'], 64);
    if (!id) return [];
    const verif = texto(v['verificacionId'], 64);
    return [{
      id,
      herramienta: texto(v['herramienta'], 40),
      hoja: texto(v['hoja'], 20),
      columna: texto(v['columna'], 120),
      resumen: texto(v['resumen']),
      estrato: texto(v['estrato'], 80) || null,
      verificacionId: verif && verificacionesJugador.includes(verif) ? verif : null,
      ciclo: Number(v['ciclo']) || 1,
      creada: texto(v['creada'], 40),
    }];
  });
  const idsEv = new Set(evidencias.map(x => x.id));
  const ramas = RAMAS_6M.map(r => r.id);
  const crudasTar = Array.isArray(e['tarjetas']) ? e['tarjetas'] : [];
  const tarjetas: Tarjeta[] = crudasTar.slice(0, MAX_TARJETAS).flatMap((x): Tarjeta[] => {
    const v = (x ?? {}) as Record<string, unknown>;
    const id = texto(v['id'], 64);
    const t = texto(v['texto']);
    if (!id || !t) return [];
    const evs = (Array.isArray(v['evidencias']) ? v['evidencias'] : []).map(y => texto(y, 64)).filter(y => idsEv.has(y));
    let estado = uno(v['estado'], Object.keys(ESTADOS) as EstadoTarjeta[], 'hipotesis');
    if (estado === 'verificada' && evs.length === 0) estado = 'hipotesis';
    return [{
      id,
      rama: uno(v['rama'], ramas, 'metodo'),
      texto: t,
      origen: uno(v['origen'], Object.keys(ORIGENES) as Origen[], 'propio'),
      estado,
      evidencias: [...new Set(evs)],
      pendienteId: texto(v['pendienteId'], 64) || null,
      ciclo: Number(v['ciclo']) || 1,
      creada: texto(v['creada'], 40),
    }];
  });
  // Las votaciones solo se cambian con su propio endpoint
  return { tarjetas, evidencias, votaciones: previa.votaciones };
}

export function validarVotacion(espina: Espina, causas: unknown, porques: unknown): { ok: true; votacion: Omit<Votacion, 'ciclo'> } | { ok: false; error: string } {
  const ids = new Set(espina.tarjetas.map(t => t.id));
  const elegidas = [...new Set((Array.isArray(causas) ? causas : []).map(c => texto(c, 64)))].filter(c => ids.has(c));
  const requeridas = Math.min(CAUSAS_A_VOTAR, espina.tarjetas.length);
  if (espina.tarjetas.length === 0) return { ok: false, error: 'Agrega al menos una causa a la espina de pescado antes de votar.' };
  if (elegidas.length !== requeridas) return { ok: false, error: `Vota exactamente ${requeridas} ${requeridas === 1 ? 'causa' : 'causas'}.` };
  const ps = (Array.isArray(porques) ? porques : []).map(p => texto(p)).slice(0, NUM_PORQUES);
  if (ps.length < NUM_PORQUES || ps.some(p => !p)) return { ok: false, error: 'Escribe los 5 porqués.' };
  return { ok: true, votacion: { causas: elegidas, porques: ps } };
}

// Qué causa raíz respalda cada verificación
export const CAUSA_POR_VERIFICACION: Record<string, string> = {
  medianas_iguales: 'ventana_captura_cuello',
  errores_captura_interfaz: 'reproceso_documental',
  error_captura_frecuente: 'reproceso_documental',
  concentracion_sucursales: 'reproceso_documental',
  quejas_reproceso_documental: 'reproceso_documental',
  atorados_sin_plastico: 'fuga_aprobados_sin_plastico',
  secuencia_buro: 'secuencia_tardia_buro',
  trabajo_perdido_buro: 'secuencia_tardia_buro',
};

export function causasDeTarjeta(espina: Espina, tarjeta: Tarjeta): string[] {
  const causas = new Set<string>();
  for (const id of tarjeta.evidencias) {
    const ev = espina.evidencias.find(x => x.id === id);
    const causa = ev?.verificacionId ? CAUSA_POR_VERIFICACION[ev.verificacionId] : undefined;
    if (causa) causas.add(causa);
  }
  return [...causas];
}

export function ultimaVotacion(espina: Espina): Votacion | null {
  return espina.votaciones.reduce<Votacion | null>((u, v) => (!u || v.ciclo >= u.ciclo ? v : u), null);
}

export function tarjetasVerificadas(espina: Espina): Tarjeta[] {
  return espina.tarjetas.filter(t => t.estado === 'verificada' && t.evidencias.length > 0);
}

export interface CausaEvaluable { id: string; nombre: string }
export const PREFIJO_SIN_VERIFICAR = 'sin_verificar:';
export const PREFIJO_SIN_RESPALDO = 'sin_respaldo:';

// Convierte las causas votadas en el último ciclo en la lista que evalúa el diagnóstico:
// cada causa raíz respaldada cuenta una vez; lo votado sin verificar se penaliza.
export function causasDesdeEspina(espina: Espina): CausaEvaluable[] {
  const v = ultimaVotacion(espina);
  if (!v) return [];
  const out: CausaEvaluable[] = [];
  const vistas = new Set<string>();
  for (const id of v.causas) {
    const t = espina.tarjetas.find(x => x.id === id);
    if (!t) continue;
    if (t.estado !== 'verificada' || t.evidencias.length === 0) {
      out.push({ id: PREFIJO_SIN_VERIFICAR + t.id, nombre: t.texto });
      continue;
    }
    const causas = causasDeTarjeta(espina, t).filter(c => !vistas.has(c));
    if (causas.length === 0) out.push({ id: PREFIJO_SIN_RESPALDO + t.id, nombre: t.texto });
    for (const c of causas) { vistas.add(c); out.push({ id: c, nombre: t.texto }); }
  }
  return out;
}
