import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type TipoAviso = 'exito' | 'error' | 'info' | 'advertencia';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  titulo: string;
  mensaje?: string | undefined;
}

type TonoConfirmacion = 'primario' | 'advertencia' | 'peligro';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje?: ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  tono?: TonoConfirmacion;
}

interface ContextoUI {
  avisar: (tipo: TipoAviso, titulo: string, mensaje?: string) => void;
  confirmar: (opciones: OpcionesConfirmacion) => Promise<boolean>;
}

const Contexto = createContext<ContextoUI | null>(null);

const DURACION_AVISO = 4500;

const ICONOS: Record<TipoAviso, string> = {
  exito: '✓',
  error: '×',
  info: 'i',
  advertencia: '!',
};

export function ProveedorUI({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [confirmacion, setConfirmacion] = useState<OpcionesConfirmacion | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);
  const siguienteId = useRef(1);

  const cerrarAviso = useCallback((id: number) => {
    setAvisos(prev => prev.filter(a => a.id !== id));
  }, []);

  const avisar = useCallback((tipo: TipoAviso, titulo: string, mensaje?: string) => {
    const id = siguienteId.current++;
    setAvisos(prev => [...prev.slice(-3), { id, tipo, titulo, mensaje }]);
    window.setTimeout(() => cerrarAviso(id), DURACION_AVISO);
  }, [cerrarAviso]);

  const confirmar = useCallback((opciones: OpcionesConfirmacion) => {
    resolverRef.current?.(false);
    setConfirmacion(opciones);
    return new Promise<boolean>(resolve => { resolverRef.current = resolve; });
  }, []);

  const responder = useCallback((valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setConfirmacion(null);
  }, []);

  return (
    <Contexto.Provider value={{ avisar, confirmar }}>
      {children}

      <div className="avisos" role="region" aria-live="polite" aria-label="Notificaciones">
        {avisos.map(a => (
          <div key={a.id} className={`aviso aviso-${a.tipo}`} role={a.tipo === 'error' ? 'alert' : 'status'}>
            <span className="aviso-icono" aria-hidden="true">{ICONOS[a.tipo]}</span>
            <div className="aviso-cuerpo">
              <div className="aviso-titulo">{a.titulo}</div>
              {a.mensaje && <div className="aviso-mensaje">{a.mensaje}</div>}
            </div>
            <button className="aviso-cerrar" onClick={() => cerrarAviso(a.id)} aria-label="Cerrar notificación">
              {'×'}
            </button>
          </div>
        ))}
      </div>

      {confirmacion && (
        <ModalConfirmacion opciones={confirmacion} onResponder={responder} />
      )}
    </Contexto.Provider>
  );
}

function ModalConfirmacion({ opciones, onResponder }: {
  opciones: OpcionesConfirmacion;
  onResponder: (v: boolean) => void;
}) {
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const tono = opciones.tono ?? 'primario';
  const claseBoton = tono === 'peligro' ? 'btn-peligro' : tono === 'advertencia' ? 'btn-advertencia' : 'btn-primario';

  useEffect(() => {
    confirmarRef.current?.focus();
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onResponder(false);
    }
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, [onResponder]);

  return (
    <div className="modal-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onResponder(false); }}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-titulo">
        <div className={`modal-icono modal-icono-${tono}`} aria-hidden="true">
          {tono === 'primario' ? '?' : '!'}
        </div>
        <h3 id="modal-titulo" className="modal-titulo">{opciones.titulo}</h3>
        {opciones.mensaje && <div className="modal-mensaje">{opciones.mensaje}</div>}
        <div className="modal-acciones">
          <button className="btn-fantasma" onClick={() => onResponder(false)}>
            {opciones.textoCancelar ?? 'Cancelar'}
          </button>
          <button ref={confirmarRef} className={claseBoton} onClick={() => onResponder(true)}>
            {opciones.textoConfirmar ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useUI(): ContextoUI {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useUI debe usarse dentro de ProveedorUI');
  return ctx;
}
