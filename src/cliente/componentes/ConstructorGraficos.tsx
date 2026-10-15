import { useEffect, useMemo, useRef, useState } from 'react';
import { api, EVENTO_VERIFICACION } from '../api.js';
import { Icono } from './ui/Iconos.js';
import type { NombreIcono } from './ui/Iconos.js';
import { Grafico, SinValores } from './Graficos.js';
import { FiltrosBarra } from './FiltrosBarra.js';
import { useSesion } from '../i18n.js';
import { registrarEvento } from '../eventos.js';
import { useEspina, agregarEvidencia } from '../espina.js';
import {
  ajustarSpec, calcular, columnasDe, CAMPO_EVENTOS, gruposPorDefecto, herramientaDe, MEDIDAS, necesitaCampoMedida,
  specInicial, tablaDatos, tituloSpec, TIPOS, TIPOS_SOLO_SOLICITUDES, TODOS_LOS_EVENTOS, valoresDistintos,
} from '../constructor.js';
import type { Contexto, Medida, Spec, TipoGrafico } from '../constructor.js';
import type { Columna } from '../analisis.js';
import type { DatosJuego } from '../datos.js';
import { eventosDe } from '../../compartido/expediente.js';

const ICONOS: Record<TipoGrafico, NombreIcono> = {
  pareto: 'pareto', pareto_eventos: 'eventos', pareto_etapas: 'etapas', pareto_comparativo: 'comparar', histograma: 'histograma',
  dispersion: 'dispersion', corrida: 'corrida', control: 'control', caja: 'caja', pivote: 'tabla',
};

// Columnas sí/no que también funcionan como números (proporción)
const BOOLEANAS = new Set(['tieneReproceso', 'rechazoBuroTrasReproceso', 'aprobadaSinTarjeta']);
// Texto libre o identificadores: no sirven como categoría ni como estrato
const NO_CATEGORICAS = new Set(['comments', 'comentarioCliente', 'id', 'applicationNum', 'customerNum', 'solicitudNum']);
const ESTRATOS_PREFERIDOS = ['branchNum', 'sucursalNum', 'state', 'estado', 'mes'];

// Verificaciones del modo completo: qué análisis respalda cada afirmación de los asesores
const MAPA_VERIFICACIONES: Record<string, { columnas: string[]; herramientas: string[] }> = {
  medianas_iguales: { columnas: ['ventanaCaptura', 'dateFirstInput', 'dateLastInput'], herramientas: ['histograma', 'carta_control', 'caja', 'pareto'] },
  errores_captura_interfaz: { columnas: ['comments', 'erroresCaptura'], herramientas: ['pareto', 'tabla_dinamica'] },
  trabajo_perdido_buro: { columnas: ['creditBureauRunDate', 'creditBureauResult', 'rechazoBuroTrasReproceso'], herramientas: ['pareto', 'tabla_dinamica', 'caja'] },
  error_captura_frecuente: { columnas: ['comments', 'erroresComentario', 'erroresCaptura'], herramientas: ['pareto', 'tabla_dinamica'] },
  atorados_sin_plastico: { columnas: ['lastStatus', 'datePlasticSent', 'aprobadaSinTarjeta'], herramientas: ['pareto', 'tabla_dinamica'] },
  concentracion_sucursales: { columnas: ['branchNum'], herramientas: ['pareto', 'tabla_dinamica', 'caja'] },
  secuencia_buro: { columnas: ['creditBureauRunDate', 'dateDocsSent', 'diasHastaBuro', 'rechazoBuroTrasReproceso'], herramientas: ['pareto', 'tabla_dinamica', 'histograma', 'caja'] },
  quejas_reproceso_documental: { columnas: ['categoriaPrimaria', 'categoriaQueja'], herramientas: ['pareto', 'tabla_dinamica'] },
};

interface Props {
  datos: DatosJuego;
  // Solo en modo completo: verificaciones y espina de pescado
  conEspina: boolean;
  onAgregarTablero?: (spec: Spec, titulo: string) => void;
  onAnalisis?: (herramienta: string) => void;
}

