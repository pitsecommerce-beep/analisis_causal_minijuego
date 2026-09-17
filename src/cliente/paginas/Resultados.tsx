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

const COLORES_DESENLACE: Record<string, string> = {
  reconversion: '#38a169',
  buen_trabajo: '#3182ce',
  sobreviviste: '#d69e2e',
  en_la_mira: '#e53e3e',
  destituido: '#9b2c2c',
};

const NOMBRES_DIMENSION: Record<string, string> = {
  diagnostico: 'Diagnostico (causa raiz)',
  criterio: 'Criterio (evidencia)',
  impacto: 'Impacto (mejora KPIs)',
  metodo: 'Metodo (herramientas)',
  compromisos: 'Compromisos',
  penalizaciones: 'Penalizaciones',
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
      <div className="contenedor" style={{ paddingTop: 32, paddingBottom: 32, maxWidth: 700 }}>
        <h2 style={{ color: 'var(--color-primario)', marginBottom: 8 }}>Cierre de partida</h2>
        <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 24, fontSize: 14 }}>
          Antes de ver tu resultado, declara cuales crees que son las causas raiz del problema.
        </p>

        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12 }}>Selecciona las causas raiz que identificaste</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CAUSAS_OPCIONES.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '8px 12px', borderRadius: 'var(--radio)',
                background: causasSeleccionadas.includes(c.id) ? '#ebf8ff' : 'transparent',
                border: `1px solid ${causasSeleccionadas.includes(c.id) ? 'var(--color-primario)' : 'var(--color-borde)'}` }}>
                <input type="checkbox" checked={causasSeleccionadas.includes(c.id)}
                  onChange={() => toggleCausa(c.id)} />
                <span style={{ fontSize: 14 }}>{c.nombre}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12 }}>Reflexion metodologica</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={consultoGuia} onChange={e => setConsultoGuia(e.target.checked)} />
            <span style={{ fontSize: 14 }}>Consulte la guia o nota tecnica durante el analisis</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={pasosEnOrden} onChange={e => setPasosEnOrden(e.target.checked)} />
            <span style={{ fontSize: 14 }}>Segui los pasos del metodo en orden</span>
          </label>
        </div>

        <button className="btn-acento" style={{ width: '100%', padding: 14, fontSize: 16 }}
          onClick={enviarCierre} disabled={cargando || causasSeleccionadas.length === 0}>
          {cargando ? 'Evaluando...' : 'Ver mi resultado'}
        </button>
      </div>
    );
  }

  if (!resultado) return null;

  const { desglose, desenlace, ramonCierre } = resultado;
  const colorDesenlace = COLORES_DESENLACE[desenlace.id] ?? 'var(--color-primario)';

  return (
    <div className="contenedor" style={{ paddingTop: 32, paddingBottom: 32, maxWidth: 700 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ color: colorDesenlace, fontSize: 28, marginBottom: 4 }}>
          {desenlace.nombre}
        </h1>
        <p style={{ fontSize: 48, fontWeight: 800, color: colorDesenlace, margin: '8px 0' }}>
          {desglose.total} / 1000
        </p>
      </div>

      {ramonCierre && (
        <div className="tarjeta" style={{ marginBottom: 24, borderLeft: `4px solid ${colorDesenlace}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>🧐</span>
            <strong style={{ color: 'var(--color-primario)' }}>Ramon Betancourt (Consejo)</strong>
          </div>
          <div className="dialogo-burbuja">
            {ramonCierre.lineas.map((l: string, i: number) => (
              <p key={i} style={{ marginBottom: i < ramonCierre.lineas.length - 1 ? 6 : 0 }}>{l}</p>
            ))}
          </div>
        </div>
      )}

      <div className="tarjeta" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 16, color: 'var(--color-primario)' }}>Desglose de puntuacion</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['diagnostico', 'criterio', 'impacto', 'metodo', 'compromisos', 'penalizaciones'] as const).map(dim => {
            const valor = desglose[dim] as number;
            const maxDim = dim === 'penalizaciones' ? 0 : dim === 'compromisos' ? 50 : 250;
            const esPenalizacion = dim === 'penalizaciones';
            const pct = esPenalizacion ? 0 : maxDim > 0 ? Math.min(100, (valor / maxDim) * 100) : 0;

            return (
              <div key={dim}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
                  <span>{NOMBRES_DIMENSION[dim]}</span>
                  <strong style={{ color: esPenalizacion && valor < 0 ? 'var(--color-peligro)' : undefined }}>
                    {valor}
                  </strong>
                </div>
                {!esPenalizacion && (
                  <div className="barra-resultado">
                    <div className="barra-resultado-relleno" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <details className="tarjeta" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-primario)' }}>
          Ver detalles completos
        </summary>
        <pre style={{ marginTop: 12, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-texto-secundario)' }}>
          {desglose.detalles.join('\n')}
        </pre>
      </details>

      <button className="btn-primario" style={{ width: '100%', padding: 14, fontSize: 16 }}
        onClick={salir}>
        Salir
      </button>
    </div>
  );
}
