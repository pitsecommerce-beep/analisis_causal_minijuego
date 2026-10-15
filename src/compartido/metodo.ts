// Método de Bohn medido por comportamiento: qué hizo el participante y en qué orden.
import type { Espina } from './espina.js';

export const TIPOS_EVENTO = ['analisis', 'vista', 'proceso_etapa', 'espina_tarjeta', 'evidencia', 'acciones', 'votacion', 'aviso'] as const;
export type TipoEvento = typeof TIPOS_EVENTO[number];

export interface Evento {
  tipo: string;
  datos: Record<string, any>;
  // ISO 8601 asignado por el servidor
  momento: string;
}

export interface VinculoAccion {
  accionId: number;
  tarjetaId: string | null;
  // Si la causa estaba verificada cuando se eligió la acción
  verificada: boolean;
}

export const HITOS = {
  percibir: 'Percibir: revisó comentarios de clientes o KPIs del ciclo antes de analizar solicitudes',
  definir: 'Definir: hizo un Pareto de errores o quejas',
  hipotesis: 'Hipótesis: agregó causas a la espina antes de decidir acciones',
  probar: 'Probar: sus acciones están ligadas a causas verificadas',
  estratificar: 'Estratificar: repitió un análisis filtrado por un estrato',
} as const;
export type Hito = keyof typeof HITOS;
export type Hitos = Record<Hito, boolean>;

// Columnas que describen errores o quejas: un Pareto sobre ellas define el problema
export const COLUMNAS_ERRORES_QUEJAS = ['comments', 'erroresComentario', 'categoriaPrimaria', 'categoriaSecundaria', 'categoriaQueja'];
const CAMPOS_SUCURSAL = ['branchNum', 'sucursalNum'];
export const ACCION_CAPACITAR_TODAS = 3;

const de = (eventos: Evento[], tipo: string) => eventos.filter(e => e.tipo === tipo);
const primero = (eventos: Evento[]) => eventos.reduce<Evento | null>((p, e) => (!p || e.momento < p.momento ? e : p), null);

export function vinculosDe(eventos: Evento[]): VinculoAccion[] {
  return de(eventos, 'acciones').flatMap(e => (Array.isArray(e.datos['acciones']) ? e.datos['acciones'] : []) as VinculoAccion[]);
}

export function estratificoPorSucursal(eventos: Evento[], antesDe?: string): boolean {
  return de(eventos, 'analisis').some(e => CAMPOS_SUCURSAL.includes(e.datos['estrato']?.campo) && (!antesDe || e.momento < antesDe));
}

export function evaluarHitos(eventos: Evento[], espina: Espina): Hitos {
  const analisis = de(eventos, 'analisis');
  const primerSolicitudes = primero(analisis.filter(e => e.datos['hoja'] === 'solicitudes'));
  const percepcion = eventos.filter(e =>
    (e.tipo === 'vista' && ['comentarios', 'decisiones'].includes(e.datos['vista'])) ||
    (e.tipo === 'analisis' && e.datos['hoja'] === 'comentarios'));
  const primeraPercepcion = primero(percepcion);

  const primeraTarjeta = primero(de(eventos, 'espina_tarjeta'));
  const primerasAcciones = primero(de(eventos, 'acciones'));

  const verificadas = new Set(espina.tarjetas.filter(t => t.estado === 'verificada' && t.evidencias.length > 0).map(t => t.id));
  const vinculos = vinculosDe(eventos);

  const clave = (e: Evento) => `${e.datos['hoja']}|${e.datos['herramienta']}|${e.datos['columna']}`;
  const sinEstrato = new Set(analisis.filter(e => !e.datos['estrato']).map(clave));

  return {
    percibir: !!primeraPercepcion && (!primerSolicitudes || primeraPercepcion.momento <= primerSolicitudes.momento),
    definir: analisis.some(e => e.datos['herramienta'] === 'pareto' && COLUMNAS_ERRORES_QUEJAS.includes(e.datos['columna'])),
    hipotesis: !!primeraTarjeta && (!primerasAcciones || primeraTarjeta.momento < primerasAcciones.momento),
    probar: vinculos.length > 0 && vinculos.every(v => v.tarjetaId != null && verificadas.has(v.tarjetaId)),
    estratificar: analisis.some(e => e.datos['estrato'] && sinEstrato.has(clave(e))),
  };
}

export interface ResumenMetodo {
  hitos: Hitos;
  accionesSinVerificar: number;
  capacitoSinEstratificar: boolean;
  herramientas: string[];
}

export function resumirMetodo(eventos: Evento[], espina: Espina): ResumenMetodo {
  const acciones = de(eventos, 'acciones');
  return {
    hitos: evaluarHitos(eventos, espina),
    accionesSinVerificar: vinculosDe(eventos).filter(v => !v.verificada).length,
    capacitoSinEstratificar: acciones.some(e =>
      (e.datos['acciones'] as VinculoAccion[] ?? []).some(v => v.accionId === ACCION_CAPACITAR_TODAS) && !estratificoPorSucursal(eventos, e.momento)),
    herramientas: [...new Set(de(eventos, 'analisis').map(e => String(e.datos['herramienta'])))],
  };
}

// Lo que Betancourt señala en cuanto el participante decide sin sustento
export function avisosPorAcciones(vinculos: VinculoAccion[], nombres: Record<number, string>, eventosPrevios: Evento[], idioma: 'es' | 'en' = 'es'): string[] {
  const en = idioma === 'en';
  const avisos: string[] = [];
  if (vinculos.some(v => v.accionId === ACCION_CAPACITAR_TODAS) && !estratificoPorSucursal(eventosPrevios)) {
    avisos.push(en
      ? 'You are about to train all 18 branches without looking at the data by branch. Before spending 100 units, stratify the errors by branch: are they spread out or concentrated in a few?'
      : 'Vas a capacitar a las 18 sucursales sin haber revisado los datos por sucursal. Antes de gastar 100 unidades, estratifica los errores por sucursal: ¿están repartidos o se concentran en unas cuantas?');
  }
  const sinSustento = vinculos.filter(v => !v.verificada).map(v => nombres[v.accionId] ?? `${en ? 'Action' : 'Acción'} ${v.accionId}`);
  if (sinSustento.length > 0) {
    const lista = sinSustento.map(n => (en ? `“${n}”` : `«${n}»`)).join(', ');
    avisos.push(en
      ? `You chose ${lista} without linking it to a verified cause. The board expects data-driven decisions: verify the cause in your fishbone before investing.`
      : `Elegiste ${lista} sin ligarla a una causa verificada. El consejo espera decisiones sustentadas en datos: verifica la causa en tu espina de pescado antes de invertir.`);
  }
  return avisos;
}
