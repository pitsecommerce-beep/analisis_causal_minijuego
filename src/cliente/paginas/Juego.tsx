import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, EVENTO_SESION_FINALIZADA, EVENTO_VERIFICACION } from '../api.js';
import { useSondeo } from '../sondeo.js';
import { TabDatos } from '../componentes/TabDatos.js';
import { ConstructorGraficos } from '../componentes/ConstructorGraficos.js';
import { TabTablero } from '../componentes/TabTablero.js';
import { VistaCaso } from '../componentes/VistaCaso.js';
import { accionesTablero } from '../tablero.js';
import { useDatos } from '../datos.js';
import { useSesion } from '../i18n.js';
import { TabAsesores } from '../componentes/TabAsesores.js';
import { TabDecisiones } from '../componentes/TabDecisiones.js';
import { Consentimiento } from '../componentes/Consentimiento.js';
import { AsesorAlgoritmico } from '../componentes/AsesorAlgoritmico.js';
import { useUI } from '../componentes/ui/Notificaciones.js';
import { Icono } from '../componentes/ui/Iconos.js';
import type { NombreIcono } from '../componentes/ui/Iconos.js';
import { PiePagina } from '../componentes/ui/PiePagina.js';
import { SalaEspera } from '../componentes/SalaEspera.js';
import { Onboarding } from '../componentes/Onboarding.js';
import { Pendientes, estaResuelto } from '../componentes/Pendientes.js';
import { usePendientes } from '../pendientes.js';
import { TabEspina } from '../componentes/TabEspina.js';
import { cargarEspina, fijarCicloEspina } from '../espina.js';
import { registrarEvento } from '../eventos.js';
import type { PasoRecorrido } from '../componentes/Onboarding.js';
import { DICCIONARIOS, LOCALES } from '../../compartido/i18n/index.js';

type Vista = 'caso' | 'datos' | 'analisis' | 'tablero' | 'asesores' | 'espina' | 'decisiones';

const INTERVALO_ESPERA = 4000;
const INTERVALO_LATIDO = 15000;
const CLAVE_ONBOARDING = 'onboardingVisto';

function leerModo(): string {
  try { return JSON.parse(localStorage.getItem('configSesion') ?? '{}').modo ?? 'completo'; } catch { return 'completo'; }
}

function onboardingVisto(): boolean {
  try { return localStorage.getItem(CLAVE_ONBOARDING) === '1'; } catch { return false; }
}

// En modo informativo no hay juego: solo consulta, análisis y tablero
const TABS_INFORMATIVO: { id: Vista; icono: NombreIcono }[] = [
  { id: 'caso', icono: 'caso' },
  { id: 'datos', icono: 'tabla' },
  { id: 'analisis', icono: 'grafica' },
  { id: 'tablero', icono: 'tablero' },
  { id: 'asesores', icono: 'mensajes' },
];

const TABS: { id: Vista; icono: NombreIcono }[] = [
  { id: 'datos', icono: 'tabla' },
  { id: 'analisis', icono: 'grafica' },
  { id: 'tablero', icono: 'tablero' },
  { id: 'asesores', icono: 'mensajes' },
  { id: 'espina', icono: 'diagnostico' },
  { id: 'decisiones', icono: 'decisiones' },
];

