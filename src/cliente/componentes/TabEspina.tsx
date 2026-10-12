import { useState } from 'react';
import { RAMAS_6M, ORIGENES, ESTADOS, ultimaVotacion } from '../../compartido/espina.js';
import type { Espina, Origen, Rama, Tarjeta, EstadoTarjeta } from '../../compartido/espina.js';
import { useEspina, agregarTarjeta, actualizarTarjeta, eliminarTarjeta, adjuntarEvidencia, quitarEvidencia } from '../espina.js';
import { Icono } from './ui/Iconos.js';

const CLASE_ESTADO: Record<EstadoTarjeta, string> = { hipotesis: 'badge-info', verificada: 'badge-exito', refutada: 'badge-advertencia' };

interface Props {
  onAgregar?: (rama: Rama, origen: Origen) => void;
}

// Diagrama de Ishikawa con las 6M: cada tarjeta es una causa posible con su evidencia
export function TabEspina({ onAgregar }: Props) {
  const espina = useEspina();
  const votadas = new Set(ultimaVotacion(espina)?.causas ?? []);
  const cuenta = (e: EstadoTarjeta) => espina.tarjetas.filter(t => t.estado === e).length;
  const arriba = RAMAS_6M.slice(0, 3);
  const abajo = RAMAS_6M.slice(3);

  return (
    <div data-tour="espina-contenido">
      <div className="espina-encabezado">
        <div>
          <h3>Espina de pescado</h3>
          <p>Ordena las causas posibles en las 6M. Una causa solo queda verificada cuando le adjuntas una gráfica o cálculo de la pestaña Datos.</p>
        </div>
        <div className="espina-cuentas">
          <span className="badge badge-info">{cuenta('hipotesis')} hipótesis</span>
          <span className="badge badge-exito">{cuenta('verificada')} verificadas</span>
          <span className="badge badge-advertencia">{cuenta('refutada')} refutadas</span>
        </div>
      </div>

      <div className="espina-diagrama">
        <div className="espina-fila">
          {arriba.map(r => <RamaEspina key={r.id} rama={r.id} nombre={r.nombre} espina={espina} votadas={votadas} onAgregar={onAgregar} />)}
        </div>
        <div className="espina-columna-vertebral" aria-hidden="true">
          <span className="espina-linea" />
          <div className="espina-cabeza">Efecto: ETF Bank tarda demasiado en entregar las tarjetas de crédito</div>
        </div>
        <div className="espina-fila">
          {abajo.map(r => <RamaEspina key={r.id} rama={r.id} nombre={r.nombre} espina={espina} votadas={votadas} onAgregar={onAgregar} />)}
        </div>
      </div>

      <Evidencias espina={espina} />
      <Porques espina={espina} />
    </div>
  );
}

