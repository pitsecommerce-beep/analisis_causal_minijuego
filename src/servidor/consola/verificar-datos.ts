import { cargarTodo } from '../datos/cargador.js';

interface ValorEsperado {
  nombre: string;
  esperado: string;
  obtenido: string;
  ok: boolean;
}

function run() {
  console.log('Cargando datos...\n');
  const { solicitudes, comentarios, estadisticas } = cargarTodo();

  const resultados: ValorEsperado[] = [];

  function check(nombre: string, esperado: number | string, obtenido: number | string) {
    const ok = String(esperado) === String(obtenido);
    resultados.push({ nombre, esperado: String(esperado), obtenido: String(obtenido), ok });
  }

  check('Filas', 1500, estadisticas.filas);
  check('Sucursales', 18, estadisticas.sucursales);
  check('Estados', 8, estadisticas.estados);
  check('Meses distintos', 18, estadisticas.mesesDistintos);
  check('Errores totales', 1318, estadisticas.erroresTotales);
  check('Errores de captura', 659, estadisticas.erroresCaptura);
  check('Documentos incompletos', 472, estadisticas.erroresIncompletos);
  check('Documentos ilegibles', 187, estadisticas.erroresIlegibles);
  check('Casos con al menos un error', 897, estadisticas.casosConError);
  check('Intentos, media', '1.96', String(estadisticas.intentosMedia));
  check('Intentos, desviacion', '0.89', String(estadisticas.intentosDesviacion));
  check('Ventana de captura, media', '18.9', String(estadisticas.ventanaCapturaMedia));
  check('Ventana de captura, mediana', '11', String(estadisticas.ventanaCapturaMediana));
  check('Correlacion intentos-captura', '0.786', String(estadisticas.correlacionIntentoCaptura));
  check('Buro corrido', 1397, estadisticas.buroCorrido);
  check('Buro aceptado', 1022, estadisticas.buroAceptado);
  check('Score aceptado', 873, estadisticas.scoreAceptado);
  check('Plastico enviado', 731, estadisticas.plasticoEnviado);
  check('Atorados', 142, estadisticas.atorados);
  check('Dias perdidos en rechazados por buro', 6758, estadisticas.diasPerdidosRechazados);
  check(
    'Top 3 sucursales por errores',
    '110,676,728',
    estadisticas.top3SucursalesPorErrores.join(',')
  );

  const maxNombre = Math.max(...resultados.map((r) => r.nombre.length));
  const maxEsp = Math.max(...resultados.map((r) => r.esperado.length));
  const maxObt = Math.max(...resultados.map((r) => r.obtenido.length));

  const header = `${'Medida'.padEnd(maxNombre)}  ${'Esperado'.padEnd(maxEsp)}  ${'Obtenido'.padEnd(maxObt)}  Estado`;
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of resultados) {
    const estado = r.ok ? 'OK' : 'FALLO';
    const marca = r.ok ? '\x1b[32m' : '\x1b[31m';
    console.log(
      `${r.nombre.padEnd(maxNombre)}  ${r.esperado.padEnd(maxEsp)}  ${r.obtenido.padEnd(maxObt)}  ${marca}${estado}\x1b[0m`
    );
  }

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallos.length}/${resultados.length} verificaciones pasaron.`);

  if (fallos.length > 0) {
    console.log('\nFallos:');
    for (const f of fallos) {
      console.log(`  ${f.nombre}: esperado ${f.esperado}, obtenido ${f.obtenido}`);
    }
    process.exit(1);
  }
}

run();
