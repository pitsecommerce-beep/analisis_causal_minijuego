import { useNavigate } from 'react-router-dom';

export function Inicio() {
  const nav = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="tarjeta" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🏦</div>
        <h1 style={{ color: 'var(--color-primario)', marginBottom: 4, fontSize: 24 }}>
          Director de Operaciones
        </h1>
        <p style={{ color: 'var(--color-texto-secundario)', marginBottom: 32, fontSize: 15 }}>
          ETF Bank &middot; Simulador de Analisis Causal
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primario" style={{ padding: '14px 24px', fontSize: 16 }}
            onClick={() => nav('/unirse')}>
            Entrar como Jugador
          </button>
          <button className="btn-fantasma" style={{ padding: '14px 24px', fontSize: 16 }}
            onClick={() => nav('/profesor')}>
            Entrar como Profesor
          </button>
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: 'var(--color-texto-secundario)' }}>
          IPADE Business School &middot; Executive MBA
        </p>
      </div>
    </div>
  );
}
