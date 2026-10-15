import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Icono } from './ui/Iconos.js';
import { useUI } from './ui/Notificaciones.js';
import { VotacionCiclo } from './VotacionCiclo.js';
import { AvisoBetancourt } from './Betancourt.js';
import { useEspina } from '../espina.js';
import { useSesion } from '../i18n.js';

interface Props {
  estado: any;
  onEstadoCambio: (estado: any) => void;
  onIrEspina?: () => void;
}

export function TabDecisiones({ estado, onEstadoCambio, onIrEspina }: Props) {
  const { t } = useSesion();
  const nombreMetrica = (id: string) => t(`metricas.${id}`);
  const unidad = (u?: string) => (u === 'dias' ? t('proceso.dias') : u ?? '');
  const { avisar, confirmar } = useUI();
  const [acciones, setAcciones] = useState<any[]>([]);
  const [metricas, setMetricas] = useState<any[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [metricaComp, setMetricaComp] = useState('');
  const [valorComp, setValorComp] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [compromisoDeclarado, setCompromisoDeclarado] = useState(false);
  const [votando, setVotando] = useState(false);
  const [causaPorAccion, setCausaPorAccion] = useState<Record<number, string>>({});
  const [avisos, setAvisos] = useState<string[]>([]);
  const espina = useEspina();
  // Las verificadas primero: son las que sustentan una decisión
  const causasOrdenadas = [...espina.tarjetas].sort((a, b) => Number(b.estado === 'verificada') - Number(a.estado === 'verificada'));

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
    const nombres = seleccionadas.map(id => acciones.find(x => x.id === id)?.nombre ?? t('decisiones.accion', { n: id }));
    const ok = await confirmar({
      titulo: seleccionadas.length === 1 ? t('decisiones.confirmarTitulo1') : t('decisiones.confirmarTitulo', { n: seleccionadas.length }),
      mensaje: (
        <>
          <ul style={{ margin: '0 0 10px 18px' }}>
            {nombres.map(n => <li key={n}>{n}</li>)}
          </ul>
          {t('decisiones.confirmarMensaje', { costo: costoSeleccion })}
        </>
      ),
      textoConfirmar: t('decisiones.confirmarAcciones'),
      tono: 'advertencia',
      icono: 'acciones',
    });
    if (!ok) return;
    setError('');
    setCargando(true);
    try {
      const res = await api.partida.acciones(seleccionadas.map(id => ({ accionId: id, tarjetaId: causaPorAccion[id] || null })));
      onEstadoCambio(res);
      setSeleccionadas([]);
      setCausaPorAccion({});
      if (res?.avisos?.length) setAvisos(res.avisos);
      avisar('exito', t('decisiones.confirmadas'), t('decisiones.presupuestoRestante', { n: res?.presupuestoDisponible ?? presupuesto - costoSeleccion }));
    } catch (err: any) {
      setError(String(err?.message ?? '').startsWith('Presupuesto insuficiente') ? t('decisiones.sinPresupuesto') : t('decisiones.error'));
    }
    setCargando(false);
  }

  async function declararCompromiso() {
    if (!metricaComp || !valorComp) return;
    setError('');
    try {
      await api.partida.compromiso(metricaComp, parseFloat(valorComp));
      setCompromisoDeclarado(true);
      avisar('exito', t('decisiones.compromisoDeclarado'), `${nombreMetrica(metricaComp)}: ${valorComp} ${unidad(metricaActual?.unidad)}`.trim());
    } catch (err: any) {
      setError(String(err?.message ?? '').startsWith('Presupuesto insuficiente') ? t('decisiones.sinPresupuesto') : t('decisiones.error'));
    }
  }

  // Antes de avanzar se votan las causas principales y se escriben los 5 porqués
  function avanzarCiclo() {
    setVotando(true);
  }

  async function confirmarAvance() {
    setVotando(false);
    const ok = await confirmar({
      titulo: t('decisiones.avanzarTitulo'),
      mensaje: seleccionadas.length > 0
        ? t('decisiones.avanzarDescartar')
        : t('decisiones.avanzarMensaje'),
      textoConfirmar: t('decisiones.avanzarCiclo'),
      tono: 'advertencia',
      icono: 'avanzar',
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
        avisar('info', t('decisiones.cicloIniciado', { n: res.estado?.cicloActual ?? '' }), t('decisiones.equipoEspera'));
      }
    } catch (err: any) {
      setError(String(err?.message ?? '').startsWith('Presupuesto insuficiente') ? t('decisiones.sinPresupuesto') : t('decisiones.error'));
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
              {t('decisiones.disponibles')}
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
                        {a.demora === 0 ? t('decisiones.inmediata') : a.demora === 1 ? t('decisiones.unCiclo') : t('decisiones.ciclos', { n: a.demora })}
                      </div>
                    </div>
                  </div>
                  {yaElegida && (
                    <span className="badge badge-exito" style={{ marginTop: 8 }}>{t('decisiones.yaElegida')}</span>
                  )}
                  {sel && (
                    <div className="accion-causa" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                      <label className="campo-label" htmlFor={`causa-${a.id}`}>{t('decisiones.queCausa')}</label>
                      <select id={`causa-${a.id}`} value={causaPorAccion[a.id] ?? ''}
                        onChange={e => setCausaPorAccion(c => ({ ...c, [a.id]: e.target.value }))}>
                        <option value="">{t('decisiones.ninguna')}</option>
                        {causasOrdenadas.map(c => <option key={c.id} value={c.id}>[{t(`espinaUi.estados.${c.estado}`)}] {c.texto}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {seleccionadas.length > 0 && (
            <button className="btn-advertencia" style={{ width: '100%', marginTop: 14, padding: 14, fontSize: 15 }}
              onClick={confirmarAcciones} disabled={cargando || costoSeleccion > presupuesto}>
              {seleccionadas.length === 1 ? t('decisiones.confirmar1', { costo: costoSeleccion }) : t('decisiones.confirmarN', { n: seleccionadas.length, costo: costoSeleccion })}
            </button>
          )}
        </div>

        <div>
          <h3 style={{ marginBottom: 14, color: 'var(--color-primario)', fontSize: 18, fontWeight: 700 }}>
            {t('decisiones.compromisoTitulo')}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginBottom: 14, lineHeight: 1.6 }}>
            {t('decisiones.compromisoAyuda')}
          </p>

          {compromisoDeclarado ? (
            <div className="tarjeta" style={{
              background: 'var(--color-exito-suave)',
              marginBottom: 20,
              border: '1px solid rgba(26, 122, 76, 0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ color: 'var(--color-exito)', fontSize: 14 }}>{t('decisiones.compromisoDeclarado')}</strong>
              </div>
              <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>
                {nombreMetrica(metricaComp)}: <strong style={{ color: 'var(--color-texto)' }}>{valorComp} {unidad(metricaActual?.unidad)}</strong>
              </p>
            </div>
          ) : (
            <div className="tarjeta" style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="campo-label" htmlFor="metrica-comp">
                  {t('decisiones.metrica')}
                </label>
                <select id="metrica-comp" value={metricaComp} onChange={e => {
                  setMetricaComp(e.target.value);
                  if (kpis && e.target.value) setValorComp(String(kpis[e.target.value] ?? ''));
                }}>
                  <option value="">{t('decisiones.selecciona')}</option>
                  {metricas.map(m => (
                    <option key={m.id} value={m.id}>
                      {nombreMetrica(m.id)} · {t('decisiones.actual', { n: `${kpis?.[m.id]?.toFixed?.(1) ?? ''} ${unidad(m.unidad)}`.trim() })}
                    </option>
                  ))}
                </select>
              </div>
              {metricaComp && valorActual != null && (
                <div style={{ marginBottom: 14 }}>
                  <label className="campo-label" htmlFor="valor-comp">
                    {t('decisiones.valorPrometido')}
                    <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6 }}>
                      {t('decisiones.actual', { n: typeof valorActual === 'number' ? valorActual.toFixed(1) : String(valorActual) })}
                    </span>
                  </label>
                  <input id="valor-comp" type="number" step="0.1" value={valorComp}
                    onChange={e => setValorComp(e.target.value)} />
                </div>
              )}
              <button className="btn-primario" onClick={declararCompromiso}
                disabled={!metricaComp || !valorComp} style={{ width: '100%' }}>
                {t('decisiones.declarar')}
              </button>
            </div>
          )}

          <button className="btn-advertencia" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
            onClick={avanzarCiclo} disabled={cargando || !compromisoDeclarado}>
            {t('decisiones.avanzar')}
          </button>
          {avisos.length > 0 && <AvisoBetancourt avisos={avisos} onCerrar={() => setAvisos([])} />}
          {votando && (
            <VotacionCiclo ciclo={estado?.cicloActual ?? 1} onCancelar={() => setVotando(false)} onVotado={confirmarAvance}
              onIrEspina={() => { setVotando(false); onIrEspina?.(); }} />
          )}

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
                <Icono nombre="grafica" tamano={18} />
                {t('decisiones.kpis')}
              </h4>
              <div style={{ fontSize: 13 }}>
                {metricas.map(m => (
                  <div key={m.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--color-borde-sutil)',
                  }}>
                    <span style={{ color: 'var(--color-texto-secundario)' }}>{nombreMetrica(m.id)}</span>
                    <strong style={{ color: 'var(--color-texto)' }}>
                      {kpis?.[m.id]?.toFixed?.(1) ?? '-'} {unidad(m.unidad)}
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
