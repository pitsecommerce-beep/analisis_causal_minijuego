import { useEffect, useRef } from 'react';
import * as P from './sala/pixel.js';

const RAMON = P.PERSONAJES.find(p => p.id === 'ramon')!;

// Retrato animado de Ramón Betancourt (Consejo), con el mismo sprite de la Sala de Juntas
export function RetratoBetancourt({ hablando = false, animo = 'neutral', tamano = 96 }: { hablando?: boolean; animo?: P.Animo; tamano?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const estadoRef = useRef({ hablando, animo });
  estadoRef.current = { hablando, animo };

  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    let raf = 0;
    const cuadro = (t: number) => {
      const { hablando: h, animo: a } = estadoRef.current;
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      P.dibujarRetrato(c, RAMON, {
        parpadeo: (t + RAMON.fase * 7) % 4300 < 130,
        habla: h && Math.floor(t / 110) % 2 === 0,
        animo: a,
        respiro: 0,
        resaltado: false,
      });
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={34} height={34} className="betancourt-retrato" style={{ width: tamano, height: tamano }} aria-hidden="true" />;
}

// Ramón de medio cuerpo, grande y sin marco, para hablarle directamente al participante
export function RamonMedioCuerpo({ hablando = false, animo = 'neutral', senala = false, escala = 5 }: { hablando?: boolean; animo?: P.Animo; senala?: boolean; escala?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const estadoRef = useRef({ hablando, animo, senala });
  estadoRef.current = { hablando, animo, senala };

  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    let raf = 0;
    const cuadro = (t: number) => {
      const e = estadoRef.current;
      c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      P.dibujarMedioCuerpo(c, RAMON, {
        parpadeo: (t + RAMON.fase * 7) % 4300 < 130,
        habla: e.hablando && Math.floor(t / 110) % 2 === 0,
        animo: e.animo,
        respiro: Math.floor(t / 1500) % 2,
        resaltado: false,
      }, e.senala);
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas ref={ref} width={P.MEDIO_CUERPO.ancho} height={P.MEDIO_CUERPO.alto} className="ramon-medio-cuerpo"
      style={{ width: P.MEDIO_CUERPO.ancho * escala, height: P.MEDIO_CUERPO.alto * escala }} aria-hidden="true" />
  );
}

// Intervención de Betancourt durante el juego cuando el participante decide sin sustento
export function AvisoBetancourt({ avisos, onCerrar }: { avisos: string[]; onCerrar: () => void }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === 'Enter') onCerrar(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className="betancourt-aviso" role="alertdialog" aria-modal="true" aria-labelledby="betancourt-nombre">
        <RetratoBetancourt hablando animo="enojado" />
        <div className="betancourt-globo">
          <div id="betancourt-nombre" className="betancourt-nombre">Ramón Betancourt <small>Consejo</small></div>
          {avisos.map((a, i) => <p key={i}>{a}</p>)}
          <button className="btn-primario btn-sm" onClick={onCerrar} autoFocus>Entendido</button>
        </div>
      </div>
    </div>
  );
}
