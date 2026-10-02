import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
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
import type { PasoRecorrido } from '../componentes/Onboarding.js';

type Vista = 'datos' | 'asesores' | 'decisiones';

const INTERVALO_ESPERA = 4000;
const INTERVALO_LATIDO = 15000;
const CLAVE_ONBOARDING = 'onboardingVisto';

function onboardingVisto(): boolean {
  try { return localStorage.getItem(CLAVE_ONBOARDING) === '1'; } catch { return false; }
}

const TABS: { id: Vista; label: string; icono: NombreIcono }[] = [
  { id: 'datos', label: 'Datos', icono: 'tabla' },
  { id: 'asesores', label: 'Sala de Juntas', icono: 'mensajes' },
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
        setError('Esta sesión ya terminó. Pide a tu profesor el código de una sesión activa.');
        setCargando(false);
        return;
      }
    } catch { /* si falla, se intenta iniciar directamente */ }
    setEsperando(false);
    await iniciar();
  }

  useEffect(() => {
    if (!esperando) return;
    const id = window.setInterval(async () => {
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
    }, INTERVALO_ESPERA);
    return () => window.clearInterval(id);
  }, [esperando]);

  // Latido durante la partida para que el profesor vea a la persona como conectada
  useEffect(() => {
    if (!estado) return;
    const id = window.setInterval(() => { api.jugador.latido().catch(() => {}); }, INTERVALO_LATIDO);
    return () => window.clearInterval(id);
  }, [!!estado]);

  const pasosRecorrido: PasoRecorrido[] = [
    {
      icono: 'diagnostico',
      titulo: 'Bienvenido(a), Director(a)',
      texto: 'ETF Bank tarda demasiado en entregar tarjetas de crédito y las quejas crecen. Tu misión es encontrar las causas raíz con datos y corregirlas en 4 ciclos. Te mostramos el simulador en un minuto.',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'ciclo',
      icono: 'reloj',
      titulo: 'Ciclos',
      texto: 'La partida tiene 4 ciclos. En cada uno analizas, decides y avanzas. Al terminar el cuarto declaras las causas raíz y recibes tu evaluación.',
    },
    {
      objetivo: 'vidas',
      icono: 'corazon',
      titulo: 'Vidas',
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
      icono: 'escudo',
      titulo: 'Credibilidad',
      texto: 'Es la confianza que el consejo y tu equipo tienen en ti. Sube cuando respondes con evidencia y cumples tus compromisos. Baja cuando respondes sin evidencia, pospones decisiones o incumples lo que prometiste. Si llega a cero pierdes una vida.',
    },
    {
      objetivo: 'presupuesto',
      icono: 'sumar',
      titulo: 'Presupuesto',
      texto: 'Es el dinero para toda la partida, no por ciclo. Cada acción tiene un costo y lo que te sobre al final también suma puntos.',
    },
    {
      objetivo: 'tab-datos',
      icono: 'tabla',
      titulo: 'Datos',
      texto: 'Aquí están las solicitudes de tarjeta y los comentarios de clientes. Es tu fuente de evidencia.',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'herramientas',
      icono: 'histograma',
      titulo: 'Herramientas de análisis',
      texto: 'Haz doble clic en el encabezado de una columna para elegirla y luego aplica una herramienta. Verificar con datos te permite refutar afirmaciones en la Sala de Juntas.',
      alEntrar: () => setVista('datos'),
    },
    {
      objetivo: 'tab-asesores',
      icono: 'mensajes',
      titulo: 'Sala de Juntas',
      texto: 'Tu equipo opina sobre el problema. Algunas afirmaciones son ciertas y otras engañosas. Responde con evidencia para convencerlos y ganar credibilidad.',
    },
    {
      objetivo: 'tab-decisiones',
      icono: 'decisiones',
      titulo: 'Decisiones',
      texto: 'Elige acciones dentro de tu presupuesto, declara a qué métrica te comprometes y avanza al siguiente ciclo. Algunas acciones tardan en surtir efecto.',
    },
    {
      objetivo: 'ayuda',
      icono: 'pregunta',
      titulo: '¿Necesitas repasar?',
      texto: 'Con este botón puedes volver a ver este recorrido cuando quieras.',
    },
    {
      icono: 'exito',
      titulo: 'Cómo se evalúa',
      texto: 'Al final se evalúa tu diagnóstico, tu criterio con la evidencia, el impacto en los KPIs y tu método. Consejo: verifica antes de actuar.',
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
    }
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

  const ciclo = estado.cicloActual ?? 1;
  const vidas = estado.vidas ?? 3;
  const credibilidad = estado.credibilidad ?? 50;
  const presupuesto = estado.presupuestoDisponible ?? 0;
  const esTratamiento = infoExp?.grupo === 'tratamiento';

  const credColor = credibilidad >= 60
    ? '#4ade80'
    : credibilidad >= 30
      ? '#fbbf24'
      : '#f87171';

  return (
    <div className="pagina" style={{ background: 'var(--color-fondo)' }}>
      <header className="barra-estado">
        <div className="contenedor" style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
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

      <main className="contenedor" style={{ flex: 1, paddingTop: 20, paddingBottom: 40, width: '100%' }}>
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
          />
        )}
        {vista === 'decisiones' && (
          <TabDecisiones estado={estado} onEstadoCambio={onEstadoCambio} />
        )}
        </div>
      </main>
      <PiePagina />
      {mostrarOnboarding && <Onboarding pasos={pasosRecorrido} onTerminar={terminarOnboarding} />}
    </div>
  );
}
