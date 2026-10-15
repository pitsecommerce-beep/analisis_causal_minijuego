import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Icono } from './ui/Iconos.js';
import { VistaTablero } from './TabTablero.js';
import { ProveedorSesion } from '../i18n.js';
import { prepararDatos } from '../datos.js';
import { traductor } from '../../compartido/i18n/index.js';
import type { ConfigSesion } from '../../compartido/configuracion.js';
import type { Tablero } from '../../compartido/tablero.js';
import type { DatosJuego } from '../datos.js';

type Equipo = { jugadorId: string; nombre: string; actualizado: string; tablero: Tablero };

// Tableros de todos los equipos, en solo lectura, para guiar la discusión final.
// Los gráficos se dibujan con los datos y el idioma de la sesión.
export function TablerosProfesor({ sesionId, onCerrar }: { sesionId: string; onCerrar: () => void }) {
  const [config, setConfig] = useState<ConfigSesion | null>(null);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [crudos, setCrudos] = useState<{ solicitudes: any[]; comentarios: any[]; columnas: any } | null>(null);
  const [elegido, setElegido] = useState<string>('');
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setError(false);
    Promise.all([api.profesor.tableros(sesionId), api.profesor.datosSesion(sesionId)])
      .then(([tab, datos]) => {
        setConfig(tab.config);
        setEquipos(tab.tableros);
        setElegido(e => e || tab.tableros[0]?.jugadorId || '');
        setCrudos(datos);
      })
      .catch(() => setError(true));
  }, [sesionId, intento]);

  const datos: DatosJuego | null = useMemo(() => {
    if (!config || !crudos) return null;
    return prepararDatos(crudos.solicitudes, crudos.comentarios, crudos.columnas, config.version === 'extendida' ? 'R2' : 'original', traductor(config.idioma));
  }, [config, crudos]);

  const equipo = equipos.find(e => e.jugadorId === elegido);

  return (
    <div className="tableros-profesor" role="dialog" aria-modal="true" aria-label="Tableros de los equipos">
      <header className="tableros-profesor-cabecera">
        <h2>Tableros de los equipos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-fantasma btn-sm" onClick={() => setIntento(i => i + 1)}>Actualizar</button>
          <button className="btn-fantasma btn-sm" onClick={onCerrar}><Icono nombre="cerrar" tamano={16} /> Cerrar</button>
        </div>
      </header>
      {error && (
        <div className="alerta-error" role="alert" style={{ margin: 20 }}>
          No se pudieron cargar los tableros. <button className="btn-fantasma btn-sm" onClick={() => setIntento(i => i + 1)}>Intenta de nuevo</button>
        </div>
      )}
      {!error && !datos && <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>}
      {datos && config && (
        <div className="tableros-profesor-cuerpo">
          <nav className="tableros-profesor-lista">
            {equipos.length === 0 && <p className="datos-nota">Ningún equipo ha agregado gráficos todavía.</p>}
            {equipos.map(e => (
              <button key={e.jugadorId} className={e.jugadorId === elegido ? 'activo' : ''} onClick={() => setElegido(e.jugadorId)}>
                <strong>{e.nombre}</strong>
                <span>{e.tablero.graficos.length} {e.tablero.graficos.length === 1 ? 'gráfico' : 'gráficos'}</span>
              </button>
            ))}
          </nav>
          <div className="tableros-profesor-vista">
            {equipo && (
              <ProveedorSesion configFija={config}>
                <VistaTablero key={equipo.jugadorId} tablero={equipo.tablero} datos={datos} nombreEquipo={equipo.nombre} editable={false} />
              </ProveedorSesion>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
