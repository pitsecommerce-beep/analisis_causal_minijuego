import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icono } from './ui/Iconos.js';
import { useUI } from './ui/Notificaciones.js';
import { Grafico, SinValores } from './Graficos.js';
import { useSesion } from '../i18n.js';
import { calcular, specInicial } from '../constructor.js';
import type { Contexto, Spec } from '../constructor.js';
import { accionesTablero, cargarTablero, enOrdenA3, useTablero } from '../tablero.js';
import { exportarPNG, nombreArchivo } from '../exportar.js';
import { SECCIONES_A3, TEXTOS_A3 } from '../../compartido/tablero.js';
import type { GraficoTablero, SeccionA3, Tablero } from '../../compartido/tablero.js';
import type { DatosJuego } from '../datos.js';
import { formatoFecha } from '../analisis.js';

// Pestaña del participante: tablero editable que se guarda solo
export function TabTablero({ datos, nombreEquipo, onIrAnalisis }: { datos: DatosJuego; nombreEquipo: string; onIrAnalisis: () => void }) {
  const { t } = useSesion();
  const { tablero, cargado, error, guardando, errorGuardar } = useTablero();
  useEffect(() => { cargarTablero(); }, []);

  if (error) {
    return (
      <div className="alerta-error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        {t('comun.errorCarga')}
        <button className="btn-fantasma btn-sm" onClick={() => cargarTablero()}>{t('comun.reintentar')}</button>
      </div>
    );
  }
  if (!cargado) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <VistaTablero tablero={tablero} datos={datos} nombreEquipo={nombreEquipo} editable onIrAnalisis={onIrAnalisis}
      estado={errorGuardar ? (
        <span className="tablero-estado error">{t('tablero.errorGuardar')} <button className="btn-fantasma btn-sm" onClick={accionesTablero.reintentarGuardado}>{t('comun.reintentar')}</button></span>
      ) : <span className="tablero-estado">{guardando ? t('tablero.guardando') : t('tablero.guardado')}</span>} />
  );
}

export function VistaTablero({ tablero, datos, nombreEquipo, editable, onIrAnalisis, estado }: {
  tablero: Tablero; datos: DatosJuego; nombreEquipo: string; editable: boolean; onIrAnalisis?: () => void; estado?: React.ReactNode;
}) {
  const { t } = useSesion();
  const [proyectando, setProyectando] = useState<number | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const ordenados = enOrdenA3(tablero.graficos);

  return (
    <div className="tablero">
      <div className="tablero-cabecera">
        <div>
          <h2 className="tablero-titulo">{editable ? t('tablero.titulo') : nombreEquipo}</h2>
          {editable && <p className="datos-nota" style={{ margin: 0 }}>{t('tablero.ayuda')}</p>}
        </div>
        <div className="constructor-acciones">
          {estado}
          <button className="btn-fantasma btn-sm" onClick={() => setProyectando(0)} disabled={ordenados.length === 0}>
            <Icono nombre="proyectar" tamano={16} />{t('tablero.proyectar')}
          </button>
          <button className="btn-primario btn-sm" onClick={() => setImprimiendo(true)} disabled={ordenados.length === 0 && !Object.values(tablero.textos).some(Boolean)}>
            <Icono nombre="descargar" tamano={16} />{t('tablero.descargarPdf')}
          </button>
        </div>
      </div>

      <TextosA3 tablero={tablero} editable={editable} />

      {ordenados.length === 0 ? (
        <div className="tarjeta tablero-vacio">
          <Icono nombre="tablero" tamano={28} />
          <p><strong>{t('tablero.vacio')}</strong></p>
          {editable && <p className="datos-nota">{t('tablero.vacioAccion')}</p>}
          {onIrAnalisis && <button className="btn-primario btn-sm" onClick={onIrAnalisis}>{t('tablero.irAnalisis')}</button>}
        </div>
      ) : SECCIONES_A3.map(sec => {
        const deSeccion = ordenados.filter(g => g.seccion === sec);
        if (deSeccion.length === 0) return null;
        return (
          <section key={sec} className="tablero-seccion">
            <h3 className="tablero-seccion-titulo">{t(`tablero.secciones.${sec}`)}</h3>
            {deSeccion.map(g => (
              <TarjetaGrafico key={g.id} g={g} datos={datos} editable={editable}
                primero={deSeccion[0]?.id === g.id} ultimo={deSeccion[deSeccion.length - 1]?.id === g.id}
                onProyectar={() => setProyectando(ordenados.indexOf(g))} />
            ))}
          </section>
        );
      })}

      {proyectando != null && <Proyeccion graficos={ordenados} inicio={proyectando} datos={datos} onCerrar={() => setProyectando(null)} />}
      {imprimiendo && <ImpresionA3 tablero={tablero} datos={datos} nombreEquipo={nombreEquipo} onTerminar={() => setImprimiendo(false)} />}
    </div>
  );
}

