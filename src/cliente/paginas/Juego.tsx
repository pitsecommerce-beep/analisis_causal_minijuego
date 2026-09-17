import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { TabDatos } from '../componentes/TabDatos.js';
import { TabAsesores } from '../componentes/TabAsesores.js';
import { TabDecisiones } from '../componentes/TabDecisiones.js';
import { Consentimiento } from '../componentes/Consentimiento.js';
import { AsesorAlgoritmico } from '../componentes/AsesorAlgoritmico.js';

type Vista = 'datos' | 'asesores' | 'decisiones';

export function Juego() {
  const nav = useNavigate();
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
      if (err.message.includes('aun no ha iniciado')) {
        setError('La sesion aun no ha sido iniciada por el profesor. Espera un momento y recarga.');
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

  if (mostrarConsentimiento) {
    return <Consentimiento onAceptado={onConsentimientoCompletado} />;
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 18, color: 'var(--color-texto-secundario)' }}>Cargando partida...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="tarjeta" style={{ maxWidth: 500, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-peligro)', marginBottom: 16 }}>{error}</p>
          <button className="btn-primario" onClick={() => { setError(''); iniciar(); }}>
            Reintentar
          </button>
          <button className="btn-fantasma" style={{ marginLeft: 8 }} onClick={() => nav('/')}>
            Volver
          </button>
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="barra-estado">
        <div className="barra-estado-item">
          <span className="barra-estado-label">Director(a)</span>
          <span className="barra-estado-valor">{nombreJugador}</span>
        </div>
        <div className="barra-estado-item">
          <span className="barra-estado-label">Sesion</span>
          <span className="barra-estado-valor">{sesionNombre}</span>
        </div>
        <div className="barra-estado-item">
          <span className="barra-estado-label">Ciclo</span>
          <span className="barra-estado-valor">{ciclo} / 4</span>
        </div>
        <div className="barra-estado-item">
          <span className="barra-estado-label">Vidas</span>
          <span className="barra-estado-valor">{'❤️'.repeat(vidas)}{'🖤'.repeat(3 - vidas)}</span>
        </div>
        <div className="barra-estado-item">
          <span className="barra-estado-label">Credibilidad</span>
          <span className="barra-estado-valor" style={{
            color: credibilidad >= 60 ? 'var(--color-exito)' : credibilidad >= 30 ? 'var(--color-acento)' : 'var(--color-peligro)'
          }}>
            {credibilidad}%
          </span>
        </div>
        <div className="barra-estado-item">
          <span className="barra-estado-label">Presupuesto</span>
          <span className="barra-estado-valor">${presupuesto}</span>
        </div>
      </div>

      <div className="contenedor" style={{ flex: 1, paddingTop: 16, paddingBottom: 32 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`tab ${vista === 'datos' ? 'activo' : ''}`}
            onClick={() => onCambioVista('datos')}>
            Datos
          </button>
          <button className={`tab ${vista === 'asesores' ? 'activo' : ''}`}
            onClick={() => onCambioVista('asesores')}>
            Sala de Juntas
          </button>
          <button className={`tab ${vista === 'decisiones' ? 'activo' : ''}`}
            onClick={() => onCambioVista('decisiones')}>
            Decisiones
          </button>
        </div>

        {esTratamiento && vista === 'decisiones' && <AsesorAlgoritmico />}

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
    </div>
  );
}
