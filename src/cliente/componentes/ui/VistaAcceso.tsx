import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PiePagina } from './PiePagina.js';
import { useSesion } from '../../i18n.js';

interface Props {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  pie?: ReactNode;
  navegacion?: boolean;
}

export function VistaAcceso({ titulo, subtitulo, children, pie, navegacion = true }: Props) {
  const { t } = useSesion();
  const marca = (
    <>
      <img src="/favicon.png" alt="" width={28} height={28} />
      <span>{t('acceso.marca')}</span>
    </>
  );

  return (
    <div className="pagina acceso">
      <header className="acceso-encabezado contenedor">
        {navegacion
          ? <Link to="/" className="acceso-marca">{marca}</Link>
          : <div className="acceso-marca">{marca}</div>}
        {navegacion && <Link to="/" className="enlace enlace-sutil">{t('acceso.volverInicio')}</Link>}
      </header>

      <main className="pagina-contenido acceso-contenido">
        <div className="acceso-tarjeta">
          <h1 className="acceso-titulo">{titulo}</h1>
          {subtitulo && <p className="acceso-subtitulo">{subtitulo}</p>}
          {children}
        </div>
        {pie && <p className="acceso-pie">{pie}</p>}
      </main>

      <PiePagina />
    </div>
  );
}
