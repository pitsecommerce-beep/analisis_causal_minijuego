import type { EstadoDialogo } from '../dialogos/motor-dialogos.js';

export interface EstadoDialogoJSON {
  verificaciones: string[];
  refutaciones: string[];
  convencidos: string[];
  accionesAceptadas: number[];
  postergados: string[];
}

export function serializarDialogo(estado: EstadoDialogo): EstadoDialogoJSON {
  return {
    verificaciones: [...estado.verificaciones],
    refutaciones: [...estado.refutaciones],
    convencidos: [...estado.convencidos],
    accionesAceptadas: estado.accionesAceptadas,
    postergados: [...estado.postergados],
  };
}

export function deserializarDialogo(data: EstadoDialogoJSON): EstadoDialogo {
  return {
    verificaciones: new Set(data.verificaciones ?? []),
    refutaciones: new Set(data.refutaciones ?? []),
    convencidos: new Set(data.convencidos ?? []),
    accionesAceptadas: data.accionesAceptadas ?? [],
    postergados: new Set(data.postergados ?? []),
  };
}
