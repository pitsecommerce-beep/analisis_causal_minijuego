import { useNavigate } from 'react-router-dom';
import { PiePagina } from '../componentes/ui/PiePagina.js';

export function Inicio() {
  const nav = useNavigate();

  return (
    <div className="pagina fondo-marca">
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{
          maxWidth: 460,
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 18,
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            marginBottom: 24,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: 28,
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.85)',
            letterSpacing: '-0.04em',
          }}>
            ETF
          </div>

          <h1 style={{
            color: '#ffffff',
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 6,
            letterSpacing: '-0.02em',
          }}>
            Director de Operaciones
          </h1>

          <p style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            ETF Bank
          </p>

          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 15,
            marginBottom: 40,
            lineHeight: 1.6,
          }}>
            Simulador de Análisis Causal
          </p>

          <div style={{
            background: 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(10px)',
            borderRadius: 16,
            padding: 28,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="btn-acento"
                style={{ padding: '14px 24px', fontSize: 15, borderRadius: 10 }}
                onClick={() => nav('/unirse')}
              >
                Entrar como Participante
              </button>
              <button
                style={{
                  padding: '14px 24px',
                  fontSize: 15,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                }}
                onClick={() => nav('/profesor')}
              >
                Panel del Profesor
              </button>
            </div>
          </div>
        </div>
      </div>
      <PiePagina oscuro />
    </div>
  );
}
