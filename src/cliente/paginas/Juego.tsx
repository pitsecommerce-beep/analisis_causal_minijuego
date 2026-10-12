import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, EVENTO_SESION_FINALIZADA, EVENTO_VERIFICACION } from '../api.js';
import { useSondeo } from '../sondeo.js';
import { TabDatos } from '../componentes/TabDatos.js';
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

type Vista = 'datos' | 'asesores' | 'espina' | 'decisiones';

const INTERVALO_ESPERA = 4000;
const INTERVALO_LATIDO = 15000;
const CLAVE_ONBOARDING = 'onboardingVisto';

function onboardingVisto(): boolean {
  try { return localStorage.getItem(CLAVE_ONBOARDING) === '1'; } catch { return false; }
}

const TABS: { id: Vista; label: string; icono: NombreIcono }[] = [
  { id: 'datos', label: 'Datos', icono: 'tabla' },
  { id: 'asesores', label: 'Sala de Juntas', icono: 'mensajes' },
  { id: 'espina', label: 'Espina de pescado', icono: 'diagnostico' },
  { id: 'decisiones', label: 'Decisiones', icono: 'decisiones' },
];

export function Juego() {
  const nav = useNavigate();
  const { confirmar, avisar } = useUI();
  const [estado, setEstado] = useState<any>(null);
  const [vista, setVista] = useState<Vista>('datos');
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
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);
  const inicioRef = useRef(Date.now());

  const nombreJugador = localStorage.getItem('nombreJugador') ?? 'Jugador';
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
          setError('Esta sesión ya terminó. Pide a tu profesor el código de una sesión activa.');
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
          avisar('exito', 'La sesión comenzó', 'Mucho éxito, Director(a).');
          await iniciar();
        } else {
          setError('Esta sesión ya terminó. Pide a tu profesor el código de una sesión activa.');
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

  // Inducción: Ramón Betancourt presenta el encargo a nombre del consejo y señala la interfaz
  const pasosRecorrido: PasoRecorrido[] = [
    {
      titulo: 'El encargo del consejo',
      texto: 'Bienvenido(a), Director(a). Soy Ramón Betancourt y hablo a nombre del consejo de ETF Bank. Te contratamos como consultor(a): entregamos las tarjetas de crédito demasiado tarde y las quejas crecen.',
      puntos: [
        'Encuentra las causas raíz con datos, siguiendo el método de Bohn.',
        'Corrígelas con acciones sustentadas, en 4 ciclos.',
        'Rinde cuentas al consejo en cada ciclo.',
      ],
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'ciclo',
      titulo: 'Tienes 4 ciclos',
      texto: 'En cada ciclo analizas, decides y cierras votando tus causas principales. Al terminar el cuarto, el consejo evalúa tu diagnóstico.',
    },
    {
      objetivo: 'vidas',
      animo: 'enojado',
      titulo: 'Tus vidas',
      texto: 'Empiezas con 3. Si las pierdes todas, el consejo te destituye. Pierdes una cuando:',
      puntos: [
        'No tomas ninguna acción en un ciclo.',
        'Tu resultado queda por debajo de la mitad de lo que prometiste.',
        'Tu credibilidad llega a cero.',
        'Gastas mucho presupuesto sin mover ningún KPI.',
      ],
    },
    {
      objetivo: 'credibilidad',
      titulo: 'Tu credibilidad',
      texto: 'Es la confianza que el consejo y tu equipo tienen en ti. Sube cuando respondes con evidencia y cumples lo que prometes. Baja cuando respondes sin datos o pospones decisiones.',
    },
    {
      objetivo: 'presupuesto',
      titulo: 'El presupuesto',
      texto: 'Es para toda la partida, no por ciclo. Cada acción cuesta, y lo que no gastes también cuenta a tu favor.',
    },
    {
      objetivo: 'tab-datos',
      titulo: 'Los datos del proceso',
      texto: 'Aquí están las 1,500 solicitudes de tarjeta. Es tu fuente de evidencia: no aceptes una afirmación que no puedas comprobar aquí.',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'tab-proceso',
      titulo: 'La vista del proceso',
      texto: 'Antes de buscar causas, entiende el proceso. Este es el flujo completo, de la sucursal hasta que el cliente recibe su tarjeta. Haz clic en cada etapa para ver cuánto tarda: mediana, media, desviación y percentil 90.',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'tab-comentarios',
      titulo: 'La voz del cliente',
      texto: 'Estos son los comentarios de clientes, cada uno ligado a su solicitud. Empieza por aquí: un Pareto por categoría te dice de qué se quejan más, y puedes cruzarlos con sus solicitudes.',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'herramientas',
      titulo: 'Las herramientas de Bohn',
      texto: 'Histograma, Pareto, corrida, gráfica de control, dispersión y pivote. Usa "Estratificar por" para repetir cualquier análisis por sucursal, estado o mes. Elige una columna, una herramienta y guarda lo que encuentres con "Adjuntar a la espina".',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'tab-asesores',
      titulo: 'Tu equipo',
      texto: 'En la Sala de Juntas tu equipo te dará su opinión. Algunas afirmaciones son ciertas y otras engañosas. Responde con evidencia para convencerlos.',
    },
    {
      objetivo: 'pendientes',
      titulo: 'Lista de pendientes',
      texto: 'Cada afirmación o recomendación de tu equipo queda anotada aquí. Desde esta lista puedes enviarla a tu espina de pescado como causa posible.',
    },
    {
      objetivo: 'tab-espina',
      titulo: 'La espina de pescado',
      texto: 'Aquí ordenas tus hipótesis en las 6M: Personal, Método, Máquina, Material, Medición y Entorno. Una causa solo queda verificada cuando le adjuntas una gráfica o cálculo. Al cerrar cada ciclo votarás tus 3 causas principales y escribirás tus 5 porqués.',
    },
    {
      objetivo: 'tab-decisiones',
      titulo: 'Las decisiones',
      texto: 'Elige acciones, liga cada una a la causa que ataca y declara al consejo cuánto vas a mejorar un indicador. Si decides sin una causa verificada, te lo voy a señalar.',
      animo: 'enojado',
    },
    {
      objetivo: 'ayuda',
      titulo: '¿Necesitas repasar?',
      texto: 'Con este botón vuelvo a explicarte el simulador cuando quieras.',
    },
    {
      titulo: 'Cómo te evaluaremos',
      animo: 'feliz',
      texto: 'El consejo no mide intenciones. Evaluaremos tu diagnóstico con las causas que verificaste y votaste, el impacto en los KPIs y tu método: si escuchaste al cliente primero, definiste el problema con un Pareto, planteaste hipótesis antes de actuar, estratificaste y decidiste con causas probadas. Éxito, Director(a).',
    },
  ];

  function terminarOnboarding() {
    try { localStorage.setItem(CLAVE_ONBOARDING, '1'); } catch { /* sin almacenamiento */ }
    setMostrarOnboarding(false);
  }

  async function iniciar() {
    setCargando(true);
    try {
      const res = await api.partida.iniciar();
      setEstado(res);
      if (!onboardingVisto()) setMostrarOnboarding(true);
      telemetria('partida_iniciada', { ciclo: res.cicloActual });
    } catch (err: any) {
      if (err.message.includes('aún no ha iniciado')) {
        setError('La sesión aún no ha sido iniciada por el profesor. Espera un momento y recarga.');
      } else {
        setError(err.message);
      }
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
      titulo: 'Salir del simulador',
      mensaje: 'Tu avance queda guardado. Para continuar, vuelve a unirte con el mismo código y el mismo nombre.',
      textoConfirmar: 'Salir',
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
          <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>Cargando partida...</p>
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
          <h3 style={{ color: 'var(--color-texto)', marginBottom: 8 }}>Sesión no disponible</h3>
          <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>{error}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn-primario" onClick={() => { setError(''); setCargando(true); comprobarSesion(); }}>
              Reintentar
            </button>
            <button className="btn-fantasma" onClick={() => nav('/unirse')}>
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!estado) return null;

  if (sesionFinalizada) {
    return <CierreSesion estado={estado} onResultados={() => nav('/resultados')} onSalir={async () => { await api.jugador.salir().catch(() => {}); localStorage.clear(); nav('/unirse'); }} />;
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
        <div className="contenedor" style={{ display: 'flex', alignItems: 'stretch', gap: 0, maxWidth: vista === 'datos' ? 1680 : undefined }}>
          <div className="barra-estado-item">
            <span className="barra-estado-label">Director(a)</span>
            <span className="barra-estado-valor">{nombreJugador}</span>
          </div>
          <div className="barra-estado-item">
            <span className="barra-estado-label">Sesión</span>
            <span className="barra-estado-valor">{sesionNombre}</span>
          </div>
          <div className="barra-estado-item" data-tour="ciclo">
            <span className="barra-estado-label">Ciclo</span>
            <span className="barra-estado-valor">{ciclo} / 4</span>
          </div>
          <div className="barra-estado-item" data-tour="vidas">
            <span className="barra-estado-label">Vidas</span>
            <span className="barra-estado-valor" style={{ display: 'inline-flex', gap: 4 }}>
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} style={{ display: 'inline-flex', color: i < vidas ? '#f87171' : 'rgba(255,255,255,0.25)' }}>
                  <Icono nombre="corazon" tamano={15} relleno={i < vidas} grosor={i < vidas ? 0 : 2} />
                </span>
              ))}
              <span className="sr-only">{vidas} de 3</span>
            </span>
          </div>
          <div className="barra-estado-item" data-tour="credibilidad">
            <span className="barra-estado-label">Credibilidad</span>
            <span className="barra-estado-valor" style={{ color: credColor }}>
              {credibilidad}%
            </span>
          </div>
          <div className="barra-estado-item" data-tour="presupuesto" style={{ marginLeft: 'auto' }}>
            <span className="barra-estado-label">Presupuesto</span>
            <span className="barra-estado-valor">${presupuesto}</span>
          </div>
          <div className="barra-estado-item" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setMostrarPendientes(true)}
              data-tour="pendientes"
              aria-label={`Lista de pendientes, ${porResolver} sin resolver`}
              title="Lista de pendientes"
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
              <span className="ocultar-movil">Pendientes</span>
              {porResolver > 0 && <span className="pendientes-contador">{porResolver}</span>}
            </button>
            <button
              onClick={() => setMostrarOnboarding(true)}
              data-tour="ayuda"
              aria-label="Ver cómo se juega"
              title="Cómo se juega"
              style={{
                display: 'inline-flex',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: 6,
              }}
            >
              <Icono nombre="pregunta" tamano={18} />
            </button>
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
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="contenedor" style={{ flex: 1, paddingTop: 20, paddingBottom: 40, width: '100%', maxWidth: vista === 'datos' ? 1680 : undefined }}>
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
          {TABS.map(t => (
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
              {t.label}
            </button>
          ))}
        </div>

        {esTratamiento && vista === 'decisiones' && <AsesorAlgoritmico />}

        <div key={vista} className="transicion-contenido">
        {vista === 'datos' && <TabDatos onHerramientaUsada={onHerramientaUsada} />}
        {vista === 'asesores' && (
          <TabAsesores
            onCredibilidadCambio={onCredibilidadCambio}
            onRecargar={recargarEstado}
            onAbrirLaptop={() => onCambioVista('datos')}
          />
        )}
        {vista === 'espina' && <TabEspina />}
        {vista === 'decisiones' && (
          <TabDecisiones estado={estado} onEstadoCambio={onEstadoCambio} onIrEspina={() => onCambioVista('espina')} />
        )}
        </div>
      </main>
      <PiePagina />
      {mostrarPendientes && <Pendientes pendientes={pendientes} verificadas={verificadas} onCerrar={() => setMostrarPendientes(false)} />}
      {mostrarOnboarding && <Onboarding pasos={pasosRecorrido} onTerminar={terminarOnboarding} />}
    </div>
  );
}

