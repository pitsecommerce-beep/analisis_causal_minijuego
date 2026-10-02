import { useState } from 'react';
import { api } from '../api.js';
import { useUI } from './ui/Notificaciones.js';
import { PiePagina } from './ui/PiePagina.js';

interface Props {
  onAceptado: () => void;
}

export function Consentimiento({ onAceptado }: Props) {
  const { avisar } = useUI();
  const [cargando, setCargando] = useState(false);

  async function responder(acepta: boolean) {
    setCargando(true);
    try {
      await api.experimento.consentimiento(acepta);
      avisar('exito', acepta ? 'Gracias por participar en el estudio' : 'Respuesta registrada', acepta ? undefined : 'Tus datos no se incluirán en la investigación.');
      onAceptado();
    } catch (err: any) {
      avisar('error', 'No se pudo registrar tu respuesta', err.message);
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
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--color-info-suave)', marginBottom: 14,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-info)' }}>CI</span>
          </div>
          <h2 style={{ color: 'var(--color-primario)', fontSize: 22, fontWeight: 700 }}>
            Consentimiento informado
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
            Esta sesión forma parte de un estudio de investigación sobre la toma de decisiones
            en contextos de análisis causal. Tu participación es voluntaria.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--color-texto)' }}>Datos recopilados:</strong> se registrarán las acciones que realices dentro del
            juego (herramientas utilizadas, decisiones tomadas, tiempos de respuesta) de forma
            anonimizada. Estos datos se usarán exclusivamente con fines académicos.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--color-texto)' }}>Grupos:</strong> algunos participantes tendrán acceso a un asesor algorítmico
            adicional. La asignación es aleatoria y no afecta tu evaluación académica.
          </p>
          <p style={{ marginBottom: 14 }}>
            <strong style={{ color: 'var(--color-texto)' }}>Confidencialidad:</strong> tus datos serán tratados de forma anónima. Los
            resultados agregados podrán ser publicados en artículos académicos sin identificar
            participantes individuales.
          </p>
          <p>
            Puedes participar en el juego sin aceptar el estudio. En ese caso, tus datos
            no serán incluidos en el análisis de investigación.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primario" style={{ flex: 1, padding: 14, fontSize: 15 }}
            onClick={() => responder(true)} disabled={cargando}>
            Acepto participar
          </button>
          <button className="btn-fantasma" style={{ flex: 1, padding: 14, fontSize: 15 }}
            onClick={() => responder(false)} disabled={cargando}>
            No acepto, solo jugar
          </button>
        </div>
      </div>
    </div>
    <PiePagina />
    </div>
  );
}
