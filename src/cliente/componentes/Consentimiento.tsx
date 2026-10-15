import { useSesion } from '../i18n.js';
import { useState } from 'react';
import { api } from '../api.js';
import { useUI } from './ui/Notificaciones.js';
import { Icono } from './ui/Iconos.js';
import { PiePagina } from './ui/PiePagina.js';

interface Props {
  onAceptado: () => void;
}

export function Consentimiento({ onAceptado }: Props) {
  const { avisar } = useUI();
  const { t } = useSesion();
  const [cargando, setCargando] = useState(false);

  async function responder(acepta: boolean) {
    setCargando(true);
    try {
      await api.experimento.consentimiento(acepta);
      avisar('exito', acepta ? t('ui.consentimiento.gracias') : t('ui.consentimiento.registrada'), acepta ? undefined : t('ui.consentimiento.noIncluidos'));
      onAceptado();
    } catch (err: any) {
      avisar('error', t('ui.consentimiento.error'));
      void err;
    }
    setCargando(false);
  }

  return (
    <div className="pagina">
    <div className="pagina-contenido" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-fondo)',
      padding: 20,
    }}>
      <div className="tarjeta" style={{ maxWidth: 580, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="icono-insignia icono-insignia-info icono-insignia-lg" style={{ marginBottom: 14 }}>
            <Icono nombre="escudo" tamano={26} grosor={1.8} />
          </div>
          <h2 style={{ color: 'var(--color-primario)', fontSize: 22, fontWeight: 700 }}>
            {t('ui.consentimiento.titulo')}
          </h2>
        </div>

        <div style={{
          fontSize: 14,
          lineHeight: 1.7,
          color: 'var(--color-texto-secundario)',
          background: 'var(--color-superficie-alt)',
          borderRadius: 'var(--radio)',
          padding: '20px 24px',
          marginBottom: 24,
        }}>
          <p style={{ marginBottom: 14 }}>
            {t('ui.consentimiento.intro')}
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--color-texto)' }}>{t('ui.consentimiento.datosTitulo')}</strong> {t('ui.consentimiento.datos')}
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--color-texto)' }}>{t('ui.consentimiento.gruposTitulo')}</strong> {t('ui.consentimiento.grupos')}
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--color-texto)' }}>{t('ui.consentimiento.confidencialidadTitulo')}</strong> {t('ui.consentimiento.confidencialidad')}
          </p>
          <p>
            {t('ui.consentimiento.cierre')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primario" style={{ flex: 1, padding: 14, fontSize: 15 }}
            onClick={() => responder(true)} disabled={cargando}>
            {t('ui.consentimiento.acepto')}
          </button>
          <button className="btn-fantasma" style={{ flex: 1, padding: 14, fontSize: 15 }}
            onClick={() => responder(false)} disabled={cargando}>
            {t('ui.consentimiento.noAcepto')}
          </button>
        </div>
      </div>
    </div>
    <PiePagina />
    </div>
  );
}
