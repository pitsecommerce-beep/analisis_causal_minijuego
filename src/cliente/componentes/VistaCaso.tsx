import { Icono } from './ui/Iconos.js';
import { VistaProceso } from './VistaProceso.js';
import { useSesion } from '../i18n.js';
import { registrarEvento } from '../eventos.js';
import { DICCIONARIOS } from '../../compartido/i18n/index.js';
import type { DatosJuego } from '../datos.js';

// Pestaña de inicio del modo informativo: contexto del caso, el proceso (Anexo 1) y la consigna del entregable
export function VistaCaso({ datos, onVerDatos }: { datos: DatosJuego | null; onVerDatos: () => void }) {
  const { t, config } = useSesion();
  const espera = DICCIONARIOS[config.idioma].caso.espera;
  return (
    <div className="caso">
      <div className="tarjeta caso-cabecera">
        <h2>{t('caso.titulo')}</h2>
        <div className="caso-columnas">
          <section>
            <h3>{t('caso.encargoTitulo')}</h3>
            <p>{t('caso.encargo')}</p>
            <h3>{t('caso.muestraTitulo')}</h3>
            <p>{t('caso.muestra')}</p>
          </section>
          <section>
            <h3>{t('caso.entregableTitulo')}</h3>
            <p>{t('caso.entregable')}</p>
            <h3>{t('caso.esperaTitulo')}</h3>
            <ul>{espera.map(x => <li key={x}>{x}</li>)}</ul>
            <p className="caso-cierre">{t('caso.cierre')}</p>
          </section>
        </div>
        <button className="btn-primario" onClick={onVerDatos}><Icono nombre="tabla" tamano={16} />{t('caso.empezar')}</button>
      </div>

      <div className="tarjeta caso-proceso">
        <h3>{t('caso.procesoTitulo')}</h3>
        <p>{t('caso.proceso')}</p>
        {datos && (
          <>
            <VistaProceso filas={datos.solicitudes} estrato="" onEtapa={etapa => registrarEvento('proceso_etapa', { etapa, estrato: null })} />
          </>
        )}
      </div>
    </div>
  );
}
