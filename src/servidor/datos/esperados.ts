import type { ClaveDatos } from '../../compartido/configuracion.js';
import type { EstadisticasVerificacion } from './derivados.js';

type Esperado = Partial<Omit<EstadisticasVerificacion, 'filasFueraInvariante'>> & { fueraInvariante?: number };

// Valores que el cargador debe reproducir. R2 viene del diccionario de datos; A_es, de la nota del caso.
// A_en, B_en y B_es se fijaron con lo que arroja cada archivo, sin ajustar el parser para igualar idiomas.
export const ESPERADOS: Record<ClaveDatos, Esperado> = {
  R2: {
    filas: 1500, sucursales: 18, estados: 8, mesesDistintos: 18,
    erroresTotales: 1318, erroresCaptura: 659, erroresIncompletos: 472, erroresIlegibles: 187,
    casosConError: 897, intentosMedia: 1.96, intentosDesviacion: 0.89,
    ventanaCapturaMedia: 18.9, ventanaCapturaMediana: 11, correlacionIntentoCaptura: 0.786,
    buroCorrido: 1397, buroAceptado: 1022, scoreAceptado: 873, plasticoEnviado: 731,
    atorados: 142, diasPerdidosRechazados: 6758, top3SucursalesPorErrores: [110, 676, 728],
  },
  A_es: {
    filas: 103, erroresCaptura: 49, erroresIncompletos: 42, erroresIlegibles: 18, erroresOtros: 4,
    correlacionIntentoCaptura: 0.805, fueraInvariante: 11,
  },
  A_en: {
    filas: 103, erroresCaptura: 49, erroresIncompletos: 43, erroresIlegibles: 20, erroresOtros: 3,
    correlacionIntentoCaptura: 0.805, fueraInvariante: 9,
  },
  B_es: {
    filas: 103, erroresCaptura: 49, erroresIncompletos: 43, erroresIlegibles: 20, erroresOtros: 3,
    correlacionIntentoCaptura: 0.805, fueraInvariante: 9,
  },
  B_en: {
    filas: 103, erroresCaptura: 49, erroresIncompletos: 43, erroresIlegibles: 20, erroresOtros: 3,
    correlacionIntentoCaptura: 0.805, fueraInvariante: 9,
  },
};

export function compararEsperados(clave: ClaveDatos, e: EstadisticasVerificacion) {
  const obtenido: Record<string, unknown> = { ...e, fueraInvariante: e.filasFueraInvariante.length };
  return Object.entries(ESPERADOS[clave]).map(([nombre, esperado]) => ({
    nombre,
    esperado: String(esperado),
    obtenido: String(obtenido[nombre]),
    ok: String(esperado) === String(obtenido[nombre]),
  }));
}
