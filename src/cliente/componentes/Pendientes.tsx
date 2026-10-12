import { useEffect } from 'react';
import { alternarPendiente } from '../pendientes.js';
import type { Pendiente } from '../pendientes.js';
import { Icono } from './ui/Iconos.js';
import { RAMAS_6M } from '../../compartido/espina.js';
import type { Rama } from '../../compartido/espina.js';
import { useEspina, agregarTarjeta } from '../espina.js';

interface Props {
  pendientes: Pendiente[];
  verificadas: string[];
  onCerrar: () => void;
}

// La nota pasa a la espina como causa posible, sin la instrucción inicial
function textoCausa(nota: string): string {
  return nota.replace(/^(Validar|Revisar|Recomendación de [^:]+):\s*/i, '');
}

export function estaResuelto(p: Pendiente, verificadas: string[]): boolean {
  return p.hecho || (!!p.afirmacion && verificadas.includes(p.afirmacion));
}

// Panel lateral con lo que el equipo pidió validar o recomendó revisar
export function Pendientes({ pendientes, verificadas, onCerrar }: Props) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const espina = useEspina();
  const enEspina = new Set(espina.tarjetas.map(t => t.pendienteId).filter(Boolean));
  const abiertos = pendientes.filter(p => !estaResuelto(p, verificadas));
  const resueltos = pendientes.filter(p => estaResuelto(p, verificadas));

  return (
    <div className="pendientes-fondo" onClick={onCerrar}>
      <aside className="pendientes-panel" role="dialog" aria-label="Lista de pendientes" onClick={e => e.stopPropagation()}>
        <header className="pendientes-encabezado">
          <div>
            <h3>Lista de pendientes</h3>
            <p>Lo que tu equipo te pidió validar o te recomendó revisar.</p>
          </div>
          <button className="aviso-cerrar" onClick={onCerrar} aria-label="Cerrar pendientes"><Icono nombre="cerrar" tamano={18} /></button>
        </header>

        {pendientes.length === 0 && (
          <p className="pendientes-vacio">Aún no hay pendientes. Habla con tu equipo en la Sala de Juntas y aquí aparecerán sus notas.</p>
        )}

        <ul className="pendientes-lista">
          {[...abiertos, ...resueltos].map(p => {
            const validada = !!p.afirmacion && verificadas.includes(p.afirmacion);
            const resuelto = estaResuelto(p, verificadas);
            return (
              <li key={p.id} className={resuelto ? 'resuelto' : ''}>
                <label>
                  <input type="checkbox" className="casilla" checked={resuelto} disabled={validada} onChange={() => alternarPendiente(p.id)} />
                  <span>
                    <span className="pendientes-texto">{p.texto}</span>
                    <span className="pendientes-meta">
                      {p.personaje}
                      {validada && <span className="badge badge-exito">Validado con datos</span>}
                      {enEspina.has(p.id) && <span className="badge badge-info">En la espina</span>}
                    </span>
                  </span>
                </label>
                {!enEspina.has(p.id) && (
                  <select className="pendientes-enviar" value="" aria-label="Enviar a la espina de pescado"
                    onChange={e => e.target.value && agregarTarjeta({ rama: e.target.value as Rama, texto: textoCausa(p.texto), origen: 'equipo', pendienteId: p.id })}>
                    <option value="">Enviar a la espina…</option>
                    {RAMAS_6M.map(r => <option key={r.id} value={r.id}>Rama {r.nombre}</option>)}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
