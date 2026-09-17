import { useState, useEffect } from 'react';
import { api } from '../api.js';

const NOMBRES: Record<string, string> = {
  bernardo: 'Bernardo (Gte. Regional)',
  oscar: 'Oscar (Dir. Sistemas)',
  paulina: 'Paulina (Contralora)',
  silvia: 'Silvia (Gte. Capacitacion)',
  diego: 'Diego (Analista CrOP)',
  ramon: 'Ramon Betancourt (Consejo)',
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

  if (cargando) return <p style={{ padding: 20 }}>Cargando dialogos...</p>;
  if (dialogos.length === 0) return <p style={{ padding: 20, color: 'var(--color-texto-secundario)' }}>No hay dialogos en este momento. Avanza al siguiente ciclo.</p>;

  const porPersonaje: Record<string, any[]> = {};
  for (const d of dialogos) {
    if (!porPersonaje[d.personaje]) porPersonaje[d.personaje] = [];
    porPersonaje[d.personaje].push(d);
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16, color: 'var(--color-primario)' }}>Sala de Juntas</h3>

      {Object.entries(porPersonaje).map(([personaje, nodos]) => (
        <div key={personaje} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{EXPRESIONES[nodos[0]?.expresion] ?? '😐'}</span>
            <strong style={{ color: 'var(--color-primario)' }}>{NOMBRES[personaje] ?? personaje}</strong>
          </div>

          {nodos.map((nodo: any) => (
            <div key={nodo.nodoId}>
              <div className="dialogo-burbuja">
                {nodo.lineas.map((l: string, i: number) => (
                  <p key={i} style={{ marginBottom: i < nodo.lineas.length - 1 ? 6 : 0 }}>{l}</p>
                ))}
              </div>

              {nodo.afirmacion && (
                <div style={{ fontSize: 12, padding: '4px 8px', background: '#fefcbf', borderRadius: 4, marginBottom: 8, display: 'inline-block' }}>
                  Afirmacion: {nodo.afirmacion.veredicto === 'verdadero' ? '✅' : nodo.afirmacion.veredicto === 'parcial' ? '⚠️' : '❌'}
                  {' '}{nodo.afirmacion.id}
                </div>
              )}

              {!respondidos.has(nodo.nodoId) && nodo.respuestas?.length > 0 && (
                <div className="respuestas-lista">
                  {nodo.respuestas.map((r: any, i: number) => (
                    <button key={i} className="respuesta-opcion"
                      onClick={() => responder(nodo.nodoId, r.efecto, personaje, r.texto)}>
                      {r.texto}
                      <span style={{ fontSize: 11, color: 'var(--color-texto-secundario)', marginLeft: 8 }}>
                        ({r.credibilidad > 0 ? `+${r.credibilidad}` : r.credibilidad} cred)
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
      ))}
    </div>
  );
}
