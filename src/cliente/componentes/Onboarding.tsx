import { useSesion } from '../i18n.js';
import { useCallback, useEffect, useState } from 'react';
import type { NombreIcono } from './ui/Iconos.js';
import { RamonMedioCuerpo } from './Betancourt.js';
import type { Animo } from './sala/pixel.js';

export interface PasoRecorrido {
  // Valor del atributo data-tour del elemento a señalar. Sin objetivo, Ramón solo habla.
  objetivo?: string;
  icono?: NombreIcono;
  // Expresión de Betancourt en este paso
  animo?: Animo;
  titulo: string;
  texto: string;
  puntos?: string[];
  // Se ejecuta al entrar al paso, por ejemplo para cambiar de pestaña
  alEntrar?: () => void;
}

interface Props {
  pasos: PasoRecorrido[];
  onTerminar: () => void;
}

const MARGEN = 8;
// Velocidad de la máquina de escribir: caracteres cada 28 ms, como en la Sala de Juntas
const CARACTERES_POR_TICK = 2;
const MS_TICK = 28;

interface Caja { top: number; left: number; width: number; height: number }

function medir(objetivo?: string): Caja | null {
  if (!objetivo) return null;
  const el = document.querySelector(`[data-tour="${objetivo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top - MARGEN, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 };
}

function escalaRamon(): number {
  const w = window.innerWidth;
  return w < 640 ? 2.5 : w < 1100 ? 4 : 5;
}

// Inducción presentada por Ramón Betancourt: aparece de medio cuerpo abajo a la izquierda
// y habla mientras se señalan los elementos de la interfaz
export function Onboarding({ pasos, onTerminar }: Props) {
  const { t } = useSesion();
  const [indice, setIndice] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [escritos, setEscritos] = useState(0);
  const [escala, setEscala] = useState(escalaRamon);
  // Al cambiar de paso, Ramón baja el brazo y lo vuelve a levantar hacia el nuevo elemento
  const [brazoArriba, setBrazoArriba] = useState(false);
  const paso = pasos[indice]!;
  const esUltimo = indice === pasos.length - 1;
  const escribiendo = escritos < paso.texto.length;

  const ir = useCallback((i: number) => {
    setIndice(Math.max(0, Math.min(i, pasos.length - 1)));
  }, [pasos.length]);

  useEffect(() => {
    paso.alEntrar?.();
    const el = paso.objetivo ? document.querySelector(`[data-tour="${paso.objetivo}"]`) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [indice]);

  useEffect(() => {
    setBrazoArriba(false);
    const id = window.setTimeout(() => setBrazoArriba(true), 350);
    return () => window.clearTimeout(id);
  }, [indice]);

  // Máquina de escribir: Ramón mueve la boca mientras aparece el texto
  useEffect(() => {
    setEscritos(0);
    const id = window.setInterval(() => {
      setEscritos(n => {
        if (n >= paso.texto.length) { window.clearInterval(id); return n; }
        return n + CARACTERES_POR_TICK;
      });
    }, MS_TICK);
    return () => window.clearInterval(id);
  }, [indice]);

  // El objetivo puede aparecer tarde (datos cargando) o moverse con el scroll, así que se mide de forma continua
  useEffect(() => {
    let cuadro = 0;
    const actualizar = () => {
      setCaja(prev => {
        const nueva = medir(paso.objetivo);
        if (prev && nueva && prev.top === nueva.top && prev.left === nueva.left && prev.width === nueva.width && prev.height === nueva.height) return prev;
        return nueva;
      });
      cuadro = window.requestAnimationFrame(actualizar);
    };
    actualizar();
    return () => window.cancelAnimationFrame(cuadro);
  }, [paso.objetivo]);

  useEffect(() => {
    const alRedimensionar = () => setEscala(escalaRamon());
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

  function siguiente() {
    // El primer clic termina de mostrar el texto; el segundo avanza
    if (escribiendo) { setEscritos(paso.texto.length); return; }
    if (esUltimo) onTerminar(); else ir(indice + 1);
  }

  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') ir(indice - 1);
      if (e.key === 'Escape') onTerminar();
    }
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, [indice, escribiendo, ir, onTerminar]);

  return (
    <div className="recorrido" role="dialog" aria-modal="true" aria-labelledby="recorrido-titulo">
      <div className="recorrido-bloqueo" />
      {caja
        ? <div className="recorrido-foco recorrido-foco-pulso" style={{ top: caja.top, left: caja.left, width: caja.width, height: caja.height }} />
        : <div className="recorrido-velo" />}

      <div className="ramon-escena">
        <RamonMedioCuerpo hablando={escribiendo} animo={paso.animo ?? 'neutral'} senala={!!caja && brazoArriba} escala={escala} />
        <div className="ramon-globo" onClick={() => escribiendo && setEscritos(paso.texto.length)}>
          <div className="ramon-globo-nombre">{t('ui.onboarding.nombre')} <small>{t('ui.onboarding.rol')}</small></div>
          <h2 id="recorrido-titulo" className="ramon-globo-titulo">{paso.titulo}</h2>
          <p className="ramon-globo-texto" aria-live="polite">
            {paso.texto.slice(0, escritos)}
            {escribiendo && <span className="ramon-cursor" aria-hidden="true">▌</span>}
          </p>
          {paso.puntos && !escribiendo && (
            <ul className="onboarding-puntos">
              {paso.puntos.map(p => <li key={p}>{p}</li>)}
            </ul>
          )}
          <div className="recorrido-pie">
            <span className="onboarding-paso">{indice + 1} de {pasos.length}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!esUltimo && (
                <button className="enlace enlace-sutil onboarding-saltar" onClick={onTerminar}>{t('ui.onboarding.saltar')}</button>
              )}
              {indice > 0 && (
                <button className="btn-fantasma btn-sm" onClick={() => ir(indice - 1)}>{t('ui.onboarding.anterior')}</button>
              )}
              <button className="btn-primario btn-sm" onClick={e => { e.stopPropagation(); siguiente(); }} autoFocus>
                {esUltimo && !escribiendo ? t('ui.onboarding.comenzar') : t('ui.onboarding.siguiente')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
