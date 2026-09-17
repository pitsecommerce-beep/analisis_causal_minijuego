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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f2b4a 0%, #1a4d80 50%, #0f2b4a 100%)',
      padding: '20px',
    }}>
      <form
        className="tarjeta"
        style={{ maxWidth: 420, width: '100%', border: 'none', boxShadow: 'var(--sombra-elevada)' }}
        onSubmit={unirse}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--color-primario-suave)',
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 24 }}>🎯</span>
          </div>
          <h2 style={{ color: 'var(--color-primario)', marginBottom: 6, fontSize: 22, fontWeight: 700 }}>
            Unirse a la sesion
          </h2>
          <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>
            Ingresa el codigo que te proporciono tu profesor
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              fontSize: 12,
              fontWeight: 600,
              display: 'block',
              marginBottom: 6,
              color: 'var(--color-texto-secundario)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Codigo de sesion
            </label>
            <input
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="ABC123"
              maxLength={8}
              required
              style={{
                textTransform: 'uppercase',
                letterSpacing: 6,
                textAlign: 'center',
                fontSize: 22,
                fontWeight: 700,
                padding: '14px 16px',
                background: 'var(--color-superficie-alt)',
                border: '2px solid var(--color-borde)',
              }}
            />
          </div>
          <div>
            <label style={{
              fontSize: 12,
              fontWeight: 600,
              display: 'block',
              marginBottom: 6,
              color: 'var(--color-texto-secundario)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Tu nombre
            </label>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Juan Perez"
              required
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--color-peligro-suave)',
              color: 'var(--color-peligro)',
              padding: '10px 14px',
              borderRadius: 'var(--radio)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <button
            className="btn-primario"
            type="submit"
            disabled={cargando}
            style={{ padding: '14px', fontSize: 15, marginTop: 4 }}
          >
            {cargando ? 'Entrando...' : 'Entrar al simulador'}
          </button>
        </div>

        <button
          type="button"
          className="btn-fantasma"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => nav('/')}
        >
          Volver al inicio
        </button>
      </form>
    </div>
  );
}
