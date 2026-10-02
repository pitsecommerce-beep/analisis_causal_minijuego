import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { BarraPareto, Contenedor, Resumen } from '../analisis.js';
import { formatoFecha, formatoMes, formatoNumero } from '../analisis.js';

// Paleta validada (light): azul para la serie, ocre para referencias
const COLOR_SERIE = '#2563a8';
const COLOR_REFERENCIA = '#b7791f';
const ALTO = 320;
const M = { top: 32, right: 20, bottom: 56, left: 56 };

function useAncho() {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(800);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => { if (e) setAncho(Math.max(320, e.contentRect.width)); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, ancho };
}

function ticks(min: number, max: number, n = 5): number[] {
  if (min === max) return [min];
  const crudo = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= crudo) ?? crudo;
  const out: number[] = [];
  const fin = Math.ceil(max / paso - 1e-9) * paso;
  for (let v = Math.ceil(min / paso) * paso; v <= fin + 1e-9; v += paso) out.push(Number(v.toFixed(10)));
  return out;
}

interface Tip { x: number; y: number; contenido: ReactNode }

function Marco({ children, tip, alto = ALTO, refDiv }: { children: ReactNode; tip: Tip | null; alto?: number; refDiv: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={refDiv} className="grafico" style={{ height: alto }}>
      {children}
      {tip && (
        <div className="grafico-tip" style={{ left: tip.x, top: tip.y }}>
          {tip.contenido}
        </div>
      )}
    </div>
  );
}

function EjeY({ valores, escala, ancho, formato }: { valores: number[]; escala: (v: number) => number; ancho: number; formato: (v: number) => string }) {
  return (
    <g>
      {valores.map(v => (
        <g key={v}>
          <line x1={M.left} x2={ancho - M.right} y1={escala(v)} y2={escala(v)} className="grafico-rejilla" />
          <text x={M.left - 8} y={escala(v)} className="grafico-eje" textAnchor="end" dominantBaseline="middle">{formato(v)}</text>
        </g>
      ))}
    </g>
  );
}

function fmtValor(v: number, esFecha: boolean) {
  return esFecha ? formatoFecha(v) : formatoNumero(v);
}

// ── Histograma ──

export function Histograma({ bins, resumen, esFecha }: { bins: Contenedor[]; resumen: Resumen | null; esFecha: boolean }) {
  const { ref, ancho } = useAncho();
  const [tip, setTip] = useState<Tip | null>(null);
  if (bins.length === 0) return null;
  const maxConteo = Math.max(...bins.map(b => b.conteo));
  const x0 = bins[0]!.desde;
  const x1 = bins[bins.length - 1]!.hasta;
  const iw = ancho - M.left - M.right;
  const ih = ALTO - M.top - M.bottom;
  const sx = (v: number) => M.left + ((v - x0) / (x1 - x0 || 1)) * iw;
  const ty = ticks(0, maxConteo);
  const topeY = Math.max(maxConteo, ty[ty.length - 1] ?? maxConteo);
  const sy = (v: number) => M.top + ih - (v / (topeY || 1)) * ih;
  const pasoEtiqueta = Math.ceil(bins.length / Math.max(2, Math.floor(iw / 70)));
  const refs = resumen && !esFecha
    ? [{ v: resumen.mediana, et: 'Mediana' }, { v: resumen.p90, et: 'P90' }]
    : [];

  return (
    <Marco refDiv={ref} tip={tip}>
      <svg width={ancho} height={ALTO} onMouseLeave={() => setTip(null)}>
        <EjeY valores={ty} escala={sy} ancho={ancho} formato={v => formatoNumero(v)} />
        {bins.map((b, i) => {
          const x = sx(b.desde) + 1;
          const w = Math.max(1, sx(b.hasta) - sx(b.desde) - 2);
          const y = sy(b.conteo);
          return (
            <g key={i}>
              <path d={barraRedondeada(x, y, w, M.top + ih - y)} fill={COLOR_SERIE} />
              <rect x={x - 1} y={M.top} width={w + 2} height={ih} fill="transparent"
                onMouseMove={() => setTip({
                  x: x + w / 2, y: Math.max(M.top, y - 8),
                  contenido: <><strong>{b.conteo.toLocaleString('es-MX')} registros</strong><br />{esFecha ? formatoMes(b.desde) : `${formatoNumero(b.desde)} a ${formatoNumero(b.hasta)}`}</>,
                })} />
              {i % pasoEtiqueta === 0 && (
                <text x={esFecha ? x + w / 2 : x} y={ALTO - M.bottom + 18} className="grafico-eje" textAnchor={esFecha ? 'middle' : 'start'}>
                  {esFecha ? formatoMes(b.desde) : formatoNumero(b.desde)}
                </text>
              )}
            </g>
          );
        })}
        {refs.map((r, i) => (
          <g key={r.et} pointerEvents="none">
            <line x1={sx(r.v)} x2={sx(r.v)} y1={M.top - 4} y2={M.top + ih} stroke={COLOR_REFERENCIA} strokeWidth={2} strokeDasharray="5 4" />
            <text x={sx(r.v)} y={M.top - 10} className="grafico-referencia grafico-referencia-fondo" textAnchor="middle">{r.et}: {formatoNumero(r.v)}</text>
          </g>
        ))}
        <line x1={M.left} x2={ancho - M.right} y1={M.top + ih} y2={M.top + ih} className="grafico-base" />
      </svg>
    </Marco>
  );
}