export function Juego() {
  const nav = useNavigate();
  const { confirmar, avisar } = useUI();
  const [estado, setEstado] = useState<any>(null);
  // El simulador recibe al participante en la Sala de Juntas, con su equipo
  const [vista, setVista] = useState<Vista>(() => (leerModo() === 'informativo' ? 'caso' : 'asesores'));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [herramientasUsadas, setHerramientasUsadas] = useState<string[]>([]);
  const [infoExp, setInfoExp] = useState<{ modoExperimento: boolean; grupo: string | null; consentimiento: boolean } | null>(null);
  const [mostrarConsentimiento, setMostrarConsentimiento] = useState(false);
  const [esperando, setEsperando] = useState(false);
  const [sesionFinalizada, setSesionFinalizada] = useState(false);
  const [mostrarPendientes, setMostrarPendientes] = useState(false);
  const [verificadas, setVerificadas] = useState<string[]>([]);
  const pendientes = usePendientes();
  const { fijarConfig, config, t: tr } = useSesion();
  const informativo = config.modo === 'informativo';
  const { datos, error: errorDatos, reintentar: reintentarDatos } = useDatos();
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const inicioRef = useRef(Date.now());

  const nombreJugador = localStorage.getItem('nombreJugador') ?? '';
  const sesionNombre = localStorage.getItem('sesionNombre') ?? '';

  useEffect(() => {
    if (!localStorage.getItem('token') || localStorage.getItem('tipoAuth') !== 'jugador') {
      nav('/unirse');
      return;
    }
    cargarExperimentoYPartida();
  }, []);

  async function cargarExperimentoYPartida() {
    setCargando(true);
    try {
      const info = await api.experimento.info();
      setInfoExp(info);
      if (info.config) {
        fijarConfig(info.config);
        if (info.config.modo === 'informativo') setVista('caso');
      }

      if (info.modoExperimento && !info.consentimiento) {
        setMostrarConsentimiento(true);
        setCargando(false);
        return;
      }

      await comprobarSesion();
    } catch {
      await comprobarSesion();
    }
  }

  // Consulta el estado de la sesión: espera si aún no inicia, entra al juego si ya está en curso
  async function comprobarSesion() {
    try {
      const { sesionEstado } = await api.jugador.latido();
      if (sesionEstado === 'abierta') {
        setEsperando(true);
        setCargando(false);
        return;
      }
      if (sesionEstado === 'finalizada') {
        // Si ya tenía partida, se muestra el cierre con su avance; si no, la sesión no está disponible
        try {
          setEstado(await api.partida.iniciar());
          setSesionFinalizada(true);
        } catch {
          setError(tr('juego.sesionTerminada'));
        }
        setCargando(false);
        return;
      }
    } catch { /* si falla, se intenta iniciar directamente */ }
    setEsperando(false);
    await iniciar();
  }

  useSondeo(async () => {
    try {
      const { sesionEstado } = await api.jugador.latido();
      if (sesionEstado !== 'abierta') {
        setEsperando(false);
        if (sesionEstado === 'en_curso') {
          avisar('exito', tr('juego.sesionComenzo'), tr('juego.exito'));
          await iniciar();
        } else {
          setError(tr('juego.sesionTerminada'));
        }
      }
    } catch { /* reintenta en el siguiente intervalo */ }
  }, INTERVALO_ESPERA, esperando);

  // Latido durante la partida para que el profesor vea a la persona como conectada
  useSondeo(() => {
    api.jugador.latido()
      .then(({ sesionEstado }) => { if (sesionEstado === 'finalizada') setSesionFinalizada(true); })
      .catch(() => {});
  }, INTERVALO_LATIDO, !!estado && !sesionFinalizada);

  useEffect(() => {
    if (estado) cargarEspina();
  }, [!!estado]);
  useEffect(() => { fijarCicloEspina(estado?.cicloActual ?? 1); }, [estado?.cicloActual]);

  // Afirmaciones ya validadas con datos: cierran solas sus notas en la Lista de Pendientes
  useEffect(() => {
    if (!estado) return;
    api.datos.verificaciones().then(setVerificadas).catch(() => {});
    const alVerificar = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setVerificadas(prev => prev.includes(id) ? prev : [...prev, id]);
    };
    window.addEventListener(EVENTO_VERIFICACION, alVerificar);
    return () => window.removeEventListener(EVENTO_VERIFICACION, alVerificar);
  }, [!!estado]);

  useEffect(() => {
    const alFinalizar = () => setSesionFinalizada(true);
    window.addEventListener(EVENTO_SESION_FINALIZADA, alFinalizar);
    return () => window.removeEventListener(EVENTO_SESION_FINALIZADA, alFinalizar);
  }, []);

  // Inducción: Ramón Betancourt recibe al nuevo director a prueba y señala la interfaz
  const ob = DICCIONARIOS[config.idioma].onboarding;
  const pasosRecorrido: PasoRecorrido[] = [
    { ...ob.prueba, puntos: [...ob.prueba.puntos], alEntrar: () => setVista('asesores') },
    { objetivo: 'ciclo', ...ob.ciclos },
    { objetivo: 'vidas', animo: 'enojado', ...ob.vidas, puntos: [...ob.vidas.puntos] },
    { objetivo: 'credibilidad', ...ob.credibilidad },
    { objetivo: 'presupuesto', ...ob.presupuesto },
    { objetivo: 'tab-datos', titulo: ob.datos.titulo, texto: tr('onboarding.datos.texto', { n: (datos?.solicitudes.length ?? 0).toLocaleString(LOCALES[config.idioma]) }), alEntrar: () => setVista('datos') },
    { objetivo: 'tab-proceso', ...ob.proceso, alEntrar: () => setVista('datos') },
    { objetivo: 'tab-comentarios', ...ob.comentarios, alEntrar: () => setVista('datos') },
    { objetivo: 'tab-analisis', ...ob.analisis, alEntrar: () => setVista('analisis') },
    { objetivo: 'tab-tablero', ...ob.tablero },
    { objetivo: 'tab-asesores', ...ob.equipo },
    { objetivo: 'pendientes', ...ob.pendientes },
    { objetivo: 'tab-espina', ...ob.espina },
    { objetivo: 'tab-decisiones', ...ob.decisiones, animo: 'enojado' },
    { objetivo: 'ayuda', ...ob.ayuda },
    { ...ob.evaluacion, animo: 'feliz' },
  ];

  function terminarOnboarding() {
    try { localStorage.setItem(CLAVE_ONBOARDING, '1'); } catch { /* sin almacenamiento */ }
    setMostrarOnboarding(false);
    // Al terminar la inducción se vuelve a la Sala de Juntas para conocer al equipo
    setVista('asesores');
  }

  async function iniciar() {
    setCargando(true);
    try {
      const res = await api.partida.iniciar();
      setEstado(res);
      if (!onboardingVisto() && leerModo() !== 'informativo') setMostrarOnboarding(true);
      telemetria('partida_iniciada', { ciclo: res.cicloActual });
    } catch (err: any) {
      setError(String(err?.message ?? '').includes('aún no ha iniciado') ? tr('juego.sesionNoIniciada') : tr('juego.errorInicio'));
    }
    setCargando(false);
  }

  function telemetria(tipo: string, datos?: Record<string, unknown>) {
    if (!infoExp?.modoExperimento) return;
    api.telemetria.registrar(tipo, datos).catch(() => {});
  }

  const recargarEstado = useCallback(async () => {
    try {
      const res = await api.partida.estado();
      setEstado(res);
    } catch { /* ignore */ }
  }, []);

  function onEstadoCambio(nuevoEstado: any) {
    setEstado(nuevoEstado);
    telemetria('estado_cambio', { ciclo: nuevoEstado?.cicloActual, vidas: nuevoEstado?.vidas });
    if (nuevoEstado?.terminada || nuevoEstado?.fase === 'finalizada') {
      telemetria('partida_finalizada', {
        duracionSegundos: Math.round((Date.now() - inicioRef.current) / 1000),
        herramientasUsadas,
      });
      localStorage.setItem('herramientasUsadas', JSON.stringify(herramientasUsadas));
      nav('/resultados');
      return;
    }
    // Cada ciclo nuevo arranca en la Sala de Juntas, donde el equipo reacciona a lo ocurrido
    if ((nuevoEstado?.cicloActual ?? 0) > (estado?.cicloActual ?? 0)) onCambioVista('asesores');
  }

  function onCredibilidadCambio(cred: number) {
    setEstado((prev: any) => prev ? { ...prev, credibilidad: cred } : prev);
    telemetria('credibilidad_cambio', { credibilidad: cred });
  }

  function onHerramientaUsada(h: string) {
    setHerramientasUsadas(prev => {
      const next = prev.includes(h) ? prev : [...prev, h];
      localStorage.setItem('herramientasUsadas', JSON.stringify(next));
      return next;
    });
    telemetria('herramienta_usada', { herramienta: h });
  }

  function onCambioVista(v: Vista) {
    setVista(v);
    registrarEvento('vista', { vista: v });
    telemetria('cambio_vista', { vista: v });
  }

  function onConsentimientoCompletado() {
    setMostrarConsentimiento(false);
    api.experimento.info().then(info => setInfoExp(info)).catch(() => {});
    comprobarSesion();
  }

  async function salir() {
    const ok = await confirmar({
      titulo: tr('juego.salirTitulo'),
      mensaje: tr('juego.salirMensaje'),
      textoConfirmar: tr('juego.salir'),
      tono: 'advertencia',
      icono: 'salir',
    });
    if (!ok) return;
    // Libera el nombre para poder volver a entrar de inmediato; si falla, se libera solo al minuto y medio
    await api.jugador.salir().catch(() => {});
    localStorage.clear();
    nav('/unirse');
  }

  if (mostrarConsentimiento) {
    return <Consentimiento onAceptado={onConsentimientoCompletado} />;
  }

  if (esperando) {
    return <SalaEspera nombre={nombreJugador} sesion={sesionNombre} />;
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-superficie)' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/favicon.png" alt="" width={48} height={48} style={{ marginBottom: 24 }} />
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2, marginBottom: 14 }} />
          <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>{tr('juego.cargando')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="tarjeta" style={{ maxWidth: 480, textAlign: 'center' }}>
          <div className="icono-insignia icono-insignia-advertencia icono-insignia-lg" style={{ marginBottom: 16 }}>
            <Icono nombre="reloj" tamano={26} grosor={1.8} />
          </div>
          <h3 style={{ color: 'var(--color-texto)', marginBottom: 8 }}>{tr('juego.noDisponible')}</h3>
          <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>{error}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn-primario" onClick={() => { setError(''); setCargando(true); comprobarSesion(); }}>
              {tr('juego.reintentar')}
            </button>
            <button className="btn-fantasma" onClick={() => nav('/unirse')}>
              {tr('juego.volver')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!estado) return null;

  if (sesionFinalizada) {
    return <CierreSesion informativo={informativo} estado={estado} onResultados={() => nav('/resultados')} onSalir={async () => { await api.jugador.salir().catch(() => {}); localStorage.clear(); nav('/unirse'); }} />;
  }

  const ciclo = estado.cicloActual ?? 1;
  const vidas = estado.vidas ?? 3;
  const credibilidad = estado.credibilidad ?? 50;
  const presupuesto = estado.presupuestoDisponible ?? 0;
  const esTratamiento = infoExp?.grupo === 'tratamiento';
  const porResolver = pendientes.filter(p => !estaResuelto(p, verificadas)).length;

  const credColor = credibilidad >= 60
    ? '#4ade80'
    : credibilidad >= 30
      ? '#fbbf24'
      : '#f87171';

  return (
    <div className="pagina" style={{ background: 'var(--color-fondo)' }}>
      <header className="barra-estado">
        <div className="contenedor" style={{ display: 'flex', alignItems: 'stretch', gap: 0, maxWidth: vista === 'datos' || vista === 'analisis' || vista === 'tablero' ? 1680 : undefined }}>
          <div className="barra-estado-item">
            <span className="barra-estado-label">{tr(informativo ? 'juego.equipo' : 'juego.director')}</span>
            <span className="barra-estado-valor">{nombreJugador}</span>
          </div>
          <div className="barra-estado-item">
            <span className="barra-estado-label">{tr('juego.sesion')}</span>
            <span className="barra-estado-valor">{sesionNombre}</span>
          </div>
          {informativo ? <div style={{ marginLeft: 'auto' }} /> : <>
          <div className="barra-estado-item" data-tour="ciclo">
            <span className="barra-estado-label">{tr('juego.ciclo')}</span>
            <span className="barra-estado-valor">{ciclo} / 4</span>
          </div>
          <div className="barra-estado-item" data-tour="vidas">
            <span className="barra-estado-label">{tr('juego.vidas')}</span>
            <span className="barra-estado-valor" style={{ display: 'inline-flex', gap: 4 }}>
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} style={{ display: 'inline-flex', color: i < vidas ? '#f87171' : 'rgba(255,255,255,0.25)' }}>
                  <Icono nombre="corazon" tamano={15} relleno={i < vidas} grosor={i < vidas ? 0 : 2} />
                </span>
              ))}
              <span className="sr-only">{tr('juego.vidasDe', { n: vidas })}</span>
            </span>
          </div>
          <div className="barra-estado-item" data-tour="credibilidad">
            <span className="barra-estado-label">{tr('juego.credibilidad')}</span>
            <span className="barra-estado-valor" style={{ color: credColor }}>
              {credibilidad}%
            </span>
          </div>
          <div className="barra-estado-item" data-tour="presupuesto" style={{ marginLeft: 'auto' }}>
            <span className="barra-estado-label">{tr('juego.presupuesto')}</span>
            <span className="barra-estado-valor">${presupuesto}</span>
          </div>
          </>}
          <div className="barra-estado-item" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!informativo && <button
              onClick={() => setMostrarPendientes(true)}
              data-tour="pendientes"
              aria-label={tr('juego.pendientesAria', { n: porResolver })}
              title={tr('juego.listaPendientes')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '6px 10px',
                fontSize: 13,
              }}
            >
              <Icono nombre="diagnostico" tamano={16} />
              <span className="ocultar-movil">{tr('juego.pendientes')}</span>
              {porResolver > 0 && <span className="pendientes-contador">{porResolver}</span>}
            </button>}
            {!informativo && <button
              onClick={() => setMostrarOnboarding(true)}
              data-tour="ayuda"
              aria-label={tr('juego.comoSeJuega')}
              title={tr('juego.comoSeJuega')}
              style={{
                display: 'inline-flex',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: 6,
              }}
            >
              <Icono nombre="pregunta" tamano={18} />
            </button>}
            <button
              onClick={salir}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '6px 14px',
                fontSize: 13,
              }}
            >
              {tr('juego.salir')}
            </button>
          </div>
        </div>
      </header>

      <main className="contenedor" style={{ flex: 1, paddingTop: 20, paddingBottom: 40, width: '100%', maxWidth: vista === 'datos' || vista === 'analisis' || vista === 'tablero' ? 1680 : undefined }}>
        <div style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          background: 'var(--color-superficie)',
          borderRadius: 'var(--radio)',
          padding: 4,
          boxShadow: 'var(--sombra)',
          border: '1px solid var(--color-borde-sutil)',
        }}>
          {(informativo ? TABS_INFORMATIVO : TABS).map(t => (
            <button
              key={t.id}
              onClick={() => onCambioVista(t.id)}
              data-tour={`tab-${t.id}`}
              aria-pressed={vista === t.id}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: 'var(--radio-sm)',
                fontSize: 14,
                fontWeight: vista === t.id ? 600 : 500,
                background: vista === t.id ? 'var(--color-primario)' : 'transparent',
                color: vista === t.id ? '#fff' : 'var(--color-texto-secundario)',
                transition: 'all var(--transicion)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icono nombre={t.icono} tamano={17} />
              {tr(`juego.tabs.${t.id}`)}
            </button>
          ))}
        </div>

        {esTratamiento && !informativo && vista === 'decisiones' && <AsesorAlgoritmico />}

        <div key={vista} className="transicion-contenido">
        {vista === 'caso' && <VistaCaso datos={datos} onVerDatos={() => onCambioVista('datos')} />}
        {(vista === 'datos' || vista === 'analisis' || vista === 'tablero') && !datos && <CargaDatos error={errorDatos} onReintentar={reintentarDatos} />}
        {vista === 'datos' && datos && <TabDatos datos={datos} />}
        {vista === 'analisis' && datos && <ConstructorGraficos datos={datos} conEspina={!informativo} onAnalisis={onHerramientaUsada} onAgregarTablero={accionesTablero.agregar} />}
        {vista === 'tablero' && datos && <TabTablero datos={datos} nombreEquipo={nombreJugador} onIrAnalisis={() => onCambioVista('analisis')} />}
        {vista === 'asesores' && (
          <TabAsesores
            onCredibilidadCambio={onCredibilidadCambio}
            onRecargar={recargarEstado}
            onAbrirLaptop={() => onCambioVista('datos')}
            soloLectura={informativo}
          />
        )}
        {vista === 'espina' && !informativo && <TabEspina />}
        {vista === 'decisiones' && !informativo && (
          <TabDecisiones estado={estado} onEstadoCambio={onEstadoCambio} onIrEspina={() => onCambioVista('espina')} />
        )}
        </div>
      </main>
      <PiePagina />
      {mostrarPendientes && !informativo && <Pendientes pendientes={pendientes} verificadas={verificadas} onCerrar={() => setMostrarPendientes(false)} />}
      {mostrarOnboarding && !informativo && <Onboarding pasos={pasosRecorrido} onTerminar={terminarOnboarding} />}
    </div>
  );
}

