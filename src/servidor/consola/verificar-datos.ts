import { cargarDesdeExcel } from '../datos/cargador.js';
import { compararEsperados } from '../datos/esperados.js';
import { CLAVES_DATOS } from '../../compartido/configuracion.js';

function run() {
  console.log('Cargando datos desde los Excel...\n');
  const todos = cargarDesdeExcel();
  let fallos = 0;

  for (const clave of CLAVES_DATOS) {
    const { solicitudes, comentarios, estadisticas } = todos[clave];
    const resultados = compararEsperados(clave, estadisticas);
    console.log(`== ${clave}: ${solicitudes.length} solicitudes, ${comentarios.length} comentarios`);
    const ancho = Math.max(...resultados.map((r) => r.nombre.length));
    for (const r of resultados) {
      const marca = r.ok ? '\x1b[32mOK\x1b[0m' : '\x1b[31mFALLO\x1b[0m';
      console.log(`  ${r.nombre.padEnd(ancho)}  esperado ${r.esperado.padEnd(12)} obtenido ${r.obtenido.padEnd(12)} ${marca}`);
    }
    fallos += resultados.filter((r) => !r.ok).length;

    // Las filas que no cumplen intentos = 1 + errores se reportan; los datos no se corrigen
    const fuera = estadisticas.filasFueraInvariante;
    if (fuera.length > 0) {
      const porNum = new Map(solicitudes.map((s) => [s.applicationNum, s]));
      console.log(`  Filas fuera del invariante intentos = 1 + errores: ${fuera.length}`);
      for (const n of fuera.slice(0, clave === 'R2' ? 10 : fuera.length)) {
        const s = porNum.get(n)!;
        console.log(`    solicitud ${n}: intentos ${s.numTries}, errores ${s.erroresPorCaso}`);
      }
      if (clave === 'R2' && fuera.length > 10) console.log(`    ... y ${fuera.length - 10} más`);
    }
    console.log('');
  }

  if (fallos > 0) {
    console.log(`${fallos} verificaciones fallaron.`);
    process.exit(1);
  }
  console.log('Todas las verificaciones pasaron.');
}

run();
