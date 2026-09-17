import { useState, useEffect, useMemo } from 'react';
import { api } from '../api.js';

const HERRAMIENTAS = [
  { id: 'histograma', nombre: 'Histograma', icono: '📊' },
  { id: 'pareto', nombre: 'Pareto', icono: '📉' },
  { id: 'diagrama_corrida', nombre: 'Corrida', icono: '📈' },
  { id: 'dispersion', nombre: 'Dispersion', icono: '⚡' },
  { id: 'tabla_dinamica', nombre: 'Pivote', icono: '🔄' },
  { id: 'filtro', nombre: 'Filtrar', icono: '🔍' },
  { id: 'contar', nombre: 'Contar', icono: '🔢' },
  { id: 'sumar', nombre: 'Sumar', icono: '➕' },
  { id: 'estadisticas', nombre: 'Stats', icono: '📐' },
];

const MAPA_VERIFICACIONES: Record<string, { columnas: string[]; herramientas: string[] }> = {
  medianas_iguales: { columnas: ['ventanaCaptura', 'dateFirstInput', 'dateLastInput'], herramientas: ['estadisticas', 'histograma'] },
  errores_captura_interfaz: { columnas: ['comments'], herramientas: ['contar', 'filtro'] },
  trabajo_perdido_buro: { columnas: ['creditBureauRunDate', 'creditBureauResult'], herramientas: ['sumar', 'contar'] },
  error_captura_frecuente: { columnas: ['comments'], herramientas: ['contar', 'pareto'] },
  atorados_sin_plastico: { columnas: ['lastStatus', 'datePlasticSent'], herramientas: ['contar', 'filtro'] },
  concentracion_sucursales: { columnas: ['branchNum', 'comments'], herramientas: ['pareto', 'tabla_dinamica'] },
  secuencia_buro: { columnas: ['creditBureauRunDate', 'dateDocsSent'], herramientas: ['sumar', 'filtro'] },
};

interface Props {
  onHerramientaUsada?: (herramienta: string) => void;
}