function useResultado(g: GraficoTablero, datos: DatosJuego) {
  const { t } = useSesion();
  return useMemo(() => {
    const spec = { ...specInicial(), ...g.spec } as Spec;
    const columnas = spec.tabla === 'comentarios' ? datos.colsComentarios : datos.colsSolicitudes;
    const filas = spec.tabla === 'comentarios' ? datos.comentarios : datos.solicitudes;
    const ctx: Contexto = { columnas, t, vocabulario: datos.vocabulario };
    try {
      return { spec, resultado: calcular(filas, spec, ctx) };
    } catch {
      return { spec, resultado: null };
    }
  }, [g.spec, datos, t]);
}

function TarjetaGrafico({ g, datos, editable, primero, ultimo, onProyectar }: {
  g: GraficoTablero; datos: DatosJuego; editable: boolean; primero: boolean; ultimo: boolean; onProyectar: () => void;
}) {
  const { t } = useSesion();
  const { confirmar } = useUI();
  const ref = useRef<HTMLDivElement>(null);
  const { spec, resultado } = useResultado(g, datos);

  async function eliminar() {
    const ok = await confirmar({ titulo: t('tablero.eliminarTitulo'), mensaje: t('tablero.eliminarMensaje', { titulo: g.titulo }), textoConfirmar: t('tablero.eliminar'), tono: 'peligro', icono: 'eliminar' });
    if (ok) accionesTablero.eliminar(g.id);
  }

  return (
    <article className="tarjeta tablero-tarjeta">
      <div className="tablero-tarjeta-cabecera">
        {editable
          ? <input className="tablero-input-titulo" value={g.titulo} maxLength={160} aria-label={t('tablero.tituloGrafico')} onChange={e => accionesTablero.actualizar(g.id, { titulo: e.target.value })} />
          : <h4 className="tablero-tarjeta-titulo">{g.titulo}</h4>}
        <div className="tablero-tarjeta-acciones">
          {editable && (
            <select value={g.seccion} aria-label={t('tablero.seccion')} title={t('tablero.seccion')} onChange={e => accionesTablero.actualizar(g.id, { seccion: e.target.value as SeccionA3 })}>
              {SECCIONES_A3.map(s => <option key={s} value={s}>{t(`tablero.secciones.${s}`)}</option>)}
            </select>
          )}
          {editable && <button className="btn-icono" onClick={() => accionesTablero.mover(g.id, -1)} disabled={primero} title={t('tablero.subir')} aria-label={t('tablero.subir')}><Icono nombre="subir" tamano={16} /></button>}
          {editable && <button className="btn-icono" onClick={() => accionesTablero.mover(g.id, 1)} disabled={ultimo} title={t('tablero.bajar')} aria-label={t('tablero.bajar')}><Icono nombre="bajar" tamano={16} /></button>}
          <button className="btn-icono" onClick={onProyectar} title={t('tablero.proyectar')} aria-label={t('tablero.proyectar')}><Icono nombre="proyectar" tamano={16} /></button>
          <button className="btn-icono" onClick={() => ref.current && exportarPNG(ref.current, g.titulo, nombreArchivo(g.titulo))} disabled={!resultado}
            title={t('tablero.png')} aria-label={t('tablero.png')}><Icono nombre="imagen" tamano={16} /></button>
          {editable && <button className="btn-icono peligro" onClick={eliminar} title={t('tablero.eliminar')} aria-label={t('tablero.eliminar')}><Icono nombre="eliminar" tamano={16} /></button>}
        </div>
      </div>
      <div ref={ref}>
        {resultado ? <Grafico r={resultado} alto={320} formatoCondicional={spec.formatoCondicional} /> : <SinValores texto={t('tablero.graficoNoDisponible')} />}
      </div>
      {editable ? (
        <label className="tablero-conclusion">
          <span className="campo-label">{t('tablero.conclusion')}</span>
          <textarea rows={2} maxLength={400} value={g.conclusion} placeholder={t('tablero.conclusionPlaceholder')}
            onChange={e => accionesTablero.actualizar(g.id, { conclusion: e.target.value })} />
        </label>
      ) : g.conclusion && <p className="tablero-conclusion-texto">{g.conclusion}</p>}
    </article>
  );
}

