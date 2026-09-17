import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export function Unirse() {
  const nav = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function unirse(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const res = await api.sesion.unirse(codigo.toUpperCase(), nombre);
      localStorage.setItem('token', res.token);
      localStorage.setItem('tipoAuth', 'jugador');
      localStorage.setItem('nombreJugador', nombre);
      localStorage.setItem('sesionNombre', res.sesion.nombre);
      nav('/juego');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form className="tarjeta" style={{ maxWidth: 400, width: '100%' }} onSubmit={unirse}>
        <h2 style={{ color: 'var(--color-primario)', marginBottom: 4 }}>Unirse a la sesion</h2>
        <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 24, fontSize: 14 }}>
          Ingresa el codigo que te dio tu profesor
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Codigo de sesion
            </label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)}
              placeholder="ABC123" maxLength={8} required
              style={{ textTransform: 'uppercase', letterSpacing: 4, textAlign: 'center', fontSize: 20, fontWeight: 700 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Tu nombre
            </label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Juan Perez" required />
          </div>

          {error && <p style={{ color: 'var(--color-peligro)', fontSize: 13 }}>{error}</p>}

          <button className="btn-primario" type="submit" disabled={cargando}
            style={{ padding: '12px', fontSize: 15, marginTop: 8 }}>
            {cargando ? 'Entrando...' : 'Entrar al juego'}
          </button>
        </div>

        <button type="button" className="btn-fantasma" style={{ width: '100%', marginTop: 12 }}
          onClick={() => nav('/')}>
          Volver
        </button>
      </form>
    </div>
  );
}
