import { useState, useEffect } from 'react';
import { api } from '../api.js';

const NOMBRES: Record<string, { nombre: string; rol: string }> = {
  bernardo: { nombre: 'Bernardo', rol: 'Gte. Regional' },
  oscar: { nombre: 'Oscar', rol: 'Dir. Sistemas' },
  paulina: { nombre: 'Paulina', rol: 'Contralora' },
  silvia: { nombre: 'Silvia', rol: 'Gte. Capacitacion' },
  diego: { nombre: 'Diego', rol: 'Analista CrOP' },
  ramon: { nombre: 'Ramon Betancourt', rol: 'Consejo' },
};

const EXPRESIONES: Record<string, string> = {
  neutral: '😐', serio: '😤', confiado: '😏', preocupado: '😟',
  entusiasta: '😊', nervioso: '😰', aliviado: '😌', molesto: '😠',
  frustrado: '😩', satisfecho: '😌', resignado: '🤷', solemne: '🧐',
  firme: '💪', sorprendido: '😮', tecnico: '🤓', impaciente: '⏳',
  amable: '🤝', defensivo: '🛡️',
};

interface Props {
  onCredibilidadCambio?: (cred: number) => void;
  onRecargar?: () => void;
}

export function TabAsesores({ onCredibilidadCambio, onRecargar }: Props) {
  const [dialogos, setDialogos] = useState<any[]>([]);
  const [respondidos, setRespondidos] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [conversacion, setConversacion] = useState<{ personaje: string; lineas: string[]; tipo: 'asesor' | 'jugador' }[]>([]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      const data = await api.partida.dialogos();
      setDialogos(data);
    } catch { /* ignore */ }
    setCargando(false);
  }

  async function responder(nodoId: string, efecto: string, personaje: string, textoJugador: string) {
    setConversacion(prev => [...prev, { personaje, lineas: [textoJugador], tipo: 'jugador' }]);
    setRespondidos(prev => new Set([...prev, nodoId]));

    try {
      const res = await api.partida.respuesta(nodoId, efecto, personaje);
      if (res.credibilidad != null) onCredibilidadCambio?.(res.credibilidad);

      if (res.siguienteNodo) {
        setConversacion(prev => [...prev, {
          personaje: res.siguienteNodo.personaje,
          lineas: res.siguienteNodo.lineas,
          tipo: 'asesor',
        }]);

        if (res.siguienteNodo.respuestas?.length > 0) {
          setDialogos(prev => [...prev, res.siguienteNodo]);
        }
      }
    } catch { /* ignore */ }
  }

  if (cargando) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid var(--color-borde)',
          borderTopColor: 'var(--color-primario)',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 12px',
        }} />
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>Cargando dialogos...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (dialogos.length === 0) {
    return (
      <div className="tarjeta" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: 'var(--color-superficie-alt)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 26 }}>👥</span>
        </div>
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: 15 }}>
          No hay dialogos en este momento.
        </p>
        <p style={{ color: 'var(--color-texto-terciario)', fontSize: 13, marginTop: 4 }}>
          Avanza al siguiente ciclo para interactuar con tu equipo.
        </p>
      </div>
    );
  }

  const porPersonaje: Record<string, any[]> = {};
  for (const d of dialogos) {
    if (!porPersonaje[d.personaje]) porPersonaje[d.personaje] = [];
    porPersonaje[d.personaje].push(d);
  }

  return (
    <div>
      <h3 style={{
        marginBottom: 20,
        color: 'var(--color-primario)',
        fontSize: 18,
        fontWeight: 700,
      }}>
        Sala de Juntas
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Object.entries(porPersonaje).map(([personaje, nodos]) => {
          const info = NOMBRES[personaje];
          return (
            <div key={personaje} className="tarjeta" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'var(--color-primario-suave)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {EXPRESIONES[nodos[0]?.expresion] ?? '😐'}
                </div>
                <div>
                  <strong style={{ color: 'var(--color-primario)', fontSize: 15 }}>
                    {info?.nombre ?? personaje}
                  </strong>
                  <div style={{ fontSize: 12, color: 'var(--color-texto-terciario)' }}>
                    {info?.rol ?? ''}
                  </div>
                </div>
              </div>

              {nodos.map((nodo: any) => (
                <div key={nodo.nodoId}>
                  <div className="dialogo-burbuja">
                    {nodo.lineas.map((l: string, i: number) => (
                      <p key={i} style={{ marginBottom: i < nodo.lineas.length - 1 ? 8 : 0 }}>{l}</p>
                    ))}
                  </div>

                  {nodo.afirmacion && (
                    <div style={{
                      fontSize: 12,
                      padding: '5px 10px',
                      background: nodo.afirmacion.veredicto === 'verdadero'
                        ? 'var(--color-exito-suave)'
                        : nodo.afirmacion.veredicto === 'parcial'
                          ? 'var(--color-advertencia-suave)'
                          : 'var(--color-peligro-suave)',
                      borderRadius: 'var(--radio-sm)',
                      marginBottom: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      {nodo.afirmacion.veredicto === 'verdadero' ? '✅' : nodo.afirmacion.veredicto === 'parcial' ? '⚠️' : '❌'}
                      <span>{nodo.afirmacion.id}</span>
                    </div>
                  )}

                  {!respondidos.has(nodo.nodoId) && nodo.respuestas?.length > 0 && (
                    <div className="respuestas-lista">
                      {nodo.respuestas.map((r: any, i: number) => (
                        <button key={i} className="respuesta-opcion"
                          onClick={() => responder(nodo.nodoId, r.efecto, personaje, r.texto)}>
                          <span>{r.texto}</span>
                          <span style={{
                            fontSize: 11,
                            color: r.credibilidad > 0 ? 'var(--color-exito)' : r.credibilidad < 0 ? 'var(--color-peligro)' : 'var(--color-texto-terciario)',
                            marginLeft: 8,
                            fontWeight: 600,
                          }}>
                            {r.credibilidad > 0 ? `+${r.credibilidad}` : r.credibilidad}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {conversacion
                .filter(c => c.personaje === personaje)
                .map((c, i) => (
                  <div key={`conv-${i}`} className={`dialogo-burbuja ${c.tipo === 'jugador' ? 'jugador' : ''}`}>
                    {c.lineas.map((l, j) => <p key={j}>{l}</p>)}
                  </div>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
