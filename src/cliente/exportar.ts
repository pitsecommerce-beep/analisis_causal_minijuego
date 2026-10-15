// Exporta el gráfico de una tarjeta como PNG: título, leyenda y gráfico(s) en una sola imagen.
// Los gráficos son SVG con colores como atributos, así que se pueden rasterizar sin librerías.

const NS = 'http://www.w3.org/2000/svg';
const FUENTE = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
const ESCALA = 2;

function el(nombre: string, attrs: Record<string, string | number>, texto?: string): SVGElement {
  const e = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (texto != null) e.textContent = texto;
  return e;
}

// Tabla HTML (tabla dinámica) convertida a SVG
function tablaASvg(tabla: HTMLTableElement): SVGSVGElement {
  const filas = [...tabla.querySelectorAll('tr')].map(tr => [...tr.querySelectorAll('th, td')].map(c => ({
    texto: (c.textContent ?? '').replace(/[▲▼]/g, '').trim(),
    fondo: (c as HTMLElement).style.background || '',
    encabezado: c.tagName === 'TH',
  })));
  const columnas = Math.max(...filas.map(f => f.length));
  const anchos = Array.from({ length: columnas }, (_, i) => Math.min(260, Math.max(70, ...filas.map(f => (f[i]?.texto.length ?? 0) * 7.5 + 24))));
  const alto = 30;
  const ancho = anchos.reduce((a, b) => a + b, 0);
  const svg = el('svg', { xmlns: NS, width: ancho, height: filas.length * alto, viewBox: `0 0 ${ancho} ${filas.length * alto}` }) as SVGSVGElement;
  filas.forEach((f, r) => {
    let x = 0;
    f.forEach((c, i) => {
      const w = anchos[i]!;
      svg.appendChild(el('rect', { x, y: r * alto, width: w, height: alto, fill: c.encabezado ? '#0f2b4a' : c.fondo || (r % 2 ? '#fafbfc' : '#ffffff'), stroke: '#e5e8ed' }));
      svg.appendChild(el('text', { x: x + 10, y: r * alto + 19, 'font-size': 12, 'font-family': FUENTE, 'font-weight': c.encabezado || i === 0 ? 600 : 400, fill: c.encabezado ? '#ffffff' : '#1b2332' }, c.texto));
      x += w;
    });
  });
  return svg;
}

export async function exportarPNG(contenedor: HTMLElement, titulo: string, archivo: string): Promise<void> {
  const leyenda = [...contenedor.querySelectorAll('.grafico-leyenda > span')].map(s => {
    const marca = s.querySelector('.grafico-leyenda-marca') as HTMLElement | null;
    const tipo = marca?.classList.contains('linea') ? 'linea' : marca?.classList.contains('discontinua') ? 'discontinua' : marca?.classList.contains('punto') ? 'punto' : 'barra';
    return { texto: s.textContent ?? '', color: marca?.style.background || marca?.style.borderTopColor || '#8a94a3', tipo };
  });
  const paneles = [...contenedor.querySelectorAll('.grafico-panel')];
  const graficos: { titulo: string; svg: SVGSVGElement }[] = paneles.length
    ? paneles.map(p => ({ titulo: p.querySelector('.grafico-panel-titulo')?.textContent ?? '', svg: p.querySelector('svg') as SVGSVGElement }))
    : [...contenedor.querySelectorAll('.grafico svg')].map(svg => ({ titulo: '', svg: svg as SVGSVGElement }));
  if (graficos.length === 0) {
    const tabla = contenedor.querySelector('table');
    if (tabla) graficos.push({ titulo: '', svg: tablaASvg(tabla) });
  }
  if (graficos.length === 0) return;

  const margen = 24;
  const altoTitulo = 40;
  const altoLeyenda = leyenda.length ? 28 : 0;
  const altoPanel = paneles.length ? 24 : 0;
  const anchos = graficos.map(g => Number(g.svg.getAttribute('width')) || g.svg.getBoundingClientRect().width);
  const altos = graficos.map(g => Number(g.svg.getAttribute('height')) || g.svg.getBoundingClientRect().height);
  const ancho = margen * 2 + anchos.reduce((a, b) => a + b, 0) + (graficos.length - 1) * 16;
  const alto = margen * 2 + altoTitulo + altoLeyenda + altoPanel + Math.max(...altos);

  const svg = el('svg', { xmlns: NS, width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}` });
  svg.appendChild(el('rect', { x: 0, y: 0, width: ancho, height: alto, fill: '#ffffff' }));
  svg.appendChild(el('text', { x: margen, y: margen + 20, 'font-size': 20, 'font-weight': 700, 'font-family': FUENTE, fill: '#0f2b4a' }, titulo));
  let lx = margen;
  const ly = margen + altoTitulo + 12;
  for (const l of leyenda) {
    if (l.tipo === 'linea') svg.appendChild(el('rect', { x: lx, y: ly - 6, width: 16, height: 3, fill: l.color }));
    else if (l.tipo === 'discontinua') svg.appendChild(el('line', { x1: lx, x2: lx + 18, y1: ly - 4, y2: ly - 4, stroke: l.color, 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
    else if (l.tipo === 'punto') svg.appendChild(el('circle', { cx: lx + 5, cy: ly - 4, r: 5, fill: l.color }));
    else svg.appendChild(el('rect', { x: lx, y: ly - 10, width: 12, height: 12, rx: 3, fill: l.color }));
    svg.appendChild(el('text', { x: lx + 24, y: ly, 'font-size': 13, 'font-family': FUENTE, fill: '#56637a' }, l.texto));
    lx += 24 + l.texto.length * 7 + 24;
  }
  let x = margen;
  const y = margen + altoTitulo + altoLeyenda;
  graficos.forEach((g, i) => {
    if (g.titulo) svg.appendChild(el('text', { x, y: y + 16, 'font-size': 14, 'font-weight': 600, 'font-family': FUENTE, fill: '#1b2332' }, g.titulo));
    const copia = g.svg.cloneNode(true) as SVGSVGElement;
    copia.setAttribute('x', String(x));
    copia.setAttribute('y', String(y + altoPanel));
    svg.appendChild(copia);
    x += anchos[i]! + 16;
  });

  const texto = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, mal) => { img.onload = () => ok(); img.onerror = () => mal(new Error('imagen')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = ancho * ESCALA;
    canvas.height = alto * ESCALA;
    const c = canvas.getContext('2d')!;
    c.scale(ESCALA, ESCALA);
    c.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, 'image/png'));
    if (!blob) throw new Error('png');
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `${archivo}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Nombre de archivo legible a partir del título del gráfico
export function nombreArchivo(titulo: string): string {
  return titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'grafico';
}
