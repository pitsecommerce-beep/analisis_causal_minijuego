interface Props {
  oscuro?: boolean;
}

export function PiePagina({ oscuro = false }: Props) {
  const anio = new Date().getFullYear();
  return (
    <footer className={`pie-pagina ${oscuro ? 'pie-pagina-oscuro' : ''}`}>
      <div className="contenedor pie-pagina-contenido">
        <div>
          <strong>IPADE Business School</strong>
          <span className="pie-pagina-separador" aria-hidden="true">·</span>
          <span>Área de Dirección de Operaciones</span>
        </div>
        <div className="pie-pagina-secundario">
          Simulador de Análisis Causal · ETF Bank · {anio}
        </div>
      </div>
    </footer>
  );
}
