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

type Vista = 'datos' | 'asesores' | 'decisiones';

const TABS: { id: Vista; label: string; icono: NombreIcono }[] = [
  { id: 'datos', label: 'Datos', icono: 'tabla' },
  { id: 'asesores', label: 'Sala de Juntas', icono: 'mensajes' },
  { id: 'decisiones', label: 'Decisiones', icono: 'decisiones' },
];

export function Juego() {
  const nav = useNavigate();
  const { confirmar } = useUI();
  const [estado, setEstado] = useState<any>(null);
  const [vista, setVista] = useState<Vista>('datos');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [herramientasUsadas, setHerramientasUsadas] = useState<string[]>([]);
  const [infoExp, setInfoExp] = useState<{ modoExperimento: boolean; grupo: string | null; consentimiento: boolean } | null>(null);
  const [mostrarConsentimiento, setMostrarConsentimiento] = useState(false);
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

      await iniciar();
    } catch {
      await iniciar();
    }
  }

  async function iniciar() {
    setCargando(true);
    try {
      const res = await api.partida.iniciar();
      setEstado(res);
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
    iniciar();
  }

  async function salir() {
    const ok = await confirmar({
      titulo: 'Salir del simulador',
      mensaje: 'Tu avance queda guardado, pero tendrás que volver a unirte con el código de la sesión para continuar.',
      textoConfirmar: 'Salir',
      tono: 'advertencia',
      icono: 'salir',
    });
    if (!ok) return;
    localStorage.clear();
    nav('/');
  }

  if (mostrarConsentimiento) {
    return <Consentimiento onAceptado={onConsentimientoCompletado} />;
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, marginBottom: 16 }} />
          <p style={{ fontSize: 15, color: 'var(--color-texto-secundario)' }}>Cargando partida...</p>
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
            <button className="btn-primario" onClick={() => { setError(''); iniciar(); }}>
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
          <div className="barra-estado-item">
            <span className="barra-estado-label">Ciclo</span>
            <span className="barra-estado-valor">{ciclo} / 4</span>
          </div>
          <div className="barra-estado-item">
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
          <div className="barra-estado-item">
            <span className="barra-estado-label">Credibilidad</span>
            <span className="barra-estado-valor" style={{ color: credColor }}>
              {credibilidad}%
            </span>
          </div>
          <div className="barra-estado-item" style={{ marginLeft: 'auto' }}>
            <span className="barra-estado-label">Presupuesto</span>
            <span className="barra-estado-valor">${presupuesto}</span>
          </div>
          <div className="barra-estado-item" style={{ justifyContent: 'center' }}>
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
    </div>
  );
}
