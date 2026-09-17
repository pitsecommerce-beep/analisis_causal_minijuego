import type { EstadoPartida } from '../motor/ciclos.js';

export interface Afirmacion {
  id: string;
  verificable: boolean;
  veredicto: string;
}

export interface RespuestaDialogo {
  texto: string;
  efecto: string;
  credibilidad: number;
  requiere?: string;
}

export interface NodoDialogo {
  id: string;
  personaje: string;
  ciclo: number;
  fase: string;
  expresion: string;
  lineas: string[];
  afirmacion?: Afirmacion;
  condicion?: CondicionNodo;
  respuestas: RespuestaDialogo[];
}

export interface CondicionNodo {
  tipo: string;
  metrica?: string;
  operador?: string;
  valor?: number | string;
  afirmacion?: string;
  accionId?: number;
  acciones?: number[];
  minimo?: number;
  maximo?: number;
}

export interface EstadoDialogo {
  verificaciones: Set<string>;
  refutaciones: Set<string>;
  convencidos: Set<string>;
  accionesAceptadas: number[];
  postergados: Set<string>;
}

export function crearEstadoDialogo(): EstadoDialogo {
  return {
    verificaciones: new Set(),
    refutaciones: new Set(),
    convencidos: new Set(),
    accionesAceptadas: [],
    postergados: new Set(),
  };
}

export function evaluarCondicion(
  cond: CondicionNodo,
  partida: EstadoPartida,
  estado: EstadoDialogo
): boolean {
  switch (cond.tipo) {
    case 'kpi': {
      const valor = (partida.kpis as Record<string, number>)[cond.metrica!] ?? 0;
      const umbral = cond.valor as number;
      switch (cond.operador) {
        case '>': return valor > umbral;
        case '>=': return valor >= umbral;
        case '<': return valor < umbral;
        case '<=': return valor <= umbral;
        case '==': return valor === umbral;
        default: return false;
      }
    }
    case 'refutado':
      return estado.refutaciones.has(cond.afirmacion!);
    case 'convencido':
      return estado.convencidos.size > 0;
    case 'aceptaron_su_accion':
      return estado.accionesAceptadas.length > 0;
    case 'accion_elegida':
      return partida.accionesElegidas.some((a) => a.accionId === cond.accionId);
    case 'accion_no_elegida':
      return !partida.accionesElegidas.some((a) => a.accionId === cond.accionId);
    case 'ninguna_accion_de':
      return !cond.acciones!.some((id) =>
        partida.accionesElegidas.some((a) => a.accionId === id)
      );
    case 'multiples_acciones': {
      const count = cond.acciones!.filter((id) =>
        partida.accionesElegidas.some((a) => a.accionId === id)
      ).length;
      const min = cond.minimo ?? 0;
      const max = cond.maximo ?? Infinity;
      return count >= min && count <= max;
    }
    case 'sin_acciones_nuevas':
      return partida.accionesElegidas.filter((a) => a.cicloElegido === partida.cicloActual).length === 0;
    case 'vida_perdida':
      return partida.vidas < 3;
    case 'credibilidad_baja':
      return partida.credibilidad < 30;
    case 'postergado':
      return estado.postergados.size > 0;
    case 'escuchado':
      return true;
    case 'pide_consejo':
      return true;
    case 'compromiso_cumplido': {
      const ultimo = partida.resultadosCiclo[partida.resultadosCiclo.length - 1];
      return ultimo?.cumplioCompromiso ?? false;
    }
    case 'compromiso_no_cumplido': {
      const ultimo = partida.resultadosCiclo[partida.resultadosCiclo.length - 1];
      return ultimo ? !ultimo.cumplioCompromiso : false;
    }
    case 'vidas_restantes':
      return partida.vidas === (cond.valor as number);
    case 'destituido':
      return partida.destituido;
    case 'desenlace':
      return true;
    default:
      return false;
  }
}

export function filtrarRespuestas(
  respuestas: RespuestaDialogo[],
  estado: EstadoDialogo
): RespuestaDialogo[] {
  return respuestas.filter((r) => {
    if (!r.requiere) return true;
    if (r.requiere.startsWith('verifico:')) {
      const afirmacionId = r.requiere.replace('verifico:', '');
      return estado.verificaciones.has(afirmacionId);
    }
    return true;
  });
}

export function obtenerNodosCiclo(
  nodos: NodoDialogo[],
  ciclo: number,
  partida: EstadoPartida,
  estado: EstadoDialogo
): NodoDialogo[] {
  const resultado: NodoDialogo[] = [];

  for (const nodo of nodos) {
    if (nodo.ciclo !== ciclo && nodo.ciclo !== 0) continue;

    if (nodo.condicion) {
      if (!evaluarCondicion(nodo.condicion, partida, estado)) continue;
    }

    if (nodo.ciclo === ciclo && nodo.fase === 'apertura') {
      resultado.push(nodo);
    }
  }

  return resultado;
}

export function aplicarEfecto(
  efecto: string,
  estado: EstadoDialogo,
  personaje: string
): void {
  if (efecto === 'abrir_laptop') return;
  if (efecto === 'postergar') {
    estado.postergados.add(personaje);
    return;
  }
  if (efecto === 'rechazar') return;
  if (efecto === 'mostrar_resultados') return;
  if (efecto === 'escuchar') return;
  if (efecto === 'insistir_sin_datos') return;

  if (efecto === 'refutar') return;
  if (efecto === 'contraargumentar') return;
  if (efecto === 'confirmar') return;

  if (efecto.startsWith('convencer:')) {
    estado.convencidos.add(efecto.replace('convencer:', ''));
    return;
  }

  if (efecto.startsWith('aceptar:')) {
    const accionId = parseInt(efecto.replace('aceptar:', ''), 10);
    if (!isNaN(accionId) && !estado.accionesAceptadas.includes(accionId)) {
      estado.accionesAceptadas.push(accionId);
    }
    return;
  }

  if (efecto.startsWith('aceptar_multiple:')) {
    const ids = efecto.replace('aceptar_multiple:', '').split(',').map(Number);
    for (const id of ids) {
      if (!estado.accionesAceptadas.includes(id)) {
        estado.accionesAceptadas.push(id);
      }
    }
    return;
  }

  if (efecto.startsWith('pedir_consejo:')) return;
}