export function TabDatos({ onHerramientaUsada }: Props) {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [columnas, setColumnas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<'solicitudes' | 'comentarios'>('solicitudes');
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [ordenCol, setOrdenCol] = useState('');
  const [ordenAsc, setOrdenAsc] = useState(true);
  const [filtroCol, setFiltroCol] = useState('');
  const [filtroVal, setFiltroVal] = useState('');
  const [colSeleccionada, setColSeleccionada] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);
  const [verificaciones, setVerificaciones] = useState<string[]>([]);
  const [herramientasUsadas, setHerramientasUsadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function cargar() {
      try {
        const [sol, com, cols, verifs] = await Promise.all([
          api.datos.solicitudes(),
          api.datos.comentarios(),
          api.datos.columnas(),
          api.datos.verificaciones(),
        ]);
        setSolicitudes(sol);
        setComentarios(com);
        setColumnas(cols.solicitudes);
        setVerificaciones(verifs);
      } catch { /* ignore */ }
      setCargando(false);
    }
    cargar();
  }, []);

  const datosFiltrados = useMemo(() => {
    let datos = tab === 'solicitudes' ? solicitudes : comentarios;
    if (filtroCol && filtroVal) {
      const lower = filtroVal.toLowerCase();
      datos = datos.filter(r => String(r[filtroCol] ?? '').toLowerCase().includes(lower));
    }
    if (ordenCol) {
      datos = [...datos].sort((a, b) => {
        const va = a[ordenCol], vb = b[ordenCol];
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return ordenAsc ? cmp : -cmp;
      });
    }
    return datos;
  }, [tab, solicitudes, comentarios, filtroCol, filtroVal, ordenCol, ordenAsc]);

  function ordenar(campo: string) {
    if (ordenCol === campo) { setOrdenAsc(!ordenAsc); }
    else { setOrdenCol(campo); setOrdenAsc(true); }
  }

  async function aplicarHerramienta(herramientaId: string) {
    if (!colSeleccionada) {
      setResultado('Selecciona una columna primero (haz doble clic en el encabezado)');
      return;
    }

    const datos = tab === 'solicitudes' ? solicitudes : comentarios;
    const valores = datos.map(r => r[colSeleccionada]).filter(v => v != null);

    let res = '';
    const nums = valores.map(Number).filter(n => !isNaN(n));

    switch (herramientaId) {
      case 'contar':
        if (nums.length > 0) {
          const conteos: Record<string, number> = {};
          for (const v of valores) { conteos[String(v)] = (conteos[String(v)] ?? 0) + 1; }
          const top5 = Object.entries(conteos).sort((a, b) => b[1] - a[1]).slice(0, 10);
          res = `CONTAR (${colSeleccionada}): ${valores.length} valores\n` +
            top5.map(([k, v]) => `  ${k}: ${v}`).join('\n');
        }
        break;
      case 'sumar':
        res = nums.length > 0
          ? `SUMA (${colSeleccionada}): ${nums.reduce((a, b) => a + b, 0).toFixed(2)}`
          : 'La columna no tiene valores numericos';
        break;
      case 'estadisticas':
        if (nums.length > 0) {
          const sorted = [...nums].sort((a, b) => a - b);
          const media = nums.reduce((a, b) => a + b, 0) / nums.length;
          const mediana = sorted[Math.floor(sorted.length / 2)]!;
          const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
          const varianza = nums.reduce((s, v) => s + (v - media) ** 2, 0) / nums.length;
          const desvest = Math.sqrt(varianza);
          res = `ESTADISTICAS (${colSeleccionada}):\n  N: ${nums.length}\n  Media: ${media.toFixed(2)}\n  Mediana: ${mediana}\n  Desv.Est: ${desvest.toFixed(2)}\n  P90: ${p90}\n  Min: ${sorted[0]}\n  Max: ${sorted[sorted.length - 1]}`;
        }
        break;
      case 'filtro':
        setFiltroCol(colSeleccionada);
        res = `Filtro activo en "${colSeleccionada}". Escribe el valor a buscar arriba.`;
        break;
      default:
        res = `${herramientaId.toUpperCase()} aplicado a "${colSeleccionada}" (${valores.length} valores)`;
    }

    setResultado(res);
    setHerramientasUsadas(prev => new Set([...prev, herramientaId]));
    onHerramientaUsada?.(herramientaId);

    for (const [verifId, regla] of Object.entries(MAPA_VERIFICACIONES)) {
      if (verificaciones.includes(verifId)) continue;
      if (regla.columnas.includes(colSeleccionada) && regla.herramientas.includes(herramientaId)) {
        try {
          await api.datos.verificar(verifId, herramientaId);
          setVerificaciones(prev => [...prev, verifId]);
        } catch { /* ignore */ }
      }
    }
  }

  const cols = tab === 'solicitudes' ? columnas : [
    { campo: 'solicitudNum' }, { campo: 'estado' }, { campo: 'sucursalNum' },
    { campo: 'intentos' }, { campo: 'categoriaPrimaria' }, { campo: 'categoriaSecundaria' },
    { campo: 'comentarioCliente' },
  ];

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
        <p style={{ color: 'var(--color-texto-secundario)', fontSize: 14 }}>Cargando datos...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={`tab ${tab === 'solicitudes' ? 'activo' : ''}`}
          onClick={() => setTab('solicitudes')}>
          Solicitudes ({solicitudes.length})
        </button>
        <button className={`tab ${tab === 'comentarios' ? 'activo' : ''}`}
          onClick={() => setTab('comentarios')}>
          Comentarios ({comentarios.length})
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {filtroCol && (
            <>
              <input value={filtroVal} onChange={e => setFiltroVal(e.target.value)}
                placeholder={`Filtrar ${filtroCol}...`}
                style={{ width: 180, fontSize: 13 }} />
              <button className="btn-fantasma" style={{ padding: '6px 10px', fontSize: 12 }}
                onClick={() => { setFiltroCol(''); setFiltroVal(''); }}>
                Limpiar
              </button>
            </>
          )}
        </div>
      </div>

      {colSeleccionada && (
        <div style={{
          marginBottom: 12,
          padding: '8px 14px',
          background: 'var(--color-primario-suave)',
          borderRadius: 'var(--radio)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>
            Columna seleccionada: <strong style={{ color: 'var(--color-primario)' }}>{colSeleccionada}</strong>
          </span>
          <button
            onClick={() => setColSeleccionada('')}
            style={{ background: 'none', border: 'none', fontSize: 16, color: 'var(--color-texto-terciario)', padding: '0 4px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {HERRAMIENTAS.map(h => (
          <button key={h.id} className="herramienta-btn" onClick={() => aplicarHerramienta(h.id)}
            style={{
              background: herramientasUsadas.has(h.id) ? 'var(--color-acento-suave)' : undefined,
              borderColor: herramientasUsadas.has(h.id) ? 'var(--color-acento)' : undefined,
              color: herramientasUsadas.has(h.id) ? 'var(--color-acento)' : undefined,
            }}>
            <span style={{ fontSize: 18 }}>{h.icono}</span>
            {h.nombre}
          </button>
        ))}
      </div>

      {resultado && (
        <pre style={{
          background: 'var(--color-primario)',
          color: '#e2e8f0',
          padding: 18,
          borderRadius: 'var(--radio)',
          marginBottom: 14,
          fontSize: 13,
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflow: 'auto',
          lineHeight: 1.6,
          fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
        }}>
          {resultado}
        </pre>
      )}

      {verificaciones.length > 0 && (
        <div style={{
          marginBottom: 14,
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--color-texto-secundario)' }}>Verificaciones:</span>
          {verificaciones.map(v => (
            <span key={v} className="badge badge-exito">{v}</span>
          ))}
        </div>
      )}

      <div className="tarjeta" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
          <table className="datos">
            <thead>
              <tr>
                {cols.map((c: any) => (
                  <th key={c.campo}
                    onClick={() => ordenar(c.campo)}
                    onDoubleClick={() => setColSeleccionada(c.campo)}
                    style={{
                      background: colSeleccionada === c.campo ? 'var(--color-acento)' : undefined,
                      color: colSeleccionada === c.campo ? '#fff' : undefined,
                    }}>
                    {c.nombre ?? c.campo}
                    {ordenCol === c.campo ? (ordenAsc ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datosFiltrados.slice(0, 200).map((r, i) => (
                <tr key={i}>
                  {cols.map((c: any) => (
                    <td key={c.campo}>{formatVal(r[c.campo])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {datosFiltrados.length > 200 && (
          <p style={{
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--color-texto-terciario)',
            borderTop: '1px solid var(--color-borde-sutil)',
            background: 'var(--color-superficie-alt)',
          }}>
            Mostrando 200 de {datosFiltrados.length} filas
          </p>
        )}
      </div>
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' && v.includes('T') && v.includes('-')) {
    try { return new Date(v).toLocaleDateString('es-MX'); } catch { return String(v); }
  }
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
