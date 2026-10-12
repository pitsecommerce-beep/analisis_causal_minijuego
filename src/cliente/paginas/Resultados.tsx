import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useUI } from '../componentes/ui/Notificaciones.js';
import { Icono } from '../componentes/ui/Iconos.js';
import { PiePagina } from '../componentes/ui/PiePagina.js';
import { useEspina, cargarEspina } from '../espina.js';
import { ESTADOS, causasDeTarjeta, ultimaVotacion } from '../../compartido/espina.js';

const COLORES_DESENLACE: Record<string, { color: string; bg: string }> = {
  reconversion: { color: '#1a7a4c', bg: '#e6f5ed' },
  buen_trabajo: { color: '#2563a8', bg: '#e8f2fd' },
  sobreviviste: { color: '#c8922a', bg: '#fdf6e8' },
  en_la_mira: { color: '#c0392b', bg: '#fce8e6' },
  destituido: { color: '#7f1d1d', bg: '#fce8e6' },
};

const NOMBRES_DIMENSION: Record<string, { nombre: string; color: string }> = {
  diagnostico: { nombre: 'Diagnóstico (causa raíz)', color: '#2563a8' },
  criterio: { nombre: 'Criterio (evidencia)', color: '#7c3aed' },
  impacto: { nombre: 'Impacto (mejora KPIs)', color: '#059669' },
  metodo: { nombre: 'Método (hitos de Bohn)', color: '#0891b2' },
  compromisos: { nombre: 'Compromisos', color: '#c8922a' },
  penalizaciones: { nombre: 'Penalizaciones', color: '#c0392b' },
};

