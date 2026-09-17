import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function Login() {
  const nav = useNavigate();
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
      nav('/profesor/panel');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f2b4a 0%, #1a4d80 50%, #0f2b4a 100%)',
      padding: 20,
    }}>
      <form className="tarjeta" style={{ maxWidth: 420, width: '100%', border: 'none', boxShadow: 'var(--sombra-elevada)' }} onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--color-primario-suave)', marginBottom: 16,
          }}>
            <span style={{ fontSize: 24 }}>👨‍🏫</span>
          </div>
          <h2 style={{ color: 'var(--color-primario)', fontSize: 22, fontWeight: 700 }}>
            {modo === 'login' ? 'Panel del Profesor' : 'Crear cuenta'}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Correo electronico
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com" required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--color-texto-secundario)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Contrasena
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Minimo 6 caracteres" required minLength={6} />
          </div>

          {error && (
            <div style={{ background: 'var(--color-peligro-suave)', color: 'var(--color-peligro)', padding: '10px 14px', borderRadius: 'var(--radio)', fontSize: 13, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button className="btn-primario" type="submit" disabled={cargando} style={{ padding: 14, fontSize: 15, marginTop: 4 }}>
            {cargando ? 'Cargando...' : modo === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}
          </button>
          <button type="button" className="btn-fantasma" onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
            {modo === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
          </button>
        </div>

        <button type="button" className="btn-fantasma" style={{ width: '100%', marginTop: 16 }}
          onClick={() => nav('/')}>Volver al inicio</button>
      </form>
    </div>
  );
}

function Panel() {
  const nav = useNavigate();
  const [sesiones, setSesiones] = useState<any[]>([]);
  const [nombre, setNombre] = useState('');
  const [detalle, setDetalle] = useState<any>(null);
  const [error, setError] = useState('');
  const [modoExp, setModoExp] = useState(false);
  const [pctTrat, setPctTrat] = useState(50);
  const [resumenExp, setResumenExp] = useState<any>(null);

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
    } catch { /* ignore */ }
  }

  async function crearSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.sesion.crear(nombre);
      setNombre('');
      await cargarSesiones();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function verDetalle(id: string) {
    try {
      const data = await api.profesor.sesion(id);
      setDetalle(data);
      setModoExp(data.sesion.modo_experimento ?? false);
      setPctTrat(data.sesion.pct_tratamiento ?? 50);
      if (data.sesion.modo_experimento) {
        api.experimento.resumen(id).then(r => setResumenExp(r)).catch(() => {});
      } else {
        setResumenExp(null);
      }
    } catch { /* ignore */ }
  }

  async function guardarExperimento() {
    if (!detalle) return;
    try {
      await api.experimento.configurar(detalle.sesion.id, modoExp, pctTrat);
      await verDetalle(detalle.sesion.id);
    } catch { /* ignore */ }
  }

  function exportarDatos(formato: string) {
    if (!detalle) return;
    const token = localStorage.getItem('token');
    const url = api.experimento.exportarUrl(detalle.sesion.id, formato);
    window.open(`${url}&token=${token}`, '_blank');
  }

  async function iniciarSesion(id: string) {
    await api.profesor.iniciarSesion(id);
    await cargarSesiones();
    if (detalle?.sesion?.id === id) await verDetalle(id);
  }

  async function finalizarSesion(id: string) {
    await api.profesor.finalizarSesion(id);
    await cargarSesiones();
    if (detalle?.sesion?.id === id) await verDetalle(id);
  }

  function cerrarSesion() {
    localStorage.clear();
    nav('/');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-fondo)' }}>
      <div style={{
        background: 'var(--color-primario)',
        color: '#fff',
        padding: '16px 0',
        boxShadow: '0 2px 8px rgba(15, 43, 74, 0.2)',
      }}>
        <div className="contenedor" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>Panel del Profesor</h1>
            <p style={{ fontSize: 12, opacity: 0.6 }}>IPADE Business School</p>
          </div>
          <button
            onClick={cerrarSesion}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '8px 16px',
              borderRadius: 'var(--radio)',
              fontSize: 13,
            }}
          >
            Cerrar sesion
          </button>
        </div>
      </div>

      <div className="contenedor" style={{ paddingTop: 24, paddingBottom: 40 }}>
        <div className="grid-2">
          <div>
            <div className="tarjeta" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600, color: 'var(--color-primario)' }}>
                Nueva sesion de juego
              </h3>
              <form onSubmit={crearSesion} style={{ display: 'flex', gap: 8 }}>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Nombre de la sesion" required />
                <button className="btn-primario" type="submit" style={{ whiteSpace: 'nowrap' }}>Crear</button>
              </form>
              {error && (
                <div style={{ background: 'var(--color-peligro-suave)', color: 'var(--color-peligro)', padding: '8px 12px', borderRadius: 'var(--radio)', fontSize: 13, marginTop: 8 }}>
                  {error}
                </div>
              )}
            </div>

            <div className="tarjeta">
              <h3 style={{ marginBottom: 14, fontSize: 16, fontWeight: 600, color: 'var(--color-primario)' }}>
                Mis sesiones
              </h3>
              {sesiones.length === 0 && (
                <p style={{ color: 'var(--color-texto-terciario)', fontSize: 14, padding: '12px 0' }}>
                  No hay sesiones creadas
                </p>
              )}
              {sesiones.map(s => (
                <div key={s.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid var(--color-borde-sutil)',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginTop: 2 }}>
                      Codigo: <strong style={{ letterSpacing: 1 }}>{s.codigo}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${s.estado === 'abierta' ? 'badge-info' : s.estado === 'en_curso' ? 'badge-exito' : 'badge-advertencia'}`}>
                      {s.estado}
                    </span>
                    <button className="btn-fantasma" onClick={() => verDetalle(s.id)} style={{ padding: '6px 12px', fontSize: 13 }}>
                      Ver
                    </button>
                    {s.estado === 'abierta' && (
                      <button className="btn-acento" onClick={() => iniciarSesion(s.id)} style={{ padding: '6px 12px', fontSize: 13 }}>
                        Iniciar
                      </button>
                    )}
                    {s.estado === 'en_curso' && (
                      <button className="btn-peligro" onClick={() => finalizarSesion(s.id)} style={{ padding: '6px 12px', fontSize: 13 }}>
                        Finalizar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            {detalle && (
              <div className="tarjeta">
                <h3 style={{ marginBottom: 4, fontSize: 18, fontWeight: 700, color: 'var(--color-primario)' }}>
                  {detalle.sesion.nombre}
                </h3>
                <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14, marginBottom: 20 }}>
                  Codigo: <strong style={{ fontSize: 22, letterSpacing: 3, color: 'var(--color-primario)' }}>{detalle.sesion.codigo}</strong>
                </p>

                <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>
                  Participantes ({detalle.jugadores.length})
                </h4>
                {detalle.jugadores.length === 0
                  ? <p style={{ fontSize: 14, color: 'var(--color-texto-terciario)', padding: '8px 0' }}>Nadie se ha unido</p>
                  : (
                    <div style={{ borderRadius: 'var(--radio)', overflow: 'hidden', border: '1px solid var(--color-borde-sutil)' }}>
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
                    Modo Experimento (ADENDA)
                  </h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={modoExp} onChange={e => setModoExp(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primario)' }} />
                    <span style={{ fontSize: 14 }}>Activar modo experimento</span>
                  </label>
                  {modoExp && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'var(--color-texto-secundario)' }}>
                        Grupo tratamiento: <strong>{pctTrat}%</strong>
                      </label>
                      <input type="range" min={0} max={100} value={pctTrat}
                        onChange={e => setPctTrat(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-primario)' }} />
                    </div>
                  )}
                  <button className="btn-sutil" onClick={guardarExperimento}
                    style={{ padding: '8px 18px', fontSize: 13 }}>
                    Guardar configuracion
                  </button>
                </div>

                {modoExp && resumenExp && (
                  <div style={{ marginTop: 20, borderTop: '1px solid var(--color-borde)', paddingTop: 20 }}>
                    <h4 style={{ marginBottom: 10, fontSize: 14, fontWeight: 600, color: 'var(--color-primario)' }}>
                      Resumen del Experimento
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 10,
                      marginBottom: 16,
                    }}>
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
                      <button className="btn-acento" onClick={() => exportarDatos('json')}
                        style={{ padding: '8px 14px', fontSize: 13 }}>
                        Exportar JSON
                      </button>
                      <button className="btn-acento" onClick={() => exportarDatos('csv')}
                        style={{ padding: '8px 14px', fontSize: 13 }}>
                        Exportar CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
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
