import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useUI } from '../componentes/ui/Notificaciones.js';
import { PiePagina } from '../componentes/ui/PiePagina.js';

const ETIQUETAS_ESTADO: Record<string, { texto: string; clase: string }> = {
  abierta: { texto: 'Abierta', clase: 'badge-info' },
  en_curso: { texto: 'En curso', clase: 'badge-exito' },
  finalizada: { texto: 'Finalizada', clase: 'badge-advertencia' },
};

function Login() {
  const nav = useNavigate();
  const { avisar } = useUI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<'login' | 'registro'>('login');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      if (modo === 'registro') {
        await api.profesor.registrar(email, password);
      }
      const res = await api.profesor.login(email, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('tipoAuth', 'profesor');
      if (modo === 'registro') avisar('exito', 'Cuenta creada', 'Bienvenido al panel del profesor.');
      nav('/profesor/panel');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pagina fondo-marca">
      <div className="pagina-contenido" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <form className="tarjeta" style={{ maxWidth: 420, width: '100%', border: 'none', boxShadow: 'var(--sombra-elevada)' }} onSubmit={submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--color-primario-suave)', marginBottom: 16,
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primario)' }}>Prof</span>
            </div>
            <h2 style={{ color: 'var(--color-primario)', fontSize: 22, fontWeight: 700 }}>
              {modo === 'login' ? 'Panel del Profesor' : 'Crear cuenta'}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="campo-label" htmlFor="email">Correo electronico</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com" required autoFocus />
            </div>
            <div>
              <label className="campo-label" htmlFor="password">Contrasena</label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                placeholder="Minimo 6 caracteres" required minLength={6} />
            </div>

            {error && <div className="alerta-error" role="alert">{error}</div>}

            <button className="btn-primario" type="submit" disabled={cargando} style={{ padding: 14, fontSize: 15, marginTop: 4 }}>
              {cargando ? 'Cargando...' : modo === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
            </button>
            <button type="button" className="btn-fantasma" onClick={() => { setError(''); setModo(modo === 'login' ? 'registro' : 'login'); }}>
              {modo === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
            </button>
          </div>

          <button type="button" className="btn-fantasma" style={{ width: '100%', marginTop: 16 }}
            onClick={() => nav('/')}>Volver al inicio</button>
        </form>
      </div>
      <PiePagina oscuro />
    </div>
  );
}

function Panel() {
  const nav = useNavigate();
  const { avisar, confirmar } = useUI();
  const [sesiones, setSesiones] = useState<any[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [nombre, setNombre] = useState('');
  const [creando, setCreando] = useState(false);
  const [detalle, setDetalle] = useState<any>(null);
  const [modoExp, setModoExp] = useState(false);
  const [pctTrat, setPctTrat] = useState(50);
  const [resumenExp, setResumenExp] = useState<any>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token') || localStorage.getItem('tipoAuth') !== 'profesor') {
      nav('/profesor');
      return;
    }
    cargarSesiones();
  }, []);

  async function cargarSesiones() {
    try {
      const data = await api.profesor.sesiones();
      setSesiones(data);
      setSeleccion(prev => new Set([...prev].filter(id => data.some((s: any) => s.id === id))));
    } catch (err: any) {
      avisar('error', 'No se pudieron cargar las sesiones', err.message);
    } finally {
      setCargandoLista(false);
    }
  }

  async function crearSesion(e: React.FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    setCreando(true);
    try {
      const sesion = await api.sesion.crear(limpio);
      setNombre('');
      await cargarSesiones();
      avisar('exito', 'Sesion creada', `Codigo de acceso: ${sesion.codigo}`);
    } catch (err: any) {
      avisar('error', 'No se pudo crear la sesion', err.message);
    } finally {
      setCreando(false);
    }
  }

  async function verDetalle(id: string) {
    try {
      const data = await api.profesor.sesion(id);
      setDetalle(data);
      setModoExp(data.sesion.modo_experimento ?? false);
      setPctTrat(data.sesion.pct_tratamiento ?? 50);
      if (data.sesion.modo_experimento) {
        api.experimento.resumen(id).then(r => setResumenExp(r)).catch(() => setResumenExp(null));
      } else {
        setResumenExp(null);
      }
    } catch (err: any) {
      avisar('error', 'No se pudo abrir la sesion', err.message);
    }
  }

  async function guardarExperimento() {
    if (!detalle) return;
    const ok = await confirmar({
      titulo: 'Guardar configuracion del experimento',
      mensaje: modoExp
        ? `El modo experimento quedara activo con ${pctTrat}% de participantes en el grupo tratamiento. Los participantes que ya se unieron conservan su grupo.`
        : 'El modo experimento quedara desactivado para esta sesion.',
      textoConfirmar: 'Guardar',
    });
    if (!ok) return;
    try {
      await api.experimento.configurar(detalle.sesion.id, modoExp, pctTrat);
      await verDetalle(detalle.sesion.id);
      avisar('exito', 'Configuracion guardada');
    } catch (err: any) {
      avisar('error', 'No se pudo guardar la configuracion', err.message);
    }
  }

  function exportarDatos(formato: string) {
    if (!detalle) return;
    const token = localStorage.getItem('token');
    const url = api.experimento.exportarUrl(detalle.sesion.id, formato);
    window.open(`${url}&token=${encodeURIComponent(token ?? '')}`, '_blank', 'noopener');
    avisar('info', `Exportando ${formato.toUpperCase()}`, 'La descarga se abrira en una pestana nueva.');
  }

  async function copiarCodigo(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      avisar('exito', 'Codigo copiado', codigo);
    } catch {
      avisar('error', 'No se pudo copiar el codigo');
    }
  }

  async function iniciarSesion(s: any) {
    const ok = await confirmar({
      titulo: `Iniciar "${s.nombre}"`,
      mensaje: 'Los participantes podran comenzar a jugar en cuanto la sesion inicie.',
      textoConfirmar: 'Iniciar sesion',
      tono: 'advertencia',
    });
    if (!ok) return;
    try {
      await api.profesor.iniciarSesion(s.id);
      await cargarSesiones();
      if (detalle?.sesion?.id === s.id) await verDetalle(s.id);
      avisar('exito', 'Sesion iniciada', s.nombre);
    } catch (err: any) {
      avisar('error', 'No se pudo iniciar la sesion', err.message);
    }
  }

  async function finalizarSesion(s: any) {
    const ok = await confirmar({
      titulo: `Finalizar "${s.nombre}"`,
      mensaje: 'Los participantes ya no podran continuar sus partidas. Esta accion no se puede deshacer.',
      textoConfirmar: 'Finalizar sesion',
      tono: 'peligro',
    });
    if (!ok) return;
    try {
      await api.profesor.finalizarSesion(s.id);
      await cargarSesiones();
      if (detalle?.sesion?.id === s.id) await verDetalle(s.id);
      avisar('exito', 'Sesion finalizada', s.nombre);
    } catch (err: any) {
      avisar('error', 'No se pudo finalizar la sesion', err.message);
    }
  }

  async function eliminar(ids: string[]) {
    if (ids.length === 0) return;
    const nombres = sesiones.filter(s => ids.includes(s.id)).map(s => s.nombre);
    const ok = await confirmar({
      titulo: ids.length === 1 ? `Eliminar "${nombres[0]}"` : `Eliminar ${ids.length} sesiones`,
      mensaje: 'Se borraran tambien los participantes, partidas y datos de telemetria asociados. Esta accion no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      tono: 'peligro',
    });
    if (!ok) return;
    setOcupado(true);
    try {
      const res = ids.length === 1
        ? await api.profesor.eliminarSesion(ids[0]!)
        : await api.profesor.eliminarSesiones(ids);
      if (detalle && ids.includes(detalle.sesion.id)) {
        setDetalle(null);
        setResumenExp(null);
      }
      setSeleccion(prev => new Set([...prev].filter(id => !ids.includes(id))));
      await cargarSesiones();
      avisar('exito', res.eliminadas === 1 ? 'Sesion eliminada' : `${res.eliminadas} sesiones eliminadas`);
    } catch (err: any) {
      avisar('error', 'No se pudo eliminar', err.message);
    } finally {
      setOcupado(false);
    }
  }

  function alternarSeleccion(id: string) {
    setSeleccion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function alternarTodas() {
    setSeleccion(prev => prev.size === sesiones.length ? new Set() : new Set(sesiones.map(s => s.id)));
  }

  async function cerrarSesion() {
    const ok = await confirmar({
      titulo: 'Cerrar sesion',
      mensaje: 'Tendras que volver a ingresar tu correo y contrasena para acceder al panel.',
      textoConfirmar: 'Cerrar sesion',
      tono: 'advertencia',
    });
    if (!ok) return;
    localStorage.clear();
    nav('/');
  }

  const todasSeleccionadas = sesiones.length > 0 && seleccion.size === sesiones.length;
  const algunaSeleccionada = seleccion.size > 0 && !todasSeleccionadas;

  return (
    <div className="pagina" style={{ background: 'var(--color-fondo)' }}>
      <header style={{
        background: 'var(--color-primario)',
        color: '#fff',
        padding: '16px 0',
        boxShadow: '0 2px 8px rgba(15, 43, 74, 0.2)',
      }}>
        <div className="contenedor" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Panel del Profesor</h1>
            <p style={{ fontSize: 12, opacity: 0.6 }}>Director de Operaciones · ETF Bank</p>
          </div>
          <button
            onClick={cerrarSesion}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '8px 16px',
              fontSize: 13,
            }}
          >
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="contenedor pagina-contenido" style={{ paddingTop: 24, paddingBottom: 40, width: '100%' }}>
        <div className="grid-2">
          <div>
            <div className="tarjeta" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600, color: 'var(--color-primario)' }}>
                Nueva sesion de juego
              </h3>
              <form onSubmit={crearSesion} style={{ display: 'flex', gap: 8 }}>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  aria-label="Nombre de la sesion" maxLength={80}
                  placeholder="Ej. MBA Grupo A, Octubre" required />
                <button className="btn-primario" type="submit" disabled={creando || !nombre.trim()} style={{ whiteSpace: 'nowrap' }}>
                  {creando ? 'Creando...' : 'Crear'}
                </button>
              </form>
            </div>

            <div className="tarjeta">
              <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600, color: 'var(--color-primario)' }}>
                Mis sesiones
                {sesiones.length > 0 && (
                  <span style={{ fontWeight: 500, color: 'var(--color-texto-terciario)', marginLeft: 8, fontSize: 14 }}>
                    ({sesiones.length})
                  </span>
                )}
              </h3>

              {cargandoLista && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div className="spinner" />
                </div>
              )}

              {!cargandoLista && sesiones.length === 0 && (
                <p style={{ color: 'var(--color-texto-terciario)', fontSize: 14, padding: '12px 0' }}>
                  Aun no has creado sesiones. Crea la primera con el formulario de arriba.
                </p>
              )}

              {sesiones.length > 0 && (
                <div className="sesiones-barra">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      className="casilla"
                      checked={todasSeleccionadas}
                      ref={el => { if (el) el.indeterminate = algunaSeleccionada; }}
                      onChange={alternarTodas}
                    />
                    {seleccion.size > 0 ? `${seleccion.size} seleccionada(s)` : 'Seleccionar todas'}
                  </label>
                  {seleccion.size > 0 && (
                    <button className="btn-peligro btn-sm" disabled={ocupado} onClick={() => eliminar([...seleccion])}>
                      Eliminar seleccionadas
                    </button>
                  )}
                </div>
              )}

              {sesiones.map(s => {
                const etiqueta = ETIQUETAS_ESTADO[s.estado] ?? { texto: s.estado, clase: 'badge-info' };
                const seleccionada = seleccion.has(s.id);
                const activa = detalle?.sesion?.id === s.id;
                return (
                  <div key={s.id} className={`sesion-fila ${seleccionada ? 'seleccionada' : ''} ${activa ? 'activa' : ''}`}>
                    <input
                      type="checkbox"
                      className="casilla"
                      checked={seleccionada}
                      onChange={() => alternarSeleccion(s.id)}
                      aria-label={`Seleccionar ${s.nombre}`}
                    />
                    <div className="sesion-fila-info">
                      <div className="sesion-fila-nombre" title={s.nombre}>{s.nombre}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>Codigo: <strong style={{ letterSpacing: 1 }}>{s.codigo}</strong></span>
                        <span className={`badge ${etiqueta.clase}`}>{etiqueta.texto}</span>
                      </div>
                    </div>
                    <div className="sesion-fila-acciones">
                      <button className="btn-fantasma btn-sm" onClick={() => verDetalle(s.id)}>
                        Ver
                      </button>
                      {s.estado === 'abierta' && (
                        <button className="btn-advertencia btn-sm" onClick={() => iniciarSesion(s)}>
                          Iniciar
                        </button>
                      )}
                      {s.estado === 'en_curso' && (
                        <button className="btn-peligro btn-sm" onClick={() => finalizarSesion(s)}>
                          Finalizar
                        </button>
                      )}
                      <button className="btn-peligro-sutil btn-sm" disabled={ocupado} onClick={() => eliminar([s.id])}
                        aria-label={`Eliminar ${s.nombre}`}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {!detalle && sesiones.length > 0 && (
              <div className="tarjeta" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-texto-terciario)' }}>
                Selecciona "Ver" en una sesion para consultar participantes y configurar el experimento.
              </div>
            )}

            {detalle && (
              <div className="tarjeta">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: 'var(--color-primario)', minWidth: 0, overflowWrap: 'anywhere' }}>
                    {detalle.sesion.nombre}
                  </h3>
                  <button className="btn-fantasma btn-sm" onClick={() => { setDetalle(null); setResumenExp(null); }}
                    aria-label="Cerrar detalle">
                    Cerrar
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>
                    Codigo: <strong style={{ fontSize: 22, letterSpacing: 3, color: 'var(--color-primario)' }}>{detalle.sesion.codigo}</strong>
                  </p>
                  <button className="btn-sutil btn-sm" onClick={() => copiarCodigo(detalle.sesion.codigo)}>
                    Copiar codigo
                  </button>
                </div>

                <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>
                  Participantes ({detalle.jugadores.length})
                </h4>
                {detalle.jugadores.length === 0
                  ? <p style={{ fontSize: 14, color: 'var(--color-texto-terciario)', padding: '8px 0' }}>Nadie se ha unido todavia</p>
                  : (
                    <div style={{ borderRadius: 'var(--radio)', overflow: 'auto', border: '1px solid var(--color-borde-sutil)' }}>
                      <table className="datos">
                        <thead>
                          <tr><th>Nombre</th><th>Estado</th><th>Puntuacion</th></tr>
                        </thead>
                        <tbody>
                          {detalle.jugadores.map((j: any) => {
                            const partida = detalle.partidas.find((p: any) => p.jugador_id === j.id);
                            return (
                              <tr key={j.id}>
                                <td style={{ fontWeight: 500 }}>{j.nombre}</td>
                                <td>
                                  <span className={`badge ${partida?.fase === 'finalizada' ? 'badge-exito' : partida ? 'badge-info' : 'badge-advertencia'}`}>
                                    {partida?.fase ?? 'esperando'}
                                  </span>
                                </td>
                                <td style={{ fontWeight: 600 }}>{partida?.puntuacion ?? '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                }

                <div style={{ marginTop: 24, borderTop: '1px solid var(--color-borde)', paddingTop: 20 }}>
                  <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--color-primario)' }}>
                    Modo Experimento
                  </h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                    <input type="checkbox" className="casilla" checked={modoExp} onChange={e => setModoExp(e.target.checked)} />
                    <span style={{ fontSize: 14 }}>Activar modo experimento</span>
                  </label>
                  {modoExp && (
                    <div style={{ marginBottom: 12 }}>
                      <label htmlFor="pct-trat" style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'var(--color-texto-secundario)' }}>
                        Grupo tratamiento: <strong>{pctTrat}%</strong>
                      </label>
                      <input id="pct-trat" type="range" min={0} max={100} value={pctTrat}
                        onChange={e => setPctTrat(Number(e.target.value))}
                        style={{ width: '100%', padding: 0, border: 'none', accentColor: 'var(--color-primario)' }} />
                    </div>
                  )}
                  <button className="btn-sutil btn-sm" onClick={guardarExperimento}
                    disabled={modoExp === (detalle.sesion.modo_experimento ?? false) && pctTrat === (detalle.sesion.pct_tratamiento ?? 50)}>
                    Guardar configuracion
                  </button>
                </div>

                {modoExp && resumenExp && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--color-borde)', paddingTop: 20 }}>
                    <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--color-primario)' }}>
                      Resumen del Experimento
                    </h4>
                    <div className="grid-3" style={{ gap: 10, marginBottom: 16 }}>
                      <div style={{ background: 'var(--color-superficie-alt)', borderRadius: 'var(--radio)', padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primario)' }}>{resumenExp.totalEventos}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-texto-terciario)', marginTop: 2 }}>Eventos</div>
                      </div>
                      <div style={{ background: 'var(--color-superficie-alt)', borderRadius: 'var(--radio)', padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-info)' }}>
                          {resumenExp.jugadores.filter((j: any) => j.grupo === 'control').length} / {resumenExp.jugadores.filter((j: any) => j.grupo === 'tratamiento').length}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-texto-terciario)', marginTop: 2 }}>Control / Trat.</div>
                      </div>
                      <div style={{ background: 'var(--color-superficie-alt)', borderRadius: 'var(--radio)', padding: 12, textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-exito)' }}>
                          {resumenExp.jugadores.filter((j: any) => j.consentimiento).length}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-texto-terciario)', marginTop: 2 }}>Consentimiento</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-fantasma btn-sm" onClick={() => exportarDatos('json')}>
                        Exportar JSON
                      </button>
                      <button className="btn-fantasma btn-sm" onClick={() => exportarDatos('csv')}>
                        Exportar CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <PiePagina />
    </div>
  );
}

export function Profesor() {
  return (
    <Routes>
      <Route index element={<Login />} />
      <Route path="panel" element={<Panel />} />
    </Routes>
  );
}
