import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useUI } from './ui/Notificaciones.js';

interface Props {
  estado: any;
  onEstadoCambio: (estado: any) => void;
}

export function TabDecisiones({ estado, onEstadoCambio }: Props) {
  const { avisar, confirmar } = useUI();
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
    const nombres = seleccionadas.map(id => acciones.find(x => x.id === id)?.nombre ?? `Acción ${id}`);
    const ok = await confirmar({
      titulo: `Confirmar ${seleccionadas.length} acción(es)`,
      mensaje: (
        <>
          <ul style={{ margin: '0 0 10px 18px' }}>
            {nombres.map(n => <li key={n}>{n}</li>)}
          </ul>
          Se descontarán <strong>${costoSeleccion}</strong> de tu presupuesto. Una vez confirmadas no se pueden revertir.
        </>
      ),
      textoConfirmar: 'Confirmar acciones',
      tono: 'advertencia',
    });
    if (!ok) return;
    setError('');
    setCargando(true);
    try {
      const res = await api.partida.acciones(seleccionadas.map(id => ({ accionId: id })));
      onEstadoCambio(res);
      setSeleccionadas([]);
      avisar('exito', 'Acciones confirmadas', `Presupuesto restante: $${res?.presupuestoDisponible ?? presupuesto - costoSeleccion}`);
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
      avisar('exito', 'Compromiso declarado', `${metricaActual?.nombre ?? metricaComp}: ${valorComp} ${metricaActual?.unidad ?? ''}`.trim());
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function avanzarCiclo() {
    const ok = await confirmar({
      titulo: 'Avanzar al siguiente ciclo',
      mensaje: seleccionadas.length > 0
        ? 'Tienes acciones seleccionadas sin confirmar y se descartarán. El ciclo actual se cerrará y no podrás volver a él.'
        : 'El ciclo actual se cerrará y no podrás volver a él. Asegúrate de haber tomado todas tus decisiones.',
      textoConfirmar: 'Avanzar ciclo',
      tono: 'advertencia',
    });
    if (!ok) return;
    setCargando(true);
    setError('');
    try {
      const res = await api.partida.avanzar();
      onEstadoCambio(res.estado);
      setCompromisoDeclarado(false);
      setSeleccionadas([]);
      if (!res.estado?.terminada && res.estado?.fase !== 'finalizada') {
        avisar('info', `Ciclo ${res.estado?.cicloActual ?? ''} iniciado`.trim(), 'Revisa los nuevos datos y la sala de juntas.');
      }
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
                  role="checkbox"
                  aria-checked={sel}
                  aria-disabled={yaElegida || noAlcanza}
                  tabIndex={yaElegida || noAlcanza ? -1 : 0}
                  className={`accion-card ${sel ? 'seleccionada' : ''} ${yaElegida || noAlcanza ? 'deshabilitada' : ''}`}
                  onClick={() => !yaElegida && !noAlcanza && toggleAccion(a.id)}
                  onKeyDown={e => {
                    if ((e.key === ' ' || e.key === 'Enter') && !yaElegida && !noAlcanza) {
                      e.preventDefault();
                      toggleAccion(a.id);
                    }
                  }}>
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
            <button className="btn-advertencia" style={{ width: '100%', marginTop: 14, padding: 14, fontSize: 15 }}
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
            Declara al consejo qué métrica vas a mejorar y a cuánto te comprometes.
          </p>

          {compromisoDeclarado ? (
            <div className="tarjeta" style={{
              background: 'var(--color-exito-suave)',
              marginBottom: 20,
              border: '1px solid rgba(26, 122, 76, 0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ color: 'var(--color-exito)', fontSize: 14 }}>Compromiso declarado</strong>
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>
                {metricaActual?.nombre}: <strong style={{ color: 'var(--color-texto)' }}>{valorComp} {metricaActual?.unidad}</strong>
              </p>
            </div>
          ) : (
            <div className="tarjeta" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="campo-label" htmlFor="metrica-comp">
                  Métrica
                </label>
                <select id="metrica-comp" value={metricaComp} onChange={e => {
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
                  <label className="campo-label" htmlFor="valor-comp">
                    Valor prometido
                    <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                      (actual: {typeof valorActual === 'number' ? valorActual.toFixed(1) : valorActual})
                    </span>
                  </label>
                  <input id="valor-comp" type="number" step="0.1" value={valorComp}
                    onChange={e => setValorComp(e.target.value)} />
                </div>
              )}
              <button className="btn-primario" onClick={declararCompromiso}
                disabled={!metricaComp || !valorComp} style={{ width: '100%' }}>
                Declarar compromiso
              </button>
            </div>
          )}

          <button className="btn-advertencia" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
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
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primario)', letterSpacing: '0.04em' }}>KPI</span>
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
        <div className="alerta-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
    </div>
  );
}
