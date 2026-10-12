import { useState, useEffect, useMemo } from 'react';
import { api, EVENTO_VERIFICACION } from '../api.js';
import { Icono } from './ui/Iconos.js';
import type { NombreIcono } from './ui/Iconos.js';
import { Histograma, Pareto, Corrida, Dispersion, CartaControl } from './Graficos.js';
import { VistaProceso } from './VistaProceso.js';
import { useEspina, agregarEvidencia } from '../espina.js';
import { registrarEvento } from '../eventos.js';
import {
  agregarCalculadas, COLUMNAS_CALCULADAS, COLUMNAS_CRUCE_COMENTARIOS, ESTRATOS, cartaControl, contarCategorias, correlacion, cruzar,
  formatoFecha, formatoNumero, histograma, pareto, pares, pivote, resumir, valoresEstrato, valoresNumericos, aNumero,
} from '../analisis.js';
import type { Columna, Fila } from '../analisis.js';

export type IdHerramienta = 'histograma' | 'pareto' | 'diagrama_corrida' | 'carta_control' | 'dispersion' | 'tabla_dinamica' | 'filtro' | 'contar' | 'sumar' | 'estadisticas';

const HERRAMIENTAS: { id: IdHerramienta; nombre: string; icono: NombreIcono; ayuda: string }[] = [
  { id: 'histograma', nombre: 'Histograma', icono: 'histograma', ayuda: 'Distribución de una columna numérica o de fechas' },
  { id: 'pareto', nombre: 'Pareto', icono: 'pareto', ayuda: 'Categorías más frecuentes y su porcentaje acumulado' },
  { id: 'diagrama_corrida', nombre: 'Corrida', icono: 'corrida', ayuda: 'Valores en orden de captura contra su mediana' },
  { id: 'carta_control', nombre: 'Control', icono: 'grafica', ayuda: 'Media por mes con límites de control a 3 sigmas' },
  { id: 'dispersion', nombre: 'Dispersión', icono: 'dispersion', ayuda: 'Relación entre dos columnas numéricas' },
  { id: 'tabla_dinamica', nombre: 'Pivote', icono: 'tabla', ayuda: 'Agrupa por la columna y resume otra' },
  { id: 'filtro', nombre: 'Filtrar', icono: 'filtro', ayuda: 'Muestra solo las filas que contienen un texto' },
  { id: 'contar', nombre: 'Contar', icono: 'contar', ayuda: 'Frecuencia de cada valor' },
  { id: 'sumar', nombre: 'Sumar', icono: 'sumar', ayuda: 'Suma de una columna numérica' },
  { id: 'estadisticas', nombre: 'Estadísticas', icono: 'estadisticas', ayuda: 'Media, mediana, desviación y percentiles' },
];

