import { useSesion } from '../i18n.js';
import { DICCIONARIOS } from '../../compartido/i18n/index.js';
import { useEffect, useState } from 'react';
import { PiePagina } from './ui/PiePagina.js';

const N_FRASES = 8;

const INTERVALO_FRASE = 8000;

interface Props {
  nombre: string;
  sesion: string;
}

export function SalaEspera({ nombre, sesion }: Props) {
  const { t, config } = useSesion();
  const frases = DICCIONARIOS[config.idioma].ui.espera.frases;
  const [indice, setIndice] = useState(() => Math.floor(Math.random() * N_FRASES));

  useEffect(() => {
    const id = window.setInterval(() => setIndice(i => (i + 1) % N_FRASES), INTERVALO_FRASE);
    return () => window.clearInterval(id);
  }, []);

  const [texto, autor] = frases[indice % frases.length]!;

  return (
    <div className="pagina espera-pagina">
      <main className="pagina-contenido espera">
        <img src="/favicon.png" alt="" width={56} height={56} className="espera-logo" />

        <div className="espera-indicador" aria-hidden="true">
          <span /><span /><span />
        </div>

        <h1 className="espera-estado" role="status">
          {t('ui.espera.estado')}
        </h1>

        <p className="espera-saludo">
          {t('ui.espera.saludo', { nombre, sesion: sesion || t('ui.espera.laSesion') })}
          <br />{t('ui.espera.automatico')}
        </p>

        <figure key={indice} className="espera-frase transicion-contenido">
          <blockquote>“{texto}”</blockquote>
          <figcaption>{autor}</figcaption>
        </figure>

      </main>
      <PiePagina />
    </div>
  );
}
