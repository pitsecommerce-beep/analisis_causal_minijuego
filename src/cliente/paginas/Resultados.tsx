import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const CAUSAS_OPCIONES = [
  { id: 'ventana_captura_cuello', nombre: 'Ventana de captura como cuello de botella' },
  { id: 'reproceso_documental', nombre: 'Reproceso documental (errores de captura)' },
  { id: 'fuga_aprobados_sin_plastico', nombre: 'Fuga de aprobados sin plastico enviado' },
  { id: 'secuencia_tardia_buro', nombre: 'Secuencia tardia de consulta al buro' },
  { id: 'saturacion_sucursales', nombre: 'Saturacion de sucursales especificas' },
  { id: 'falta_capacitacion', nombre: 'Falta de capacitacion del personal' },
  { id: 'sistema_lento', nombre: 'Lentitud del sistema informatico' },
  { id: 'politica_credito_restrictiva', nombre: 'Politica de credito demasiado restrictiva' },
];

const COLORES_DESENLACE: Record<string, { color: string; bg: string }> = {
  reconversion: { color: '#1a7a4c', bg: '#e6f5ed' },
  buen_trabajo: { color: '#2563a8', bg: '#e8f2fd' },
  sobreviviste: { color: '#c8922a', bg: '#fdf6e8' },
  en_la_mira: { color: '#c0392b', bg: '#fce8e6' },
  destituido: { color: '#7f1d1d', bg: '#fce8e6' },
};

const NOMBRES_DIMENSION: Record<string, { nombre: string; icono: string }> = {
  diagnostico: { nombre: 'Diagnostico (causa raiz)', icono: '🔍' },
  criterio: { nombre: 'Criterio (evidencia)', icono: '📋' },
  impacto: { nombre: 'Impacto (mejora KPIs)', icono: '📈' },
  metodo: { nombre: 'Metodo (herramientas)', icono: '🛠' },
  compromisos: { nombre: 'Compromisos', icono: '🤝' },
  penalizaciones: { nombre: 'Penalizaciones', icono: '⚠️' },
};

