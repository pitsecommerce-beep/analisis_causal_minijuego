import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatoFecha, formatoNumero, localeActual } from '../analisis.js';
import type {
  ResultadoPareto, ResultadoComparativo, ResultadoHistograma, ResultadoDispersion, ResultadoCorrida,
  ResultadoControl, ResultadoCaja, ResultadoPivote, Resultado,
} from '../constructor.js';
import { useT } from '../i18n.js';
import { LARGO_RACHA } from '../constructor.js';

// Paleta sobria que se lee impresa en blanco y negro: barras en gris medio, acumulado en un acento oscuro.
// Los colores van como atributos (no clases) para que el PNG exportado se vea igual que en pantalla.
export const PALETA = {
  barra: '#8a94a3',
  acento: '#c2410c',
  referencia: '#1f2937',
  rejilla: '#e5e8ed',
  base: '#9aa5b4',
  texto: '#1b2332',
  textoSec: '#56637a',
  superficie: '#ffffff',
  // Grupos: los tres primeros tonos validados para dispersión; el cuarto, gris para "Otros"
  grupos: ['#2a78d6', '#eb6834', '#1baf7a', '#9aa1a9'],
};
const FUENTE = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
const ALTO = 340;
const M = { top: 36, right: 24, bottom: 64, left: 64 };

const txt = (tam = 12, color = PALETA.textoSec, peso = 400) => ({ fontSize: tam, fill: color, fontFamily: FUENTE, fontWeight: peso });

function useAncho(fijo?: number | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(fijo ?? 800);
  useEffect(() => {
    if (fijo || !ref.current) return;
    const ro = new ResizeObserver(([e]) => { if (e) setAncho(Math.max(300, e.contentRect.width)); });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [fijo]);
  return { ref, ancho: fijo ?? ancho };
}

function ticks(min: number, max: number, n = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const crudo = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(crudo));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= crudo) ?? crudo;
  const out: number[] = [];
  const fin = Math.ceil(max / paso - 1e-9) * paso;
  for (let v = Math.floor(min / paso + 1e-9) * paso; v <= fin + 1e-9; v += paso) out.push(Number(v.toFixed(10)));
  return out;
}

interface Tip { x: number; y: number; contenido: ReactNode }

function Marco({ children, tip, alto, refDiv }: { children: ReactNode; tip: Tip | null; alto: number; refDiv: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={refDiv} className="grafico" style={{ height: alto }}>
      {children}
      {tip && <div className="grafico-tip" style={{ left: tip.x, top: tip.y }}>{tip.contenido}</div>}
    </div>
  );
}

function Svg({ ancho, alto, children, onLeave }: { ancho: number; alto: number; children: ReactNode; onLeave?: () => void }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} onMouseLeave={onLeave} style={{ fontFamily: FUENTE }}>
      <rect x={0} y={0} width={ancho} height={alto} fill={PALETA.superficie} />
      {children}
    </svg>
  );
}

function EjeY({ valores, escala, x1, x2, formato, lado = 'izq' }: { valores: number[]; escala: (v: number) => number; x1: number; x2: number; formato: (v: number) => string; lado?: 'izq' | 'der' }) {
  return (
    <g>
      {valores.map(v => (
        <g key={v}>
          {lado === 'izq' && <line x1={x1} x2={x2} y1={escala(v)} y2={escala(v)} stroke={PALETA.rejilla} strokeWidth={1} />}
          <text x={lado === 'izq' ? x1 - 8 : x2 + 8} y={escala(v)} {...txt()} textAnchor={lado === 'izq' ? 'end' : 'start'} dominantBaseline="middle">{formato(v)}</text>
        </g>
      ))}
    </g>
  );
}

function TituloEje({ x, y, texto, vertical }: { x: number; y: number; texto: string; vertical?: boolean }) {
  return <text x={x} y={y} {...txt(12, PALETA.textoSec, 500)} textAnchor="middle" transform={vertical ? `rotate(-90 ${x} ${y})` : undefined}>{texto}</text>;
}

function barra(x: number, y: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const fmt = (v: number, esFecha = false, d = 2) => (esFecha ? formatoFecha(v) : formatoNumero(v, d));
const recortar = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s);

export function Leyenda({ elementos }: { elementos: { color: string; texto: string; tipo: 'barra' | 'linea' | 'punto' | 'discontinua' }[] }) {
  return (
    <div className="grafico-leyenda">
      {elementos.map(e => (
        <span key={e.texto}>
          <span className={`grafico-leyenda-marca ${e.tipo}`} style={e.tipo === 'discontinua' ? { borderTopColor: e.color } : { background: e.color }} />
          {e.texto}
        </span>
      ))}
    </div>
  );
}

// ── Pareto ──

