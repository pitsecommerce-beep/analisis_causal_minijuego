import { useSesion } from '../i18n.js';
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
  return nota.replace(/^(Validar|Revisar|Recomendación de [^:]+|Validate|Review|[^:]+[’']s recommendation):\s*/i, '');
}

export function estaResuelto(p: Pendiente, verificadas: string[]): boolean {
  return p.hecho || (!!p.afirmacion && verificadas.includes(p.afirmacion));
}

// Panel lateral con lo que el equipo pidió validar o recomendó revisar
export function Pendientes({ pendientes, verificadas, onCerrar }: Props) {
  const { t } = useSesion();
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
      <aside className="pendientes-panel" role="dialog" aria-label={t('pendientesUi.titulo')} onClick={e => e.stopPropagation()}>
        <header className="pendientes-encabezado">
          <div>
            <h3>{t('pendientesUi.titulo')}</h3>
            <p>{t('pendientesUi.ayuda')}</p>
          </div>
          <button className="aviso-cerrar" onClick={onCerrar} aria-label={t('pendientesUi.cerrar')}><Icono nombre="cerrar" tamano={18} /></button>
        </header>

        {pendientes.length === 0 && (
          <p className="pendientes-vacio">{t('pendientesUi.vacio')}</p>
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
                      {validada && <span className="badge badge-exito">{t('pendientesUi.validado')}</span>}
                      {enEspina.has(p.id) && <span className="badge badge-info">{t('pendientesUi.enEspina')}</span>}
                    </span>
                  </span>
                </label>
                {!enEspina.has(p.id) && (
                  <select className="pendientes-enviar" value="" aria-label={t('pendientesUi.enviar')}
                    onChange={e => e.target.value && agregarTarjeta({ rama: e.target.value as Rama, texto: textoCausa(p.texto), origen: 'equipo', pendienteId: p.id })}>
                    <option value="">{t('pendientesUi.enviar')}</option>
                    {RAMAS_6M.map(r => <option key={r.id} value={r.id}>{t('pendientesUi.rama', { nombre: t(`espinaUi.ramas.${r.id}`) })}</option>)}
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