function CargaDatos({ error, onReintentar }: { error: boolean; onReintentar: () => void }) {
  const { t } = useSesion();
  if (error) {
    return (
      <div className="alerta-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        {t('comun.errorCarga')}
        <button className="btn-fantasma btn-sm" onClick={onReintentar}>{t('comun.reintentar')}</button>
      </div>
    );
  }
  return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
}

// Pantalla que reemplaza al juego cuando el profesor finaliza la sesión
function CierreSesion({ estado, onResultados, onSalir, informativo }: { estado: any; onResultados: () => void; onSalir: () => void; informativo: boolean }) {
  const { t } = useSesion();
  // En modo informativo no hay evaluación ni ciclos que mostrar
  const yaEvaluada = !informativo && estado.fase === 'finalizada';
  const completoCiclos = !informativo && !!estado.terminada;
  const datos = [
    { etiqueta: t('juego.cicloAlcanzado'), valor: `${estado.cicloActual ?? 1} / 4` },
    { etiqueta: t('juego.vidas'), valor: String(estado.vidas ?? 0) },
    { etiqueta: t('juego.credibilidad'), valor: `${estado.credibilidad ?? 0}%` },
    { etiqueta: t('juego.presupuestoRestante'), valor: `$${estado.presupuestoDisponible ?? 0}` },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--color-fondo)' }}>
      <div className="tarjeta" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div className="icono-insignia icono-insignia-advertencia icono-insignia-lg" style={{ marginBottom: 16 }}>
          <Icono nombre="finalizar" tamano={26} grosor={1.8} />
        </div>
        <h3 style={{ color: 'var(--color-texto)', marginBottom: 8 }}>{t('juego.cierreTitulo')}</h3>
        <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
          {yaEvaluada
            ? t('juego.cierreEvaluada')
            : completoCiclos
              ? t('juego.cierreCompleto')
              : informativo ? t('juego.cierreInformativo') : t('juego.cierreJuego')}
        </p>
        {!informativo && !yaEvaluada && !completoCiclos && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20, textAlign: 'left' }}>
            {datos.map(d => (
              <div key={d.etiqueta} style={{ padding: '10px 12px', borderRadius: 'var(--radio)', background: 'var(--color-fondo)' }}>
                <div style={{ fontSize: 12, color: 'var(--color-texto-secundario)' }}>{d.etiqueta}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-texto)' }}>{d.valor}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {(yaEvaluada || completoCiclos) && (
            <button className="btn-primario" onClick={onResultados}>
              {yaEvaluada ? t('juego.verResultados') : t('juego.declararCausas')}
            </button>
          )}
          <button className="btn-fantasma" onClick={onSalir}>{t('juego.salir')}</button>
        </div>
      </div>
    </div>
  );
}
