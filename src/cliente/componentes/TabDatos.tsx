import { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';
import { Icono } from './ui/Iconos.js';
import type { NombreIcono } from './ui/Iconos.js';
import { Histograma, Pareto, Corrida, Dispersion } from './Graficos.js';
import {
  agregarCalculadas, COLUMNAS_CALCULADAS, contarCategorias, correlacion, formatoFecha, formatoNumero,
  histograma, pareto, pares, pivote, resumir, valoresNumericos, aNumero,
} from '../analisis.js';
import type { Columna, Fila } from '../analisis.js';

type IdHerramienta = 'histograma' | 'pareto' | 'diagrama_corrida' | 'dispersion' | 'tabla_dinamica' | 'filtro' | 'contar' | 'sumar' | 'estadisticas';

const HERRAMIENTAS: { id: IdHerramienta; nombre: string; icono: NombreIcono; ayuda: string }[] = [
  { id: 'histograma', nombre: 'Histograma', icono: 'histograma', ayuda: 'Distribución de una columna numérica o de fechas' },
  { id: 'pareto', nombre: 'Pareto', icono: 'pareto', ayuda: 'Categorías más frecuentes y su porcentaje acumulado' },
  { id: 'diagrama_corrida', nombre: 'Corrida', icono: 'corrida', ayuda: 'Valores en orden de captura contra su mediana' },
  { id: 'dispersion', nombre: 'Dispersión', icono: 'dispersion', ayuda: 'Relación entre dos columnas numéricas' },
  { id: 'tabla_dinamica', nombre: 'Pivote', icono: 'tabla', ayuda: 'Agrupa por la columna y resume otra' },
  { id: 'filtro', nombre: 'Filtrar', icono: 'filtro', ayuda: 'Muestra solo las filas que contienen un texto' },
  { id: 'contar', nombre: 'Contar', icono: 'contar', ayuda: 'Frecuencia de cada valor' },
  { id: 'sumar', nombre: 'Sumar', icono: 'sumar', ayuda: 'Suma de una columna numérica' },
  { id: 'estadisticas', nombre: 'Estadísticas', icono: 'estadisticas', ayuda: 'Media, mediana, desviación y percentiles' },
];

const MAPA_VERIFICACIONES: Record<string, { columnas: string[]; herramientas: IdHerramienta[] }> = {
  medianas_iguales: { columnas: ['ventanaCaptura', 'dateFirstInput', 'dateLastInput'], herramientas: ['estadisticas', 'histograma'] },
  errores_captura_interfaz: { columnas: ['comments'], herramientas: ['contar', 'filtro'] },
  trabajo_perdido_buro: { columnas: ['creditBureauRunDate', 'creditBureauResult'], herramientas: ['sumar', 'contar'] },
  error_captura_frecuente: { columnas: ['comments', 'erroresComentario'], herramientas: ['contar', 'pareto'] },
  atorados_sin_plastico: { columnas: ['lastStatus', 'datePlasticSent'], herramientas: ['contar', 'filtro'] },
  concentracion_sucursales: { columnas: ['branchNum', 'comments'], herramientas: ['pareto', 'tabla_dinamica'] },
  secuencia_buro: { columnas: ['creditBureauRunDate', 'dateDocsSent'], herramientas: ['sumar', 'filtro'] },
};

const FILAS_POR_PAGINA = 300;

interface Props {
  onHerramientaUsada?: (herramienta: string) => void;
}

export function TabDatos({ onHerramientaUsada }: Props) {
  const [solicitudes, setSolicitudes] = useState<Fila[]>([]);
  const [comentarios, setComentarios] = useState<Fila[]>([]);
  const [colsSolicitudes, setColsSolicitudes] = useState<Columna[]>([]);
  const [colsComentarios, setColsComentarios] = useState<Columna[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [tab, setTab] = useState<'solicitudes' | 'comentarios'>('solicitudes');
  const [ordenCol, setOrdenCol] = useState('');
  const [ordenAsc, setOrdenAsc] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [filtroVal, setFiltroVal] = useState('');
  const [colSeleccionada, setColSeleccionada] = useState('');
  const [colSecundaria, setColSecundaria] = useState('');
  const [herramienta, setHerramienta] = useState<IdHerramienta | null>(null);
  const [aviso, setAviso] = useState('');
  const [verificaciones, setVerificaciones] = useState<string[]>([]);
  const [herramientasUsadas, setHerramientasUsadas] = useState<Set<string>>(new Set());
  const [limite, setLimite] = useState(FILAS_POR_PAGINA);

  useEffect(() => {
    async function cargar() {
      try {
        const [sol, com, cols, verifs] = await Promise.all([
          api.datos.solicitudes(),
          api.datos.comentarios(),
          api.datos.columnas(),
          api.datos.verificaciones(),
        ]);
        setSolicitudes(agregarCalculadas(sol));
        setComentarios(com);
        setColsSolicitudes([...(cols.solicitudes ?? []), ...COLUMNAS_CALCULADAS]);
        setColsComentarios(cols.comentarios ?? []);
        setVerificaciones(verifs);
      } catch (err: any) {
        setErrorCarga(err.message || 'No se pudieron cargar los datos');
      }
      setCargando(false);
    }
    cargar();
  }, []);

  const cols = tab === 'solicitudes' ? colsSolicitudes : colsComentarios;
  const filas = tab === 'solicitudes' ? solicitudes : comentarios;
  const columna = cols.find(c => c.campo === colSeleccionada) ?? null;
  const numericas = cols.filter(c => c.tipo !== 'texto');

  const datosFiltrados = useMemo(() => {
    let datos = filas;
    if (filtroCol && filtroVal) {
      const lower = filtroVal.toLowerCase();
      datos = datos.filter(r => String(r[filtroCol] ?? '').toLowerCase().includes(lower));
    }
    if (ordenCol) {
      datos = [...datos].sort((a, b) => {
        const va = a[ordenCol] as any, vb = b[ordenCol] as any;
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return ordenAsc ? cmp : -cmp;
      });
    }
    return datos;
  }, [filas, filtroCol, filtroVal, ordenCol, ordenAsc]);

  function cambiarTab(t: 'solicitudes' | 'comentarios') {
    setTab(t);
    setColSeleccionada('');
    setColSecundaria('');
    setHerramienta(null);
    setFiltroCol('');
    setFiltroVal('');
    setOrdenCol('');
    setLimite(FILAS_POR_PAGINA);
  }

  function ordenar(campo: string) {
    if (ordenCol === campo) setOrdenAsc(!ordenAsc);
    else { setOrdenCol(campo); setOrdenAsc(true); }
  }

  function elegirColumna(campo: string) {
    setColSeleccionada(campo);
    setAviso('');
    if (herramienta === 'filtro') setFiltroCol(campo);
  }

  async function aplicarHerramienta(id: IdHerramienta) {
    if (!columna) {
      setHerramienta(null);
      setAviso('Primero elige una columna en el selector "Columna" o haz doble clic en un encabezado de la tabla.');
      return;
    }
    setAviso('');
    setHerramienta(id);
    if (id === 'filtro') setFiltroCol(columna.campo);
    if (id === 'dispersion' && !colSecundaria) {
      const otra = numericas.find(c => c.campo !== columna.campo);
      if (otra) setColSecundaria(otra.campo);
    }
    setHerramientasUsadas(prev => new Set([...prev, id]));
    onHerramientaUsada?.(id);

    for (const [verifId, regla] of Object.entries(MAPA_VERIFICACIONES)) {
      if (verificaciones.includes(verifId)) continue;
      if (regla.columnas.includes(columna.campo) && regla.herramientas.includes(id)) {
        try {
          await api.datos.verificar(verifId, id);
          setVerificaciones(prev => [...prev, verifId]);
        } catch { /* la verificación es opcional para el análisis */ }
      }
    }
  }

  if (cargando) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>Cargando datos...</p>
      </div>
    );
  }

  if (errorCarga) {
    return <div className="alerta-error" role="alert">{errorCarga}</div>;
  }

  const visibles = datosFiltrados.slice(0, limite);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={`tab ${tab === 'solicitudes' ? 'activo' : ''}`} onClick={() => cambiarTab('solicitudes')}>
          Solicitudes ({solicitudes.length})
        </button>
        <button className={`tab ${tab === 'comentarios' ? 'activo' : ''}`} onClick={() => cambiarTab('comentarios')}>
          Comentarios ({comentarios.length})
        </button>
      </div>

      <div className="datos-controles">
        <div className="datos-columna">
          <label className="campo-label" htmlFor="col-analisis">Columna</label>
          <select id="col-analisis" value={colSeleccionada} onChange={e => elegirColumna(e.target.value)}>
            <option value="">Elige una columna...</option>
            {cols.map(c => <option key={c.campo} value={c.campo}>{c.nombre}</option>)}
          </select>
        </div>
        <div data-tour="herramientas" className="datos-herramientas">
          {HERRAMIENTAS.map(h => (
            <button key={h.id} className={`herramienta-btn ${herramienta === h.id ? 'activa' : ''} ${herramientasUsadas.has(h.id) ? 'usada' : ''}`}
              onClick={() => aplicarHerramienta(h.id)} title={h.ayuda} aria-pressed={herramienta === h.id}>
              <Icono nombre={h.icono} tamano={18} />
              {h.nombre}
            </button>
          ))}
        </div>
      </div>

      {aviso && <div className="datos-aviso" role="status"><Icono nombre="info" tamano={16} />{aviso}</div>}

      {herramienta && columna && (
        <PanelResultado
          herramienta={herramienta}
          columna={columna}
          secundaria={cols.find(c => c.campo === colSecundaria) ?? null}
          opcionesSecundaria={numericas.filter(c => c.campo !== columna.campo)}
          onSecundaria={setColSecundaria}
          filas={datosFiltrados}
          filtroVal={filtroVal}
          onFiltro={setFiltroVal}
          onCerrar={() => { setHerramienta(null); if (herramienta === 'filtro') { setFiltroCol(''); setFiltroVal(''); } }}
        />
      )}

      {verificaciones.length > 0 && (
        <div style={{ marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-texto-secundario)' }}>Verificaciones:</span>
          {verificaciones.map(v => <span key={v} className="badge badge-exito">{v}</span>)}
        </div>
      )}

      <div className="tarjeta datos-tabla">
        <div className="datos-tabla-scroll">
          <table className="datos">
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.campo}
                    onClick={() => ordenar(c.campo)}
                    onDoubleClick={() => elegirColumna(c.campo)}
                    title="Clic para ordenar. Doble clic para analizar esta columna."
                    className={colSeleccionada === c.campo ? 'seleccionada' : ''}>
                    {c.nombre}
                    {ordenCol === c.campo ? (ordenAsc ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((r, i) => (
                <tr key={i}>
                  {cols.map(c => (
                    <td key={c.campo} className={colSeleccionada === c.campo ? 'seleccionada' : ''}>
                      {formatVal(r[c.campo], c.tipo)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="datos-tabla-pie">
          <span>
            {datosFiltrados.length === filas.length
              ? `${filas.length.toLocaleString('es-MX')} filas`
              : `${datosFiltrados.length.toLocaleString('es-MX')} de ${filas.length.toLocaleString('es-MX')} filas con el filtro`}
            {visibles.length < datosFiltrados.length && ` · mostrando ${visibles.length.toLocaleString('es-MX')}`}
          </span>
          {visibles.length < datosFiltrados.length && (
            <button className="btn-fantasma btn-sm" onClick={() => setLimite(datosFiltrados.length)}>Mostrar todas</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelResultado({ herramienta, columna, secundaria, opcionesSecundaria, onSecundaria, filas, filtroVal, onFiltro, onCerrar }: {
  herramienta: IdHerramienta;
  columna: Columna;
  secundaria: Columna | null;
  opcionesSecundaria: Columna[];
  onSecundaria: (campo: string) => void;
  filas: Fila[];
  filtroVal: string;
  onFiltro: (v: string) => void;
  onCerrar: () => void;
}) {
  const info = HERRAMIENTAS.find(h => h.id === herramienta)!;
  const esFecha = columna.tipo === 'fecha';
  const nums = useMemo(() => valoresNumericos(filas, columna), [filas, columna]);
  const resumen = useMemo(() => resumir(nums), [nums]);
  const requiereNumero = herramienta === 'histograma' || herramienta === 'diagrama_corrida' || herramienta === 'dispersion'
    || herramienta === 'sumar' || herramienta === 'estadisticas';

  let contenido: React.ReactNode;

  if (requiereNumero && columna.tipo === 'texto') {
    contenido = <SinDatos texto={`"${columna.nombre}" es una columna de texto. Para ${info.nombre.toLowerCase()} elige una columna numérica o de fechas, o usa Pareto, Contar o Pivote.`} />;
  } else if (herramienta === 'histograma') {
    contenido = (
      <>
        <Histograma bins={histograma(nums, esFecha)} resumen={resumen} esFecha={esFecha} />
        {resumen && <ResumenLinea resumen={resumen} esFecha={esFecha} />}
      </>
    );
  } else if (herramienta === 'pareto') {
    const barras = pareto(contarCategorias(filas, columna));
    contenido = barras.length === 0 ? <SinDatos texto="No hay valores para graficar." /> : (
      <>
        <Leyenda elementos={[{ color: '#2563a8', texto: '% de cada categoría', tipo: 'barra' }, { color: '#b7791f', texto: '% acumulado', tipo: 'linea' }]} />
        <Pareto barras={barras} />
      </>
    );
  } else if (herramienta === 'diagrama_corrida') {
    const ordenadas = [...filas].sort((a, b) => (aNumero(a['dateFirstInput'], 'fecha') ?? 0) - (aNumero(b['dateFirstInput'], 'fecha') ?? 0));
    const serie = valoresNumericos(ordenadas, columna);
    contenido = resumen ? <Corrida valores={serie} mediana={resumen.mediana} esFecha={esFecha} /> : <SinDatos texto="No hay valores para graficar." />;
  } else if (herramienta === 'dispersion') {
    if (!secundaria) {
      contenido = <SinDatos texto="Elige la columna del eje vertical." />;
    } else {
      const ps = pares(filas, columna, secundaria);
      const r = correlacion(ps.map(p => p.x), ps.map(p => p.y));
      contenido = (
        <>
          <Dispersion puntos={ps} etiquetaX={columna.nombre} etiquetaY={secundaria.nombre} xFecha={esFecha} yFecha={secundaria.tipo === 'fecha'} />
          <p className="datos-nota">
            {ps.length.toLocaleString('es-MX')} puntos · Correlación (r): <strong>{Number.isFinite(r) ? r.toFixed(3) : '-'}</strong>. Recuerda que correlación no implica causalidad.
          </p>
        </>
      );
    }
  } else if (herramienta === 'tabla_dinamica') {
    const filasPiv = pivote(filas, columna, secundaria);
    contenido = (
      <div className="datos-pivote">
        <table className="datos">
          <thead>
            <tr>
              <th>{columna.nombre}</th>
              <th>Conteo</th>
              <th>% del total</th>
              {secundaria && <th>Suma de {secundaria.nombre}</th>}
              {secundaria && <th>Promedio de {secundaria.nombre}</th>}
            </tr>
          </thead>
          <tbody>
            {filasPiv.map(f => (
              <tr key={f.grupo}>
                <td style={{ fontWeight: 500 }}>{f.grupo}</td>
                <td>{f.conteo.toLocaleString('es-MX')}</td>
                <td>{formatoNumero(f.pct, 1)}%</td>
                {secundaria && <td>{f.suma != null ? formatoNumero(f.suma) : '-'}</td>}
                {secundaria && <td>{f.promedio != null ? formatoNumero(f.promedio) : '-'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else if (herramienta === 'contar') {
    const cats = contarCategorias(filas, columna);
    const total = cats.reduce((s, c) => s + c.conteo, 0);
    contenido = (
      <>
        <p className="datos-nota" style={{ marginTop: 0 }}>
          {columna.campo === 'comments'
            ? `${total.toLocaleString('es-MX')} eventos mencionados en los comentarios`
            : `${total.toLocaleString('es-MX')} registros · ${cats.length.toLocaleString('es-MX')} valores distintos`}
        </p>
        <div className="datos-conteo">
          {cats.slice(0, 20).map(c => (
            <div key={c.etiqueta} className="datos-conteo-fila">
              <span className="datos-conteo-etiqueta" title={c.etiqueta}>{c.etiqueta}</span>
              <span className="datos-conteo-barra"><span style={{ width: `${(c.conteo / (cats[0]?.conteo || 1)) * 100}%` }} /></span>
              <span className="datos-conteo-valor">{c.conteo.toLocaleString('es-MX')}</span>
            </div>
          ))}
        </div>
        {cats.length > 20 && <p className="datos-nota">Se muestran los 20 valores más frecuentes.</p>}
      </>
    );
  } else if (herramienta === 'sumar') {
    contenido = esFecha
      ? <SinDatos texto="Las fechas no se pueden sumar. Usa Histograma o Estadísticas." />
      : <Cifras cifras={[{ etiqueta: `Suma de ${columna.nombre}`, valor: formatoNumero(nums.reduce((a, b) => a + b, 0)) }, { etiqueta: 'Registros con valor', valor: nums.length.toLocaleString('es-MX') }]} />;
  } else if (herramienta === 'estadisticas') {
    contenido = resumen ? (
      <Cifras cifras={[
        { etiqueta: 'N', valor: resumen.n.toLocaleString('es-MX') },
        { etiqueta: 'Media', valor: fmt(resumen.media, esFecha) },
        { etiqueta: 'Mediana', valor: fmt(resumen.mediana, esFecha) },
        ...(esFecha ? [] : [{ etiqueta: 'Desv. estándar', valor: formatoNumero(resumen.desviacion) }]),
        { etiqueta: 'P10', valor: fmt(resumen.p10, esFecha) },
        { etiqueta: 'P90', valor: fmt(resumen.p90, esFecha) },
        { etiqueta: 'Mínimo', valor: fmt(resumen.min, esFecha) },
        { etiqueta: 'Máximo', valor: fmt(resumen.max, esFecha) },
      ]} />
    ) : <SinDatos texto="La columna no tiene valores." />;
  } else {
    contenido = (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="campo-label" htmlFor="filtro-valor" style={{ margin: 0 }}>Contiene</label>
        <input id="filtro-valor" value={filtroVal} onChange={e => onFiltro(e.target.value)} autoFocus
          placeholder={`Texto a buscar en ${columna.nombre}`} style={{ maxWidth: 360 }} />
        <span className="datos-nota" style={{ margin: 0 }}>{filas.length.toLocaleString('es-MX')} filas coinciden</span>
      </div>
    );
  }

  const usaSecundaria = herramienta === 'dispersion' || herramienta === 'tabla_dinamica';

  return (
    <div className="tarjeta datos-resultado transicion-contenido">
      <div className="datos-resultado-cabecera">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div className="icono-insignia icono-insignia-primario icono-insignia-sm"><Icono nombre={info.icono} tamano={18} /></div>
          <div style={{ minWidth: 0 }}>
            <h4 className="datos-resultado-titulo">{info.nombre} de {columna.nombre}</h4>
            <p className="datos-nota" style={{ margin: 0 }}>{info.ayuda}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {usaSecundaria && (
            <select value={secundaria?.campo ?? ''} onChange={e => onSecundaria(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
              aria-label={herramienta === 'dispersion' ? 'Columna del eje vertical' : 'Columna a resumir'}>
              <option value="">{herramienta === 'dispersion' ? 'Eje vertical...' : 'Sin columna a resumir'}</option>
              {opcionesSecundaria.map(c => <option key={c.campo} value={c.campo}>{c.nombre}</option>)}
            </select>
          )}
          <button className="aviso-cerrar" onClick={onCerrar} aria-label="Cerrar resultado"><Icono nombre="cerrar" tamano={18} /></button>
        </div>
      </div>
      {contenido}
    </div>
  );
}

function fmt(v: number, esFecha: boolean) {
  return esFecha ? formatoFecha(v) : formatoNumero(v);
}

function SinDatos({ texto }: { texto: string }) {
  return <div className="datos-aviso" style={{ margin: 0 }}><Icono nombre="info" tamano={16} />{texto}</div>;
}

function Cifras({ cifras }: { cifras: { etiqueta: string; valor: string }[] }) {
  return (
    <div className="datos-cifras">
      {cifras.map(c => (
        <div key={c.etiqueta} className="datos-cifra">
          <span className="datos-cifra-valor">{c.valor}</span>
          <span className="datos-cifra-etiqueta">{c.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function ResumenLinea({ resumen, esFecha }: { resumen: NonNullable<ReturnType<typeof resumir>>; esFecha: boolean }) {
  return (
    <p className="datos-nota">
      N: <strong>{resumen.n.toLocaleString('es-MX')}</strong> · Media: <strong>{fmt(resumen.media, esFecha)}</strong> · Mediana: <strong>{fmt(resumen.mediana, esFecha)}</strong>
      {!esFecha && <> · Desv. estándar: <strong>{formatoNumero(resumen.desviacion)}</strong></>} · P90: <strong>{fmt(resumen.p90, esFecha)}</strong>
    </p>
  );
}

function Leyenda({ elementos }: { elementos: { color: string; texto: string; tipo: 'barra' | 'linea' }[] }) {
  return (
    <div className="grafico-leyenda">
      {elementos.map(e => (
        <span key={e.texto}>
          <span className={`grafico-leyenda-marca ${e.tipo}`} style={{ background: e.color }} />
          {e.texto}
        </span>
      ))}
    </div>
  );
}

function formatVal(v: unknown, tipo: Columna['tipo']): string {
  if (v == null) return '';
  if (tipo === 'fecha') return formatoFecha(aNumero(v, 'fecha'));
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
