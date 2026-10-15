import { useState } from 'react';
import { RAMAS_6M, ORIGENES, ultimaVotacion } from '../../compartido/espina.js';
import type { Espina, Origen, Rama, Tarjeta, EstadoTarjeta } from '../../compartido/espina.js';
import { useEspina, agregarTarjeta, actualizarTarjeta, eliminarTarjeta, adjuntarEvidencia, quitarEvidencia } from '../espina.js';
import { Icono } from './ui/Iconos.js';
import { useUI } from './ui/Notificaciones.js';
import { useSesion } from '../i18n.js';

const CLASE_ESTADO: Record<EstadoTarjeta, string> = { hipotesis: 'badge-info', verificada: 'badge-exito', refutada: 'badge-advertencia' };

interface Props {
  onAgregar?: (rama: Rama, origen: Origen) => void;
}

// Diagrama de Ishikawa con las 6M: cada tarjeta es una causa posible con su evidencia
export function TabEspina({ onAgregar }: Props) {
  const { t } = useSesion();
  const espina = useEspina();
  const votadas = new Set(ultimaVotacion(espina)?.causas ?? []);
  const cuenta = (e: EstadoTarjeta) => espina.tarjetas.filter(x => x.estado === e).length;
  const arriba = RAMAS_6M.slice(0, 3);
  const abajo = RAMAS_6M.slice(3);

  return (
    <div data-tour="espina-contenido">
      <div className="espina-encabezado">
        <div>
          <h3>{t('espinaUi.titulo')}</h3>
          <p>{t('espinaUi.ayuda')}</p>
        </div>
        <div className="espina-cuentas">
          <span className="badge badge-info">{t('espinaUi.cuentas.hipotesis', { n: cuenta('hipotesis') })}</span>
          <span className="badge badge-exito">{t('espinaUi.cuentas.verificada', { n: cuenta('verificada') })}</span>
          <span className="badge badge-advertencia">{t('espinaUi.cuentas.refutada', { n: cuenta('refutada') })}</span>
        </div>
      </div>

      <div className="espina-diagrama">
        <div className="espina-fila">
          {arriba.map(r => <RamaEspina key={r.id} rama={r.id} espina={espina} votadas={votadas} onAgregar={onAgregar} />)}
        </div>
        <div className="espina-columna-vertebral" aria-hidden="true">
          <span className="espina-linea" />
          <div className="espina-cabeza">{t('espinaUi.efecto')}</div>
        </div>
        <div className="espina-fila">
          {abajo.map(r => <RamaEspina key={r.id} rama={r.id} espina={espina} votadas={votadas} onAgregar={onAgregar} />)}
        </div>
      </div>

      <Evidencias espina={espina} />
      <Porques espina={espina} />
    </div>
  );
}

