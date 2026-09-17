import { useState } from 'react';
import { api } from '../api.js';

interface Props {
  onAceptado: () => void;
}

export function Consentimiento({ onAceptado }: Props) {
  const [cargando, setCargando] = useState(false);

  async function responder(acepta: boolean) {
    setCargando(true);
    try {
      await api.experimento.consentimiento(acepta);
      onAceptado();
    } catch { /* ignore */ }
    setCargando(false);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="tarjeta" style={{ maxWidth: 600, width: '100%' }}>
        <h2 style={{ color: 'var(--color-primario)', marginBottom: 16 }}>
          Consentimiento informado
        </h2>

        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--color-texto-secundario)' }}>
          <p style={{ marginBottom: 12 }}>
            Esta sesion forma parte de un estudio de investigacion sobre la toma de decisiones
            en contextos de analisis causal. Tu participacion es voluntaria.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Datos recopilados:</strong> se registraran las acciones que realices dentro del
            juego (herramientas utilizadas, decisiones tomadas, tiempos de respuesta) de forma
            anonimizada. Estos datos se usaran exclusivamente con fines academicos.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Grupos:</strong> algunos participantes tendran acceso a un asesor algoritmico
            adicional. La asignacion es aleatoria y no afecta tu evaluacion academica.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Confidencialidad:</strong> tus datos seran tratados de forma anonima. Los
            resultados agregados podran ser publicados en articulos academicos sin identificar
            participantes individuales.
          </p>
          <p style={{ marginBottom: 16 }}>
            Puedes participar en el juego sin aceptar el estudio. En ese caso, tus datos
            no seran incluidos en el analisis de investigacion.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primario" style={{ flex: 1, padding: 12 }}
            onClick={() => responder(true)} disabled={cargando}>
            Acepto participar
          </button>
          <button className="btn-fantasma" style={{ flex: 1, padding: 12 }}
            onClick={() => responder(false)} disabled={cargando}>
            No acepto, solo jugar
          </button>
        </div>
      </div>
    </div>
  );
}
