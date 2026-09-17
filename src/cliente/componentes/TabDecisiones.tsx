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
          <h3 style={{ marginBottom: 12, color: 'var(--color-primario)' }}>Acciones disponibles</h3>
          <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginBottom: 12 }}>
            Presupuesto: <strong>{presupuesto}</strong> unidades
            {costoSeleccion > 0 && <span> (seleccion: {costoSeleccion})</span>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {acciones.map(a => {
              const yaElegida = yaElegidas.includes(a.id);
              const sel = seleccionadas.includes(a.id);
              const noAlcanza = !yaElegida && !sel && a.costo > presupuesto - costoSeleccion;

              return (
                <div key={a.id}
                  className={`accion-card ${sel ? 'seleccionada' : ''} ${yaElegida || noAlcanza ? 'deshabilitada' : ''}`}
                  onClick={() => !yaElegida && !noAlcanza && toggleAccion(a.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nombre}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-texto-secundario)', marginTop: 2 }}>
                        {a.descripcion}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-primario)' }}>${a.costo}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-texto-secundario)' }}>
                        {a.demora === 0 ? 'Inmediata' : `${a.demora} ciclo(s)`}
                      </div>
                    </div>
                  </div>
                  {yaElegida && <span className="badge badge-exito" style={{ marginTop: 6 }}>Ya elegida</span>}
                </div>
              );
            })}
          </div>

          {seleccionadas.length > 0 && (
            <button className="btn-acento" style={{ width: '100%', marginTop: 12, padding: 12 }}
              onClick={confirmarAcciones} disabled={cargando || costoSeleccion > presupuesto}>
              Confirmar {seleccionadas.length} accion(es) (${costoSeleccion})
            </button>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 12, color: 'var(--color-primario)' }}>Compromiso del ciclo</h3>
          <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginBottom: 12 }}>
            Declara al consejo que metrica vas a mejorar y a cuanto te comprometes.
          </p>

          {compromisoDeclarado ? (
            <div className="tarjeta" style={{ background: '#f0fff4', marginBottom: 16 }}>
              <p style={{ color: 'var(--color-exito)', fontWeight: 600 }}>Compromiso declarado</p>
              <p style={{ fontSize: 14 }}>
                {metricaActual?.nombre}: {valorComp} {metricaActual?.unidad}
              </p>
            </div>
          ) : (
            <div className="tarjeta" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Metrica</label>
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
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                    Valor prometido (actual: {typeof valorActual === 'number' ? valorActual.toFixed(1) : valorActual})
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

          <button className="btn-acento" style={{ width: '100%', padding: 14, fontSize: 16 }}
            onClick={avanzarCiclo} disabled={cargando || !compromisoDeclarado}>
            Avanzar al siguiente ciclo
          </button>

          {estado?.kpis && (
            <div className="tarjeta" style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>KPIs actuales</h4>
              <div style={{ fontSize: 13 }}>
                {metricas.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
                    borderBottom: '1px solid var(--color-borde)' }}>
                    <span>{m.nombre}</span>
                    <strong>{kpis?.[m.id]?.toFixed?.(1) ?? '-'} {m.unidad}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'var(--color-peligro)', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}
