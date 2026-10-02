import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { PiePagina } from '../componentes/ui/PiePagina.js';

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
      const res = await api.sesion.unirse(codigo.trim().toUpperCase(), nombre.trim());
      localStorage.setItem('token', res.token);
      localStorage.setItem('tipoAuth', 'jugador');
      localStorage.setItem('nombreJugador', nombre.trim());
      localStorage.setItem('sesionNombre', res.sesion.nombre);
      nav('/juego');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="pagina fondo-marca">
    <div className="pagina-contenido" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
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
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primario)' }}>ETF</span>
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
            <label className="campo-label" htmlFor="codigo">
              Codigo de sesion
            </label>
            <input
              id="codigo"
              autoComplete="off"
              autoFocus
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
            <label className="campo-label" htmlFor="nombre">
              Tu nombre
            </label>
            <input
              id="nombre"
              autoComplete="name"
              maxLength={60}
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Juan Perez"
              required
            />
          </div>

          {error && (
            <div className="alerta-error" role="alert">
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
    <PiePagina oscuro />
    </div>
  );
}
