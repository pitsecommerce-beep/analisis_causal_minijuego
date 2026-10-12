import { useEffect, useRef } from 'react';

// Tras este tiempo sin interacción se dejan de hacer consultas periódicas. Así una pestaña
// olvidada no mantiene encendido el servidor (Railway lo duerme cuando no recibe tráfico).
export const MS_INACTIVIDAD = 10 * 60_000;

const EVENTOS_ACTIVIDAD = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;

// Ejecuta `fn` cada `intervalo` ms mientras la pestaña esté visible y la persona haya
// interactuado recientemente. Al volver a la pestaña o retomar actividad se ejecuta de inmediato.
export function useSondeo(fn: () => void, intervalo: number, activo = true): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!activo) return;
    let ultimaActividad = Date.now();
    let id: number | undefined;

    const enPausa = () => document.hidden || Date.now() - ultimaActividad > MS_INACTIVIDAD;

    const detener = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
    };

    const programar = () => {
      if (id !== undefined || enPausa()) return;
      id = window.setInterval(() => {
        if (enPausa()) { detener(); return; }
        fnRef.current();
      }, intervalo);
    };

    const reanudar = () => {
      const estabaDetenido = id === undefined;
      if (estabaDetenido && !enPausa()) fnRef.current();
      programar();
    };

    const alInteractuar = () => {
      const estabaInactivo = Date.now() - ultimaActividad > MS_INACTIVIDAD;
      ultimaActividad = Date.now();
      if (estabaInactivo) reanudar();
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) detener();
      else reanudar();
    };

    for (const e of EVENTOS_ACTIVIDAD) window.addEventListener(e, alInteractuar, { passive: true });
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    programar();

    return () => {
      detener();
      for (const e of EVENTOS_ACTIVIDAD) window.removeEventListener(e, alInteractuar);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
    };
  }, [intervalo, activo]);
}