// Pantalla que reemplaza al juego cuando el profesor finaliza la sesión
function CierreSesion({ estado, onResultados, onSalir }: { estado: any; onResultados: () => void; onSalir: () => void }) {
  const yaEvaluada = estado.fase === 'finalizada';
  const completoCiclos = !!estado.terminada;
  const datos = [
    { etiqueta: 'Ciclo alcanzado', valor: `${estado.cicloActual ?? 1} / 4` },
    { etiqueta: 'Vidas', valor: String(estado.vidas ?? 0) },
    { etiqueta: 'Credibilidad', valor: `${estado.credibilidad ?? 0}%` },
    { etiqueta: 'Presupuesto restante', valor: `$${estado.presupuestoDisponible ?? 0}` },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--color-fondo)' }}>
      <div className="tarjeta" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div className="icono-insignia icono-insignia-advertencia icono-insignia-lg" style={{ marginBottom: 16 }}>
          <Icono nombre="finalizar" tamano={26} grosor={1.8} />
        </div>
        <h3 style={{ color: 'var(--color-texto)', marginBottom: 8 }}>Tu profesor finalizó la sesión</h3>
        <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
          {yaEvaluada
            ? 'Tu partida ya fue evaluada. Puedes consultar tus resultados.'
            : completoCiclos
              ? 'Completaste los cuatro ciclos. Declara tus causas raíz para recibir tu evaluación.'
              : 'Ya no es posible seguir jugando. Así quedó tu partida:'}
        </p>
        {!yaEvaluada && !completoCiclos && (
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
              {yaEvaluada ? 'Ver resultados' : 'Declarar causas'}
            </button>
          )}
          <button className="btn-fantasma" onClick={onSalir}>Salir</button>
        </div>
      </div>
    </div>
  );
}