function TextosA3({ tablero, editable }: { tablero: Tablero; editable: boolean }) {
  const { t } = useSesion();
  const hayTexto = Object.values(tablero.textos).some(Boolean);
  if (!editable && !hayTexto) return null;
  return (
    <details className="tarjeta tablero-textos" open={!editable || undefined}>
      <summary>
        <span>{t('tablero.textos')}</span>
        {editable && <span className="datos-nota" style={{ margin: 0, fontWeight: 400 }}>{t('tablero.textosAyuda')}</span>}
      </summary>
      <div className="tablero-textos-grid">
        {TEXTOS_A3.map(k => (
          <label key={k} className="constructor-campo">
            <span className="campo-label">{t(`tablero.campos.${k}`)}</span>
            {editable
              ? <textarea rows={3} maxLength={2000} value={tablero.textos[k]} placeholder={t(`tablero.placeholders.${k}`)} onChange={e => accionesTablero.texto(k, e.target.value)} />
              : <p className="tablero-conclusion-texto">{tablero.textos[k]}</p>}
          </label>
        ))}
      </div>
    </details>
  );
}

// En proyección el gráfico se dibuja más chico y se amplía, para que ejes y etiquetas se lean desde lejos
const ZOOM = 1.4;

// Pantalla completa, un gráfico por vista; se avanza con las flechas del teclado
function Proyeccion({ graficos, inicio, datos, onCerrar }: { graficos: GraficoTablero[]; inicio: number; datos: DatosJuego; onCerrar: () => void }) {
  const { t } = useSesion();
  const [i, setI] = useState(inicio);
  const ref = useRef<HTMLDivElement>(null);
  const g = graficos[i]!;
  const { spec, resultado } = useResultado(g, datos);
  const [tam, setTam] = useState({ ancho: window.innerWidth, alto: window.innerHeight });

  useEffect(() => {
    ref.current?.requestFullscreen?.().catch(() => {});
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') setI(x => Math.min(graficos.length - 1, x + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI(x => Math.max(0, x - 1));
      if (e.key === 'Escape') onCerrar();
    };
    const pantalla = () => { if (!document.fullscreenElement) onCerrar(); };
    const redimensionar = () => setTam({ ancho: window.innerWidth, alto: window.innerHeight });
    window.addEventListener('keydown', tecla);
    window.addEventListener('resize', redimensionar);
    document.addEventListener('fullscreenchange', pantalla);
    return () => {
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', redimensionar);
      document.removeEventListener('fullscreenchange', pantalla);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  return createPortal(
    <div ref={ref} className="proyeccion" role="dialog" aria-modal="true">
      <div className="proyeccion-cabecera">
        <h2>{g.titulo}</h2>
        <span className="proyeccion-n">{t('tablero.deN', { i: i + 1, n: graficos.length })}</span>
      </div>
      <div className="proyeccion-grafico">
        {resultado ? <Grafico r={resultado} ancho={Math.round((tam.ancho - 96) / ZOOM)} alto={Math.round(Math.max(300, tam.alto - 260) / ZOOM)} formatoCondicional={spec.formatoCondicional} />
          : <SinValores texto={t('tablero.graficoNoDisponible')} />}
      </div>
      {g.conclusion && <p className="proyeccion-conclusion">{g.conclusion}</p>}
      <div className="proyeccion-controles">
        <button className="btn-fantasma" onClick={() => setI(x => Math.max(0, x - 1))} disabled={i === 0} aria-label={t('tablero.anterior')}><Icono nombre="izquierda" tamano={22} /></button>
        <button className="btn-fantasma" onClick={onCerrar}>{t('tablero.salirProyeccion')}</button>
        <button className="btn-fantasma" onClick={() => setI(x => Math.min(graficos.length - 1, x + 1))} disabled={i === graficos.length - 1} aria-label={t('tablero.siguiente')}><Icono nombre="derecha" tamano={22} /></button>
      </div>
    </div>,
    document.body,
  );
}

// Hoja A3 horizontal para el consejo. Se imprime con el diálogo del navegador, que permite guardarla como PDF.
// A la izquierda: antecedentes, situación actual, meta y análisis. A la derecha: propuesta, plan y seguimiento.
const ANCHO_COLUMNA = 720;

function ImpresionA3({ tablero, datos, nombreEquipo, onTerminar }: { tablero: Tablero; datos: DatosJuego; nombreEquipo: string; onTerminar: () => void }) {
  const { t } = useSesion();
  const ordenados = enOrdenA3(tablero.graficos);
  useEffect(() => {
    document.body.classList.add('imprimiendo-a3');
    const fin = () => onTerminar();
    window.addEventListener('afterprint', fin);
    // Se da un momento para que los gráficos se dibujen antes de abrir el diálogo
    const id = window.setTimeout(() => window.print(), 400);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', fin);
      document.body.classList.remove('imprimiendo-a3');
    };
  }, []);

  const bloqueTexto = (k: (typeof TEXTOS_A3)[number]) => (
    <div className="a3-bloque">
      <h3>{t(`tablero.campos.${k}`)}</h3>
      <p>{tablero.textos[k]}</p>
    </div>
  );
  const bloqueGraficos = (sec: SeccionA3) => {
    const gs = ordenados.filter(g => g.seccion === sec);
    return (
      <div className="a3-bloque">
        <h3>{t(`tablero.secciones.${sec}`)}</h3>
        {gs.map(g => <GraficoA3 key={g.id} g={g} datos={datos} />)}
      </div>
    );
  };

  return createPortal(
    <div className="a3-impresion">
      <header className="a3-encabezado">
        <h1>{t('tablero.a3')} · {nombreEquipo}</h1>
        <span>{formatoFecha(Date.now())}</span>
      </header>
      <div className="a3-columnas">
        <div>{bloqueTexto('antecedentes')}{bloqueGraficos('situacion')}{bloqueTexto('meta')}{bloqueGraficos('analisis')}</div>
        <div>{bloqueTexto('propuesta')}{bloqueTexto('plan')}{bloqueGraficos('seguimiento')}</div>
      </div>
    </div>,
    document.body,
  );
}

function GraficoA3({ g, datos }: { g: GraficoTablero; datos: DatosJuego }) {
  const { spec, resultado } = useResultado(g, datos);
  return (
    <figure className="a3-grafico">
      <figcaption>{g.titulo}</figcaption>
      {resultado && <Grafico r={resultado} ancho={ANCHO_COLUMNA} alto={260} formatoCondicional={spec.formatoCondicional} />}
      {g.conclusion && <p>{g.conclusion}</p>}
    </figure>
  );
}