export function ParetoGrafico({ r, ancho: fijo, alto = ALTO, compacto }: { r: ResultadoPareto; ancho?: number | undefined; alto?: number; compacto?: boolean }) {
  const t = useT();
  const { ref, ancho } = useAncho(fijo);
  const [tip, setTip] = useState<Tip | null>(null);
  if (r.barras.length === 0) return <SinValores />;
  const m = { ...M, right: r.aditiva ? 56 : M.right, bottom: compacto ? 56 : 80 };
  const iw = ancho - m.left - m.right;
  const ih = alto - m.top - m.bottom;
  const maxV = Math.max(...r.barras.map(b => b.valor), r.referencia ?? 0);
  const ty = ticks(0, maxV);
  const tope = Math.max(maxV, ty[ty.length - 1] ?? maxV) || 1;
  const sy = (v: number) => m.top + ih - (v / tope) * ih;
  const sp = (p: number) => m.top + ih - (p / 100) * ih;
  const banda = iw / r.barras.length;
  const cx = (i: number) => m.left + banda * i + banda / 2;
  const w = Math.max(3, Math.min(64, banda * 0.72));
  const maxCar = Math.max(6, Math.floor(Math.min(banda * 2, compacto ? 110 : 150) / 6.5));
  const linea = r.aditiva ? r.barras.map((b, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${sp(b.acumulado ?? 0)}`).join(' ') : '';

  return (
    <>
      {!compacto && (
        <Leyenda elementos={[
          { color: PALETA.barra, texto: r.etiquetaValor, tipo: 'barra' },
          ...(r.aditiva ? [{ color: PALETA.acento, texto: t('graficos.acumulado'), tipo: 'linea' as const }] : []),
          ...(r.referencia != null ? [{ color: PALETA.referencia, texto: `${t('graficos.referenciaGeneral')}: ${fmt(r.referencia)}`, tipo: 'discontinua' as const }] : []),
        ]} />
      )}
      <Marco refDiv={ref} tip={tip} alto={alto}>
        <Svg ancho={ancho} alto={alto} onLeave={() => setTip(null)}>
          <EjeY valores={ty} escala={sy} x1={m.left} x2={ancho - m.right} formato={v => formatoNumero(v)} />
          {r.aditiva && <EjeY valores={[0, 20, 40, 60, 80, 100]} escala={sp} x1={m.left} x2={ancho - m.right} formato={v => `${v}%`} lado="der" />}
          {r.linea80 && (
            <g>
              <line x1={m.left} x2={ancho - m.right} y1={sp(80)} y2={sp(80)} stroke={PALETA.acento} strokeWidth={1} strokeDasharray="2 4" />
              <text x={ancho - m.right - 4} y={sp(80) - 5} {...txt(11, PALETA.acento, 600)} textAnchor="end">80%</text>
            </g>
          )}
          {r.barras.map((b, i) => {
            const y = sy(b.valor);
            return (
              <g key={b.etiqueta}>
                <path d={barra(cx(i) - w / 2, y, w, m.top + ih - y)} fill={PALETA.barra} />
                {!r.aditiva && (
                  <text x={cx(i)} y={y - 6} {...txt(11, PALETA.textoSec)} textAnchor="middle">{t('graficos.n')}={b.n}</text>
                )}
                <text x={cx(i)} y={m.top + ih + 14} {...txt(compacto ? 11 : 12, PALETA.texto)} textAnchor="end"
                  transform={`rotate(-35 ${cx(i)} ${m.top + ih + 14})`}>{recortar(b.etiqueta, maxCar)}</text>
                <rect x={cx(i) - banda / 2} y={m.top} width={banda} height={ih} fill="transparent"
                  onMouseMove={() => setTip({
                    x: cx(i), y: Math.max(m.top, y - 10),
                    contenido: <><strong>{b.etiqueta}</strong><br />{r.etiquetaValor}: {fmt(b.valor)}<br />{t('graficos.nSolicitudes', { n: b.n })}
                      {b.acumulado != null && <><br />{t('graficos.acumulado')}: {fmt(b.acumulado, false, 1)}%</>}{b.ayuda && <><br />{b.ayuda}</>}</>,
                  })} />
              </g>
            );
          })}
          {r.referencia != null && (
            <line x1={m.left} x2={ancho - m.right} y1={sy(r.referencia)} y2={sy(r.referencia)} stroke={PALETA.referencia} strokeWidth={1.5} strokeDasharray="6 4" pointerEvents="none" />
          )}
          {r.aditiva && (
            <g pointerEvents="none">
              <path d={linea} fill="none" stroke={PALETA.acento} strokeWidth={2} />
              {r.barras.map((b, i) => (
                <circle key={b.etiqueta} cx={cx(i)} cy={sp(b.acumulado ?? 0)} r={4.5} fill={PALETA.acento} stroke={PALETA.superficie} strokeWidth={2} />
              ))}
            </g>
          )}
          <line x1={m.left} x2={ancho - m.right} y1={m.top + ih} y2={m.top + ih} stroke={PALETA.base} />
          {!compacto && <TituloEje x={16} y={m.top + ih / 2} texto={r.etiquetaValor} vertical />}
        </Svg>
      </Marco>
    </>
  );
}

export function ComparativoGrafico({ r, ancho: fijo }: { r: ResultadoComparativo; ancho?: number | undefined }) {
  const t = useT();
  const etiqueta = r.paneles[0]?.pareto;
  const anchoPanel = fijo ? Math.floor((fijo - 16 * (r.paneles.length - 1)) / r.paneles.length) : undefined;
  return (
    <>
      {etiqueta && (
        <Leyenda elementos={[
          { color: PALETA.barra, texto: etiqueta.etiquetaValor, tipo: 'barra' },
          ...(etiqueta.aditiva ? [{ color: PALETA.acento, texto: t('graficos.acumulado'), tipo: 'linea' as const }] : []),
        ]} />
      )}
      <div className="grafico-paneles" style={{ gridTemplateColumns: `repeat(${Math.min(r.paneles.length, 4)}, minmax(0, 1fr))` }}>
        {r.paneles.map(p => (
          <div key={p.titulo} className="grafico-panel">
            <div className="grafico-panel-titulo">{p.titulo} <span>{t('graficos.nSolicitudes', { n: p.n })}</span></div>
            <ParetoGrafico r={p.pareto} compacto alto={290} ancho={anchoPanel} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Histograma ──

export function HistogramaGrafico({ r, ancho: fijo, alto = ALTO }: { r: ResultadoHistograma; ancho?: number | undefined; alto?: number }) {
  const t = useT();
  const { ref, ancho } = useAncho(fijo);
  const [tip, setTip] = useState<Tip | null>(null);
  const dos = r.series.length > 1;
  const m = { ...M, top: dos ? 44 : 40 };
  const iw = ancho - m.left - m.right;
  const ih = alto - m.top - m.bottom;
  const x0 = r.bordes[0]!, x1 = r.bordes[r.bordes.length - 1]!;
  const sx = (v: number) => m.left + ((v - x0) / (x1 - x0 || 1)) * iw;
  const maxC = Math.max(...r.series.flatMap(s => s.conteos));
  const ty = ticks(0, maxC);
  const tope = Math.max(maxC, ty[ty.length - 1] ?? maxC) || 1;
  const sy = (v: number) => m.top + ih - (v / tope) * ih;
  const colores = dos ? [PALETA.grupos[0]!, PALETA.grupos[1]!] : [PALETA.barra];
  const tx = ticks(x0, x1, Math.max(3, Math.floor(iw / 90)));
  const refs = r.series.flatMap((s, i) => [
    { v: s.resumen.media, et: `${dos ? `${s.etiqueta}: ` : ''}${t('graficos.media')} ${fmt(s.resumen.media, r.esFecha, 1)}`, color: dos ? colores[i]! : PALETA.referencia, guion: '' },
    { v: s.resumen.mediana, et: `${dos ? `${s.etiqueta}: ` : ''}${t('graficos.mediana')} ${fmt(s.resumen.mediana, r.esFecha, 1)}`, color: dos ? colores[i]! : PALETA.acento, guion: '6 4' },
  ]);

  return (
    <>
      <Leyenda elementos={[
        ...(dos ? r.series.map((s, i) => ({ color: colores[i]!, texto: `${s.etiqueta} (${t('graficos.n')}=${s.resumen.n})`, tipo: 'barra' as const })) : []),
        ...refs.map(x => ({ color: x.color, texto: x.et, tipo: x.guion ? 'discontinua' as const : 'linea' as const })),
      ]} />
      <Marco refDiv={ref} tip={tip} alto={alto}>
        <Svg ancho={ancho} alto={alto} onLeave={() => setTip(null)}>
          <EjeY valores={ty} escala={sy} x1={m.left} x2={ancho - m.right} formato={v => formatoNumero(v)} />
          {r.bordes.slice(0, -1).map((b, i) => {
            const xa = sx(b) + 1, xb = sx(r.bordes[i + 1]!) - 1;
            const ancho1 = Math.max(1, xb - xa);
            return (
              <g key={i}>
                {r.series.map((s, j) => {
                  const w = dos ? ancho1 / 2 : ancho1;
                  const x = xa + (dos ? j * w : 0);
                  const y = sy(s.conteos[i] ?? 0);
                  return <path key={j} d={barra(x, y, Math.max(1, w - (dos ? 1 : 0)), m.top + ih - y)} fill={colores[j]} />;
                })}
                <rect x={xa} y={m.top} width={ancho1} height={ih} fill="transparent"
                  onMouseMove={() => setTip({
                    x: (xa + xb) / 2, y: m.top + 4,
                    contenido: <><strong>{t('graficos.rango', { a: fmt(b, r.esFecha, 1), b: fmt(r.bordes[i + 1]!, r.esFecha, 1) })}</strong>
                      {r.series.map(s => <span key={s.etiqueta}><br />{dos ? `${s.etiqueta}: ` : ''}{s.conteos[i]} {t('comun.registros')}</span>)}</>,
                  })} />
              </g>
            );
          })}
          {refs.map((x, i) => (
            <line key={i} x1={sx(x.v)} x2={sx(x.v)} y1={m.top - 6} y2={m.top + ih} stroke={x.color} strokeWidth={2} strokeDasharray={x.guion || undefined} pointerEvents="none" />
          ))}
          {tx.filter(v => v >= x0 - 1e-9 && v <= x1 + 1e-9).map(v => (
            <text key={v} x={sx(v)} y={m.top + ih + 18} {...txt()} textAnchor="middle">{fmt(v, r.esFecha)}</text>
          ))}
          <line x1={m.left} x2={ancho - m.right} y1={m.top + ih} y2={m.top + ih} stroke={PALETA.base} />
          <TituloEje x={m.left + iw / 2} y={alto - 16} texto={r.etiquetaX} />
          <TituloEje x={16} y={m.top + ih / 2} texto={t('graficos.frecuencia')} vertical />
        </Svg>
      </Marco>
    </>
  );
}

// ── Dispersión ──

function Marca({ x, y, grupo, r = 4.5, opacidad = 0.7 }: { x: number; y: number; grupo: number; r?: number; opacidad?: number }) {
  const color = PALETA.grupos[Math.min(grupo, PALETA.grupos.length - 1)]!;
  // Forma distinta por grupo para que se distingan impresos en blanco y negro
  const forma = grupo % 4;
  const comun = { fill: color, fillOpacity: opacidad, stroke: PALETA.superficie, strokeWidth: 1 };
  if (forma === 1) return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...comun} />;
  if (forma === 2) return <path d={`M${x},${y - r * 1.2} L${x + r * 1.1},${y + r * 0.8} L${x - r * 1.1},${y + r * 0.8} Z`} {...comun} />;
  if (forma === 3) return <path d={`M${x},${y - r * 1.2} L${x + r * 1.2},${y} L${x},${y + r * 1.2} L${x - r * 1.2},${y} Z`} {...comun} />;
  return <circle cx={x} cy={y} r={r} {...comun} />;
}

export function DispersionGrafico({ r, ancho: fijo, alto = ALTO }: { r: ResultadoDispersion; ancho?: number | undefined; alto?: number }) {
  const t = useT();
  const { ref, ancho } = useAncho(fijo);
  const [tip, setTip] = useState<Tip | null>(null);
  const iw = ancho - M.left - M.right;
  const ih = alto - M.top - M.bottom;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of r.puntos) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const ty = ticks(y0, y1);
  const tx = ticks(x0, x1, Math.max(3, Math.floor(iw / 100)));
  const ya = Math.min(y0, ty[0] ?? y0), yb = Math.max(y1, ty[ty.length - 1] ?? y1);
  const pad = (x1 - x0) * 0.03 || 0.5;
  const xa = x0 - pad, xb = x1 + pad;
  const sx = (v: number) => M.left + ((v - xa) / (xb - xa || 1)) * iw;
  const sy = (v: number) => M.top + ih - ((v - ya) / (yb - ya || 1)) * ih;
  const yTend = (x: number) => Math.min(yb, Math.max(ya, r.intercepto + r.pendiente * x));
  // Los puntos que coinciden se separan un poco para ver cuántos hay
  const desplazar = (i: number) => (((i * 7919) % 11) - 5) * 0.6;

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const mx = M.left + (e.clientX - caja.left), my = M.top + (e.clientY - caja.top);
    let mejor: (typeof r.puntos)[number] | null = null;
    let d = 20 * 20;
    const cerca: typeof r.puntos = [];
    for (const p of r.puntos) {
      const dd = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
      if (dd < 36) cerca.push(p);
      if (dd < d) { d = dd; mejor = p; }
    }
    if (!mejor) { setTip(null); return; }
    const mismos = r.puntos.filter(p => p.x === mejor!.x && p.y === mejor!.y);
    setTip({
      x: sx(mejor.x), y: sy(mejor.y) - 10,
      contenido: <>
        <strong>{t('graficos.solicitud')} {mismos.slice(0, 6).map(p => p.id).join(', ')}{mismos.length > 6 ? '…' : ''}</strong><br />
        {r.etiquetaX}: {fmt(mejor.x, r.xFecha)}<br />{r.etiquetaY}: {fmt(mejor.y, r.yFecha)}
        {r.grupos.length > 0 && <><br />{r.grupos[mejor.grupo]}</>}
        {mismos.length > 1 && <><br />{t('graficos.casos')}: {mismos.length}</>}
      </>,
    });
  }

  return (
    <>
      <Leyenda elementos={[
        ...(r.grupos.length ? r.grupos.map((g, i) => ({ color: PALETA.grupos[Math.min(i, 3)]!, texto: g, tipo: 'punto' as const })) : []),
        { color: PALETA.acento, texto: `${t('graficos.tendencia')} · ${t('graficos.correlacion')} ${Number.isFinite(r.r) ? r.r.toFixed(3) : '-'} · ${t('graficos.casos')} ${r.puntos.length}`, tipo: 'linea' },
      ]} />
      <Marco refDiv={ref} tip={tip} alto={alto}>
        <Svg ancho={ancho} alto={alto} onLeave={() => setTip(null)}>
          <EjeY valores={ty} escala={sy} x1={M.left} x2={ancho - M.right} formato={v => fmt(v, r.yFecha)} />
          {tx.filter(v => v >= xa && v <= xb).map(v => <text key={v} x={sx(v)} y={M.top + ih + 18} {...txt()} textAnchor="middle">{fmt(v, r.xFecha)}</text>)}
          {r.puntos.map((p, i) => <Marca key={i} x={sx(p.x) + desplazar(i)} y={sy(p.y) + desplazar(i + 3)} grupo={p.grupo} />)}
          <line x1={sx(xa)} x2={sx(xb)} y1={sy(yTend(xa))} y2={sy(yTend(xb))} stroke={PALETA.acento} strokeWidth={2} pointerEvents="none" />
          <line x1={M.left} x2={ancho - M.right} y1={M.top + ih} y2={M.top + ih} stroke={PALETA.base} />
          <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" onMouseMove={mover} />
          <TituloEje x={M.left + iw / 2} y={alto - 16} texto={r.etiquetaX} />
          <TituloEje x={16} y={M.top + ih / 2} texto={r.etiquetaY} vertical />
        </Svg>
      </Marco>
    </>
  );
}

// ── Corrida ──

export function CorridaGrafico({ r, ancho: fijo, alto = ALTO }: { r: ResultadoCorrida; ancho?: number | undefined; alto?: number }) {
  const t = useT();
  const { ref, ancho } = useAncho(fijo);
  const [tip, setTip] = useState<Tip | null>(null);
  const [activo, setActivo] = useState<number | null>(null);
  const vs = r.valores;
  const iw = ancho - M.left - M.right;
  const ih = alto - M.top - M.bottom;
  let min = Infinity, max = -Infinity;
  for (const p of vs) { min = Math.min(min, p.v); max = Math.max(max, p.v); }
  const ty = ticks(min, max);
  const y0 = Math.min(min, ty[0] ?? min), y1 = Math.max(max, ty[ty.length - 1] ?? max);
  const sx = (i: number) => M.left + (vs.length === 1 ? iw / 2 : (i / (vs.length - 1)) * iw);
  const sy = (v: number) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const d = vs.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.v).toFixed(1)}`).join(' ');
  // Marcas de mes en el eje para ubicar el tiempo
  const marcas: { i: number; et: string }[] = [];
  let ultimo = '';
  vs.forEach((p, i) => { const k = new Date(p.fecha).toISOString().slice(0, 7); if (k !== ultimo) { marcas.push({ i, et: k }); ultimo = k; } });
  const cada = Math.max(1, Math.ceil(marcas.length / Math.max(1, Math.floor(iw / 70))));

  function mover(e: React.MouseEvent<SVGRectElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - caja.left) / caja.width) * (vs.length - 1));
    const p = vs[i];
    if (!p) return;
    setActivo(i);
    setTip({ x: sx(i), y: sy(p.v) - 10, contenido: <><strong>{fmt(p.v, r.esFecha)}</strong><br />{t('graficos.solicitud')} {p.id} · {formatoFecha(p.fecha)}</> });
  }

  return (
    <>
      <Leyenda elementos={[{ color: PALETA.barra, texto: r.etiquetaY, tipo: 'linea' }, { color: PALETA.acento, texto: `${t('graficos.mediana')}: ${fmt(r.mediana, r.esFecha)}`, tipo: 'discontinua' }]} />
      <Marco refDiv={ref} tip={tip} alto={alto}>
        <Svg ancho={ancho} alto={alto} onLeave={() => { setTip(null); setActivo(null); }}>
          <EjeY valores={ty} escala={sy} x1={M.left} x2={ancho - M.right} formato={v => fmt(v, r.esFecha)} />
          <path d={d} fill="none" stroke={PALETA.barra} strokeWidth={1.5} strokeLinejoin="round" />
          <line x1={M.left} x2={ancho - M.right} y1={sy(r.mediana)} y2={sy(r.mediana)} stroke={PALETA.acento} strokeWidth={2} strokeDasharray="6 4" />
          {marcas.filter((_, k) => k % cada === 0).map(mk => (
            <text key={mk.et} x={sx(mk.i)} y={M.top + ih + 18} {...txt()} textAnchor="start">{mk.et}</text>
          ))}
          {activo != null && vs[activo] && (
            <g pointerEvents="none">
              <line x1={sx(activo)} x2={sx(activo)} y1={M.top} y2={M.top + ih} stroke={PALETA.base} strokeDasharray="3 3" />
              <circle cx={sx(activo)} cy={sy(vs[activo]!.v)} r={5} fill={PALETA.referencia} stroke={PALETA.superficie} strokeWidth={2} />
            </g>
          )}
          <line x1={M.left} x2={ancho - M.right} y1={M.top + ih} y2={M.top + ih} stroke={PALETA.base} />
          <rect x={M.left} y={M.top} width={iw} height={ih} fill="transparent" onMouseMove={mover} />
          <TituloEje x={M.left + iw / 2} y={alto - 16} texto={r.etiquetaX} />
          <TituloEje x={16} y={M.top + ih / 2} texto={r.etiquetaY} vertical />
        </Svg>
      </Marco>
    </>
  );
}

