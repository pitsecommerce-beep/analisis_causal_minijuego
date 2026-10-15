import { useMemo, useState } from 'react';
import { Icono } from './ui/Iconos.js';
import { valoresDistintos } from '../constructor.js';
import type { Contexto, Filtro } from '../constructor.js';
import type { Columna, Fila } from '../analisis.js';

// Filtros combinados: cada uno es "columna igual a valor" y todos se aplican a la vez.
// Agregar uno toma dos clics: la columna y el valor.
export function FiltrosBarra({ filas, columnas, ctx, filtros, onCambio }: {
  filas: Fila[]; columnas: Columna[]; ctx: Contexto; filtros: Filtro[]; onCambio: (f: Filtro[]) => void;
}) {
  const { t } = ctx;
  const [campo, setCampo] = useState('');
  const valores = useMemo(() => (campo ? valoresDistintos(filas, campo, ctx) : []), [filas, campo, ctx]);
  const nombre = (c: string) => columnas.find(x => x.campo === c)?.nombre ?? c;

  function agregar(valor: string) {
    if (!campo || !valor) return;
    onCambio([...filtros.filter(f => f.campo !== campo), { campo, valor }]);
    setCampo('');
  }

  return (
    <div className="filtros">
      {filtros.length > 0 && (
        <div className="filtros-chips">
          {filtros.map(f => (
            <button key={f.campo} className="chip" onClick={() => onCambio(filtros.filter(x => x !== f))} title={t('constructor.quitarFiltro')}>
              <span className="chip-campo">{nombre(f.campo)}:</span> {f.valor}
              <Icono nombre="cerrar" tamano={12} />
            </button>
          ))}
        </div>
      )}
      <div className="filtros-nuevo">
        <select value={campo} onChange={e => setCampo(e.target.value)} aria-label={t('constructor.elegirColumna')}>
          <option value="">{t('constructor.agregarFiltro')}</option>
          {columnas.map(c => <option key={c.campo} value={c.campo}>{c.calculada ? `ƒ  ${c.nombre}` : c.nombre}</option>)}
        </select>
        {campo && (
          <select value="" onChange={e => agregar(e.target.value)} aria-label={t('constructor.elegirValor')} autoFocus>
            <option value="">{t('constructor.elegirValor')}</option>
            {valores.slice(0, 500).map(v => <option key={v.valor} value={v.valor}>{v.valor} ({v.n})</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
