import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PiePagina } from './PiePagina.js';

interface Props {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  pie?: ReactNode;
}

export function VistaAcceso({ titulo, subtitulo, children, pie }: Props) {
  return (
    <div className="pagina acceso">
      <header className="acceso-encabezado contenedor">
        <Link to="/" className="acceso-marca">
          <img src="/favicon.png" alt="" width={28} height={28} />
          <span>Director de Operaciones</span>
        </Link>
        <Link to="/" className="enlace enlace-sutil">Volver al inicio</Link>
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