export function Resultados() {
  const nav = useNavigate();
  const { avisar, confirmar } = useUI();
  const [fase, setFase] = useState<'cierre' | 'resultado'>('cierre');
  const espina = useEspina();
  const votacion = ultimaVotacion(espina);
  const votadas = (votacion?.causas ?? []).map(id => espina.tarjetas.find(t => t.id === id)).filter(t => t != null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [errorCierre, setErrorCierre] = useState('');


  useEffect(() => {
    if (!localStorage.getItem('token')) { nav('/unirse'); return; }
    cargarEspina();
  }, []);

  async function enviarCierre() {
    const ok = await confirmar({
      titulo: 'Enviar cierre de partida',
      mensaje: 'Tu diagnóstico se calcula con las causas que votaste en el último ciclo y verificaste con datos. Una vez enviado el cierre se calculará tu puntuación final y no podrás modificarlo.',
      textoConfirmar: 'Enviar y ver resultado',
      tono: 'advertencia',
      icono: 'enviar',
    });
    if (!ok) return;
    setCargando(true);
    setErrorCierre('');
    try {
      const res = await api.partida.cierre();
      setResultado(res);
      setFase('resultado');
      avisar('exito', 'Cierre enviado', 'Tu resultado final está listo.');
    } catch (err: any) {
      setErrorCierre(err.message || 'Error al enviar el cierre');
    }
    setCargando(false);
  }

  async function salir() {
    const ok = await confirmar({
      titulo: 'Salir del simulador',
      mensaje: 'Se cerrará tu sesión en este dispositivo. Tu resultado ya quedó registrado.',
      textoConfirmar: 'Salir',
      icono: 'salir',
    });
    if (!ok) return;
    localStorage.clear();
    nav('/unirse');
  }

  if (fase === 'cierre') {
    return (
      <div className="pagina">
      <main className="pagina-contenido" style={{
        background: 'var(--color-fondo)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 20px',
      }}>
        <div style={{ maxWidth: 640, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="icono-insignia icono-insignia-primario icono-insignia-lg" style={{ marginBottom: 16 }}>
              <Icono nombre="diagnostico" tamano={26} grosor={1.8} />
            </div>
            <h2 style={{ color: 'var(--color-primario)', fontSize: 22, fontWeight: 700 }}>
              Cierre de partida
            </h2>
            <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14, marginTop: 6 }}>
              Antes de ver tu resultado, declara cuáles crees que son las causas raíz del problema.
            </p>
          </div>

          <div className="tarjeta" style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 6, fontSize: 15, fontWeight: 600 }}>
              Tu diagnóstico: causas votadas en el ciclo {votacion?.ciclo ?? '-'}
            </h4>
            <p className="datos-nota" style={{ marginTop: 0 }}>
              Vienen de tu espina de pescado. Solo suman las verificadas con datos; las votadas sin verificar restan.
            </p>
            {votadas.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--color-texto-secundario)' }}>No votaste causas en tu espina de pescado.</p>
            ) : (
              <ul className="votacion-causas">
                {votadas.map(t => {
                  const respaldo = causasDeTarjeta(espina, t).length > 0;
                  return (
                    <li key={t.id}>
                      <label style={{ cursor: 'default' }}>
                        <span>{t.texto}</span>
                        <span className={`badge ${t.estado === 'verificada' ? 'badge-exito' : 'badge-advertencia'}`}>
                          {t.estado === 'verificada' && !respaldo ? 'Verificada, sin respaldo de causa raíz' : ESTADOS[t.estado]}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {votacion && (
              <ol style={{ margin: '14px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.6, color: 'var(--color-texto-secundario)' }}>
                {votacion.porques.map((p, i) => <li key={i}>{p}</li>)}
              </ol>
            )}
          </div>

          <p className="datos-nota" style={{ marginBottom: 20 }}>
            Tu método se evalúa con lo que hiciste durante el juego: qué revisaste primero, qué analizaste, cómo estratificaste y si tus acciones se apoyaron en causas verificadas.
          </p>

          {errorCierre && (
            <div className="alerta-error" role="alert" style={{ marginBottom: 12 }}>
              {errorCierre}
            </div>
          )}

          <button className="btn-advertencia" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
            onClick={enviarCierre} disabled={cargando}>
            {cargando ? 'Evaluando...' : 'Ver mi resultado'}
          </button>
        </div>
      </main>
      <PiePagina />
      </div>
    );
  }

  if (!resultado) return null;

  const { desglose, desenlace, ramonCierre } = resultado;
  const theme = COLORES_DESENLACE[desenlace.id] ?? { color: 'var(--color-primario)', bg: 'var(--color-primario-suave)' };

  return (
    <div className="pagina transicion-pagina">
    <main className="pagina-contenido" style={{
      background: 'var(--color-fondo)',
      padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div className="tarjeta" style={{
          textAlign: 'center',
          marginBottom: 20,
          background: theme.bg,
          border: `1px solid ${theme.color}20`,
        }}>
          <p style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: theme.color,
            marginBottom: 8,
          }}>
            Resultado Final
          </p>
          <h1 style={{ color: theme.color, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
            {desenlace.nombre}
          </h1>
          <p style={{ fontSize: 52, fontWeight: 800, color: theme.color, margin: '8px 0 4px' }}>
            {desglose.total}
          </p>
          <p style={{ fontSize: 14, color: `${theme.color}99` }}>de 1000 puntos</p>
        </div>

        {ramonCierre && (
          <div className="tarjeta" style={{ marginBottom: 20, borderLeft: `4px solid ${theme.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 8,
                background: '#0f2b4a', color: '#fff', fontSize: 14, fontWeight: 700,
              }}>R</span>
              <strong style={{ color: 'var(--color-primario)', fontSize: 14 }}>Ramón Betancourt (Consejo)</strong>
            </div>
            <div className="dialogo-burbuja" style={{ maxWidth: '100%' }}>
              {ramonCierre.lineas.map((l: string, i: number) => (
                <p key={i} style={{ marginBottom: i < ramonCierre.lineas.length - 1 ? 8 : 0 }}>{l}</p>
              ))}
            </div>
          </div>
        )}

        <div className="tarjeta" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 20, color: 'var(--color-primario)', fontSize: 16, fontWeight: 600 }}>
            Desglose de puntuación
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(['diagnostico', 'criterio', 'impacto', 'metodo', 'compromisos', 'penalizaciones'] as const).map(dim => {
              const valor = desglose[dim] as number;
              const maxDim = dim === 'penalizaciones' ? 0 : dim === 'compromisos' ? 50 : 250;
              const esPenalizacion = dim === 'penalizaciones';
              const pct = esPenalizacion ? 0 : maxDim > 0 ? Math.min(100, (valor / maxDim) * 100) : 0;
              const info = NOMBRES_DIMENSION[dim]!;

              return (
                <div key={dim}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                        background: info.color, flexShrink: 0,
                      }} />
                      {info.nombre}
                    </span>
                    <strong style={{
                      color: esPenalizacion && valor < 0 ? 'var(--color-peligro)' : 'var(--color-texto)',
                      fontSize: 15,
                    }}>
                      {valor}
                    </strong>
                  </div>
                  {!esPenalizacion && (
                    <div className="barra-resultado">
                      <div
                        className="barra-resultado-relleno"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 70
                            ? 'linear-gradient(90deg, var(--color-exito), #2ecc71)'
                            : pct >= 40
                              ? 'linear-gradient(90deg, var(--color-primario), var(--color-primario-claro))'
                              : 'linear-gradient(90deg, var(--color-advertencia), #e67e22)',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <details className="tarjeta" style={{ marginBottom: 20 }}>
          <summary style={{
            cursor: 'pointer',
            fontWeight: 600,
            color: 'var(--color-primario)',
            fontSize: 14,
            padding: '2px 0',
          }}>
            Ver detalles completos
          </summary>
          <pre style={{
            marginTop: 14,
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            color: 'var(--color-texto-secundario)',
            background: 'var(--color-superficie-alt)',
            padding: 16,
            borderRadius: 'var(--radio)',
            lineHeight: 1.7,
          }}>
            {desglose.detalles.join('\n')}
          </pre>
        </details>

        <button className="btn-primario" style={{ width: '100%', padding: 16, fontSize: 16, borderRadius: 12 }}
          onClick={salir}>
          Salir del simulador
        </button>
      </div>
    </main>
    <PiePagina />
    </div>
  );
}
