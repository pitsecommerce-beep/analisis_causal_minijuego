import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { VistaAcceso } from '../componentes/ui/VistaAcceso.js';

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
    <VistaAcceso
      titulo="Únete a una sesión"
      subtitulo="Ingresa el código que te compartió tu profesor."
      navegacion={false}
    >
      <form className="acceso-formulario" onSubmit={unirse}>
        <div>
          <label className="campo-label" htmlFor="codigo">Código de sesión</label>
          <input
            id="codigo"
            className="campo-codigo"
            autoComplete="off"
            autoFocus
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            placeholder="ABC123"
            maxLength={8}
            required
          />
        </div>
        <div>
          <label className="campo-label" htmlFor="nombre">Tu nombre</label>
          <input
            id="nombre"
            autoComplete="name"
            maxLength={60}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre y apellido"
            required
          />
        </div>

        {error && <div className="alerta-error" role="alert">{error}</div>}

        <button className="btn-primario" type="submit" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar al simulador'}
        </button>
      </form>
    </VistaAcceso>
  );
}
