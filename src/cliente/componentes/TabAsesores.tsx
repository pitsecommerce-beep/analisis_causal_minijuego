import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import { useUI } from './ui/Notificaciones.js';
import * as P from './sala/pixel.js';

interface Respuesta { texto: string; efecto: string; credibilidad: number }
interface Nodo {
  personaje: string;
  nodoId: string;
  fase?: string;
  expresion?: string;
  lineas: string[];
  afirmacion?: { id: string; verificable?: boolean; veredicto?: string } | null;
  respuestas: Respuesta[];
}

type Fase = 'intro' | 'cerrando' | 'sala' | 'abriendo';
type Modo = 'hablando' | 'opciones' | 'jugador';
type Pendiente = 'pendiente' | 'nuevo' | null;

interface Charla {
  personaje: string;
  nodos: Nodo[];
  nodo: number;
  linea: number;
  modo: Modo;
  repaso: boolean;
  textoJugador: string;
  enviando: boolean;
  abrirAlTerminar: boolean;
}

interface Props {
  onCredibilidadCambio?: (cred: number) => void;
  onRecargar?: () => void;
  onAbrirLaptop?: () => void;
}

// Lo que dice cada quien cuando no tiene nada nuevo para ti
const REPOSO: Record<string, string> = {
  bernardo: 'Mis sucursales capturan rápido. Si algo se atora, es allá en CrOP.',
  oscar: 'El sistema está estable. Si quieres revisar algo en los registros, avísame.',
  ramon: 'El consejo quiere resultados, no presentaciones. Sigue con lo tuyo.',
  paulina: 'Cada peso que se gaste lo voy a revisar. Tráeme números, no corazonadas.',
  silvia: 'Si hace falta capacitar a alguien, mi equipo está listo. Solo dime a quién.',
  diego: 'Tengo los datos de CrOP a la mano por si los necesitas.',
};

const DURACION_CIERRE = 1100;
// Breve momento con la laptop abierta antes de cerrarla sola al entrar
const PAUSA_INTRO = 450;
const DURACION_APERTURA = 850;
const CLAVE_MEMORIA = 'salaJuntas:v1';

function leerMemoria(): { vistos: Set<string>; respondidos: Set<string> } {
  try {
    const m = JSON.parse(sessionStorage.getItem(CLAVE_MEMORIA) ?? '{}');
    return { vistos: new Set(m.vistos ?? []), respondidos: new Set(m.respondidos ?? []) };
  } catch {
    return { vistos: new Set(), respondidos: new Set() };
  }
}

function guardarMemoria(vistos: Set<string>, respondidos: Set<string>) {
  try {
    sessionStorage.setItem(CLAVE_MEMORIA, JSON.stringify({ vistos: [...vistos], respondidos: [...respondidos] }));
  } catch { /* sin almacenamiento */ }
}

function infoDe(id: string) {
  return P.PERSONAJES.find(p => p.id === id);
}

