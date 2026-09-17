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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="tarjeta" style={{ maxWidth: 400, width: '100%' }} onSubmit={submit}>
        <h2 style={{ color: 'var(--color-primario)', marginBottom: 24 }}>
          {modo === 'login' ? 'Iniciar sesion' : 'Registrarse'}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com" required />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Contrasena" required minLength={6} />
          {error && <p style={{ color: 'var(--color-peligro)', fontSize: 13 }}>{error}</p>}
          <button className="btn-primario" type="submit" disabled={cargando}
            style={{ padding: 12 }}>
            {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          <button type="button" className="btn-fantasma"
            onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
            {modo === 'login' ? 'Crear cuenta nueva' : 'Ya tengo cuenta'}
          </button>
        </div>

        <button type="button" className="btn-fantasma" style={{ width: '100%', marginTop: 12 }}
          onClick={() => nav('/')}>Volver</button>
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
    <div className="contenedor" style={{ paddingTop: 32, paddingBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ color: 'var(--color-primario)' }}>Panel del Profesor</h1>
        <button className="btn-fantasma" onClick={cerrarSesion}>Cerrar sesion</button>
      </div>

      <div className="grid-2">
        <div>
          <div className="tarjeta" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Nueva sesion de juego</h3>
            <form onSubmit={crearSesion} style={{ display: 'flex', gap: 8 }}>
              <input value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Nombre de la sesion" required />
              <button className="btn-primario" type="submit">Crear</button>
            </form>
            {error && <p style={{ color: 'var(--color-peligro)', fontSize: 13, marginTop: 8 }}>{error}</p>}
          </div>

          <div className="tarjeta">
            <h3 style={{ marginBottom: 12 }}>Mis sesiones</h3>
            {sesiones.length === 0 && <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>Sin sesiones</p>}
            {sesiones.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--color-borde)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.nombre}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-texto-secundario)' }}>
                    Codigo: <strong>{s.codigo}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${s.estado === 'abierta' ? 'badge-info' : s.estado === 'en_curso' ? 'badge-exito' : 'badge-advertencia'}`}>
                    {s.estado}
                  </span>
                  <button className="btn-fantasma" onClick={() => verDetalle(s.id)} style={{ padding: '4px 10px', fontSize: 13 }}>
                    Ver
                  </button>
                  {s.estado === 'abierta' && (
                    <button className="btn-acento" onClick={() => iniciarSesion(s.id)} style={{ padding: '4px 10px', fontSize: 13 }}>
                      Iniciar
                    </button>
                  )}
                  {s.estado === 'en_curso' && (
                    <button className="btn-peligro" onClick={() => finalizarSesion(s.id)} style={{ padding: '4px 10px', fontSize: 13 }}>
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
              <h3 style={{ marginBottom: 4 }}>{detalle.sesion.nombre}</h3>
              <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14, marginBottom: 16 }}>
                Codigo: <strong style={{ fontSize: 20, letterSpacing: 2 }}>{detalle.sesion.codigo}</strong>
              </p>

              <h4 style={{ marginBottom: 8 }}>Jugadores ({detalle.jugadores.length})</h4>
              {detalle.jugadores.length === 0
                ? <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>Nadie se ha unido</p>
                : (
                  <table className="datos">
                    <thead>
                      <tr><th>Nombre</th><th>Estado</th><th>Puntuacion</th></tr>
                    </thead>
                    <tbody>
                      {detalle.jugadores.map((j: any) => {
                        const partida = detalle.partidas.find((p: any) => p.jugador_id === j.id);
                        return (
                          <tr key={j.id}>
                            <td>{j.nombre}</td>
                            <td><span className={`badge ${partida?.fase === 'finalizada' ? 'badge-exito' : partida ? 'badge-info' : 'badge-advertencia'}`}>
                              {partida?.fase ?? 'esperando'}
                            </span></td>
                            <td>{partida?.puntuacion ?? '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )
              }

              <div style={{ marginTop: 20, borderTop: '1px solid var(--color-borde)', paddingTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>Modo Experimento (ADENDA)</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={modoExp} onChange={e => setModoExp(e.target.checked)} />
                  <span style={{ fontSize: 14 }}>Activar modo experimento</span>
                </label>
                {modoExp && (
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                      % grupo tratamiento: {pctTrat}%
                    </label>
                    <input type="range" min={0} max={100} value={pctTrat}
                      onChange={e => setPctTrat(Number(e.target.value))}
                      style={{ width: '100%' }} />
                  </div>
                )}
                <button className="btn-primario" onClick={guardarExperimento}
                  style={{ padding: '6px 16px', fontSize: 13 }}>
                  Guardar config
                </button>
              </div>

              {modoExp && resumenExp && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--color-borde)', paddingTop: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>Resumen del Experimento</h4>
                  <div style={{ fontSize: 13, marginBottom: 12 }}>
                    <p>Total eventos de telemetria: <strong>{resumenExp.totalEventos}</strong></p>
                    <p>
                      Control: <strong>{resumenExp.jugadores.filter((j: any) => j.grupo === 'control').length}</strong>
                      {' / '}
                      Tratamiento: <strong>{resumenExp.jugadores.filter((j: any) => j.grupo === 'tratamiento').length}</strong>
                    </p>
                    <p>
                      Con consentimiento: <strong>{resumenExp.jugadores.filter((j: any) => j.consentimiento).length}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-acento" onClick={() => exportarDatos('json')}
                      style={{ padding: '6px 12px', fontSize: 13 }}>
                      Exportar JSON
                    </button>
                    <button className="btn-acento" onClick={() => exportarDatos('csv')}
                      style={{ padding: '6px 12px', fontSize: 13 }}>
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