// ── Control ──

export function ControlGrafico({ r, ancho: fijo, alto = ALTO }: { r: ResultadoControl; ancho?: number | undefined; alto?: number }) {
  const t = useT();
  const { ref, ancho } = useAncho(fijo);
  const [tip, setTip] = useState<Tip | null>(null);
  const ps = r.puntos;
  const iw = ancho - M.left - M.right;
  const ih = alto - M.top - M.bottom;
  let min = Infinity, max = -Infinity;
  for (const p of ps) { min = Math.min(min, p.media, p.lci); max = Math.max(max, p.media, p.lcs); }
  const ty = ticks(min, max);
  const y0 = Math.min(min, ty[0] ?? min), y1 = Math.max(max, ty[ty.length - 1] ?? max);
  const paso = iw / ps.length;
  const sx = (i: number) => M.left + paso * (i + 0.5);
  const sy = (v: number) => M.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  // Los límites dependen del tamaño de cada periodo: se dibujan como escalones
  const escalon = (k: 'lcs' | 'lci') => ps.map((p, i) => `${i === 0 ? 'M' : 'L'}${(M.left + paso * i).toFixed(1)},${sy(p[k]).toFixed(1)} L${(M.left + paso * (i + 1)).toFixed(1)},${sy(p[k]).toFixed(1)}`).join(' ');
  const linea = ps.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(p.media).toFixed(1)}`).join(' ');
  const cada = Math.max(1, Math.ceil(ps.length / Math.max(1, Math.floor(iw / 70))));
  const etPeriodo = (p: string) => (r.periodo === 'mes' ? p : new Date(`${p}T00:00:00Z`).toLocaleDateString(localeActual(), { timeZone: 'UTC', day: '2-digit', month: 'short', year: '2-digit' }));

  return (
    <>
      <Leyenda elementos={[
        { color: PALETA.referencia, texto: `${t('graficos.media')}: ${formatoNumero(r.centro)}`, tipo: 'linea' },
        { color: PALETA.textoSec, texto: t('graficos.limites'), tipo: 'discontinua' },
        { color: PALETA.acento, texto: t('graficos.fueraControl'), tipo: 'punto' },
      ]} />
      <Marco refDiv={ref} tip={tip} alto={alto}>
        <Svg ancho={ancho} alto={alto} onLeave={() => setTip(null)}>
          <EjeY valores={ty} escala={sy} x1={M.left} x2={ancho - M.right} formato={v => formatoNumero(v)} />
          <path d={escalon('lcs')} fill="none" stroke={PALETA.textoSec} strokeWidth={1.5} strokeDasharray="4 4" />
          <path d={escalon('lci')} fill="none" stroke={PALETA.textoSec} strokeWidth={1.5} strokeDasharray="4 4" />
          <line x1={M.left} x2={ancho - M.right} y1={sy(r.centro)} y2={sy(r.centro)} stroke={PALETA.referencia} strokeWidth={1.5} />
          <path d={linea} fill="none" stroke={PALETA.barra} strokeWidth={1.5} strokeLinejoin="round" />
          {ps.map((p, i) => {
            const senal = p.fuera || p.racha;
            return (
              <circle key={p.periodo} cx={sx(i)} cy={sy(p.media)} r={senal ? 6 : 4}
                fill={p.fuera ? PALETA.acento : senal ? PALETA.superficie : PALETA.barra}
                stroke={senal ? PALETA.acento : PALETA.superficie} strokeWidth={2}
                onMouseEnter={() => setTip({
                  x: sx(i), y: sy(p.media) - 10,
                  contenido: <><strong>{etPeriodo(p.periodo)}</strong><br />{t('graficos.media')}: {formatoNumero(p.media)} · {t('graficos.n')} = {p.n}<br />
                    {t('graficos.limites')}: {formatoNumero(p.lci)} / {formatoNumero(p.lcs)}
                    {p.fuera && <><br /><strong>{t('graficos.fueraControl')}</strong></>}
                    {!p.fuera && p.racha && <><br /><strong>{t('graficos.racha', { n: LARGO_RACHA })}</strong></>}</>,
                })} />
            );
          })}
          {ps.map((p, i) => i % cada === 0 && (
            <text key={p.periodo} x={sx(i)} y={M.top + ih + 18} {...txt()} textAnchor="middle">{etPeriodo(p.periodo)}</text>
          ))}
          <TituloEje x={M.left + iw / 2} y={alto - 16} texto={t(r.periodo === 'mes' ? 'graficos.mes' : 'graficos.semana')} />
          <TituloEje x={16} y={M.top + ih / 2} texto={r.etiquetaY} vertical />
        </Svg>
      </Marco>
    </>
  );
}

// ── Caja ──

export function CajaGrafico({ r, ancho: fijo, alto = ALTO }: { r: ResultadoCaja; ancho?: number | undefined; alto?: number }) {
  const t = useT();
  const { ref, ancho } = useAncho(fijo);
  const [tip, setTip] = useState<Tip | null>(null);
  const m = { ...M, bottom: 80 };
  const iw = ancho - m.left - m.right;
  const ih = alto - m.top - m.bottom;
  const min = Math.min(...r.cajas.map(c => c.min)), max = Math.max(...r.cajas.map(c => c.max));
  const ty = ticks(min, max);
  const y0 = Math.min(min, ty[0] ?? min), y1 = Math.max(max, ty[ty.length - 1] ?? max);
  const sy = (v: number) => m.top + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
  const banda = iw / r.cajas.length;
  const cx = (i: number) => m.left + banda * (i + 0.5);
  const w = Math.min(56, banda * 0.5);

  return (
    <>
      <Leyenda elementos={[{ color: PALETA.barra, texto: `${t('graficos.q1')} / ${t('graficos.q3')}`, tipo: 'barra' }, { color: PALETA.acento, texto: t('graficos.mediana'), tipo: 'linea' }]} />
      <Marco refDiv={ref} tip={tip} alto={alto}>
        <Svg ancho={ancho} alto={alto} onLeave={() => setTip(null)}>
          <EjeY valores={ty} escala={sy} x1={m.left} x2={ancho - m.right} formato={v => formatoNumero(v)} />
          {r.cajas.map((c, i) => (
            <g key={c.grupo}>
              <line x1={cx(i)} x2={cx(i)} y1={sy(c.bigoteAlto)} y2={sy(c.q3)} stroke={PALETA.textoSec} strokeWidth={1.5} />
              <line x1={cx(i)} x2={cx(i)} y1={sy(c.q1)} y2={sy(c.bigoteBajo)} stroke={PALETA.textoSec} strokeWidth={1.5} />
              <line x1={cx(i) - w / 4} x2={cx(i) + w / 4} y1={sy(c.bigoteAlto)} y2={sy(c.bigoteAlto)} stroke={PALETA.textoSec} strokeWidth={1.5} />
              <line x1={cx(i) - w / 4} x2={cx(i) + w / 4} y1={sy(c.bigoteBajo)} y2={sy(c.bigoteBajo)} stroke={PALETA.textoSec} strokeWidth={1.5} />
              <rect x={cx(i) - w / 2} y={sy(c.q3)} width={w} height={Math.max(1, sy(c.q1) - sy(c.q3))} rx={3} fill={PALETA.barra} fillOpacity={0.55} stroke={PALETA.textoSec} />
              <line x1={cx(i) - w / 2} x2={cx(i) + w / 2} y1={sy(c.mediana)} y2={sy(c.mediana)} stroke={PALETA.acento} strokeWidth={2.5} />
              {c.atipicos.map((a, j) => <circle key={j} cx={cx(i)} cy={sy(a)} r={3} fill="none" stroke={PALETA.textoSec} />)}
              <text x={cx(i)} y={m.top + ih + 14} {...txt(12, PALETA.texto)} textAnchor="end" transform={`rotate(-35 ${cx(i)} ${m.top + ih + 14})`}>{recortar(c.grupo, 16)}</text>
              <rect x={cx(i) - banda / 2} y={m.top} width={banda} height={ih} fill="transparent"
                onMouseMove={() => setTip({
                  x: cx(i), y: sy(c.q3) - 10,
                  contenido: <><strong>{c.grupo}</strong> · {t('graficos.n')} = {c.n}<br />{t('graficos.maximo')}: {formatoNumero(c.max)}<br />{t('graficos.q3')}: {formatoNumero(c.q3)}<br />
                    {t('graficos.mediana')}: {formatoNumero(c.mediana)}<br />{t('graficos.q1')}: {formatoNumero(c.q1)}<br />{t('graficos.minimo')}: {formatoNumero(c.min)}</>,
                })} />
            </g>
          ))}
          <line x1={m.left} x2={ancho - m.right} y1={m.top + ih} y2={m.top + ih} stroke={PALETA.base} />
          <TituloEje x={16} y={m.top + ih / 2} texto={r.etiquetaY} vertical />
        </Svg>
      </Marco>
    </>
  );
}

// ── Tabla dinámica ──

export function PivoteTabla({ r, formatoCondicional }: { r: ResultadoPivote; formatoCondicional: boolean }) {
  const t = useT();
  const [orden, setOrden] = useState<{ col: number; asc: boolean }>({ col: -1, asc: false });
  const valores = r.filas.flatMap(f => (r.columnas.length ? f.valores : [f.total])).filter((v): v is number => v != null);
  const vmin = Math.min(...valores), vmax = Math.max(...valores);
  // Escala de un solo tono, de claro a oscuro
  const fondo = (v: number | null) => {
    if (!formatoCondicional || v == null || vmax === vmin) return undefined;
    const k = (v - vmin) / (vmax - vmin);
    return `rgba(42, 120, 214, ${(0.06 + k * 0.5).toFixed(2)})`;
  };
  const clave = (f: ResultadoPivote['filas'][number]) => (orden.col === -2 ? null : orden.col === -1 ? f.total : f.valores[orden.col]);
  const filas = [...r.filas].sort((a, b) => {
    if (orden.col === -2) return (orden.asc ? 1 : -1) * a.grupo.localeCompare(b.grupo, undefined, { numeric: true });
    const va = clave(a) ?? -Infinity, vb = clave(b) ?? -Infinity;
    return orden.asc ? va - vb : vb - va;
  });
  const th = (col: number, texto: string) => (
    <th onClick={() => setOrden(o => ({ col, asc: o.col === col ? !o.asc : col === -2 }))} title={t('tablas.ordenar')} style={{ cursor: 'pointer' }}>
      {texto}{orden.col === col ? (orden.asc ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const f = (v: number | null) => (v == null ? '' : formatoNumero(v));
  return (
    <div className="datos-pivote">
      <p className="datos-nota" style={{ marginTop: 0 }}>{r.etiquetaValor}</p>
      <table className="datos">
        <thead>
          <tr>{th(-2, r.etiquetaFilas)}{r.columnas.map((c, i) => <th key={c} onClick={() => setOrden(o => ({ col: i, asc: o.col === i ? !o.asc : false }))} style={{ cursor: 'pointer' }}>{c}{orden.col === i ? (orden.asc ? ' ▲' : ' ▼') : ''}</th>)}{th(-1, t('medidas.total'))}</tr>
        </thead>
        <tbody>
          {filas.map(fl => (
            <tr key={fl.grupo}>
              <td style={{ fontWeight: 500 }}>{fl.grupo}</td>
              {fl.valores.map((v, i) => <td key={i} style={{ background: fondo(v) }}>{f(v)}</td>)}
              <td style={{ fontWeight: 600, background: r.columnas.length ? undefined : fondo(fl.total) }}>{f(fl.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td style={{ fontWeight: 600 }}>{t('medidas.total')}</td>{r.totales.map((v, i) => <td key={i} style={{ fontWeight: 600 }}>{f(v)}</td>)}<td style={{ fontWeight: 700 }}>{f(r.total)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}

export function SinValores({ texto }: { texto?: string }) {
  const t = useT();
  return <div className="datos-aviso" style={{ margin: 0 }}>{texto ?? t('graficos.sinValores')}</div>;
}

// Dibuja cualquier resultado del constructor
export function Grafico({ r, ancho, formatoCondicional = true }: { r: Resultado; ancho?: number | undefined; formatoCondicional?: boolean }) {
  switch (r.clase) {
    case 'pareto': return <ParetoGrafico r={r} ancho={ancho} />;
    case 'comparativo': return <ComparativoGrafico r={r} ancho={ancho} />;
    case 'histograma': return <HistogramaGrafico r={r} ancho={ancho} />;
    case 'dispersion': return <DispersionGrafico r={r} ancho={ancho} />;
    case 'corrida': return <CorridaGrafico r={r} ancho={ancho} />;
    case 'control': return <ControlGrafico r={r} ancho={ancho} />;
    case 'caja': return <CajaGrafico r={r} ancho={ancho} />;
    case 'pivote': return <PivoteTabla r={r} formatoCondicional={formatoCondicional} />;
  }
}
