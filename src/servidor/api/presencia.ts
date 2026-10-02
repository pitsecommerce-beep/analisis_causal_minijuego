// Un participante se considera conectado si su navegador reportó actividad en este intervalo
export const MS_CONECTADO = 90_000;

// null indica que la base de datos no registra presencia (falta la migración 003)
export function estaConectado(ultimaActividad: unknown, ahora = Date.now()): boolean | null {
  if (ultimaActividad === undefined) return null;
  if (!ultimaActividad) return false;
  const ts = new Date(String(ultimaActividad)).getTime();
  if (Number.isNaN(ts)) return false;
  return ahora - ts < MS_CONECTADO;
}
