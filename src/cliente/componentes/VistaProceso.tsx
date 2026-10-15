import { useMemo, useState } from 'react';
import { ACTORES_PROCESO, ETAPAS_PROCESO, duracionesEtapa, formatoNumero, localeActual, resumir } from '../analisis.js';
import { useSesion } from '../i18n.js';
import type { Fila, Resumen } from '../analisis.js';
import { Icono } from './ui/Iconos.js';

interface Props {
  filas: Fila[];
  estrato: string;
  onEtapa?: (etapa: string) => void;
}

// Geometría del diagrama: un carril por actor y una columna por etapa
const ETIQUETAS = 118;
const CARRIL = 104;
const PASO = 92;
const CAJA = { ancho: 80, alto: 66 };
const ANCHO = ETIQUETAS + 16 + ETAPAS_PROCESO.length * PASO + 16;
const ALTO = ACTORES_PROCESO.length * CARRIL;

function posicion(i: number) {
  const etapa = ETAPAS_PROCESO[i]!;
  const carril = ACTORES_PROCESO.findIndex(a => a.id === etapa.actor);
  const cx = ETIQUETAS + 16 + i * PASO + PASO / 2;
  const cy = carril * CARRIL + CARRIL / 2;
  return { cx, cy, x: cx - CAJA.ancho / 2, y: cy - CAJA.alto / 2 };
}

// Flecha de una etapa a la siguiente; si cambia de carril, baja o sube en escuadra
function flecha(i: number): string {
  const a = posicion(i);
  const b = posicion(i + 1);
  const x0 = a.x + CAJA.ancho;
  const x1 = b.x - 2;
  if (a.cy === b.cy) return `M${x0},${a.cy} L${x1},${b.cy}`;
  const xm = (x0 + x1) / 2;
  return `M${x0},${a.cy} L${xm},${a.cy} L${xm},${b.cy} L${x1},${b.cy}`;
}


// Diagrama del proceso de tarjeta de crédito: de la sucursal hasta que el cliente la recibe
export function VistaProceso({ filas, estrato, onEtapa }: Props) {
  const { t } = useSesion();
  const dias = (n: number) => `${formatoNumero(n, 1)} ${n === 1 ? t('proceso.dia') : t('proceso.dias')}`;
  const nombre = (id: string) => t(`proceso.etapas.${id}.nombre`);
  const nota = (id: string) => { const n = t(`proceso.etapas.${id}.nota`); return n.startsWith('proceso.') ? null : n; };
  const [elegida, setElegida] = useState('captura');
  const etapa = ETAPAS_PROCESO.find(e => e.id === elegida)!;
  const resumenes = useMemo(
    () => Object.fromEntries(ETAPAS_PROCESO.map(e => [e.id, resumir(duracionesEtapa(filas, e))])) as Record<string, Resumen | null>,
    [filas],
  );
  const r = resumenes[elegida] ?? null;

  function elegir(id: string) {
    setElegida(id);
    onEtapa?.(id);
  }

  return (
    <div data-tour="proceso">
      <p className="datos-nota" style={{ marginTop: 0 }}>
        {t('proceso.intro')}
      </p>

      <div className="tarjeta proceso-lienzo">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="proceso-diagrama" role="group" aria-label={t('proceso.diagrama')}>
          <defs>
            <marker id="proceso-punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="proceso-punta" />
            </marker>
          </defs>

          {ACTORES_PROCESO.map((a, i) => (
            <g key={a.id}>
              <rect x={0} y={i * CARRIL} width={ANCHO} height={CARRIL} className={`proceso-carril ${i % 2 ? 'par' : ''}`} />
              {t(`proceso.actores.${a.id}`).split('\n').map((txt, k, todos) => (
                <text key={k} x={14} y={i * CARRIL + CARRIL / 2 + (k - (todos.length - 1) / 2) * 16} className="proceso-actor" dominantBaseline="middle">{txt}</text>
              ))}
            </g>
          ))}
          <line x1={ETIQUETAS} x2={ETIQUETAS} y1={0} y2={ALTO} className="proceso-divisor" />

          {ETAPAS_PROCESO.slice(0, -1).map((_, i) => (
            <path key={i} d={flecha(i)} className="proceso-flecha" markerEnd="url(#proceso-punta)" />
          ))}

          {ETAPAS_PROCESO.map((e, i) => {
            const { x, y, cx, cy } = posicion(i);
            const re = resumenes[e.id];
            const activa = e.id === elegida;
            const renglones = t(`proceso.etapas.${e.id}.corto`).split('\n');
            return (
              <g key={e.id} role="button" tabIndex={0} aria-pressed={activa} aria-label={re ? t('proceso.medianaAria', { etapa: nombre(e.id), dias: dias(re.mediana) }) : t('proceso.sinRegistroAria', { etapa: nombre(e.id) })}
                className={`proceso-nodo ${activa ? 'activa' : ''} ${re ? '' : 'sin-registro'}`}
                onClick={() => elegir(e.id)}
                onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); elegir(e.id); } }}>
                <rect x={x} y={y} width={CAJA.ancho} height={CAJA.alto} rx={10} className="proceso-caja" />
                {renglones.map((txt, k) => (
                  <text key={k} x={cx} y={cy - 16 + k * 14} className="proceso-texto" textAnchor="middle">{txt}</text>
                ))}
                <text x={cx} y={cy + 22} className="proceso-dato" textAnchor="middle">{re ? dias(re.mediana) : t('proceso.sinRegistro')}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="tarjeta datos-resultado transicion-contenido">
        <div className="datos-resultado-cabecera">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="icono-insignia icono-insignia-primario icono-insignia-sm"><Icono nombre="reloj" tamano={18} /></div>
            <div>
              <h4 className="datos-resultado-titulo">{nombre(etapa.id)}{estrato && ` · ${estrato}`}</h4>
              <p className="datos-nota" style={{ margin: 0 }}>{nota(etapa.id) ?? (r ? t('proceso.notaDias') : t('proceso.notaSinFechas'))}</p>
            </div>
          </div>
        </div>
        {r ? (
          <div className="datos-cifras">
            {[
              { etiqueta: t('proceso.conRegistro'), valor: r.n.toLocaleString(localeActual()) },
              { etiqueta: t('proceso.mediana'), valor: formatoNumero(r.mediana, 1) },
              { etiqueta: t('proceso.media'), valor: formatoNumero(r.media, 1) },
              { etiqueta: t('proceso.desviacion'), valor: formatoNumero(r.desviacion, 1) },
              { etiqueta: t('proceso.p90'), valor: formatoNumero(r.p90, 1) },
            ].map(c => (
              <div key={c.etiqueta} className="datos-cifra">
                <span className="datos-cifra-valor">{c.valor}</span>
                <span className="datos-cifra-etiqueta">{c.etiqueta}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="datos-aviso" style={{ margin: 0 }}><Icono nombre="info" tamano={16} />{t('proceso.sinMedicion')}</div>
        )}
      </div>
    </div>
  );
}
