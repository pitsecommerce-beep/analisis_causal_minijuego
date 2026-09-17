import { useState } from 'react';
import { api } from '../api.js';

export function AsesorAlgoritmico() {
  const [recomendacion, setRecomendacion] = useState<any>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function consultar() {
    setCargando(true);
    setError('');
    try {
      const rec = await api.experimento.recomendacion();
      setRecomendacion(rec);
    } catch (err: any) {
      setError(err.message);
    }
    setCargando(false);
  }

  return (
    <div className="tarjeta" style={{
      borderLeft: '4px solid var(--color-acento)',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>🤖</span>
        <strong style={{ color: 'var(--color-acento)' }}>Asesor Algoritmico</strong>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-texto-secundario)', marginBottom: 12 }}>
        Basado en el analisis de los datos del proceso, puedo sugerirte una accion.
      </p>

      {!recomendacion && (
        <button className="btn-acento" onClick={consultar} disabled={cargando}
          style={{ padding: '8px 16px', fontSize: 13 }}>
          {cargando ? 'Analizando...' : 'Pedir recomendacion'}
        </button>
      )}

      {error && <p style={{ color: 'var(--color-peligro)', fontSize: 13, marginTop: 8 }}>{error}</p>}

      {recomendacion && (
        <div style={{ marginTop: 12, padding: 12, background: '#fffff0', borderRadius: 'var(--radio)' }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>{recomendacion.explicacion}</p>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-texto-secundario)' }}>
            <span>Metrica: <strong>{recomendacion.metricaPrioritaria}</strong></span>
            <span>Confianza: <strong>{Math.round(recomendacion.confianza * 100)}%</strong></span>
          </div>
          <button className="btn-fantasma" style={{ marginTop: 8, fontSize: 12 }}
            onClick={() => { setRecomendacion(null); }}>
            Consultar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