export function Resultados() {
  const nav = useNavigate();
  const [fase, setFase] = useState<'cierre' | 'resultado'>('cierre');
  const [causasSeleccionadas, setCausasSeleccionadas] = useState<string[]>([]);
  const [consultoGuia, setConsultoGuia] = useState(false);
  const [pasosEnOrden, setPasosEnOrden] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [herramientas] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('herramientasUsadas') ?? '[]');
    } catch { return []; }
  });

  useEffect(() => {
    if (!localStorage.getItem('token')) nav('/');
  }, []);

  function toggleCausa(id: string) {
    setCausasSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function enviarCierre() {
    setCargando(true);
    try {
      const causas = causasSeleccionadas.map(id => {
        const c = CAUSAS_OPCIONES.find(x => x.id === id);
        return { id, nombre: c?.nombre ?? id };
      });
      const res = await api.partida.cierre(causas, herramientas, consultoGuia, pasosEnOrden);
      setResultado(res);
      setFase('resultado');
    } catch { /* ignore */ }
    setCargando(false);
  }

  function salir() {
    localStorage.clear();
    nav('/');
  }

  if (fase === 'cierre') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--color-fondo)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{ maxWidth: 640, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'var(--color-primario-suave)',
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 28 }}>📝</span>
            </div>
            <h2 style={{ color: 'var(--color-primario)', fontSize: 22, fontWeight: 700 }}>
              Cierre de partida
            </h2>
            <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14, marginTop: 6 }}>
              Antes de ver tu resultado, declara cuales crees que son las causas raiz del problema.
            </p>
          </div>

          <div className="tarjeta" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 14, fontSize: 15, fontWeight: 600 }}>
              Selecciona las causas raiz que identificaste
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CAUSAS_OPCIONES.map(c => {
                const sel = causasSeleccionadas.includes(c.id);
                return (
                  <label key={c.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    padding: '10px 14px',
                    borderRadius: 'var(--radio)',
                    background: sel ? 'var(--color-primario-suave)' : 'transparent',
                    border: `1px solid ${sel ? 'var(--color-primario-claro)' : 'var(--color-borde)'}`,
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => toggleCausa(c.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primario)' }}
                    />
                    <span style={{ fontSize: 14 }}>{c.nombre}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="tarjeta" style={{ marginBottom: 20 }}>
            <h4 style={{ marginBottom: 14, fontSize: 15, fontWeight: 600 }}>
              Reflexion metodologica
            </h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={consultoGuia}
                onChange={e => setConsultoGuia(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primario)' }}
              />
              <span style={{ fontSize: 14 }}>Consulte la guia o nota tecnica durante el analisis</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={pasosEnOrden}
                onChange={e => setPasosEnOrden(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primario)' }}
              />
              <span style={{ fontSize: 14 }}>Segui los pasos del metodo en orden</span>
            </label>
          </div>

          <button className="btn-acento" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
            onClick={enviarCierre} disabled={cargando || causasSeleccionadas.length === 0}>
            {cargando ? 'Evaluando...' : 'Ver mi resultado'}
          </button>
        </div>
      </div>
    );
  }

  if (!resultado) return null;

  const { desglose, desenlace, ramonCierre } = resultado;
  const theme = COLORES_DESENLACE[desenlace.id] ?? { color: 'var(--color-primario)', bg: 'var(--color-primario-suave)' };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-fondo)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="tarjeta" style={{
          textAlign: 'center',
          marginBottom: 20,
          background: theme.bg,
          border: `1px solid ${theme.color}20`,
        }}>
          <p style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: theme.color,
            marginBottom: 8,
          }}>
            Resultado Final
          </p>
          <h1 style={{ color: theme.color, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            {desenlace.nombre}
          </h1>
          <p style={{ fontSize: 52, fontWeight: 800, color: theme.color, margin: '8px 0 4px' }}>
            {desglose.total}
          </p>
          <p style={{ fontSize: 14, color: `${theme.color}99` }}>de 1000 puntos</p>
        </div>

        {ramonCierre && (
          <div className="tarjeta" style={{ marginBottom: 20, borderLeft: `4px solid ${theme.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>🧐</span>
              <strong style={{ color: 'var(--color-primario)', fontSize: 14 }}>Ramon Betancourt (Consejo)</strong>
            </div>
            <div className="dialogo-burbuja" style={{ maxWidth: '100%' }}>
              {ramonCierre.lineas.map((l: string, i: number) => (
                <p key={i} style={{ marginBottom: i < ramonCierre.lineas.length - 1 ? 8 : 0 }}>{l}</p>
              ))}
            </div>
          </div>
        )}

        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 20, color: 'var(--color-primario)', fontSize: 16, fontWeight: 600 }}>
            Desglose de puntuacion
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(['diagnostico', 'criterio', 'impacto', 'metodo', 'compromisos', 'penalizaciones'] as const).map(dim => {
              const valor = desglose[dim] as number;
              const maxDim = dim === 'penalizaciones' ? 0 : dim === 'compromisos' ? 50 : 250;
              const esPenalizacion = dim === 'penalizaciones';
              const pct = esPenalizacion ? 0 : maxDim > 0 ? Math.min(100, (valor / maxDim) * 100) : 0;
              const info = NOMBRES_DIMENSION[dim]!;

              return (
                <div key={dim}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{info.icono}</span>
                      {info.nombre}
                    </span>
                    <strong style={{
                      color: esPenalizacion && valor < 0 ? 'var(--color-peligro)' : 'var(--color-texto)',
                      fontSize: 15,
                    }}>
                      {valor}
                    </strong>
                  </div>
                  {!esPenalizacion && (
                    <div className="barra-resultado">
                      <div
                        className="barra-resultado-relleno"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 70
                            ? 'linear-gradient(90deg, var(--color-exito), #2ecc71)'
                            : pct >= 40
                              ? 'linear-gradient(90deg, var(--color-primario), var(--color-primario-claro))'
                              : 'linear-gradient(90deg, var(--color-advertencia), #e67e22)',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <details className="tarjeta" style={{ marginBottom: 20 }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: 600,
            color: 'var(--color-primario)',
            fontSize: 14,
            padding: '2px 0',
          }}>
            Ver detalles completos
          </summary>
          <pre style={{
            marginTop: 14,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: 'var(--color-texto-secundario)',
            background: 'var(--color-superficie-alt)',
            padding: 16,
            borderRadius: 'var(--radio)',
            lineHeight: 1.7,
          }}>
            {desglose.detalles.join('\n')}
          </pre>
        </details>

        <button className="btn-primario" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
          onClick={salir}>
          Salir del simulador
        </button>
      </div>
    </div>
  );
}
