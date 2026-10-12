import { useEffect } from 'react';
import { alternarPendiente } from '../pendientes.js';
import type { Pendiente } from '../pendientes.js';
import { Icono } from './ui/Iconos.js';

interface Props {
  pendientes: Pendiente[];
  verificadas: string[];
  onCerrar: () => void;
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
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </aside>
    </div>
  );
}