export function TabAsesores({ onCredibilidadCambio, onAbrirLaptop }: Props) {
  const { avisar } = useUI();
  const [dialogos, setDialogos] = useState<Nodo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fase, setFase] = useState<Fase>('intro');
  const [charla, setCharla] = useState<Charla | null>(null);
  const [escritos, setEscritos] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [memoria, setMemoria] = useState(leerMemoria);
  const [escala, setEscala] = useState(3);

  const marcoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const retratoRef = useRef<HTMLCanvasElement>(null);
  const cajasRef = useRef<Record<string, P.Caja>>({});
  const animRef = useRef({ fase: 'intro' as Fase, inicio: 0, hover: null as string | null, habla: null as string | null, enfocado: null as string | null, animos: {} as Record<string, P.Animo>, pendientes: {} as Record<string, Pendiente> });

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      setDialogos(await api.partida.dialogos());
    } catch (err: any) {
      avisar('error', 'No se pudieron cargar los diálogos', err.message);
    }
    setCargando(false);
  }

  // --- Estado derivado ---

  function pendienteDe(id: string): Pendiente {
    const nodos = dialogos.filter(d => d.personaje === id);
    if (nodos.some(n => n.respuestas.length > 0 && !memoria.respondidos.has(n.nodoId))) return 'pendiente';
    if (nodos.some(n => !memoria.vistos.has(n.nodoId))) return 'nuevo';
    return null;
  }

  const nodoActual = charla ? charla.nodos[charla.nodo] ?? null : null;
  const texto = !charla || !nodoActual
    ? ''
    : charla.modo === 'jugador' ? charla.textoJugador : nodoActual.lineas[charla.linea] ?? '';
  const claveTexto = charla ? `${charla.personaje}:${charla.modo === 'jugador' ? 'j' : 'n'}:${charla.nodo}:${charla.linea}` : '';
  const escribiendo = escritos < texto.length;

  // Máquina de escribir
  useEffect(() => {
    setEscritos(0);
    if (!claveTexto) return;
    const id = window.setInterval(() => {
      setEscritos(n => {
        if (n >= texto.length) { window.clearInterval(id); return n; }
        return n + 2;
      });
    }, 28);
    return () => window.clearInterval(id);
  }, [claveTexto]);

  // Sincroniza lo que el lienzo necesita saber en cada cuadro
  const anim = animRef.current;
  anim.fase = fase;
  anim.hover = hover;
  anim.enfocado = charla?.personaje ?? null;
  anim.habla = charla && charla.modo === 'hablando' && escribiendo ? charla.personaje : null;
  if (charla && nodoActual) anim.animos[charla.personaje] = P.animoDe(nodoActual.expresion);
  for (const per of P.PERSONAJES) anim.pendientes[per.id] = cargando ? null : pendienteDe(per.id);

  // --- Escalado entero para que los píxeles queden nítidos ---

  useEffect(() => {
    const marco = marcoRef.current;
    if (!marco) return;
    const medir = () => {
      const w = marco.clientWidth;
      if (w < 640) { setEscala(w / P.ANCHO); return; }
      const porAlto = Math.floor((window.innerHeight * 0.74) / P.ALTO);
      setEscala(Math.max(2, Math.min(Math.floor(w / P.ANCHO), porAlto)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(marco);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, []);

  // --- Bucle de dibujo ---

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    const fondo = P.pintarFondo();
    const mesa = P.pintarMesa();
    const capas = Object.fromEntries(P.PERSONAJES.map(per => {
      const capa = document.createElement('canvas');
      capa.width = P.ANCHO;
      capa.height = P.ALTO;
      return [per.id, capa];
    }));
    let raf = 0;

    const cuadro = (t: number) => {
      const a = animRef.current;
      c.clearRect(0, 0, P.ANCHO, P.ALTO);
      c.drawImage(fondo, 0, 0);

      const estados: Record<string, P.EstadoPersonaje> = {};
      for (const per of P.PERSONAJES) {
        const est: P.EstadoPersonaje = {
          parpadeo: (t + per.fase * 7) % 4300 < 130,
          habla: a.habla === per.id && Math.floor(t / 110) % 2 === 0,
          animo: a.animos[per.id] ?? 'neutral',
          respiro: Math.floor((t + per.fase * 3) / 1500) % 2,
          resaltado: a.hover === per.id || a.enfocado === per.id,
        };
        estados[per.id] = est;
        const capa = capas[per.id]!;
        const k = capa.getContext('2d')!;
        k.clearRect(0, 0, P.ANCHO, P.ALTO);
        cajasRef.current[per.id] = P.dibujarPersonaje(k, per, est);
        if (est.resaltado && a.fase === 'sala') P.contorno(c, capa, '#f2c14e');
        c.drawImage(capa, 0, 0);
      }
      c.drawImage(mesa, 0, 0);
      for (const per of P.PERSONAJES) P.dibujarManos(c, per, estados[per.id]!);

      if (a.fase === 'sala') {
        P.dibujarLaptop(c, 1, a.hover === 'laptop');
        if (!a.enfocado) {
          for (const per of P.PERSONAJES) {
            const tipo = a.pendientes[per.id];
            const caja = cajasRef.current[per.id];
            if (tipo && caja) P.dibujarIndicador(c, per.cx, caja.y0 - 7, tipo, t + per.fase);
          }
        }
      } else {
        let k = a.fase === 'intro' ? 0 : 1;
        if (a.fase === 'cerrando') k = Math.min(1, (t - a.inicio) / DURACION_CIERRE);
        if (a.fase === 'abriendo') k = 1 - Math.min(1, (t - a.inicio) / DURACION_APERTURA);
        c.fillStyle = `rgba(8, 14, 26, ${(0.62 * (1 - Math.max(0, (k - 0.4) / 0.6))).toFixed(3)})`;
        c.fillRect(0, 0, P.ANCHO, P.ALTO);
        P.dibujarLaptop(c, k);
      }

      const retrato = retratoRef.current;
      if (retrato && a.enfocado) {
        const per = infoDe(a.enfocado);
        const est = estados[a.enfocado];
        const rc = retrato.getContext('2d');
        if (per && est && rc) P.dibujarRetrato(rc, per, { ...est, resaltado: false });
      }
      raf = requestAnimationFrame(cuadro);
    };
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Fin de las transiciones de la laptop
  useEffect(() => {
    if (fase !== 'cerrando' && fase !== 'abriendo') return;
    const id = window.setTimeout(() => {
      if (fase === 'cerrando') setFase('sala');
      else onAbrirLaptop?.();
    }, fase === 'cerrando' ? DURACION_CIERRE : DURACION_APERTURA);
    return () => window.clearTimeout(id);
  }, [fase]);

  // Al entrar a la sala la laptop se cierra sola
  useEffect(() => {
    const id = window.setTimeout(cerrarLaptop, PAUSA_INTRO);
    return () => window.clearTimeout(id);
  }, []);

  function cerrarLaptop() {
    if (animRef.current.fase !== 'intro') return;
    animRef.current.inicio = performance.now();
    setFase('cerrando');
  }

  function abrirLaptop() {
    setCharla(null);
    setHover(null);
    animRef.current.inicio = performance.now();
    setFase('abriendo');
  }

  // --- Conversación ---

  function marcar(tipo: 'vistos' | 'respondidos', nodoId: string, valor = true) {
    setMemoria(m => {
      const sig = { vistos: new Set(m.vistos), respondidos: new Set(m.respondidos) };
      if (valor) sig[tipo].add(nodoId); else sig[tipo].delete(nodoId);
      guardarMemoria(sig.vistos, sig.respondidos);
      return sig;
    });
  }

  function hablarCon(id: string) {
    if (fase !== 'sala') return;
    const nodos = dialogos.filter(d => d.personaje === id);
    const pendientes = nodos.filter(n => !memoria.vistos.has(n.nodoId) || (n.respuestas.length > 0 && !memoria.respondidos.has(n.nodoId)));
    const base = { personaje: id, nodo: 0, linea: 0, modo: 'hablando' as Modo, textoJugador: '', enviando: false, abrirAlTerminar: false };
    if (pendientes.length > 0) setCharla({ ...base, nodos: pendientes, repaso: false });
    else if (nodos.length > 0) setCharla({ ...base, nodos, repaso: true });
    else setCharla({ ...base, repaso: true, nodos: [{ personaje: id, nodoId: `reposo_${id}`, lineas: [REPOSO[id] ?? '...'], respuestas: [] }] });
  }

  function siguienteNodo(ch: Charla) {
    if (ch.abrirAlTerminar) { abrirLaptop(); return; }
    if (ch.nodo + 1 < ch.nodos.length) setCharla({ ...ch, nodo: ch.nodo + 1, linea: 0, modo: 'hablando' });
    else setCharla(null);
  }

  function avanzar() {
    if (!charla || !nodoActual) return;
    if (escribiendo) { setEscritos(texto.length); return; }
    if (charla.modo === 'opciones') return;
    if (charla.modo === 'jugador') {
      if (!charla.enviando) siguienteNodo(charla);
      return;
    }
    if (charla.linea < nodoActual.lineas.length - 1) {
      setCharla({ ...charla, linea: charla.linea + 1 });
      return;
    }
    marcar('vistos', nodoActual.nodoId);
    const debeResponder = !charla.repaso && nodoActual.respuestas.length > 0 && !memoria.respondidos.has(nodoActual.nodoId);
    if (debeResponder) setCharla({ ...charla, modo: 'opciones' });
    else siguienteNodo(charla);
  }

  async function elegir(i: number) {
    if (!charla || !nodoActual || charla.modo !== 'opciones') return;
    const r = nodoActual.respuestas[i];
    if (!r) return;
    const nodoId = nodoActual.nodoId;
    // "Déjame revisarlo" no cierra la pregunta: al volver, la persona la repite y puedes responder con evidencia
    const revisaPrimero = r.efecto === 'abrir_laptop';
    setCharla({ ...charla, modo: 'jugador', textoJugador: r.texto, enviando: true, abrirAlTerminar: revisaPrimero });
    if (!revisaPrimero) marcar('respondidos', nodoId);
    try {
      const res = await api.partida.respuesta(nodoId, r.efecto, charla.personaje);
      if (res.credibilidad != null) onCredibilidadCambio?.(res.credibilidad);
      const sig: Nodo | null = res.siguienteNodo ?? null;
      if (sig) setDialogos(prev => [...prev, sig]);
      setCharla(ch => {
        if (!ch) return ch;
        const nodos = sig ? [...ch.nodos.slice(0, ch.nodo + 1), sig, ...ch.nodos.slice(ch.nodo + 1)] : ch.nodos;
        return { ...ch, nodos, enviando: false };
      });
    } catch (err: any) {
      marcar('respondidos', nodoId, false);
      setCharla(ch => ch && { ...ch, modo: 'opciones', enviando: false, abrirAlTerminar: false });
      avisar('error', 'No se pudo enviar tu respuesta', err.message);
    }
  }

  // --- Entrada ---

  const teclasRef = useRef<(e: KeyboardEvent) => void>(() => {});
  teclasRef.current = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    const tag = el?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const confirma = e.key === 'Enter' || e.key === ' ';
    if (confirma && tag === 'BUTTON') return;
    if (fase === 'intro' && confirma) { e.preventDefault(); cerrarLaptop(); return; }
    if (!charla) return;
    if (e.key === 'Escape') { setCharla(null); return; }
    if (confirma) { e.preventDefault(); avanzar(); return; }
    const n = Number(e.key);
    if (charla.modo === 'opciones' && n >= 1 && n <= 9) elegir(n - 1);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => teclasRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  function objetivoEn(e: React.PointerEvent<HTMLCanvasElement>): string | null {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * P.ANCHO;
    const y = ((e.clientY - rect.top) / rect.height) * P.ALTO;
    const l = P.LAPTOP_CERRADA;
    if (x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1) return 'laptop';
    for (const per of [...P.PERSONAJES].reverse()) {
      const k = cajasRef.current[per.id];
      if (k && x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1) return per.id;
    }
    return null;
  }

  function alMover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (fase !== 'sala' || charla) { if (hover) setHover(null); return; }
    const obj = objetivoEn(e);
    if (obj !== hover) setHover(obj);
  }

  function alClic(e: React.PointerEvent<HTMLCanvasElement>) {
    if (fase === 'intro') { cerrarLaptop(); return; }
    if (fase !== 'sala') return;
    if (charla) { avanzar(); return; }
    const obj = objetivoEn(e);
    if (obj === 'laptop') abrirLaptop();
    else if (obj) { setHover(null); hablarCon(obj); }
  }

  // --- Vista ---

  const perCharla = charla ? infoDe(charla.personaje) : undefined;
  const perHover = hover && hover !== 'laptop' ? infoDe(hover) : undefined;
  const cajaHover = perHover ? cajasRef.current[perHover.id] : undefined;
  const previa = perHover ? vistaPrevia(perHover.id) : '';

  function vistaPrevia(id: string): string {
    const nodo = dialogos.find(d => d.personaje === id && (!memoria.vistos.has(d.nodoId) || (d.respuestas.length > 0 && !memoria.respondidos.has(d.nodoId))))
      ?? dialogos.find(d => d.personaje === id);
    const linea = nodo?.lineas[0] ?? REPOSO[id] ?? '';
    return linea.length > 72 ? `${linea.slice(0, 70).trimEnd()}…` : linea;
  }

  const ancho = P.ANCHO * escala;

  return (
    <div className="sala">
      <div ref={marcoRef} className="sala-marco">
        <div className="sala-escena" style={{ width: ancho, height: P.ALTO * escala }}>
          <canvas
            ref={canvasRef}
            width={P.ANCHO}
            height={P.ALTO}
            className="sala-lienzo"
            style={{ cursor: (hover || charla) ? 'pointer' : 'default' }}
            onPointerMove={alMover}
            onPointerLeave={() => setHover(null)}
            onPointerDown={alClic}
            role="img"
            aria-label="Sala de juntas de ETF Bank con tu equipo sentado alrededor de la mesa"
          />

          {fase === 'sala' && !charla && (
            <div className="sala-rotulo">
              <strong>Sala de Juntas</strong>
              <span>{cargando ? 'Tu equipo está llegando…' : 'Haz clic en alguien para escucharlo'}</span>
            </div>
          )}

          {fase === 'sala' && !charla && perHover && cajaHover && (
            <div
              className="sala-globo"
              style={{ left: `${(perHover.cx / P.ANCHO) * 100}%`, top: `${(cajaHover.y0 / P.ALTO) * 100}%` }}
            >
              <strong>{perHover.nombre}</strong>
              <small>{perHover.rol}</small>
              {previa && <span>“{previa}”</span>}
            </div>
          )}

          {fase === 'sala' && !charla && hover === 'laptop' && (
            <div className="sala-globo sala-globo-laptop" style={{ left: '50%', top: `${(P.LAPTOP_CERRADA.y0 / P.ALTO) * 100}%` }}>
              <strong>Abrir la laptop</strong>
              <span>Vuelve a los datos para verificar lo que te dicen.</span>
            </div>
          )}

          {charla && perCharla && nodoActual && (
            <div className="sala-dialogo" onClick={avanzar} role="dialog" aria-label={`Conversación con ${perCharla.nombre}`}>
              <canvas ref={retratoRef} width={34} height={34} className="sala-retrato" />
              <div className="sala-dialogo-cuerpo">
                <div className="sala-dialogo-nombre">
                  {charla.modo === 'jugador' ? 'Tú' : perCharla.nombre}
                  {charla.modo !== 'jugador' && <small>{perCharla.rol}</small>}
                  <button
                    className="sala-cerrar"
                    onClick={(e) => { e.stopPropagation(); setCharla(null); }}
                    aria-label="Terminar conversación"
                  >
                    ×
                  </button>
                </div>
                <p className={`sala-dialogo-texto ${charla.modo === 'jugador' ? 'jugador' : ''}`} aria-live="polite">
                  {texto.slice(0, escritos)}
                  <span className="sala-oculto">{texto.slice(escritos)}</span>
                  {charla.modo === 'jugador' && charla.enviando && !escribiendo && <span className="sala-puntos">…</span>}
                </p>

                {nodoActual.afirmacion?.verificable && charla.modo !== 'jugador' && !escribiendo && (
                  <div className="sala-pista">Afirmación verificable en la laptop</div>
                )}

                {charla.modo === 'opciones' && !escribiendo && (
                  <div className="sala-opciones" onClick={(e) => e.stopPropagation()}>
                    {nodoActual.respuestas.map((r, i) => (
                      <button key={i} className="sala-opcion" onClick={() => elegir(i)}>
                        <span className="sala-opcion-num">{i + 1}</span>
                        <span className="sala-opcion-texto">{r.texto}</span>
                        {r.credibilidad !== 0 && (
                          <span className={`sala-opcion-cred ${r.credibilidad > 0 ? 'pos' : 'neg'}`}>
                            {r.credibilidad > 0 ? `+${r.credibilidad}` : r.credibilidad}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {charla.modo !== 'opciones' && !escribiendo && !(charla.modo === 'jugador' && charla.enviando) && (
                  <span className="sala-continuar" aria-hidden="true">▼</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sala-equipo" aria-label="Tu equipo">
        {P.PERSONAJES.map(per => {
          const estado = cargando ? null : pendienteDe(per.id);
          return (
            <button
              key={per.id}
              className={`sala-miembro ${charla?.personaje === per.id ? 'activo' : ''}`}
              onClick={() => hablarCon(per.id)}
              onMouseEnter={() => fase === 'sala' && !charla && setHover(per.id)}
              onMouseLeave={() => setHover(null)}
              disabled={fase !== 'sala'}
            >
              <span className="sala-miembro-nombre">{per.nombre}</span>
              <span className="sala-miembro-rol">{per.rol}</span>
              {estado === 'pendiente' && <span className="sala-marca pendiente">Te necesita</span>}
              {estado === 'nuevo' && <span className="sala-marca nuevo">Tiene algo que decir</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
