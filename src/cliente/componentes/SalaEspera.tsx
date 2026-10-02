import { useEffect, useState } from 'react';
import { PiePagina } from './ui/PiePagina.js';

const FRASES: { texto: string; autor: string }[] = [
  { texto: 'Correlación no implica causalidad.', autor: 'Principio de la estadística' },
  { texto: 'Sin datos, solo eres otra persona con una opinión.', autor: 'W. Edwards Deming' },
  { texto: 'En Dios confiamos. Todos los demás deben traer datos.', autor: 'Atribuida a W. Edwards Deming' },
  { texto: 'Todos los modelos están equivocados, pero algunos son útiles.', autor: 'George E. P. Box' },
  { texto: 'Un problema bien planteado está medio resuelto.', autor: 'John Dewey' },
  { texto: 'Pregunta por qué cinco veces y llegarás a la causa raíz.', autor: 'Taiichi Ohno' },
  { texto: 'No todo lo que cuenta puede contarse, y no todo lo que puede contarse cuenta.', autor: 'William Bruce Cameron' },
  { texto: 'La mediana no cuenta toda la historia. Mira la variabilidad.', autor: 'Control estadístico de procesos' },
];

const INTERVALO_FRASE = 8000;

interface Props {
  nombre: string;
  sesion: string;
  onVerTutorial: () => void;
}

export function SalaEspera({ nombre, sesion, onVerTutorial }: Props) {
  const [indice, setIndice] = useState(() => Math.floor(Math.random() * FRASES.length));

  useEffect(() => {
    const id = window.setInterval(() => setIndice(i => (i + 1) % FRASES.length), INTERVALO_FRASE);
    return () => window.clearInterval(id);
  }, []);

  const frase = FRASES[indice]!;

  return (
    <div className="pagina fondo-marca">
      <main className="pagina-contenido espera">
        <div className="espera-logo">
          <img src="/favicon.png" alt="" width={48} height={48} />
        </div>

        <div className="espera-estado" role="status">
          <span className="espera-pulso" aria-hidden="true" />
          Esperando a que el profesor inicie la sesión
        </div>

        <p className="espera-saludo">
          Hola, <strong>{nombre}</strong>. Ya estás en <strong>{sesion || 'la sesión'}</strong>.
          <br />El simulador comenzará automáticamente.
        </p>

        <figure key={indice} className="espera-frase transicion-contenido">
          <blockquote>“{frase.texto}”</blockquote>
          <figcaption>{frase.autor}</figcaption>
        </figure>

        <button className="espera-tutorial" onClick={onVerTutorial}>
          Mientras esperas, conoce cómo se juega
        </button>
      </main>
      <PiePagina oscuro />
    </div>
  );
}
