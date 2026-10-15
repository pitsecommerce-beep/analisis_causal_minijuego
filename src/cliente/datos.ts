import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { agregarCalculadas, columnasCalculadas, cruzar } from './analisis.js';
import type { Columna, Fila } from './analisis.js';
import { useSesion } from './i18n.js';
import type { Vocabulario } from '../compartido/expediente.js';

export interface DatosJuego {
  solicitudes: Fila[];
  comentarios: Fila[];
  colsSolicitudes: Columna[];
  colsComentarios: Columna[];
  vocabulario: Vocabulario;
}

// Los datos de la sesión no cambian: se descargan una vez y los comparten la tabla, el constructor y el tablero
let cache: Promise<{ sol: Fila[]; com: Fila[]; cols: { solicitudes: Columna[]; comentarios: Columna[] } }> | null = null;

function descargar() {
  cache ??= Promise.all([api.datos.solicitudes(), api.datos.comentarios(), api.datos.columnas()])
    .then(([sol, com, cols]) => ({ sol, com, cols }))
    .catch(err => { cache = null; throw err; });
  return cache;
}

// Agrega columnas calculadas y el cruce entre solicitudes y comentarios
export function prepararDatos(sol: Fila[], com: Fila[], cols: { solicitudes: Columna[]; comentarios: Columna[] }, vocabulario: Vocabulario, t: (c: string) => string): DatosJuego {
  const cruce = cruzar(agregarCalculadas(sol, vocabulario), com);
  return {
    solicitudes: cruce.solicitudes,
    comentarios: cruce.comentarios,
    colsSolicitudes: [...cols.solicitudes, ...columnasCalculadas('solicitudes', t, vocabulario)],
    colsComentarios: [...cols.comentarios, ...columnasCalculadas('comentarios', t, vocabulario)],
    vocabulario,
  };
}

export function useDatos(): { datos: DatosJuego | null; error: boolean; reintentar: () => void } {
  const { config, t } = useSesion();
  const [datos, setDatos] = useState<DatosJuego | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const vocabulario: Vocabulario = config.version === 'extendida' ? 'R2' : 'original';

  useEffect(() => {
    let vigente = true;
    setError(false);
    descargar().then(({ sol, com, cols }) => {
      if (!vigente) return;
      setDatos(prepararDatos(sol, com, cols, vocabulario, t));
    }).catch(() => { if (vigente) setError(true); });
    return () => { vigente = false; };
  }, [intento, vocabulario, t]);

  const reintentar = useCallback(() => setIntento(i => i + 1), []);
  return { datos, error, reintentar };
}
