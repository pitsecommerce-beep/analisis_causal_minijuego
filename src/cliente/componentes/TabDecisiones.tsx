import { useState, useEffect } from 'react';
import { api } from '../api.js';

interface Props {
  estado: any;
  onEstadoCambio: (estado: any) => void;
}

export function TabDecisiones({ estado, onEstadoCambio }: Props) {
  const [acciones, setAcciones] = useState<any[]>([]);
  const [metricas, setMetricas] = useState<any[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [metricaComp, setMetricaComp] = useState('');
  const [valorComp, setValorComp] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [compromisoDeclarado, setCompromisoDeclarado] = useState(false);

  useEffect(() => {
    Promise.all([api.config.acciones(), api.config.metricas()])
      .then(([a, m]) => { setAcciones(a); setMetricas(m); })
      .catch(() => {});
  }, []);

  const yaElegidas = (estado?.accionesElegidas ?? []).map((a: any) => a.accionId);
  const presupuesto = estado?.presupuestoDisponible ?? 0;

  function toggleAccion(id: number) {
    if (yaElegidas.includes(id)) return;
    setSeleccionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const costoSeleccion = seleccionadas.reduce((s, id) => {
    const a = acciones.find(x => x.id === id);
    return s + (a?.costo ?? 0);
  }, 0);

  async function confirmarAcciones() {
    if (seleccionadas.length === 0) return;
    setError('');
    setCargando(true);
    try {
      const res = await api.partida.acciones(seleccionadas.map(id => ({ accionId: id })));
      onEstadoCambio(res);
      setSeleccionadas([]);
    } catch (err: any) {
      setError(err.message);
    }
    setCargando(false);
  }

  async function declararCompromiso() {
    if (!metricaComp || !valorComp) return;
    setError('');
    try {
      await api.partida.compromiso(metricaComp, parseFloat(valorComp));
      setCompromisoDeclarado(true);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function avanzarCiclo() {
    setCargando(true);
    setError('');
    try {
      const res = await api.partida.avanzar();
      onEstadoCambio(res.estado);
      setCompromisoDeclarado(false);
    } catch (err: any) {
      setError(err.message);
    }
    setCargando(false);
  }

  const metricaActual = metricas.find(m => m.id === metricaComp);
  const kpis = estado?.kpis;
  const valorActual = metricaComp && kpis ? kpis[metricaComp] : null;

  return (
    <div>
      <div className="grid-2">
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ color: 'var(--color-primario)', fontSize: 18, fontWeight: 700 }}>
              Acciones disponibles
            </h3>
            <div style={{ fontSize: 13, color: 'var(--color-texto-secundario)' }}>
              <strong style={{ color: 'var(--color-primario)', fontSize: 16 }}>${presupuesto}</strong>
              {costoSeleccion > 0 && (
                <span style={{ color: 'var(--color-advertencia)', marginLeft: 6 }}>
                  (-${costoSeleccion})
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {acciones.map(a => {
              const yaElegida = yaElegidas.includes(a.id);
              const sel = seleccionadas.includes(a.id);
              const noAlcanza = !yaElegida && !sel && a.costo > presupuesto - costoSeleccion;

              return (
                <div key={a.id}
                  className={`accion-card ${sel ? 'seleccionada' : ''} ${yaElegida || noAlcanza ? 'deshabilitada' : ''}`}
                  onClick={() => !yaElegida && !noAlcanza && toggleAccion(a.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-texto)' }}>{a.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-texto-secundario)', marginTop: 4, lineHeight: 1.5 }}>
                        {a.descripcion}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-primario)', fontSize: 16 }}>${a.costo}</div>
                      <div style={{
                        fontSize: 11,
                        color: a.demora === 0 ? 'var(--color-exito)' : 'var(--color-texto-terciario)',
                        marginTop: 2,
                      }}>
                        {a.demora === 0 ? 'Inmediata' : `${a.demora} ciclo(s)`}
                      </div>
                    </div>
                  </div>
                  {yaElegida && (
                    <span className="badge badge-exito" style={{ marginTop: 8 }}>Ya elegida</span>
                  )}
                </div>
              );
            })}
          </div>

          {seleccionadas.length > 0 && (
            <button className="btn-acento" style={{ width: '100%', marginTop: 14, padding: 14, fontSize: 15 }}
              onClick={confirmarAcciones} disabled={cargando || costoSeleccion > presupuesto}>
              Confirmar {seleccionadas.length} accion(es) (${costoSeleccion})
            </button>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 14, color: 'var(--color-primario)', fontSize: 18, fontWeight: 700 }}>
            Compromiso del ciclo
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginBottom: 14, lineHeight: 1.6 }}>
            Declara al consejo que metrica vas a mejorar y a cuanto te comprometes.
          </p>

          {compromisoDeclarado ? (
            <div className="tarjeta" style={{
              background: 'var(--color-exito-suave)',
              marginBottom: 20,
              border: '1px solid rgba(26, 122, 76, 0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <strong style={{ color: 'var(--color-exito)', fontSize: 14 }}>Compromiso declarado</strong>
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>
                {metricaActual?.nombre}: <strong style={{ color: 'var(--color-texto)' }}>{valorComp} {metricaActual?.unidad}</strong>
              </p>
            </div>
          ) : (
            <div className="tarjeta" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6,
                  color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Metrica
                </label>
                <select value={metricaComp} onChange={e => {
                  setMetricaComp(e.target.value);
                  if (kpis && e.target.value) setValorComp(String(kpis[e.target.value] ?? ''));
                }}>
                  <option value="">Selecciona...</option>
                  {metricas.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} (actual: {kpis?.[m.id]?.toFixed?.(1) ?? '?'} {m.unidad})
                    </option>
                  ))}
                </select>
              </div>
              {metricaComp && valorActual != null && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6,
                    color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    Valor prometido
                    <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                      (actual: {typeof valorActual === 'number' ? valorActual.toFixed(1) : valorActual})
                    </span>
                  </label>
                  <input type="number" step="0.1" value={valorComp}
                    onChange={e => setValorComp(e.target.value)} />
                </div>
              )}
              <button className="btn-primario" onClick={declararCompromiso}
                disabled={!metricaComp || !valorComp} style={{ width: '100%' }}>
                Declarar compromiso
              </button>
            </div>
          )}

          <button className="btn-acento" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
            onClick={avanzarCiclo} disabled={cargando || !compromisoDeclarado}>
            Avanzar al siguiente ciclo
          </button>

          {estado?.kpis && (
            <div className="tarjeta" style={{ marginTop: 20 }}>
              <h4 style={{
                marginBottom: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--color-primario)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>📊</span>
                KPIs actuales
              </h4>
              <div style={{ fontSize: 13 }}>
                {metricas.map(m => (
                  <div key={m.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-borde-sutil)',
                  }}>
                    <span style={{ color: 'var(--color-texto-secundario)' }}>{m.nombre}</span>
                    <strong style={{ color: 'var(--color-texto)' }}>
                      {kpis?.[m.id]?.toFixed?.(1) ?? '-'} {m.unidad}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'var(--color-peligro-suave)',
          color: 'var(--color-peligro)',
          padding: '10px 14px',
          borderRadius: 'var(--radio)',
          fontSize: 13,
          fontWeight: 500,
          marginTop: 14,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
