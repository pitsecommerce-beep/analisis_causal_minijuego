import { useEffect, useState } from 'react';
import { api } from '../api.js';
import type { LineaParticipante } from '../api.js';
import { HITOS } from '../../compartido/metodo.js';
import type { Evento, Hito } from '../../compartido/metodo.js';
import { RAMAS_6M, ORIGENES } from '../../compartido/espina.js';

const HERRAMIENTAS: Record<string, string> = {
  histograma: 'Histograma', pareto: 'Pareto', diagrama_corrida: 'Corrida', carta_control: 'Gráfica de control',
  dispersion: 'Dispersión', tabla_dinamica: 'Pivote', filtro: 'Filtro', contar: 'Conteo', sumar: 'Suma', estadisticas: 'Estadísticas',
};
const VISTAS: Record<string, string> = {
  datos: 'la pestaña Datos', asesores: 'la Sala de Juntas', espina: 'la espina de pescado', decisiones: 'Decisiones y KPIs',
  solicitudes: 'la hoja de solicitudes', comentarios: 'los comentarios de clientes', proceso: 'la vista del proceso',
};
const NOMBRE_HITO: Record<Hito, string> = { percibir: 'Percibir', definir: 'Definir', hipotesis: 'Hipótesis', probar: 'Probar', estratificar: 'Estratificar' };

function describir(e: Evento): string {
  const d = e.datos;
  switch (e.tipo) {
    case 'analisis': {
      const partes = [`${HERRAMIENTAS[d.herramienta] ?? d.herramienta} de ${d.columnaNombre ?? d.columna}`];
      if (d.hoja === 'comentarios') partes.push('en comentarios');
      if (d.estrato) partes.push(`estratificado por ${d.estrato.nombre ?? d.estrato.campo} ${d.estrato.valor}`);
      if (d.filtro) partes.push(`filtro "${d.filtro.valor}" en ${d.filtro.columna}`);
      return partes.join(', ');
    }
    case 'vista': return `Abrió ${VISTAS[d.vista] ?? d.vista}`;
    case 'proceso_etapa': return `Revisó la etapa "${d.etapa}" del proceso${d.estrato ? ` (${d.estrato.nombre ?? d.estrato.campo} ${d.estrato.valor})` : ''}`;
    case 'espina_tarjeta': return `Agregó una causa a la espina: rama ${RAMAS_6M.find(r => r.id === d.rama)?.nombre ?? d.rama}, ${ORIGENES[d.origen as keyof typeof ORIGENES]?.toLowerCase() ?? d.origen}`;
    case 'evidencia': return `Guardó evidencia: ${HERRAMIENTAS[d.herramienta] ?? d.herramienta} de ${d.columna}${d.verificacionId ? ` (respalda ${d.verificacionId})` : ''}`;
    case 'acciones': return `Eligió acciones: ${(d.acciones ?? []).map((a: any) => `#${a.accionId} ${a.verificada ? 'con causa verificada' : a.tarjetaId ? 'con causa sin verificar' : 'sin causa ligada'}`).join('; ')}`;
    case 'votacion': return `Votó ${(d.causas ?? []).length} causas y escribió sus 5 porqués`;
    case 'aviso': return `Betancourt señaló: ${d.texto}`;
    default: return e.tipo;
  }
}

// Línea de tiempo del método de cada participante: qué hizo, en qué ciclo y a qué hora
export function LineaTiempo({ sesionId }: { sesionId: string }) {
  const [lineas, setLineas] = useState<LineaParticipante[] | null>(null);
  const [elegido, setElegido] = useState('');
  const [error, setError] = useState('');

  async function cargar() {
    setError('');
    try {
      const l = await api.profesor.lineaTiempo(sesionId);
      setLineas(l);
      if (!l.some(x => x.id === elegido)) setElegido(l.find(x => x.eventos.length > 0)?.id ?? l[0]?.id ?? '');
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => { setLineas(null); cargar(); }, [sesionId]);

  const linea = lineas?.find(l => l.id === elegido);

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid var(--color-borde)', paddingTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primario)', margin: 0 }}>Línea de tiempo del método</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {lineas && lineas.length > 0 && (
            <select value={elegido} onChange={e => setElegido(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }} aria-label="Participante">
              {lineas.map(l => <option key={l.id} value={l.id}>{l.nombre} ({l.eventos.length})</option>)}
            </select>
          )}
          <button className="btn-fantasma btn-sm" onClick={cargar}>Actualizar</button>
        </div>
      </div>
      {error && <div className="alerta-error" role="alert">{error}</div>}
      {lineas && lineas.length === 0 && <p style={{ fontSize: 14, color: 'var(--color-texto-terciario)' }}>Nadie se ha unido todavía.</p>}
      {linea && (
        <>
          <div className="linea-hitos">
            {(Object.keys(HITOS) as Hito[]).map(h => (
              <span key={h} className={`badge ${linea.hitos[h] ? 'badge-exito' : 'badge-advertencia'}`} title={HITOS[h]}>
                {linea.hitos[h] ? '✓' : '✗'} {NOMBRE_HITO[h]}
              </span>
            ))}
          </div>
          {linea.eventos.length === 0
            ? <p style={{ fontSize: 14, color: 'var(--color-texto-terciario)' }}>Sin actividad registrada.</p>
            : (
              <ol className="linea-tiempo">
                {linea.eventos.map((e, i) => (
                  <li key={i} className={`linea-evento tipo-${e.tipo}`}>
                    <span className="linea-hora">{new Date(e.momento).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span className="linea-ciclo">C{e.datos.ciclo ?? '-'}</span>
                    <span className="linea-texto">{describir(e)}</span>
                  </li>
                ))}
              </ol>
            )}
        </>
      )}
    </div>
  );
}