export function ConstructorGraficos({ datos, conEspina, onAgregarTablero, onAnalisis }: Props) {
  const { t } = useSesion();
  const [spec, setSpec] = useState<Spec>(() => specInicial());
  const [agregado, setAgregado] = useState(false);
  const verificadas = useRef<Set<string> | null>(null);
  const [registradas, setRegistradas] = useState<string[]>([]);

  const columnas = spec.tabla === 'solicitudes' ? datos.colsSolicitudes : datos.colsComentarios;
  const filas = spec.tabla === 'solicitudes' ? datos.solicitudes : datos.comentarios;
  const ctx: Contexto = useMemo(() => ({ columnas, t, vocabulario: datos.vocabulario }), [columnas, t, datos.vocabulario]);
  const cambiar = (c: Partial<Spec>) => { setSpec(s => ajustarSpec(s, c, columnas)); setAgregado(false); };

  const resultado = useMemo(() => calcular(filas, spec, ctx), [filas, spec, ctx]);
  const tabla = useMemo(() => (resultado ? tablaDatos(resultado, t) : null), [resultado, t]);
  const titulo = tituloSpec(spec, ctx);

  const categoricas = columnas.filter(c => !NO_CATEGORICAS.has(c.campo));
  const numericas = columnas.filter(c => c.tipo !== 'texto' || BOOLEANAS.has(c.campo));
  const soloNumeros = columnas.filter(c => c.tipo === 'numero' || BOOLEANAS.has(c.campo));
  const estratos = [...columnas.filter(c => ESTRATOS_PREFERIDOS.includes(c.campo)),
    ...columnas.filter(c => !ESTRATOS_PREFERIDOS.includes(c.campo) && !NO_CATEGORICAS.has(c.campo) && (c.tipo === 'texto'))];
  const tipos = TIPOS.filter(x => spec.tabla === 'solicitudes' || !TIPOS_SOLO_SOLICITUDES.includes(x));
  const esEventos = spec.tipo === 'pareto_eventos' || (spec.variable === CAMPO_EVENTOS && ['pareto', 'pareto_comparativo'].includes(spec.tipo));
  const usaMedida = ['pareto', 'pareto_comparativo', 'pareto_eventos', 'pivote'].includes(spec.tipo);
  const medidas: Medida[] = esEventos ? ['conteo', 'porcentaje', 'tasa'] : MEDIDAS;
  const aditiva = ['conteo', 'suma', 'porcentaje'].includes(spec.medida) || (esEventos && spec.medida !== 'tasa');

  // Registro del método y verificaciones: se espera un momento para no registrar cada clic intermedio
  useEffect(() => {
    if (!resultado) return;
    const id = window.setTimeout(() => {
      const herramienta = herramientaDe(spec.tipo);
      const variable = esEventos ? CAMPO_EVENTOS : spec.tipo === 'pareto_etapas' ? 'etapas' : spec.variable;
      const filtroEstrato = spec.filtros.find(f => ESTRATOS_PREFERIDOS.includes(f.campo));
      const estratoCampo = spec.estrato || filtroEstrato?.campo || '';
      registrarEvento('analisis', {
        hoja: spec.tabla,
        herramienta,
        tipo: spec.tipo,
        columna: variable,
        columnaNombre: titulo,
        secundaria: spec.variableY || null,
        medida: spec.medida,
        campoMedida: necesitaCampoMedida(spec.medida) ? spec.campoMedida : null,
        estrato: estratoCampo ? { campo: estratoCampo, nombre: columnas.find(c => c.campo === estratoCampo)?.nombre ?? estratoCampo, valor: filtroEstrato?.valor ?? null } : null,
        filtros: spec.filtros,
      });
      onAnalisis?.(herramienta);
      if (conEspina) verificar(herramienta, columnasDe(spec));
    }, 800);
    return () => window.clearTimeout(id);
  }, [spec]);

  async function verificar(herramienta: string, cols: string[]) {
    verificadas.current ??= new Set(await api.datos.verificaciones().catch(() => []));
    setRegistradas([...verificadas.current]);
    for (const [verifId, regla] of Object.entries(MAPA_VERIFICACIONES)) {
      if (verificadas.current.has(verifId)) continue;
      if (regla.herramientas.includes(herramienta) && cols.some(c => regla.columnas.includes(c))) {
        try {
          await api.datos.verificar(verifId, herramienta);
          verificadas.current.add(verifId);
          setRegistradas([...verificadas.current]);
          window.dispatchEvent(new CustomEvent(EVENTO_VERIFICACION, { detail: verifId }));
        } catch { /* la verificación es opcional para el análisis */ }
      }
    }
  }

  function agregar() {
    if (!onAgregarTablero) return;
    onAgregarTablero(spec, titulo);
    registrarEvento('analisis', { hoja: spec.tabla, herramienta: herramientaDe(spec.tipo), tipo: spec.tipo, columna: spec.variable, accion: 'tablero', columnaNombre: titulo });
    setAgregado(true);
  }

  const opcionCol = (c: Columna) => (
    <option key={c.campo} value={c.campo} title={c.calculada ? t('comun.calculada') : undefined}>{c.calculada ? `ƒ  ${c.nombre}` : c.nombre}</option>
  );

  return (
    <div className="constructor">
      <aside className="constructor-panel tarjeta" aria-label={t('constructor.titulo')}>
        <div className="segmentado" role="tablist" aria-label={t('constructor.tabla')}>
          {(['solicitudes', 'comentarios'] as const).map(x => (
            <button key={x} role="tab" aria-selected={spec.tabla === x} className={spec.tabla === x ? 'activo' : ''} onClick={() => cambiar({ tabla: x })}>
              {t(`tablas.${x}`)}
            </button>
          ))}
        </div>

        <div className="constructor-campo">
          <span className="campo-label">{t('constructor.tipo')}</span>
          <div className="constructor-tipos">
            {tipos.map(x => (
              <button key={x} className={`constructor-tipo ${spec.tipo === x ? 'activo' : ''}`} onClick={() => cambiar({ tipo: x })}
                title={t(`graficos.${x}.ayuda`)} aria-pressed={spec.tipo === x}>
                <Icono nombre={ICONOS[x]} tamano={18} />
                <span>{t(`graficos.${x}.corto`)}</span>
              </button>
            ))}
          </div>
        </div>

        {spec.tipo !== 'pareto_eventos' && spec.tipo !== 'pareto_etapas' && (
          <Campo etiqueta={t(spec.tipo === 'pivote' ? 'constructor.filas' : spec.tipo === 'dispersion' ? 'constructor.variable' : 'constructor.variable')}>
            <select value={spec.variable} onChange={e => cambiar({ variable: e.target.value })}>
              {['pareto', 'pareto_comparativo'].includes(spec.tipo) && spec.tabla === 'solicitudes' && (
                <option value={CAMPO_EVENTOS}>{t('graficos.pareto_eventos.nombre')}</option>
              )}
              {(['pareto', 'pareto_comparativo', 'pivote'].includes(spec.tipo) ? categoricas : spec.tipo === 'caja' ? soloNumeros : numericas).map(opcionCol)}
            </select>
          </Campo>
        )}

        {spec.tipo === 'dispersion' && (
          <Campo etiqueta={t('constructor.variableY')}>
            <select value={spec.variableY} onChange={e => cambiar({ variableY: e.target.value })}>
              {numericas.filter(c => c.campo !== spec.variable).map(opcionCol)}
            </select>
          </Campo>
        )}

        {usaMedida && (
          <Campo etiqueta={t('constructor.medida')}>
            <select value={spec.medida} onChange={e => cambiar({ medida: e.target.value as Medida })}>
              {medidas.map(m => <option key={m} value={m}>{t(`medidas.${m}`)}</option>)}
            </select>
            {necesitaCampoMedida(spec.medida) && !esEventos && (
              <select value={spec.campoMedida} onChange={e => cambiar({ campoMedida: e.target.value })} aria-label={t('constructor.campoMedida')} style={{ marginTop: 6 }}>
                {soloNumeros.map(opcionCol)}
              </select>
            )}
          </Campo>
        )}

        {spec.tipo !== 'pareto_etapas' && spec.tipo !== 'corrida' && spec.tipo !== 'control' && (
          <Campo etiqueta={t(spec.tipo === 'dispersion' ? 'constructor.colorear' : spec.tipo === 'caja' ? 'constructor.grupos' : spec.tipo === 'pivote' ? 'constructor.columnas' : 'constructor.estrato')}>
            <select value={spec.estrato} onChange={e => cambiar({ estrato: e.target.value })}>
              {!['caja', 'pareto_comparativo'].includes(spec.tipo) && <option value="">{t('constructor.sinEstrato')}</option>}
              {estratos.filter(c => c.campo !== spec.variable).map(opcionCol)}
            </select>
          </Campo>
        )}

        <Campo etiqueta={t('constructor.filtros')}>
          <FiltrosBarra filas={filas} columnas={categoricas} ctx={ctx} filtros={spec.filtros} onCambio={filtros => cambiar({ filtros })} />
        </Campo>

        <button className="btn-fantasma btn-sm" onClick={() => { setSpec(specInicial(spec.tabla)); setAgregado(false); }}>{t('constructor.reiniciar')}</button>
      </aside>

      <section className="constructor-resultado tarjeta">
        <div className="constructor-cabecera">
          <div style={{ minWidth: 0 }}>
            <h3 className="constructor-titulo">{titulo}</h3>
            <p className="datos-nota" style={{ margin: 0 }}>{t(`graficos.${spec.tipo}.ayuda`)}</p>
          </div>
          <div className="constructor-acciones">
            {conEspina && resultado && <AdjuntarEspina resumen={titulo} spec={spec} verificacionId={verificacionDe(spec, registradas)} />}
            {onAgregarTablero && (
              <button className="btn-primario btn-sm" onClick={agregar} disabled={!resultado}>
                <Icono nombre={agregado ? 'exito' : 'tablero'} tamano={16} />
                {t(agregado ? 'constructor.agregadoTablero' : 'constructor.agregarTablero')}
              </button>
            )}
          </div>
        </div>

        <Opciones spec={spec} cambiar={cambiar} ctx={ctx} filas={filas} esEventos={esEventos} aditiva={aditiva} estratos={estratos} />

        <div className="constructor-grafico">
          {resultado ? <Grafico r={resultado} formatoCondicional={spec.formatoCondicional} />
            : <SinValores texto={t(['caja', 'pareto_comparativo'].includes(spec.tipo) && !spec.estrato ? 'graficos.necesitaEstrato' : 'graficos.sinValores')} />}
          {resultado?.clase === 'pareto' && resultado.excluidas > 0 && (
            <p className="datos-nota">{t('graficos.excluidas', { n: resultado.excluidas, min: spec.minSolicitudes })}</p>
          )}
        </div>

        {tabla && resultado?.clase !== 'pivote' && (
          <details className="constructor-datos">
            <summary>{t('constructor.datosGrafico')} ({tabla.filas.length})</summary>
            <div className="datos-pivote">
              <table className="datos">
                <thead><tr>{tabla.columnas.map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>{tabla.filas.slice(0, 500).map((f, i) => <tr key={i}>{f.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

// Verificación registrada que respalda este análisis, para adjuntarla como evidencia
function verificacionDe(spec: Spec, registradas: string[]): string | null {
  const herramienta = herramientaDe(spec.tipo);
  const cols = columnasDe(spec);
  for (const [id, regla] of Object.entries(MAPA_VERIFICACIONES)) {
    if (registradas.includes(id) && regla.herramientas.includes(herramienta) && cols.some(c => regla.columnas.includes(c))) return id;
  }
  return null;
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="constructor-campo">
      <span className="campo-label">{etiqueta}</span>
      {children}
    </label>
  );
}

// Opciones propias de cada tipo de gráfico, en una sola fila sobre el gráfico
function Opciones({ spec, cambiar, ctx, filas, esEventos, aditiva, estratos }: {
  spec: Spec; cambiar: (c: Partial<Spec>) => void; ctx: Contexto; filas: DatosJuego['solicitudes']; esEventos: boolean; aditiva: boolean; estratos: Columna[];
}) {
  const { t } = ctx;
  const esPareto = ['pareto', 'pareto_comparativo', 'pareto_eventos'].includes(spec.tipo);
  const valoresEstrato = useMemo(() => (spec.estrato ? valoresDistintos(filas, spec.estrato, ctx) : []), [filas, spec.estrato, ctx]);
  const eventosDisponibles = eventosDe(ctx.vocabulario).map(e => e.tipo).filter(e => TODOS_LOS_EVENTOS.includes(e));
  const elementos: React.ReactNode[] = [];

  if (esPareto && !esEventos) {
    elementos.push(
      <label key="top" className="opcion">{t('constructor.topN')}
        <select value={spec.topN} onChange={e => cambiar({ topN: Number(e.target.value) })}>
          {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
          <option value={0}>{t('constructor.todas')}</option>
        </select>
      </label>,
    );
  }
  if ((esPareto || spec.tipo === 'pareto_etapas') && aditiva) {
    elementos.push(
      <label key="80" className="opcion opcion-casilla">
        <input type="checkbox" className="casilla" checked={spec.linea80} onChange={e => cambiar({ linea80: e.target.checked })} />{t('graficos.linea80')}
      </label>,
    );
  }
  if ((esPareto && !aditiva && !esEventos) || spec.tipo === 'caja') {
    elementos.push(
      <label key="min" className="opcion">{t(spec.tipo === 'caja' ? 'constructor.minSolicitudesGrupo' : 'constructor.minSolicitudes')}
        <input type="number" min={1} max={50} value={spec.minSolicitudes} onChange={e => cambiar({ minSolicitudes: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 64 }} />
      </label>,
    );
  }
  if (esEventos) {
    elementos.push(
      <fieldset key="ev" className="opcion opcion-eventos">
        <legend>{t('constructor.eventosIncluir')}</legend>
        {(['errores', 'cierres'] as const).map(g => (
          <span key={g} className="opcion-eventos-grupo">
            <strong>{t(`eventos.${g}`)}</strong>
            {eventosDisponibles.filter(e => (g === 'errores') === ['captura', 'incompletos', 'ilegibles', 'otros'].includes(e)).map(e => (
              <label key={e} className="opcion-casilla">
                <input type="checkbox" className="casilla" checked={spec.eventos.includes(e)}
                  onChange={x => cambiar({ eventos: x.target.checked ? [...spec.eventos, e] : spec.eventos.filter(y => y !== e) })} />
                {t(`eventos.${e}`)}
              </label>
            ))}
          </span>
        ))}
      </fieldset>,
    );
  }
  if (spec.tipo === 'pareto_comparativo' || (spec.tipo === 'pareto' && spec.estrato) || (spec.tipo === 'pareto_eventos' && spec.estrato)) {
    const elegidos = spec.valoresComparar.length ? spec.valoresComparar : gruposPorDefecto(filas, spec.estrato, ctx);
    elementos.push(
      <label key="cmp" className="opcion">{t('constructor.valoresComparar')}
        <span className="opcion-chips">
          {valoresEstrato.slice(0, 400).length > 0 && elegidos.map(v => (
            <button key={v} className="chip" onClick={() => cambiar({ valoresComparar: elegidos.filter(x => x !== v) })} title={t('constructor.quitarFiltro')}>
              {v}<Icono nombre="cerrar" tamano={12} />
            </button>
          ))}
          {elegidos.length < 3 && (
            <select value="" onChange={e => e.target.value && cambiar({ valoresComparar: [...elegidos, e.target.value] })} aria-label={t('constructor.agregarFiltro')}>
              <option value="">+</option>
              {[...valoresEstrato].sort((a, b) => b.n - a.n).filter(v => !elegidos.includes(v.valor)).map(v => <option key={v.valor} value={v.valor}>{v.valor} ({v.n})</option>)}
            </select>
          )}
        </span>
      </label>,
    );
  }
  if (spec.tipo === 'pareto_etapas') {
    elementos.push(
      <label key="est" className="opcion">{t('constructor.estadistico')}
        <select value={spec.estadistico} onChange={e => cambiar({ estadistico: e.target.value as Spec['estadistico'] })}>
          <option value="mediana">{t('graficos.mediana')}</option>
          <option value="media">{t('graficos.media')}</option>
        </select>
      </label>,
    );
  }
  if (spec.tipo === 'histograma') {
    elementos.push(
      <label key="int" className="opcion">{t('constructor.intervalos')}
        <select value={spec.intervalos} onChange={e => cambiar({ intervalos: Number(e.target.value) })}>
          <option value={0}>{t('constructor.auto')}</option>
          {[5, 8, 10, 12, 15, 20, 25, 30].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>,
    );
    if (spec.estrato) {
      elementos.push(
        <label key="grp" className="opcion">{t('constructor.comparar')}
          <select value={spec.grupoValor} onChange={e => cambiar({ grupoValor: e.target.value })}>
            <option value="">{t('constructor.sinEstrato')}</option>
            {valoresEstrato.map(v => <option key={v.valor} value={v.valor}>{v.valor} ({v.n})</option>)}
          </select>
          {spec.grupoValor && <span>{t('constructor.compararContra')}</span>}
        </label>,
      );
    }
  }
  if (spec.tipo === 'control') {
    elementos.push(
      <label key="per" className="opcion">{t('constructor.periodo')}
        <select value={spec.periodo} onChange={e => cambiar({ periodo: e.target.value as Spec['periodo'] })}>
          <option value="mes">{t('graficos.mes')}</option>
          <option value="semana">{t('graficos.semana')}</option>
        </select>
      </label>,
    );
  }
  if (spec.tipo === 'pivote') {
    elementos.push(
      <label key="fc" className="opcion opcion-casilla">
        <input type="checkbox" className="casilla" checked={spec.formatoCondicional} onChange={e => cambiar({ formatoCondicional: e.target.checked })} />{t('constructor.formatoCondicional')}
      </label>,
    );
  }
  void estratos;
  return elementos.length ? <div className="constructor-opciones">{elementos}</div> : null;
}

// Guarda el gráfico como evidencia y, si se elige, lo adjunta a una causa de la espina
function AdjuntarEspina({ resumen, spec, verificacionId }: { resumen: string; spec: Spec; verificacionId: string | null }) {
  const { t } = useSesion();
  const espina = useEspina();
  const [abierto, setAbierto] = useState(false);
  const [hecho, setHecho] = useState(false);
  const estrato = spec.estrato || spec.filtros.map(f => `${f.valor}`).join(', ');

  function adjuntar(tarjetaId?: string) {
    agregarEvidencia({ herramienta: herramientaDe(spec.tipo), hoja: spec.tabla, columna: spec.variable, resumen, estrato: estrato || null, verificacionId }, tarjetaId);
    setAbierto(false);
    setHecho(true);
    window.setTimeout(() => setHecho(false), 2500);
  }

  return (
    <div className="adjuntar-espina" data-tour="adjuntar-espina">
      <button className="btn-fantasma btn-sm" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <Icono nombre={hecho ? 'exito' : 'diagnostico'} tamano={16} />{t('constructor.adjuntarEspina')}
      </button>
      {abierto && (
        <div className="adjuntar-espina-menu" role="menu">
          <p className="datos-nota" style={{ margin: '0 0 6px' }}>{resumen}</p>
          {espina.tarjetas.map(x => <button key={x.id} role="menuitem" onClick={() => adjuntar(x.id)}>{x.texto}</button>)}
          <button role="menuitem" onClick={() => adjuntar()}>{t('espina.sinCausa')}</button>
        </div>
      )}
    </div>
  );
}
