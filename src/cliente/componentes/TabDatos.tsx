import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Icono } from './ui/Iconos.js';
import { VistaProceso } from './VistaProceso.js';
import { FiltrosBarra } from './FiltrosBarra.js';
import { registrarEvento } from '../eventos.js';
import { useSesion } from '../i18n.js';
import { aplicarFiltros } from '../constructor.js';
import type { Contexto, Filtro } from '../constructor.js';
import { aNumero, formatoFecha, localeActual } from '../analisis.js';
import type { Columna } from '../analisis.js';
import type { DatosJuego } from '../datos.js';

type Vista = 'solicitudes' | 'comentarios' | 'proceso';
const FILAS_POR_PAGINA = 300;

export function TabDatos({ datos }: { datos: DatosJuego }) {
  const { t } = useSesion();
  const [vista, setVista] = useState<Vista>('solicitudes');
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [orden, setOrden] = useState<{ campo: string; asc: boolean } | null>(null);
  const [limite, setLimite] = useState(FILAS_POR_PAGINA);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(false);

  const tabla = vista === 'comentarios' ? 'comentarios' : 'solicitudes';
  const cols = tabla === 'solicitudes' ? datos.colsSolicitudes : datos.colsComentarios;
  const filas = tabla === 'solicitudes' ? datos.solicitudes : datos.comentarios;
  const ctx: Contexto = useMemo(() => ({ columnas: cols, t, vocabulario: datos.vocabulario }), [cols, t, datos.vocabulario]);

  const visibles = useMemo(() => {
    let d = aplicarFiltros(filas, filtros, ctx);
    if (orden) {
      const col = cols.find(c => c.campo === orden.campo);
      d = [...d].sort((a, b) => {
        const va = a[orden.campo], vb = b[orden.campo];
        if (va == null || va === '') return 1;
        if (vb == null || vb === '') return -1;
        const na = col?.tipo === 'texto' ? null : aNumero(va, col?.tipo ?? 'numero');
        const nb = col?.tipo === 'texto' ? null : aNumero(vb, col?.tipo ?? 'numero');
        const cmp = na != null && nb != null ? na - nb : String(va).localeCompare(String(vb), undefined, { numeric: true });
        return orden.asc ? cmp : -cmp;
      });
    }
    return d;
  }, [filas, filtros, orden, ctx, cols]);

  function cambiarVista(v: Vista) {
    setVista(v);
    setFiltros([]);
    setOrden(null);
    setLimite(FILAS_POR_PAGINA);
    registrarEvento('vista', { vista: v });
  }

  async function descargar() {
    setDescargando(true);
    setErrorDescarga(false);
    try {
      await api.datos.excel(tabla);
    } catch {
      setErrorDescarga(true);
    } finally {
      setDescargando(false);
    }
  }

  const n = (x: number) => x.toLocaleString(localeActual());

  return (
    <div>
      <div className="datos-barra">
        <div className="segmentado" role="tablist">
          <button role="tab" aria-selected={vista === 'solicitudes'} className={vista === 'solicitudes' ? 'activo' : ''} onClick={() => cambiarVista('solicitudes')}>
            {t('tablas.solicitudes')} <span className="segmentado-n">{n(datos.solicitudes.length)}</span>
          </button>
          <button role="tab" data-tour="tab-comentarios" aria-selected={vista === 'comentarios'} className={vista === 'comentarios' ? 'activo' : ''} onClick={() => cambiarVista('comentarios')}>
            {t('tablas.comentarios')} <span className="segmentado-n">{n(datos.comentarios.length)}</span>
          </button>
          <button role="tab" data-tour="tab-proceso" aria-selected={vista === 'proceso'} className={vista === 'proceso' ? 'activo' : ''} onClick={() => cambiarVista('proceso')}>
            {t('tablas.proceso')}
          </button>
        </div>
        {vista !== 'proceso' && (
          <button className="btn-fantasma btn-sm" onClick={descargar} disabled={descargando}>
            <Icono nombre="descargar" tamano={16} />{t('tablas.descargarExcel')}
          </button>
        )}
      </div>
      {errorDescarga && <div className="alerta-error" role="alert">{t('comun.errorDescarga')}</div>}

      {vista === 'proceso' ? (
        <VistaProceso filas={datos.solicitudes} estrato="" onEtapa={etapa => registrarEvento('proceso_etapa', { etapa, estrato: null })} />
      ) : (
        <>
          <div className="datos-filtros">
            <FiltrosBarra filas={filas} columnas={cols.filter(c => !['comments', 'comentarioCliente'].includes(c.campo))} ctx={ctx} filtros={filtros}
              onCambio={f => { setFiltros(f); setLimite(FILAS_POR_PAGINA); }} />
          </div>
          <div className="tarjeta datos-tabla">
            <div className="datos-tabla-scroll">
              <table className="datos">
                <thead>
                  <tr>
                    {cols.map(c => (
                      <th key={c.campo} onClick={() => setOrden(o => ({ campo: c.campo, asc: o?.campo === c.campo ? !o.asc : true }))}
                        title={c.calculada ? `${t('comun.calculada')}. ${t('tablas.ordenar')}` : t('tablas.ordenar')}>
                        {c.calculada && <Icono nombre="calculada" tamano={12} />} {c.nombre}
                        {orden?.campo === c.campo ? (orden.asc ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.slice(0, limite).map((r, i) => (
                    <tr key={i}>{cols.map(c => <td key={c.campo} className={c.campo === 'comentarioCliente' || c.campo === 'comments' ? 'celda-texto' : ''}>{formatear(r[c.campo], c, t)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="datos-tabla-pie">
              <span>
                {visibles.length === filas.length ? t('comun.filas', { n: n(filas.length) }) : t('comun.filasFiltradas', { n: n(visibles.length), total: n(filas.length) })}
                {limite < visibles.length && ` · ${t('comun.mostrando', { n: n(limite) })}`}
              </span>
              {limite < visibles.length && <button className="btn-fantasma btn-sm" onClick={() => setLimite(visibles.length)}>{t('comun.mostrarTodas')}</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatear(v: unknown, c: Columna, t: (k: string) => string): string {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? t('comun.si') : t('comun.no');
  if (c.tipo === 'fecha') return formatoFecha(aNumero(v, 'fecha'));
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