function barraRedondeada(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// ── Pareto ──

export function Pareto({ barras }: { barras: BarraPareto[] }) {
  const { ref, ancho } = useAncho();
  const [tip, setTip] = useState<Tip | null>(null);
  if (barras.length === 0) return null;
  const iw = ancho - M.left - M.right;
  const ih = ALTO - M.top - M.bottom - 20;
  const banda = iw / barras.length;
  const sy = (v: number) => M.top + ih - (v / 100) * ih;
  const cx = (i: number) => M.left + banda * i + banda / 2;
  const linea = barras.map((b, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${sy(b.acumulado)}`).join(' ');
  const maxCar = Math.max(4, Math.floor(banda / 6.5));

  return (
    <Marco refDiv={ref} tip={tip} alto={ALTO + 20}>
      <svg width={ancho} height={ALTO + 20} onMouseLeave={() => setTip(null)}>
        <EjeY valores={[0, 20, 40, 60, 80, 100]} escala={sy} ancho={ancho} formato={v => `${v}%`} />
        <line x1={M.left} x2={ancho - M.right} y1={sy(80)} y2={sy(80)} stroke={COLOR_REFERENCIA} strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />
        {barras.map((b, i) => {
          const w = Math.max(2, banda * 0.7);
          const x = cx(i) - w / 2;
          const y = sy(b.pct);
          const etiqueta = b.etiqueta.length > maxCar ? `${b.etiqueta.slice(0, maxCar - 1)}…` : b.etiqueta;
          return (
            <g key={b.etiqueta}>
              <path d={barraRedondeada(x, y, w, M.top + ih - y)} fill={COLOR_SERIE} />
              <rect x={cx(i) - banda / 2} y={M.top} width={banda} height={ih} fill="transparent"
                onMouseMove={() => setTip({
                  x: cx(i), y: Math.max(M.top, Math.min(y, sy(b.acumulado)) - 8),
                  contenido: <><strong>{b.etiqueta}</strong><br />{b.conteo.toLocaleString('es-MX')} ({formatoNumero(b.pct, 1)}%)<br />Acumulado: {formatoNumero(b.acumulado, 1)}%</>,
                })} />
              <text x={cx(i)} y={M.top + ih + 16} className="grafico-eje" textAnchor="end"
                transform={`rotate(-30 ${cx(i)} ${M.top + ih + 16})`}>{etiqueta}</text>
            </g>
          );
        })}
        <path d={linea} fill="none" stroke={COLOR_REFERENCIA} strokeWidth={2} pointerEvents="none" />
        {barras.map((b, i) => (
          <circle key={b.etiqueta} cx={cx(i)} cy={sy(b.acumulado)} r={4} fill={COLOR_REFERENCIA} stroke="#fff" strokeWidth={2} pointerEvents="none" />
        ))}
        <line x1={M.left} x2={ancho - M.right} y1={M.top + ih} y2={M.top + ih} className="grafico-base" />
      </svg>
    </Marco>
  );
}

// ── Corrida ──

export function Corrida({ valores, mediana, esFecha }: { valores: number[]; mediana: number; esFecha: boolean }) {
  const { ref, ancho } = useAncho();
  const [tip, setTip] = useState<Tip | null>(null);
  const [activo, setActivo] = useState<number | null>(null);
  if (valores.length === 0) return null;
  const iw = ancho - M.left - M.right;
  const ih = ALTO - M.top - M.bottom;
  let min = Infinity, max = -Infinity;
  for (const v of valores) { if (v < min) min = v; if (v > max) max = v; }
  const ty = ticks(min, max);
  const y0 = Math.min(min, ty[0] ?? min);
  const y1 = Math.max(max, ty[ty.length - 1] ?? max);
  const sx = (i: number) => M.left + (valores.length === 1 ? iw / 2 : (i / (valores.length - 1)) * iw);
  const sy = (v: number) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const d = valores.map((v, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - caja.left) / caja.width) * (valores.length - 1));
    const v = valores[i];
    if (v == null) return;
    setActivo(i);
    setTip({ x: sx(i), y: sy(v) - 10, contenido: <><strong>{fmtValor(v, esFecha)}</strong><br />Registro {i + 1} de {valores.length}</> });
  }

  return (
    <Marco refDiv={ref} tip={tip}>
      <svg width={ancho} height={ALTO} onMouseLeave={() => { setTip(null); setActivo(null); }}>
        <EjeY valores={ty} escala={sy} ancho={ancho} formato={v => fmtValor(v, esFecha)} />
        <path d={d} fill="none" stroke={COLOR_SERIE} strokeWidth={1.5} strokeLinejoin="round" />
        <line x1={M.left} x2={ancho - M.right} y1={sy(mediana)} y2={sy(mediana)} stroke={COLOR_REFERENCIA} strokeWidth={2} strokeDasharray="5 4" />
        <text x={ancho - M.right} y={M.top - 10} className="grafico-referencia" textAnchor="end">
          <tspan fill={COLOR_REFERENCIA}>- - </tspan>Mediana: {fmtValor(mediana, esFecha)}
        </text>
        {activo != null && (
          <g pointerEvents="none">
            <line x1={sx(activo)} x2={sx(activo)} y1={M.top} y2={M.top + ih} className="grafico-cruz" />
            <circle cx={sx(activo)} cy={sy(valores[activo]!)} r={5} fill={COLOR_SERIE} stroke="#fff" strokeWidth={2} />
          </g>
        )}
        <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" onMouseMove={mover} />
        <text x={M.left + iw / 2} y={ALTO - 16} className="grafico-eje" textAnchor="middle">Orden de captura (registro)</text>
      </svg>
    </Marco>
  );
}

// ── Dispersión ──

export function Dispersion({ puntos, etiquetaX, etiquetaY, xFecha, yFecha }: {
  puntos: { x: number; y: number }[];
  etiquetaX: string;
  etiquetaY: string;
  xFecha: boolean;
  yFecha: boolean;
}) {
  const { ref, ancho } = useAncho();
  const [tip, setTip] = useState<Tip | null>(null);
  if (puntos.length === 0) return null;
  const iw = ancho - M.left - M.right;
  const ih = ALTO - M.top - M.bottom;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of puntos) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  }
  const sx = (v: number) => M.left + ((v - x0) / (x1 - x0 || 1)) * iw;
  const sy = (v: number) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const tx = ticks(x0, x1, Math.max(3, Math.floor(iw / 110)));
  const ty = ticks(y0, y1);

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const mx = M.left + (e.clientX - caja.left);
    const my = M.top + (e.clientY - caja.top);
    let mejor: { x: number; y: number } | null = null;
    let dist = 24 * 24;
    for (const p of puntos) {
      const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
      if (d < dist) { dist = d; mejor = p; }
    }
    setTip(mejor ? {
      x: sx(mejor.x), y: sy(mejor.y) - 10,
      contenido: <>{etiquetaX}: <strong>{fmtValor(mejor.x, xFecha)}</strong><br />{etiquetaY}: <strong>{fmtValor(mejor.y, yFecha)}</strong></>,
    } : null);
  }

  return (
    <Marco refDiv={ref} tip={tip}>
      <svg width={ancho} height={ALTO} onMouseLeave={() => setTip(null)}>
        <EjeY valores={ty} escala={sy} ancho={ancho} formato={v => fmtValor(v, yFecha)} />
        {tx.map(v => (
          <text key={v} x={sx(v)} y={M.top + ih + 18} className="grafico-eje" textAnchor="middle">{fmtValor(v, xFecha)}</text>
        ))}
        {puntos.map((p, i) => (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill={COLOR_SERIE} fillOpacity={0.45} pointerEvents="none" />
        ))}
        <line x1={M.left} x2={ancho - M.right} y1={M.top + ih} y2={M.top + ih} className="grafico-base" />
        <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" onMouseMove={mover} />
        <text x={M.left + iw / 2} y={ALTO - 12} className="grafico-eje" textAnchor="middle">{etiquetaX}</text>
      </svg>
    </Marco>
  );
}
