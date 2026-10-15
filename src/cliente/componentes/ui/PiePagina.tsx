import { useSesion } from '../../i18n.js';
interface Props {
  oscuro?: boolean;
}

export function PiePagina({ oscuro = false }: Props) {
  const anio = new Date().getFullYear();
  const { t } = useSesion();
  return (
    <footer className={`pie-pagina ${oscuro ? 'pie-pagina-oscuro' : ''}`}>
      <div className="contenedor pie-pagina-contenido">
        <div>
          <strong>IPADE Business School</strong>
          <span className="pie-pagina-separador" aria-hidden="true">·</span>
          <span>{t('ui.pie.area')}</span>
        </div>
        <div className="pie-pagina-secundario">
          {t('ui.pie.producto', { anio })}
        </div>
      </div>
    </footer>
  );
}
