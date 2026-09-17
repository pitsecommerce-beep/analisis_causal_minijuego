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
      marginBottom: 20,
      background: 'var(--color-acento-suave)',
      border: '1px solid rgba(200, 146, 42, 0.15)',
      borderLeftWidth: 4,
      borderLeftColor: 'var(--color-acento)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(200, 146, 42, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 20 }}>🤖</span>
        </div>
        <div>
          <strong style={{ color: 'var(--color-acento)', fontSize: 14 }}>Asesor Algoritmico</strong>
          <p style={{ fontSize: 11, color: 'var(--color-texto-terciario)' }}>Analisis basado en datos del proceso</p>
        </div>
      </div>

      {!recomendacion && (
        <button className="btn-acento" onClick={consultar} disabled={cargando}
          style={{ padding: '10px 18px', fontSize: 13 }}>
          {cargando ? 'Analizando...' : 'Pedir recomendacion'}
        </button>
      )}

      {error && (
        <div style={{
          background: 'var(--color-peligro-suave)',
          color: 'var(--color-peligro)',
          padding: '8px 12px',
          borderRadius: 'var(--radio)',
          fontSize: 13,
          marginTop: 10,
        }}>
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
            <span>Metrica: <strong style={{ color: 'var(--color-texto)' }}>{recomendacion.metricaPrioritaria}</strong></span>
            <span>Confianza: <strong style={{ color: 'var(--color-texto)' }}>{Math.round(recomendacion.confianza * 100)}%</strong></span>
          </div>
          <button className="btn-fantasma" style={{ marginTop: 10, fontSize: 12, padding: '6px 12px' }}
            onClick={() => { setRecomendacion(null); }}>
            Consultar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