function RamaEspina({ rama, espina, votadas, onAgregar }: { rama: Rama; espina: Espina; votadas: Set<string>; onAgregar?: Props['onAgregar'] }) {
  const { t } = useSesion();
  const [agregando, setAgregando] = useState(false);
  const [texto, setTexto] = useState('');
  const [origen, setOrigen] = useState<Origen>('propio');
  const tarjetas = espina.tarjetas.filter(x => x.rama === rama);
  const nombre = t(`espinaUi.ramas.${rama}`);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    agregarTarjeta({ rama, texto, origen });
    onAgregar?.(rama, origen);
    setTexto('');
    setAgregando(false);
  }

  return (
    <section className="espina-rama" aria-label={nombre}>
      <header>
        <h4>{nombre}</h4>
        <span>{tarjetas.length}</span>
      </header>
      <div className="espina-tarjetas">
        {tarjetas.map(x => <TarjetaEspina key={x.id} tarjeta={x} espina={espina} votada={votadas.has(x.id)} />)}
      </div>
      {agregando ? (
        <form className="espina-form" onSubmit={guardar}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder={t('espinaUi.describe')} rows={3} autoFocus maxLength={400} />
          <select value={origen} onChange={e => setOrigen(e.target.value as Origen)} aria-label={t('espinaUi.origen')}>
            {Object.keys(ORIGENES).map(id => <option key={id} value={id}>{t(`espinaUi.origenes.${id}`)}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="btn-primario btn-sm" disabled={!texto.trim()}>{t('espinaUi.agregar')}</button>
            <button type="button" className="btn-fantasma btn-sm" onClick={() => setAgregando(false)}>{t('comun.cancelar')}</button>
          </div>
        </form>
      ) : (
        <button className="espina-agregar" onClick={() => setAgregando(true)}>+ {t('espinaUi.agregarCausa')}</button>
      )}
    </section>
  );
}

function TarjetaEspina({ tarjeta, espina, votada }: { tarjeta: Tarjeta; espina: Espina; votada: boolean }) {
  const { t } = useSesion();
  const { confirmar } = useUI();
  const [abierta, setAbierta] = useState(false);
  const evs = tarjeta.evidencias.map(id => espina.evidencias.find(e => e.id === id)).filter(e => e != null);
  const disponibles = espina.evidencias.filter(e => !tarjeta.evidencias.includes(e.id));

  async function eliminar() {
    const ok = await confirmar({ titulo: t('espinaUi.eliminarCausa'), mensaje: t('espinaUi.eliminarMensaje', { texto: tarjeta.texto }), textoConfirmar: t('comun.eliminar'), tono: 'peligro', icono: 'eliminar' });
    if (ok) eliminarTarjeta(tarjeta.id);
  }

  return (
    <article className={`espina-tarjeta estado-${tarjeta.estado}`}>
      <button className="espina-tarjeta-resumen" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
        <span className="espina-tarjeta-texto">{tarjeta.texto}</span>
        <span className="espina-tarjeta-meta">
          <span className={`badge ${CLASE_ESTADO[tarjeta.estado]}`}>{t(`espinaUi.estados.${tarjeta.estado}`)}</span>
          <span>{t(`espinaUi.origenes.${tarjeta.origen}`)}</span>
          {evs.length > 0 && <span>· {evs.length} {evs.length === 1 ? t('espinaUi.evidencia') : t('espinaUi.evidencias')}</span>}
          {votada && <span className="badge badge-primario">{t('espinaUi.votada')}</span>}
        </span>
      </button>
      {abierta && (
        <div className="espina-tarjeta-detalle">
          <label className="campo-label" htmlFor={`estado-${tarjeta.id}`}>{t('espinaUi.estado')}</label>
          <select id={`estado-${tarjeta.id}`} value={tarjeta.estado} onChange={e => actualizarTarjeta(tarjeta.id, { estado: e.target.value as EstadoTarjeta })}>
            <option value="hipotesis">{t('espinaUi.estados.hipotesis')}</option>
            <option value="verificada" disabled={evs.length === 0} title={evs.length === 0 ? t('espinaUi.requiereEvidencia') : undefined}>{t('espinaUi.estados.verificada')}</option>
            <option value="refutada">{t('espinaUi.estados.refutada')}</option>
          </select>

          <span className="campo-label">{t('espinaUi.evidenciaTitulo')}</span>
          {evs.length === 0 && <p className="datos-nota" style={{ margin: 0 }}>{t('espinaUi.sinEvidencia')}</p>}
          <ul className="espina-evidencias">
            {evs.map(e => (
              <li key={e.id}>
                <span>{e.resumen}</span>
                <button className="aviso-cerrar" onClick={() => quitarEvidencia(tarjeta.id, e.id)} aria-label={t('espinaUi.quitarEvidencia')}><Icono nombre="cerrar" tamano={14} /></button>
              </li>
            ))}
          </ul>
          {disponibles.length > 0 && (
            <select value="" onChange={e => e.target.value && adjuntarEvidencia(tarjeta.id, e.target.value)} aria-label={t('espinaUi.adjuntarGuardada')}>
              <option value="">{t('espinaUi.adjuntarGuardada')}</option>
              {disponibles.map(e => <option key={e.id} value={e.id}>{e.resumen}</option>)}
            </select>
          )}
          <button className="btn-fantasma btn-sm" style={{ alignSelf: 'flex-start' }} onClick={eliminar}>{t('espinaUi.eliminarCausa')}</button>
        </div>
      )}
    </article>
  );
}

function Evidencias({ espina }: { espina: Espina }) {
  const { t } = useSesion();
  if (espina.evidencias.length === 0) return null;
  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--color-primario)' }}>{t('espinaUi.guardadas')}</h4>
      <ul className="espina-evidencias">
        {espina.evidencias.map(e => {
          const usos = espina.tarjetas.filter(x => x.evidencias.includes(e.id)).length;
          return (
            <li key={e.id}>
              <span>{e.resumen}</span>
              <span className="datos-nota" style={{ margin: 0 }}>
                {t('espinaUi.ciclo', { n: e.ciclo })} · {usos === 0 ? t('espinaUi.sinAsignar') : usos === 1 ? t('espinaUi.enCausa') : t('espinaUi.enCausas', { n: usos })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Porques({ espina }: { espina: Espina }) {
  const { t } = useSesion();
  const v = ultimaVotacion(espina);
  if (!v) return null;
  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--color-primario)' }}>{t('espinaUi.porques', { n: v.ciclo })}</h4>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
        {v.porques.map((p, i) => <li key={i}>{p}</li>)}
      </ol>
    </div>
  );
}
