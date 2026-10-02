import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { Icono } from './ui/Iconos.js';
import { useUI } from './ui/Notificaciones.js';

const NOMBRES: Record<string, { nombre: string; rol: string }> = {
  bernardo: { nombre: 'Bernardo', rol: 'Gte. Regional' },
  oscar: { nombre: 'Óscar', rol: 'Dir. Sistemas' },
  paulina: { nombre: 'Paulina', rol: 'Contralora' },
  silvia: { nombre: 'Silvia', rol: 'Gte. Capacitación' },
  diego: { nombre: 'Diego', rol: 'Analista CrOP' },
  ramon: { nombre: 'Ramón Betancourt', rol: 'Consejo' },
};

const COLORES_PERSONAJE: Record<string, string> = {
  bernardo: '#2563a8',
  oscar: '#7c3aed',
  paulina: '#0891b2',
  silvia: '#c8922a',
  diego: '#059669',
  ramon: '#0f2b4a',
};

interface Props {
  onCredibilidadCambio?: (cred: number) => void;
  onRecargar?: () => void;
}

export function TabAsesores({ onCredibilidadCambio, onRecargar }: Props) {
  const { avisar } = useUI();
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
    } catch (err: any) {
      avisar('error', 'No se pudieron cargar los diálogos', err.message);
    }
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
    } catch (err: any) {
      setRespondidos(prev => {
        const next = new Set(prev);
        next.delete(nodoId);
        return next;
      });
      setConversacion(prev => prev.slice(0, -1));
      avisar('error', 'No se pudo enviar tu respuesta', err.message);
    }
  }

  if (cargando) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>Cargando diálogos...</p>
      </div>
    );
  }

  if (dialogos.length === 0) {
    return (
      <div className="tarjeta" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div className="icono-insignia icono-insignia-neutro icono-insignia-lg" style={{ marginBottom: 14 }}>
          <Icono nombre="mensajes" tamano={26} grosor={1.8} />
        </div>
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: 15 }}>
          No hay diálogos en este momento.
        </p>
        <p style={{ color: 'var(--color-texto-terciario)', fontSize: 13, marginTop: 4 }}>
          Avanza al siguiente ciclo para interactuar con tu equipo.
        </p>
      </div>
    );
  }

  const porPersonaje: Record<string, any[]> = {};
  for (const d of dialogos) {
    (porPersonaje[d.personaje] ??= []).push(d);
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
                  background: COLORES_PERSONAJE[personaje] ?? 'var(--color-primario)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                  letterSpacing: '-0.02em',
                }}>
                  {(info?.nombre ?? personaje).charAt(0).toUpperCase()}
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
                      color: nodo.afirmacion.veredicto === 'verdadero'
                        ? 'var(--color-exito)'
                        : nodo.afirmacion.veredicto === 'parcial'
                          ? 'var(--color-advertencia)'
                          : 'var(--color-peligro)',
                      borderRadius: 'var(--radio-sm)',
                      marginBottom: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <Icono
                        nombre={nodo.afirmacion.veredicto === 'verdadero' ? 'exito' : nodo.afirmacion.veredicto === 'parcial' ? 'parcial' : 'error'}
                        tamano={14}
                      />
                      <span style={{ color: 'var(--color-texto)' }}>{nodo.afirmacion.id}</span>
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