function RamaEspina({ rama, nombre, espina, votadas, onAgregar }: { rama: Rama; nombre: string; espina: Espina; votadas: Set<string>; onAgregar?: Props['onAgregar'] }) {
  const [agregando, setAgregando] = useState(false);
  const [texto, setTexto] = useState('');
  const [origen, setOrigen] = useState<Origen>('propio');
  const tarjetas = espina.tarjetas.filter(t => t.rama === rama);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    agregarTarjeta({ rama, texto, origen });
    onAgregar?.(rama, origen);
    setTexto('');
    setAgregando(false);
  }

  return (
    <section className="espina-rama" aria-label={`Rama ${nombre}`}>
      <header>
        <h4>{nombre}</h4>
        <span>{tarjetas.length}</span>
      </header>
      <div className="espina-tarjetas">
        {tarjetas.map(t => <TarjetaEspina key={t.id} tarjeta={t} espina={espina} votada={votadas.has(t.id)} />)}
      </div>
      {agregando ? (
        <form className="espina-form" onSubmit={guardar}>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder="Describe la causa posible" rows={3} autoFocus maxLength={400} />
          <select value={origen} onChange={e => setOrigen(e.target.value as Origen)} aria-label="Origen de la causa">
            {Object.entries(ORIGENES).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="btn-primario btn-sm" disabled={!texto.trim()}>Agregar</button>
            <button type="button" className="btn-fantasma btn-sm" onClick={() => setAgregando(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className="espina-agregar" onClick={() => setAgregando(true)}>+ Agregar causa</button>
      )}
    </section>
  );
}

function TarjetaEspina({ tarjeta, espina, votada }: { tarjeta: Tarjeta; espina: Espina; votada: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const evs = tarjeta.evidencias.map(id => espina.evidencias.find(e => e.id === id)).filter(e => e != null);
  const disponibles = espina.evidencias.filter(e => !tarjeta.evidencias.includes(e.id));

  return (
    <article className={`espina-tarjeta estado-${tarjeta.estado}`}>
      <button className="espina-tarjeta-resumen" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
        <span className="espina-tarjeta-texto">{tarjeta.texto}</span>
        <span className="espina-tarjeta-meta">
          <span className={`badge ${CLASE_ESTADO[tarjeta.estado]}`}>{ESTADOS[tarjeta.estado]}</span>
          <span>{ORIGENES[tarjeta.origen]}</span>
          {evs.length > 0 && <span>· {evs.length} {evs.length === 1 ? 'evidencia' : 'evidencias'}</span>}
          {votada && <span className="badge badge-primario">Votada</span>}
        </span>
      </button>
      {abierta && (
        <div className="espina-tarjeta-detalle">
          <label className="campo-label" htmlFor={`estado-${tarjeta.id}`}>Estado</label>
          <select id={`estado-${tarjeta.id}`} value={tarjeta.estado} onChange={e => actualizarTarjeta(tarjeta.id, { estado: e.target.value as EstadoTarjeta })}>
            <option value="hipotesis">Hipótesis</option>
            <option value="verificada" disabled={evs.length === 0}>Verificada{evs.length === 0 ? ' (requiere evidencia)' : ''}</option>
            <option value="refutada">Refutada</option>
          </select>

          <span className="campo-label">Evidencia</span>
          {evs.length === 0 && <p className="datos-nota" style={{ margin: 0 }}>Sin evidencia. En la pestaña Datos, usa "Adjuntar a la espina" sobre una gráfica o cálculo.</p>}
          <ul className="espina-evidencias">
            {evs.map(e => (
              <li key={e.id}>
                <span>{e.resumen}</span>
                <button className="aviso-cerrar" onClick={() => quitarEvidencia(tarjeta.id, e.id)} aria-label="Quitar evidencia"><Icono nombre="cerrar" tamano={14} /></button>
              </li>
            ))}
          </ul>
          {disponibles.length > 0 && (
            <select value="" onChange={e => e.target.value && adjuntarEvidencia(tarjeta.id, e.target.value)} aria-label="Adjuntar evidencia guardada">
              <option value="">Adjuntar evidencia guardada…</option>
              {disponibles.map(e => <option key={e.id} value={e.id}>{e.resumen}</option>)}
            </select>
          )}
          <button className="btn-fantasma btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => eliminarTarjeta(tarjeta.id)}>Eliminar causa</button>
        </div>
      )}
    </article>
  );
}

function Evidencias({ espina }: { espina: Espina }) {
  if (espina.evidencias.length === 0) return null;
  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--color-primario)' }}>Evidencias guardadas desde Datos</h4>
      <ul className="espina-evidencias">
        {espina.evidencias.map(e => {
          const usos = espina.tarjetas.filter(t => t.evidencias.includes(e.id)).length;
          return <li key={e.id}><span>{e.resumen}</span><span className="datos-nota" style={{ margin: 0 }}>Ciclo {e.ciclo} · {usos === 0 ? 'sin asignar' : `en ${usos} ${usos === 1 ? 'causa' : 'causas'}`}</span></li>;
        })}
      </ul>
    </div>
  );
}

function Porques({ espina }: { espina: Espina }) {
  const v = ultimaVotacion(espina);
  if (!v) return null;
  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--color-primario)' }}>Tus 5 porqués del ciclo {v.ciclo}</h4>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
        {v.porques.map((p, i) => <li key={i}>{p}</li>)}
      </ol>
    </div>
  );
}
