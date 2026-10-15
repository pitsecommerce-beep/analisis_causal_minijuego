import { useSesion } from '../i18n.js';
import { useState } from 'react';
import { Icono } from './ui/Iconos.js';
import { api } from '../api.js';

export function AsesorAlgoritmico() {
  const [recomendacion, setRecomendacion] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const { t } = useSesion();

  async function consultar() {
    setCargando(true);
    setError('');
    try {
      const rec = await api.experimento.recomendacion();
      setRecomendacion(rec);
    } catch (err: any) {
      setError(t('ui.asesorAlgoritmico.error'));
      void err;
    }
    setCargando(false);
  }

  return (
    <div className="tarjeta" style={{
      borderLeft: '4px solid var(--color-acento)',
      marginBottom: 20,
      background: 'var(--color-acento-suave)',
      border: '1px solid rgba(200, 146, 42, 0.15)',
      borderLeftWidth: 4,
      borderLeftColor: 'var(--color-acento)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="icono-insignia icono-insignia-acento icono-insignia-sm">
          <Icono nombre="asesor" tamano={18} />
        </div>
        <div>
          <strong style={{ color: 'var(--color-acento)', fontSize: 14 }}>{t('ui.asesorAlgoritmico.titulo')}</strong>
          <p style={{ fontSize: 11, color: 'var(--color-texto-terciario)' }}>{t('ui.asesorAlgoritmico.subtitulo')}</p>
        </div>
      </div>

      {!recomendacion && (
        <button className="btn-acento" onClick={consultar} disabled={cargando}
          style={{ padding: '10px 18px', fontSize: 13 }}>
          {cargando ? t('ui.asesorAlgoritmico.analizando') : t('ui.asesorAlgoritmico.pedir')}
        </button>
      )}

      {error && (
        <div className="alerta-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}

      {recomendacion && (
        <div style={{
          marginTop: 12,
          padding: 14,
          background: 'var(--color-superficie)',
          borderRadius: 'var(--radio)',
          border: '1px solid var(--color-borde-sutil)',
        }}>
          <p style={{ fontSize: 14, marginBottom: 10, lineHeight: 1.6 }}>{recomendacion.explicacion}</p>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--color-texto-secundario)' }}>
            <span>{t('ui.asesorAlgoritmico.metrica')}: <strong style={{ color: 'var(--color-texto)' }}>{recomendacion.metricaNombre ?? recomendacion.metricaPrioritaria}</strong></span>
            <span>{t('ui.asesorAlgoritmico.confianza')}: <strong style={{ color: 'var(--color-texto)' }}>{Math.round(recomendacion.confianza * 100)}%</strong></span>
          </div>
          <button className="btn-fantasma" style={{ marginTop: 10, fontSize: 12, padding: '6px 12px' }}
            onClick={() => { setRecomendacion(null); }}>
            {t('ui.asesorAlgoritmico.pedir')}
          </button>
        </div>
      )}
    </div>
  );
}