const MAPA_VERIFICACIONES: Record<string, { columnas: string[]; herramientas: IdHerramienta[] }> = {
  medianas_iguales: { columnas: ['ventanaCaptura', 'dateFirstInput', 'dateLastInput'], herramientas: ['estadisticas', 'histograma', 'carta_control'] },
  errores_captura_interfaz: { columnas: ['comments'], herramientas: ['contar', 'filtro'] },
  trabajo_perdido_buro: { columnas: ['creditBureauRunDate', 'creditBureauResult'], herramientas: ['sumar', 'contar'] },
  error_captura_frecuente: { columnas: ['comments', 'erroresComentario'], herramientas: ['contar', 'pareto'] },
  atorados_sin_plastico: { columnas: ['lastStatus', 'datePlasticSent'], herramientas: ['contar', 'filtro'] },
  concentracion_sucursales: { columnas: ['branchNum', 'comments'], herramientas: ['pareto', 'tabla_dinamica'] },
  secuencia_buro: { columnas: ['creditBureauRunDate', 'dateDocsSent'], herramientas: ['sumar', 'filtro'] },
  quejas_reproceso_documental: { columnas: ['categoriaPrimaria', 'categoriaQueja'], herramientas: ['pareto', 'contar'] },
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
  const [tab, setTab] = useState<'solicitudes' | 'comentarios' | 'proceso'>('solicitudes');
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
  const [estratoCampo, setEstratoCampo] = useState('');
  const [estratoValor, setEstratoValor] = useState('');

  useEffect(() => {
    async function cargar() {
      try {
        const [sol, com, cols, verifs] = await Promise.all([
          api.datos.solicitudes(),
          api.datos.comentarios(),
          api.datos.columnas(),
          api.datos.verificaciones(),
        ]);
        const cruce = cruzar(agregarCalculadas(sol), com);
        setSolicitudes(cruce.solicitudes);
        setComentarios(cruce.comentarios);
        setColsSolicitudes([...(cols.solicitudes ?? []), ...COLUMNAS_CALCULADAS]);
        setColsComentarios([...(cols.comentarios ?? []), ...COLUMNAS_CRUCE_COMENTARIOS]);
        setVerificaciones(verifs);
      } catch (err: any) {
        setErrorCarga(err.message || 'No se pudieron cargar los datos');
      }
      setCargando(false);
    }
    cargar();
  }, []);

  // La vista del proceso se calcula sobre las solicitudes
  const hoja = tab === 'comentarios' ? 'comentarios' : 'solicitudes';
  const cols = hoja === 'solicitudes' ? colsSolicitudes : colsComentarios;
  const filas = hoja === 'solicitudes' ? solicitudes : comentarios;
  const columna = cols.find(c => c.campo === colSeleccionada) ?? null;
  const numericas = cols.filter(c => c.tipo !== 'texto');

  const estratos = ESTRATOS[hoja];
  const opcionesEstrato = useMemo(() => estratoCampo ? valoresEstrato(filas, estratoCampo) : [], [filas, estratoCampo]);
  const estratoActivo = estratoCampo && estratoValor ? { campo: estratoCampo, valor: estratoValor, nombre: estratos.find(e => e.campo === estratoCampo)?.nombre ?? estratoCampo } : null;

  const datosFiltrados = useMemo(() => {
    let datos = filas;
    if (estratoActivo) datos = datos.filter(r => String(r[estratoActivo.campo] ?? '') === estratoActivo.valor);
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
  }, [filas, filtroCol, filtroVal, ordenCol, ordenAsc, estratoCampo, estratoValor]);

  function cambiarTab(t: 'solicitudes' | 'comentarios' | 'proceso') {
    setTab(t);
    registrarEvento('vista', { vista: t });
    setColSeleccionada('');
    setColSecundaria('');
    setHerramienta(null);
    setFiltroCol('');
    setFiltroVal('');
    setOrdenCol('');
    setLimite(FILAS_POR_PAGINA);
    setEstratoCampo('');
    setEstratoValor('');
  }

  // Cada análisis que el participante ve (herramienta, columnas, estrato y filtro) queda registrado.
  // Se espera un momento para no registrar cada tecla del filtro.
  useEffect(() => {
    if (!herramienta || !colSeleccionada || tab === 'proceso') return;
    const id = window.setTimeout(() => registrarEvento('analisis', {
      hoja,
      herramienta,
      columna: colSeleccionada,
      columnaNombre: columna?.nombre ?? colSeleccionada,
      secundaria: colSecundaria || null,
      estrato: estratoActivo ? { campo: estratoActivo.campo, nombre: estratoActivo.nombre, valor: estratoActivo.valor } : null,
      filtro: filtroCol && filtroVal ? { columna: filtroCol, valor: filtroVal } : null,
    }), 700);
    return () => window.clearTimeout(id);
  }, [herramienta, colSeleccionada, colSecundaria, estratoCampo, estratoValor, filtroCol, filtroVal, tab]);

  function ordenar(campo: string) {
    if (ordenCol === campo) setOrdenAsc(!ordenAsc);
    else { setOrdenCol(campo); setOrdenAsc(true); }
  }

  function cerrarHerramienta() {
    setHerramienta(null);
    if (herramienta === 'filtro') { setFiltroCol(''); setFiltroVal(''); }
  }

  // Doble clic sobre la columna ya seleccionada la deselecciona y cierra la herramienta abierta
  function alternarColumna(campo: string) {
    if (colSeleccionada !== campo) { elegirColumna(campo); return; }
    setColSeleccionada('');
    setAviso('');
    cerrarHerramienta();
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
          window.dispatchEvent(new CustomEvent(EVENTO_VERIFICACION, { detail: verifId }));
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
        <button data-tour="tab-comentarios" className={`tab ${tab === 'comentarios' ? 'activo' : ''}`} onClick={() => cambiarTab('comentarios')}>
          Comentarios ({comentarios.length})
        </button>
        <button data-tour="tab-proceso" className={`tab ${tab === 'proceso' ? 'activo' : ''}`} onClick={() => cambiarTab('proceso')}>
          Proceso (Anexo 1)
        </button>
      </div>

      <div className="datos-controles">
        {tab !== 'proceso' && <div className="datos-columna">
          <label className="campo-label" htmlFor="col-analisis">Columna</label>
          <select id="col-analisis" value={colSeleccionada} onChange={e => elegirColumna(e.target.value)}>
            <option value="">Elige una columna...</option>
            {cols.map(c => <option key={c.campo} value={c.campo}>{c.nombre}</option>)}
          </select>
        </div>}
        <div className="datos-columna">
          <label className="campo-label" htmlFor="estrato-campo">Estratificar por</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select id="estrato-campo" value={estratoCampo} onChange={e => { setEstratoCampo(e.target.value); setEstratoValor(''); }}>
              <option value="">Sin estratificar</option>
              {estratos.map(e => <option key={e.campo} value={e.campo}>{e.nombre}</option>)}
            </select>
            {estratoCampo && (
              <select aria-label="Valor del estrato" value={estratoValor} onChange={e => setEstratoValor(e.target.value)}>
                <option value="">Todos</option>
                {opcionesEstrato.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
        </div>
        {tab !== 'proceso' && <div data-tour="herramientas" className="datos-herramientas">
          {HERRAMIENTAS.map(h => (
            <button key={h.id} className={`herramienta-btn ${herramienta === h.id ? 'activa' : ''} ${herramientasUsadas.has(h.id) ? 'usada' : ''}`}
              onClick={() => aplicarHerramienta(h.id)} title={h.ayuda} aria-pressed={herramienta === h.id}>
              <Icono nombre={h.icono} tamano={18} />
              {h.nombre}
            </button>
          ))}
        </div>}
      </div>

      {tab === 'proceso' && (
        <VistaProceso filas={datosFiltrados} estrato={estratoActivo ? `${estratoActivo.nombre} ${estratoActivo.valor}` : ''}
          onEtapa={etapa => registrarEvento('proceso_etapa', { etapa, estrato: estratoActivo ? { campo: estratoActivo.campo, nombre: estratoActivo.nombre, valor: estratoActivo.valor } : null })} />
      )}

      {tab !== 'proceso' && aviso && <div className="datos-aviso" role="status"><Icono nombre="info" tamano={16} />{aviso}</div>}

      {tab !== 'proceso' && herramienta && columna && (
        <PanelResultado
          herramienta={herramienta}
          columna={columna}
          secundaria={cols.find(c => c.campo === colSecundaria) ?? null}
          opcionesSecundaria={numericas.filter(c => c.campo !== columna.campo)}
          onSecundaria={setColSecundaria}
          filas={datosFiltrados}
          estrato={estratoActivo ? `${estratoActivo.nombre} ${estratoActivo.valor}` : ''}
          verificacionId={verificacionDe(herramienta, columna.campo, verificaciones)}
          hoja={hoja}
          filtroVal={filtroVal}
          onFiltro={setFiltroVal}
          onCerrar={cerrarHerramienta}
        />
      )}

      {verificaciones.length > 0 && (
        <div style={{ marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-texto-secundario)' }}>Verificaciones:</span>
          {verificaciones.map(v => <span key={v} className="badge badge-exito">{v}</span>)}
        </div>
      )}

      {tab !== 'proceso' && <div className="tarjeta datos-tabla">
        <div className="datos-tabla-scroll">
          <table className="datos">
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.campo}
                    onClick={() => ordenar(c.campo)}
                    onDoubleClick={() => alternarColumna(c.campo)}
                    title={colSeleccionada === c.campo
                      ? 'Clic para ordenar. Doble clic para quitar la selección.'
                      : 'Clic para ordenar. Doble clic para analizar esta columna.'}
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
      </div>}
    </div>
  );
}

// Verificación registrada que respalda este análisis, para adjuntarla como evidencia
function verificacionDe(herramienta: IdHerramienta, campo: string, registradas: string[]): string | null {
  for (const [id, regla] of Object.entries(MAPA_VERIFICACIONES)) {
    if (registradas.includes(id) && regla.columnas.includes(campo) && regla.herramientas.includes(herramienta)) return id;
  }
  return null;
}

function PanelResultado({ herramienta, columna, secundaria, opcionesSecundaria, onSecundaria, filas, estrato, verificacionId, hoja, filtroVal, onFiltro, onCerrar }: {
  herramienta: IdHerramienta;
  columna: Columna;
  secundaria: Columna | null;
  opcionesSecundaria: Columna[];
  onSecundaria: (campo: string) => void;
  filas: Fila[];
  estrato: string;
  verificacionId: string | null;
  hoja: string;
  filtroVal: string;
  onFiltro: (v: string) => void;
  onCerrar: () => void;
}) {
  const info = HERRAMIENTAS.find(h => h.id === herramienta)!;
  const esFecha = columna.tipo === 'fecha';
  const nums = useMemo(() => valoresNumericos(filas, columna), [filas, columna]);
  const resumen = useMemo(() => resumir(nums), [nums]);
  const requiereNumero = herramienta === 'histograma' || herramienta === 'diagrama_corrida' || herramienta === 'carta_control' || herramienta === 'dispersion'
    || herramienta === 'sumar' || herramienta === 'estadisticas';

  let contenido: React.ReactNode;
  // Cifra principal del resultado, para describir la evidencia en la espina
  let dato = '';

  if (requiereNumero && columna.tipo === 'texto') {
    contenido = <SinDatos texto={`"${columna.nombre}" es una columna de texto. Para ${info.nombre.toLowerCase()} elige una columna numérica o de fechas, o usa Pareto, Contar o Pivote.`} />;
  } else if (herramienta === 'histograma') {
    if (resumen) dato = `mediana ${fmt(resumen.mediana, esFecha)}, P90 ${fmt(resumen.p90, esFecha)}`;
    contenido = (
      <>
        <Histograma bins={histograma(nums, esFecha)} resumen={resumen} esFecha={esFecha} />
        {resumen && <ResumenLinea resumen={resumen} esFecha={esFecha} />}
      </>
    );
  } else if (herramienta === 'pareto') {
    const barras = pareto(contarCategorias(filas, columna));
    if (barras[0]) dato = `principal: ${barras[0].etiqueta} (${barras[0].conteo}, ${formatoNumero(barras[0].pct, 1)}%)`;
    contenido = barras.length === 0 ? <SinDatos texto="No hay valores para graficar." /> : (
      <>
        <Leyenda elementos={[{ color: '#2563a8', texto: '% de cada categoría', tipo: 'barra' }, { color: '#b7791f', texto: '% acumulado', tipo: 'linea' }]} />
        <Pareto barras={barras} />
      </>
    );
  } else if (herramienta === 'diagrama_corrida') {
    const ordenadas = [...filas].sort((a, b) => (aNumero(a['dateFirstInput'], 'fecha') ?? 0) - (aNumero(b['dateFirstInput'], 'fecha') ?? 0));
    const serie = valoresNumericos(ordenadas, columna);
    if (resumen) dato = `mediana ${fmt(resumen.mediana, esFecha)}`;
    contenido = resumen ? <Corrida valores={serie} mediana={resumen.mediana} esFecha={esFecha} /> : <SinDatos texto="No hay valores para graficar." />;
  } else if (herramienta === 'carta_control') {
    const carta = esFecha ? null : cartaControl(filas, columna);
    const fuera = carta?.puntos.filter(p => p.fuera).length ?? 0;
    if (carta) dato = `media ${formatoNumero(carta.centro)}, ${fuera} ${fuera === 1 ? 'mes fuera' : 'meses fuera'} de control`;
    contenido = !carta ? <SinDatos texto={esFecha ? 'La gráfica de control necesita una columna numérica, no de fechas.' : 'No hay valores por mes para graficar.'} /> : (
      <>
        <CartaControl carta={carta} />
        <p className="datos-nota">
          Media general: <strong>{formatoNumero(carta.centro)}</strong> · Desv. estándar: <strong>{formatoNumero(carta.sigma)}</strong> ·
          {' '}{fuera === 0 ? 'Todos los meses dentro de los límites.' : <strong>{fuera} {fuera === 1 ? 'mes fuera' : 'meses fuera'} de control.</strong>}
        </p>
      </>
    );
  } else if (herramienta === 'dispersion') {
    if (!secundaria) {
      contenido = <SinDatos texto="Elige la columna del eje vertical." />;
    } else {
      const ps = pares(filas, columna, secundaria);
      const r = correlacion(ps.map(p => p.x), ps.map(p => p.y));
      dato = `contra ${secundaria.nombre}, r = ${Number.isFinite(r) ? r.toFixed(3) : '-'}`;
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
    if (filasPiv[0]) dato = `mayor grupo: ${filasPiv[0].grupo} (${filasPiv[0].conteo}, ${formatoNumero(filasPiv[0].pct, 1)}%)`;
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
    if (cats[0]) dato = `más frecuente: ${cats[0].etiqueta} (${cats[0].conteo} de ${total})`;
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
    if (!esFecha) dato = `suma ${formatoNumero(nums.reduce((a, b) => a + b, 0))}`;
    contenido = esFecha
      ? <SinDatos texto="Las fechas no se pueden sumar. Usa Histograma o Estadísticas." />
      : <Cifras cifras={[{ etiqueta: `Suma de ${columna.nombre}`, valor: formatoNumero(nums.reduce((a, b) => a + b, 0)) }, { etiqueta: 'Registros con valor', valor: nums.length.toLocaleString('es-MX') }]} />;
  } else if (herramienta === 'estadisticas') {
    if (resumen) dato = `media ${fmt(resumen.media, esFecha)}, mediana ${fmt(resumen.mediana, esFecha)}, P90 ${fmt(resumen.p90, esFecha)}`;
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
    if (filtroVal) dato = `${filas.length} filas contienen "${filtroVal}"`;
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
            <h4 className="datos-resultado-titulo">{info.nombre} de {columna.nombre}{estrato && ` · ${estrato}`}</h4>
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
          <AdjuntarEspina resumen={`${info.nombre} de ${columna.nombre}${estrato ? ` (${estrato})` : ''}${dato ? `: ${dato}` : ''}`}
            herramienta={herramienta} hoja={hoja} columna={columna.campo} estrato={estrato} verificacionId={verificacionId} />
          <button className="aviso-cerrar" onClick={onCerrar} aria-label="Cerrar resultado"><Icono nombre="cerrar" tamano={18} /></button>
        </div>
      </div>
      {contenido}
    </div>
  );
}

// Guarda el resultado como evidencia y, si se elige, lo adjunta a una causa de la espina
function AdjuntarEspina({ resumen, herramienta, hoja, columna, estrato, verificacionId }: {
  resumen: string; herramienta: string; hoja: string; columna: string; estrato: string; verificacionId: string | null;
}) {
  const espina = useEspina();
  const [abierto, setAbierto] = useState(false);
  const [hecho, setHecho] = useState('');

  function adjuntar(tarjetaId?: string) {
    agregarEvidencia({ herramienta, hoja, columna, resumen, estrato: estrato || null, verificacionId }, tarjetaId);
    setAbierto(false);
    setHecho(tarjetaId ? 'Adjuntada a la causa' : 'Guardada como evidencia');
    window.setTimeout(() => setHecho(''), 2500);
  }

  return (
    <div className="adjuntar-espina" data-tour="adjuntar-espina">
      <button className="btn-fantasma btn-sm" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        {hecho || 'Adjuntar a la espina'}
      </button>
      {abierto && (
        <div className="adjuntar-espina-menu" role="menu">
          <p className="datos-nota" style={{ margin: '0 0 6px' }}>{resumen}</p>
          {espina.tarjetas.map(t => (
            <button key={t.id} role="menuitem" onClick={() => adjuntar(t.id)}>{t.texto}</button>
          ))}
          <button role="menuitem" onClick={() => adjuntar()}>Guardar sin asignar a una causa</button>
        </div>
      )}
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
