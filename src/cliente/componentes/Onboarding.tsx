import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Icono } from './ui/Iconos.js';
import type { NombreIcono } from './ui/Iconos.js';

interface Tarjeta {
  icono: NombreIcono;
  titulo: string;
  texto: ReactNode;
  puntos?: string[];
}

const TARJETAS: Tarjeta[] = [
  {
    icono: 'diagnostico',
    titulo: 'Tu misión',
    texto: 'Eres la nueva Dirección de Operaciones de ETF Bank. Las tarjetas de crédito tardan demasiado en entregarse y las quejas crecen. Encuentra las causas raíz con datos y corrígelas en 4 ciclos.',
  },
  {
    icono: 'grafica',
    titulo: 'Tu tablero',
    texto: 'En la barra superior siempre verás cómo vas.',
    puntos: [
      'Ciclo: avanzas del 1 al 4.',
      'Vidas: pierdes una si no decides nada, si incumples tu compromiso o si tu credibilidad llega a cero.',
      'Credibilidad: sube cuando respondes con evidencia.',
      'Presupuesto: cada acción tiene un costo.',
    ],
  },
  {
    icono: 'tabla',
    titulo: 'Datos',
    texto: 'Explora las solicitudes y los comentarios de clientes. Haz doble clic en un encabezado para elegir una columna y aplica herramientas como histograma, Pareto o estadísticas.',
    puntos: ['Verificar con datos te permite refutar afirmaciones de tu equipo.'],
  },
  {
    icono: 'mensajes',
    titulo: 'Sala de Juntas',
    texto: 'Tu equipo opina sobre el problema. Algunas afirmaciones son ciertas y otras son engañosas. Responde con evidencia para convencerlos y ganar credibilidad.',
  },
  {
    icono: 'decisiones',
    titulo: 'Decisiones',
    texto: 'Elige acciones dentro de tu presupuesto, declara a qué métrica te comprometes y avanza al siguiente ciclo.',
    puntos: ['Algunas acciones tardan uno o más ciclos en surtir efecto.'],
  },
  {
    icono: 'exito',
    titulo: 'Cómo se evalúa',
    texto: 'Al final declaras las causas raíz que encontraste. Se evalúa tu diagnóstico, tu criterio con la evidencia, el impacto en los KPIs y tu método.',
    puntos: ['Consejo: verifica antes de actuar.'],
  },
];

interface Props {
  onTerminar: () => void;
}

export function Onboarding({ onTerminar }: Props) {
  const [indice, setIndice] = useState(0);
  const tarjeta = TARJETAS[indice]!;
  const esUltima = indice === TARJETAS.length - 1;

  useEffect(() => {
    function onTecla(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setIndice(i => Math.min(i + 1, TARJETAS.length - 1));
      if (e.key === 'ArrowLeft') setIndice(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onTerminar();
    }
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, [onTerminar]);

  return (
    <div className="modal-fondo">
      <div className="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-titulo">
        <div className="onboarding-encabezado">
          <span className="onboarding-paso">{indice + 1} de {TARJETAS.length}</span>
          <button className="enlace enlace-sutil onboarding-saltar" onClick={onTerminar}>Saltar</button>
        </div>

        <div key={indice} className="onboarding-cuerpo transicion-contenido">
          <div className="icono-insignia icono-insignia-primario icono-insignia-lg">
            <Icono nombre={tarjeta.icono} tamano={26} grosor={1.8} />
          </div>
          <h2 id="onboarding-titulo" className="onboarding-titulo">{tarjeta.titulo}</h2>
          <p className="onboarding-texto">{tarjeta.texto}</p>
          {tarjeta.puntos && (
            <ul className="onboarding-puntos">
              {tarjeta.puntos.map(p => <li key={p}>{p}</li>)}
            </ul>
          )}
        </div>

        <div className="onboarding-pie">
          <div className="onboarding-puntos-nav" aria-hidden="true">
            {TARJETAS.map((_, i) => (
              <span key={i} className={`onboarding-punto ${i === indice ? 'activo' : ''}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {indice > 0 && (
              <button className="btn-fantasma btn-sm" onClick={() => setIndice(indice - 1)}>Anterior</button>
            )}
            <button className="btn-primario btn-sm" onClick={() => esUltima ? onTerminar() : setIndice(indice + 1)}>
              {esUltima ? 'Comenzar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
