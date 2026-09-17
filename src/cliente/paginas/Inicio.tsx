import { useNavigate } from 'react-router-dom';

export function Inicio() {
  const nav = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #0f2b4a 0%, #1a4d80 50%, #0f2b4a 100%)',
    }}>
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
          }}>
            <span style={{ fontSize: 36 }}>🏦</span>
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
            Simulador de Analisis Causal
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

          <div style={{
            marginTop: 48,
            paddingTop: 20,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <p style={{
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.35)',
              letterSpacing: '0.04em',
            }}>
              IPADE Business School
            </p>
            <p style={{
              fontSize: 11,
              color: 'rgba(255, 255, 255, 0.25)',
              marginTop: 2,
            }}>
              Area de Direccion de Operaciones
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
