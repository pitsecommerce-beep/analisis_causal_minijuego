import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { olvidarPartidaAnterior } from '../pendientes.js';
import { VistaAcceso } from '../componentes/ui/VistaAcceso.js';
import { useUI } from '../componentes/ui/Notificaciones.js';
import { useSesion } from '../i18n.js';

export function Unirse() {
  const nav = useNavigate();
  const { avisar } = useUI();
  const { fijarConfig, t } = useSesion();

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // En cuanto el código corresponde a una sesión, la página cambia al idioma de esa sesión
  useEffect(() => {
    const limpio = codigo.trim().toUpperCase();
    if (limpio.length < 6) return;
    const id = window.setTimeout(() => {
      api.sesion.buscar(limpio).then(s => { if (s?.idioma) fijarConfig({ idioma: s.idioma }); }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, [codigo]);

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
      if (res.config) fijarConfig(res.config);
      if (res.reconectado) avisar('info', t('acceso.retomaste'), t('acceso.continuaras'));
      // Cada participación nueva vuelve a mostrar la inducción al entrar al simulador
      else {
        localStorage.removeItem('onboardingVisto');
        olvidarPartidaAnterior();
      }
      nav('/juego');
    } catch (err: any) {
      const m = String(err?.message ?? '');
      setError(m.includes('no encontrada') ? t('acceso.noEncontrada')
        : m.includes('ya no acepta') ? t('acceso.noAcepta')
          : m.includes('llena') ? t('acceso.llena')
            : m.includes('activo en otro navegador') ? t('acceso.nombreActivo')
              : t('acceso.errorUnirse'));
    } finally {
      setCargando(false);
    }
  }

  return (
    <VistaAcceso
      titulo={t('acceso.unirseTitulo')}
      subtitulo={t('acceso.unirseSubtitulo')}
      navegacion={false}
    >
      <form className="acceso-formulario" onSubmit={unirse}>
        <div>
          <label className="campo-label" htmlFor="codigo">{t('acceso.codigo')}</label>
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
          <label className="campo-label" htmlFor="nombre">{t('acceso.nombre')}</label>
          <input
            id="nombre"
            autoComplete="name"
            maxLength={60}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={t('acceso.nombrePlaceholder')}
            required
          />
        </div>

        {error && <div className="alerta-error" role="alert">{error}</div>}

        <button className="btn-primario" type="submit" disabled={cargando}>
          {cargando ? t('acceso.entrando') : t('acceso.entrar')}
        </button>
      </form>
    </VistaAcceso>
  );
}
