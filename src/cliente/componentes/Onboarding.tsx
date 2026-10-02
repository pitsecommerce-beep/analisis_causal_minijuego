import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icono } from './ui/Iconos.js';
import type { NombreIcono } from './ui/Iconos.js';

export interface PasoRecorrido {
  // Valor del atributo data-tour del elemento a señalar. Sin objetivo, el paso aparece centrado.
  objetivo?: string;
  icono: NombreIcono;
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
const ANCHO_GLOBO = 340;
const SEPARACION = 14;

interface Caja { top: number; left: number; width: number; height: number }

function medir(objetivo?: string): Caja | null {
  if (!objetivo) return null;
  const el = document.querySelector(`[data-tour="${objetivo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top - MARGEN, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 };
}

export function Onboarding({ pasos, onTerminar }: Props) {
  const [indice, setIndice] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [altoGlobo, setAltoGlobo] = useState(0);
  const globoRef = useRef<HTMLDivElement>(null);
  const paso = pasos[indice]!;
  const esUltimo = indice === pasos.length - 1;

  const ir = useCallback((i: number) => {
    setIndice(Math.max(0, Math.min(i, pasos.length - 1)));
  }, [pasos.length]);

  useEffect(() => {
    paso.alEntrar?.();
    const el = paso.objetivo ? document.querySelector(`[data-tour="${paso.objetivo}"]`) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

  useLayoutEffect(() => {
    if (globoRef.current) setAltoGlobo(globoRef.current.offsetHeight);
  }, [indice, caja?.width]);

  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') ir(indice + 1);
      if (e.key === 'ArrowLeft') ir(indice - 1);
      if (e.key === 'Escape') onTerminar();
    }
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, [indice, ir, onTerminar]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(ANCHO_GLOBO, vw - 32);
  let estiloGlobo: CSSProperties;
  let flecha: 'arriba' | 'abajo' | null = null;
  let flechaLeft = 0;

  if (caja) {
    const cabeAbajo = caja.top + caja.height + SEPARACION + altoGlobo < vh - 16;
    const top = cabeAbajo ? caja.top + caja.height + SEPARACION : Math.max(16, caja.top - SEPARACION - altoGlobo);
    const centro = caja.left + caja.width / 2;
    const left = Math.max(16, Math.min(centro - ancho / 2, vw - ancho - 16));
    estiloGlobo = { top, left, width: ancho };
    flecha = cabeAbajo ? 'arriba' : 'abajo';
    flechaLeft = Math.max(20, Math.min(centro - left, ancho - 20));
  } else {
    estiloGlobo = { top: '50%', left: '50%', width: ancho, transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="recorrido" role="dialog" aria-modal="true" aria-labelledby="recorrido-titulo">
      <div className="recorrido-bloqueo" />
      {caja
        ? <div className="recorrido-foco" style={{ top: caja.top, left: caja.left, width: caja.width, height: caja.height }} />
        : <div className="recorrido-velo" />}

      <div ref={globoRef} key={indice} className="recorrido-globo" style={estiloGlobo}>
        {flecha && <span className={`recorrido-flecha recorrido-flecha-${flecha}`} style={{ left: flechaLeft }} />}
        <div className="recorrido-cabecera">
          <div className="icono-insignia icono-insignia-primario icono-insignia-sm">
            <Icono nombre={paso.icono} tamano={18} />
          </div>
          <h2 id="recorrido-titulo" className="recorrido-titulo">{paso.titulo}</h2>
        </div>
        <p className="recorrido-texto">{paso.texto}</p>
        {paso.puntos && (
          <ul className="onboarding-puntos">
            {paso.puntos.map(p => <li key={p}>{p}</li>)}
          </ul>
        )}
        <div className="recorrido-pie">
          <span className="onboarding-paso">{indice + 1} de {pasos.length}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!esUltimo && (
              <button className="enlace enlace-sutil onboarding-saltar" onClick={onTerminar}>Saltar</button>
            )}
            {indice > 0 && (
              <button className="btn-fantasma btn-sm" onClick={() => ir(indice - 1)}>Anterior</button>
            )}
            <button className="btn-primario btn-sm" onClick={() => esUltimo ? onTerminar() : ir(indice + 1)} autoFocus>
              {esUltimo ? 'Comenzar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
