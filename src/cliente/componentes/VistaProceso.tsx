import { useMemo, useState } from 'react';
import { ETAPAS_PROCESO, duracionesEtapa, formatoNumero, resumir } from '../analisis.js';
import type { Fila } from '../analisis.js';
import { Icono } from './ui/Iconos.js';

interface Props {
  filas: Fila[];
  estrato: string;
  onEtapa?: (etapa: string) => void;
}

// Anexo 1: flujo del proceso de tarjeta de crédito, con los tiempos de cada etapa
export function VistaProceso({ filas, estrato, onEtapa }: Props) {
  const [elegida, setElegida] = useState('captura');
  const etapa = ETAPAS_PROCESO.find(e => e.id === elegida)!;
  const resumenes = useMemo(
    () => Object.fromEntries(ETAPAS_PROCESO.map(e => [e.id, resumir(duracionesEtapa(filas, e))])),
    [filas],
  );
  const r = resumenes[elegida] ?? null;

  function elegir(id: string) {
    setElegida(id);
    onEtapa?.(id);
  }

  return (
    <div data-tour="proceso">
      <p className="datos-nota" style={{ marginTop: 0 }}>
        Anexo 1. Haz clic en una etapa para ver cuánto tarda{estrato ? ` (${estrato})` : ''}. Los tiempos se calculan con las fechas registradas en las solicitudes.
      </p>
      <ol className="proceso-flujo">
        {ETAPAS_PROCESO.map((e, i) => {
          const re = resumenes[e.id];
          return (
            <li key={e.id}>
              <button className={`proceso-etapa ${elegida === e.id ? 'activa' : ''} ${re ? '' : 'sin-registro'}`} onClick={() => elegir(e.id)} aria-pressed={elegida === e.id}>
                <span className="proceso-numero">{i + 1}</span>
                <span className="proceso-nombre">{e.nombre}</span>
                <span className="proceso-dato">{re ? `Mediana ${formatoNumero(re.mediana, 1)} ${re.mediana === 1 ? 'día' : 'días'}` : 'Sin registro de tiempo'}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="tarjeta datos-resultado transicion-contenido">
        <div className="datos-resultado-cabecera">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="icono-insignia icono-insignia-primario icono-insignia-sm"><Icono nombre="reloj" tamano={18} /></div>
            <div>
              <h4 className="datos-resultado-titulo">{etapa.nombre}{estrato && ` · ${estrato}`}</h4>
              <p className="datos-nota" style={{ margin: 0 }}>{etapa.nota ?? (r ? 'Días entre las dos fechas que delimitan la etapa.' : 'La base de datos no registra fechas para esta etapa.')}</p>
            </div>
          </div>
        </div>
        {r ? (
          <div className="datos-cifras">
            {[
              { etiqueta: 'Solicitudes con registro', valor: r.n.toLocaleString('es-MX') },
              { etiqueta: 'Mediana (días)', valor: formatoNumero(r.mediana, 1) },
              { etiqueta: 'Media (días)', valor: formatoNumero(r.media, 1) },
              { etiqueta: 'Desv. estándar (días)', valor: formatoNumero(r.desviacion, 1) },
              { etiqueta: 'Percentil 90 (días)', valor: formatoNumero(r.p90, 1) },
            ].map(c => (
              <div key={c.etiqueta} className="datos-cifra">
                <span className="datos-cifra-valor">{c.valor}</span>
                <span className="datos-cifra-etiqueta">{c.etiqueta}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="datos-aviso" style={{ margin: 0 }}><Icono nombre="info" tamano={16} />No hay fechas en la base para medir esta etapa. No se estiman tiempos que no están registrados.</div>
        )}
      </div>
    </div>
  );
}
