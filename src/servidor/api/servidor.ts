import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { obtenerSupabase, obtenerSupabaseAuth } from '../db/supabase.js';
import {
  crearSesion, obtenerSesionPorCodigo, obtenerSesionPorId,
  actualizarEstadoSesion, listarSesionesProfesor, eliminarSesiones,
  registrarJugador, contarJugadores, listarJugadoresSesion,
  obtenerJugadorPorNombre, registrarLatido, renovarTokenJugador, registrarSalidaJugador,
  crearPartidaDB, obtenerPartida, actualizarPartida,
  listarPartidasSesion, registrarVerificacion, listarVerificaciones,
  actualizarSesionExperimento, asignarGrupoJugador,
  registrarConsentimiento, registrarEvento,
  obtenerTelemetriaSesion, obtenerResumenExperimento, listarEventosPartida, listarEstadosPartidasSesion,
  obtenerTablero, guardarTablero, listarTablerosSesion,
} from '../db/consultas.js';
import { normalizarTablero, tableroVacio } from '../../compartido/tablero.js';
import { generarRecomendacion } from '../experimento/asesor-algoritmico.js';
import { serializarDialogo, deserializarDialogo } from '../db/serializar.js';
import { autenticarProfesor, autenticarJugador, soloModoCompleto } from './middleware.js';
import { validarConfig, configDeSesion, claveDatos, CLAVES_DATOS } from '../../compartido/configuracion.js';
import type { ClaveDatos, Idioma } from '../../compartido/configuracion.js';
import { DICCIONARIOS } from '../../compartido/i18n/index.js';
import { libroComentarios } from '../datos/excel.js';
import { estaConectado } from './presencia.js';
import { normalizarEspina, validarVotacion, causasDesdeEspina, ESPINA_VACIA } from '../../compartido/espina.js';
import type { Espina } from '../../compartido/espina.js';
import { TIPOS_EVENTO, resumirMetodo, evaluarHitos, avisosPorAcciones } from '../../compartido/metodo.js';
import type { VinculoAccion } from '../../compartido/metodo.js';
import { esCorreoProfesor, MENSAJE_DOMINIO } from './dominio.js';
import type { RequestProfesor, RequestJugador } from './middleware.js';
import { crearPartida, elegirAcciones, declararCompromiso, procesarCiclo } from '../motor/ciclos.js';
import { evaluarPartida, determinarDesenlace } from '../puntuacion/evaluacion.js';
import { crearEstadoDialogo, obtenerNodosCiclo, filtrarRespuestas, evaluarCondicion, aplicarEfecto } from '../dialogos/motor-dialogos.js';
import type { NodoDialogo } from '../dialogos/motor-dialogos.js';
import { cargarTodo, rutaSolicitudes } from '../datos/cargador.js';
import type { DatosCargados, TodosLosDatos } from '../datos/cargador.js';
import { RAIZ } from '../raiz.js';
import config from '../../../config/simulador.json' with { type: 'json' };
import verificacionesConfig from '../../../config/verificaciones.json' with { type: 'json' };

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

const clientePath = path.join(RAIZ, 'dist', 'cliente');
if (fs.existsSync(clientePath)) {
  // Vite pone un hash en el nombre de los assets, así que pueden guardarse en caché indefinidamente
  app.use('/assets', express.static(path.join(clientePath, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(clientePath, { index: false }));
}

// --- Datos cargados al inicio ---

let todosLosDatos!: TodosLosDatos;
// Lo que ven los jugadores no cambia durante la vida del proceso: se arma una sola vez por combinación
let datosPublicos!: Record<ClaveDatos, ReturnType<typeof datosParaJugador>>;
const dialogos: Record<string, NodoDialogo[]> = {};

function cargarDatosInicio() {
  todosLosDatos = cargarTodo();
  datosPublicos = Object.fromEntries(
    CLAVES_DATOS.map((c) => [c, datosParaJugador(todosLosDatos[c])])
  ) as Record<ClaveDatos, ReturnType<typeof datosParaJugador>>;

  const dirDialogos = path.join(RAIZ, 'datos', 'dialogos');
  const personajes = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego', 'ramon'];
  for (const p of personajes) {
    dialogos[p] = JSON.parse(fs.readFileSync(path.join(dirDialogos, `${p}.json`), 'utf-8'));
  }
}

// --- Utilidades ---

function codigoError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) return String((err as { code: unknown }).code);
  return undefined;
}

const MENSAJES_DB: Record<string, string> = {
  '42703': 'La base de datos no tiene una columna requerida. Aplica todas las migraciones de supabase/migrations.',
  '42P01': 'La base de datos no tiene una tabla requerida. Aplica todas las migraciones de supabase/migrations.',
  '42501': 'La base de datos rechazó la operación por permisos. Revisa que SUPABASE_SERVICE_KEY sea la clave service_role.',
  '23514': 'Un valor no cumple las restricciones de la base de datos.',
};

function responderError(res: express.Response, mensaje: string, err: unknown): void {
  console.error(`[${new Date().toISOString()}] ${mensaje}:`, err);
  const codigo = codigoError(err);
  const detalle = codigo ? MENSAJES_DB[codigo] : undefined;
  res.status(500).json({ error: detalle ? `${mensaje}. ${detalle}` : mensaje });
}

function datosParaJugador(datos: DatosCargados) {
  return {
    solicitudes: datos.solicitudes.map((s) => ({
      applicationNum: s.applicationNum,
      customerNum: s.customerNum,
      age: s.age,
      maritalStatus: s.maritalStatus,
      gender: s.gender,
      state: s.state,
      branchNum: s.branchNum,
      yearsAsCustomer: s.yearsAsCustomer,
      creditBureauScore: s.creditBureauScore,
      etfBankScore: s.etfBankScore,
      dateFirstInput: s.dateFirstInput,
      dateLastInput: s.dateLastInput,
      numTries: s.numTries,
      dateDocsSent: s.dateDocsSent,
      dateDocsReceived: s.dateDocsReceived,
      creditBureauResult: s.creditBureauResult,
      creditBureauRunDate: s.creditBureauRunDate,
      etfBankScoreResult: s.etfBankScoreResult,
      etfbScoreDate: s.etfbScoreDate,
      datePlasticSent: s.datePlasticSent,
      lastStatus: s.lastStatus,
      creditLineGranted: s.creditLineGranted,
      comments: s.comments,
      ...(s.extras ?? {}),
    })),
  };
}

function estadoPublico(partida: Record<string, unknown>) {
  const estado = partida.estado as Record<string, unknown>;
  return {
    cicloActual: estado.cicloActual,
    vidas: estado.vidas,
    credibilidad: estado.credibilidad,
    presupuestoDisponible: estado.presupuestoDisponible,
    accionesElegidas: estado.accionesElegidas,
    kpis: estado.kpis,
    resultadosCiclo: estado.resultadosCiclo,
    destituido: estado.destituido,
    terminada: estado.terminada,
    fase: partida.fase,
  };
}

// ╔══════════════════════════════════════╗
// ║     RUTAS DE PROFESOR (AUTH)         ║
// ╚══════════════════════════════════════╝

app.post('/api/profesor/registrar', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email y password requeridos' });
    return;
  }
  if (!esCorreoProfesor(email)) {
    res.status(403).json({ error: MENSAJE_DOMINIO });
    return;
  }

  const sb = obtenerSupabase();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ id: data.user.id, email: data.user.email });
});

app.post('/api/profesor/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email y password requeridos' });
    return;
  }
  if (!esCorreoProfesor(email)) {
    res.status(403).json({ error: MENSAJE_DOMINIO });
    return;
  }

  const { data, error } = await obtenerSupabaseAuth().auth.signInWithPassword({ email, password });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    profesorId: data.user.id,
    email: data.user.email,
  });
});

// El token de acceso de Supabase dura una hora; el panel lo renueva con el refresh token
app.post('/api/profesor/refrescar', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken requerido' });
    return;
  }

  const { data, error } = await obtenerSupabaseAuth().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) {
    res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
    return;
  }
  if (!esCorreoProfesor(data.user.email)) {
    res.status(403).json({ error: MENSAJE_DOMINIO });
    return;
  }

  res.json({ token: data.session.access_token, refreshToken: data.session.refresh_token });
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE SESION                 ║
// ╚══════════════════════════════════════╝

app.post('/api/sesion', autenticarProfesor, async (req, res) => {
  const { nombre } = req.body ?? {};
  if (!nombre) {
    res.status(400).json({ error: 'Nombre de sesión requerido' });
    return;
  }
  const validacion = validarConfig(req.body);
  if (!validacion.ok) {
    res.status(400).json({ error: validacion.error });
    return;
  }

  const semilla = Date.now() % 100000000;
  const profesorId = (req as RequestProfesor).profesorId;

  try {
    const sesion = await crearSesion(profesorId, nombre, semilla, validacion.config);
    res.json(sesion);
  } catch (err) {
    responderError(res, 'Error al crear sesión', err);
  }
});

app.get('/api/sesion/:codigo', async (req, res) => {
  try {
    const sesion = await obtenerSesionPorCodigo(req.params.codigo!);
    if (!sesion) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }
    res.json({
      id: sesion.id,
      codigo: sesion.codigo,
      nombre: sesion.nombre,
      estado: sesion.estado,
      idioma: configDeSesion(sesion).idioma,
    });
  } catch (err) {
    responderError(res, 'Error al buscar sesión', err);
  }
});

// Si el nombre ya existe y ese participante lleva tiempo sin actividad, se le entrega
// un token nuevo para que pueda retomar su partida desde otro navegador o tras un error.
async function reconectarJugador(req: express.Request, res: express.Response): Promise<void> {
  try {
    const sesion = await obtenerSesionPorCodigo(String(req.params['codigo']));
    const existente = sesion ? await obtenerJugadorPorNombre(sesion.id, String(req.body.nombre)) : null;
    if (!sesion || !existente || estaConectado(existente.ultima_actividad) !== false) {
      res.status(409).json({ error: 'Ese nombre está activo en otro navegador. Si eres tú, cierra esa ventana o espera un par de minutos e inténtalo de nuevo; si no, usa otro nombre.' });
      return;
    }
    const token = await renovarTokenJugador(existente.id);
    res.json({
      jugadorId: existente.id,
      token,
      sesion: { id: sesion.id, nombre: sesion.nombre, estado: sesion.estado },
      config: configDeSesion(sesion),
      modoExperimento: sesion.modo_experimento ?? false,
      reconectado: true,
    });
  } catch (err) {
    responderError(res, 'Error al reconectar', err);
  }
}

app.post('/api/sesion/:codigo/unirse', async (req, res) => {
  const { nombre, email } = req.body;
  if (!nombre) {
    res.status(400).json({ error: 'Nombre requerido' });
    return;
  }

  try {
    const sesion = await obtenerSesionPorCodigo(req.params.codigo!);
    if (!sesion) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }
    if (sesion.estado !== 'abierta' && sesion.estado !== 'en_curso') {
      res.status(400).json({ error: 'La sesión ya no acepta jugadores' });
      return;
    }

    // Quien vuelve con su mismo nombre retoma su partida, aunque la sesión esté llena
    if (await obtenerJugadorPorNombre(sesion.id, nombre)) {
      await reconectarJugador(req, res);
      return;
    }

    const count = await contarJugadores(sesion.id);
    if (count >= sesion.max_jugadores) {
      res.status(400).json({ error: 'Sesión llena' });
      return;
    }

    const jugador = await registrarJugador(sesion.id, nombre, email);

    if (sesion.modo_experimento) {
      const pct = sesion.pct_tratamiento ?? 50;
      const grupo = Math.random() * 100 < pct ? 'tratamiento' : 'control';
      await asignarGrupoJugador(jugador.id, grupo);
    }

    res.json({
      jugadorId: jugador.id,
      token: jugador.token,
      sesion: { id: sesion.id, nombre: sesion.nombre, estado: sesion.estado },
      config: configDeSesion(sesion),
      modoExperimento: sesion.modo_experimento ?? false,
    });
  } catch (err) {
    if (codigoError(err) === '23505') {
      await reconectarJugador(req, res);
      return;
    }
    responderError(res, 'Error al unirse', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE PROFESOR               ║
// ╚══════════════════════════════════════╝

app.post('/api/jugador/latido', autenticarJugador, async (req, res) => {
  const jugador = (req as RequestJugador).jugador;
  try {
    await registrarLatido(jugador.id);
  } catch (err) {
    // Sin la migracion 003 la presencia no se registra, pero la espera debe seguir funcionando
    if (codigoError(err) !== '42703') console.error(`[${new Date().toISOString()}] Error al registrar latido:`, err);
  }
  res.json({ sesionEstado: jugador.sesionEstado });
});

app.post('/api/jugador/salir', autenticarJugador, async (req, res) => {
  try {
    await registrarSalidaJugador((req as RequestJugador).jugador.id);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al salir', err);
  }
});

function idParam(req: express.Request): string {
  const id = req.params['id'];
  return Array.isArray(id) ? id[0] ?? '' : id ?? '';
}

async function esSesionDelProfesor(sesionId: string, profesorId: string): Promise<boolean> {
  try {
    const sesion = await obtenerSesionPorId(sesionId);
    return sesion?.profesor_id === profesorId;
  } catch {
    return false;
  }
}

async function sesionPropia(req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> {
  const propia = await esSesionDelProfesor(idParam(req), (req as RequestProfesor).profesorId);
  if (!propia) {
    res.status(404).json({ error: 'Sesión no encontrada' });
    return;
  }
  next();
}

app.get('/api/profesor/sesiones', autenticarProfesor, async (req, res) => {
  try {
    const sesiones = await listarSesionesProfesor((req as RequestProfesor).profesorId);
    res.json(sesiones);
  } catch (err) {
    responderError(res, 'Error al listar sesiones', err);
  }
});

app.get('/api/profesor/sesion/:id', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    const sesion = await obtenerSesionPorId(idParam(req));
    const jugadores = (await listarJugadoresSesion(sesion.id)).map(({ token: _token, ...j }) => ({
      ...j,
      conectado: estaConectado(j.ultima_actividad),
    }));
    const partidas = await listarPartidasSesion(sesion.id);
    res.json({ sesion, jugadores, partidas });
  } catch (err) {
    responderError(res, 'Error al obtener sesión', err);
  }
});

app.post('/api/profesor/sesion/:id/iniciar', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    await actualizarEstadoSesion(idParam(req), 'en_curso');
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al iniciar sesión', err);
  }
});

app.post('/api/profesor/sesion/:id/finalizar', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    await actualizarEstadoSesion(idParam(req), 'finalizada');
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al finalizar sesión', err);
  }
});

app.post('/api/profesor/sesiones/eliminar', autenticarProfesor, async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
    res.status(400).json({ error: 'Debes indicar al menos una sesión' });
    return;
  }
  try {
    const eliminadas = await eliminarSesiones((req as RequestProfesor).profesorId, ids);
    res.json({ ok: true, eliminadas });
  } catch (err) {
    responderError(res, 'Error al eliminar sesiones', err);
  }
});

app.delete('/api/profesor/sesion/:id', autenticarProfesor, async (req, res) => {
  try {
    const eliminadas = await eliminarSesiones((req as RequestProfesor).profesorId, [idParam(req)]);
    if (eliminadas === 0) {
      res.status(404).json({ error: 'Sesión no encontrada' });
      return;
    }
    res.json({ ok: true, eliminadas });
  } catch (err) {
    responderError(res, 'Error al eliminar sesión', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE DATOS (HOJA)           ║
// ╚══════════════════════════════════════╝

// Cada participante recibe la base que corresponde a la configuración de su sesión
const claveDe = (req: express.Request) => claveDatos((req as RequestJugador).jugador.config);

app.get('/api/datos/solicitudes', autenticarJugador, (req, res) => {
  res.json(datosPublicos[claveDe(req)].solicitudes);
});

// R2 es una sola base de solicitudes con comentarios en dos idiomas
function comentariosDe(req: express.Request) {
  const clave = claveDe(req);
  const enIngles = (req as RequestJugador).jugador.config.idioma === 'en';
  return (clave === 'R2' && enIngles ? todosLosDatos.R2.comentariosEn : undefined) ?? todosLosDatos[clave].comentarios;
}

app.get('/api/datos/comentarios', autenticarJugador, (req, res) => {
  res.json(comentariosDe(req));
});

// Descarga en Excel. Las solicitudes se entregan en su archivo original, tal cual;
// los comentarios se arman sin la columna de evidencia, que nunca llega al participante.
app.get('/api/datos/excel/:tabla', autenticarJugador, (req, res) => {
  const clave = claveDe(req);
  const idioma = (req as RequestJugador).jugador.config.idioma;
  const tabla = req.params['tabla'];
  try {
    if (tabla === 'solicitudes') {
      const nombre = idioma === 'en' ? 'ETF_Bank_applications.xlsx' : 'ETF_Bank_solicitudes.xlsx';
      res.download(rutaSolicitudes(clave), nombre);
      return;
    }
    if (tabla === 'comentarios') {
      const nombre = idioma === 'en' ? 'ETF_Bank_customer_comments.xlsx' : 'ETF_Bank_comentarios_clientes.xlsx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${nombre}`);
      res.send(libroComentarios(comentariosDe(req), idioma));
      return;
    }
    res.status(404).json({ error: 'Tabla no encontrada' });
  } catch (err) {
    responderError(res, 'No se pudo generar el archivo', err);
  }
});

// Tipos de las columnas originales. Los nombres visibles salen del diccionario del idioma de la sesión.
const TIPOS_SOLICITUDES: [string, 'numero' | 'texto' | 'fecha'][] = [
  ['applicationNum', 'numero'], ['customerNum', 'numero'], ['age', 'numero'], ['maritalStatus', 'texto'], ['gender', 'texto'],
  ['state', 'texto'], ['branchNum', 'numero'], ['yearsAsCustomer', 'numero'], ['creditBureauScore', 'numero'], ['etfBankScore', 'numero'],
  ['dateFirstInput', 'fecha'], ['dateLastInput', 'fecha'], ['numTries', 'numero'],
  ['timePasses', 'numero'], ['cropDeliveryTime', 'numero'], ['dateDocsSent', 'fecha'], ['executiveTime', 'numero'],
  ['dateDocsReceived', 'fecha'], ['creditBureauResult', 'texto'], ['creditBureauRunDate', 'fecha'], ['etfBankScoreResult', 'texto'],
  ['etfbScoreDate', 'fecha'], ['datePlasticSent', 'fecha'], ['cropTime', 'numero'], ['lastStatus', 'texto'],
  ['creditLineGranted', 'numero'], ['comments', 'texto'],
];
const TIPOS_COMENTARIOS: [string, 'numero' | 'texto' | 'fecha'][] = [
  ['id', 'texto'], ['solicitudNum', 'numero'], ['estado', 'texto'], ['sucursalNum', 'numero'], ['intentos', 'numero'], ['canalCaptacion', 'texto'],
  ['fechaComentario', 'fecha'], ['categoriaPrimaria', 'texto'], ['categoriaSecundaria', 'texto'], ['comentarioCliente', 'texto'],
];
// Columnas que solo existen en el archivo de la base B
const SOLO_BASE_B = new Set(['timePasses', 'cropDeliveryTime', 'executiveTime', 'cropTime']);

function columnasDe(idioma: Idioma, clave: ClaveDatos) {
  const nombres = DICCIONARIOS[idioma].columnas;
  const esB = clave.startsWith('B');
  return {
    solicitudes: TIPOS_SOLICITUDES.filter(([c]) => esB || !SOLO_BASE_B.has(c))
      .map(([campo, tipo]) => ({ campo, tipo, nombre: nombres.solicitudes[campo as keyof typeof nombres.solicitudes] })),
    comentarios: TIPOS_COMENTARIOS.map(([campo, tipo]) => ({ campo, tipo, nombre: nombres.comentarios[campo as keyof typeof nombres.comentarios] })),
  };
}

app.get('/api/datos/columnas', autenticarJugador, (req, res) => {
  res.json(columnasDe((req as RequestJugador).jugador.config.idioma, claveDe(req)));
});

app.post('/api/datos/verificacion', autenticarJugador, sesionActiva, async (req, res) => {
  const { verificacionId, herramienta } = req.body;
  if (!verificacionId) {
    res.status(400).json({ error: 'verificacionId requerido' });
    return;
  }

  const reglas = verificacionesConfig as Record<string, Record<string, unknown>>;
  const regla = reglas[verificacionId as string];
  if (!regla) {
    res.status(400).json({ error: 'Verificación no reconocida' });
    return;
  }

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }

    await registrarVerificacion(partida.id, verificacionId, herramienta);

    const estado = partida.estado as Record<string, unknown>;
    const estadoDialogo = deserializarDialogo(partida.estado_dialogo as any);
    estadoDialogo.verificaciones.add(verificacionId);
    await actualizarPartida(jugador.id, estado as any, serializarDialogo(estadoDialogo));

    res.json({ ok: true, verificaciones: [...estadoDialogo.verificaciones] });
  } catch (err) {
    responderError(res, 'Error al registrar verificación', err);
  }
});

app.get('/api/datos/verificaciones', autenticarJugador, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }
    const lista = await listarVerificaciones(partida.id);
    res.json(lista);
  } catch (err) {
    responderError(res, 'Error al listar verificaciones', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE PARTIDA                ║
// ╚══════════════════════════════════════╝

// Cuando el profesor finaliza la sesión ya no se aceptan jugadas
function rechazarSesionFinalizada(res: express.Response): void {
  res.status(403).json({ error: 'Tu profesor finalizó la sesión.', sesionFinalizada: true });
}

function sesionActiva(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if ((req as RequestJugador).jugador.sesionEstado === 'finalizada') { rechazarSesionFinalizada(res); return; }
  next();
}

app.post('/api/partida/iniciar', autenticarJugador, async (req, res) => {
  const jugador = (req as RequestJugador).jugador;

  try {
    // Una partida existente se devuelve aunque la sesión ya haya finalizado, para mostrar el resumen
    const existente = await obtenerPartida(jugador.id);
    if (existente) {
      res.json(estadoPublico(existente));
      return;
    }

    if (jugador.sesionEstado !== 'en_curso') {
      res.status(400).json({ error: jugador.sesionEstado === 'finalizada' ? 'La sesión ya terminó' : 'La sesión aún no ha iniciado' });
      return;
    }

    const sesion = await obtenerSesionPorId(jugador.sesionId);
    const estado = crearPartida({ ...config.kpisIniciales }, sesion.semilla);
    const estadoDialogo = crearEstadoDialogo();

    await crearPartidaDB(jugador.id, jugador.sesionId, estado, serializarDialogo(estadoDialogo));
    const partida = await obtenerPartida(jugador.id);
    res.json(estadoPublico(partida!));
  } catch (err) {
    responderError(res, 'Error al iniciar partida', err);
  }
});

app.get('/api/partida', autenticarJugador, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'No tienes partida activa' });
      return;
    }
    res.json(estadoPublico(partida));
  } catch (err) {
    responderError(res, 'Error al obtener partida', err);
  }
});

app.post('/api/partida/acciones', autenticarJugador, soloModoCompleto, sesionActiva, async (req, res) => {
  const { acciones } = req.body;
  if (!Array.isArray(acciones) || acciones.length === 0) {
    res.status(400).json({ error: 'Acciones requeridas (array de {accionId})' });
    return;
  }

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') {
      res.status(400).json({ error: 'Partida no activa' });
      return;
    }

    const estado = partida.estado as any;
    const cicloActual = estado.cicloActual as number;
    const accionesParaMotor = acciones.map((a: { accionId: number }) => ({
      accionId: a.accionId,
      cicloElegido: cicloActual,
    }));

    const resultado = elegirAcciones(estado, accionesParaMotor, config.acciones as any);
    if (!resultado.ok) {
      res.status(400).json({ error: resultado.error });
      return;
    }

    const estadoDialogo = deserializarDialogo(partida.estado_dialogo as any);
    for (const a of acciones) {
      if (!estadoDialogo.accionesAceptadas.includes(a.accionId)) {
        estadoDialogo.accionesAceptadas.push(a.accionId);
      }
    }

    // Cada acción se liga a la causa de la espina que pretende atacar
    const espina = espinaDe(estado);
    const vinculos: VinculoAccion[] = acciones.map((a: { accionId: number; tarjetaId?: string }) => {
      const t = espina.tarjetas.find(x => x.id === a.tarjetaId);
      return { accionId: a.accionId, tarjetaId: t?.id ?? null, verificada: !!t && t.estado === 'verificada' && t.evidencias.length > 0 };
    });
    const previos = await eventosDe(partida.id);
    const nombres = Object.fromEntries((config.acciones as { id: number; nombre: string }[]).map(a => [a.id, a.nombre]));
    const avisos = avisosPorAcciones(vinculos, nombres, previos);

    await actualizarPartida(jugador.id, estado, serializarDialogo(estadoDialogo));
    await registrarMetodo(partida.id, jugador, 'acciones', { ciclo: cicloActual, acciones: vinculos });
    for (const aviso of avisos) await registrarMetodo(partida.id, jugador, 'aviso', { ciclo: cicloActual, texto: aviso });
    const actualizada = await obtenerPartida(jugador.id);
    res.json({ ...estadoPublico(actualizada!), avisos });
  } catch (err) {
    responderError(res, 'Error al elegir acciones', err);
  }
});

app.post('/api/partida/compromiso', autenticarJugador, soloModoCompleto, sesionActiva, async (req, res) => {
  const { metrica, valorPrometido } = req.body;
  if (!metrica || valorPrometido == null) {
    res.status(400).json({ error: 'Métrica y valor prometido requeridos' });
    return;
  }

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') {
      res.status(400).json({ error: 'Partida no activa' });
      return;
    }

    const estado = partida.estado as any;
    declararCompromiso(estado, metrica, valorPrometido);
    await actualizarPartida(jugador.id, estado, partida.estado_dialogo as any);

    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al declarar compromiso', err);
  }
});

app.post('/api/partida/avanzar', autenticarJugador, soloModoCompleto, sesionActiva, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') {
      res.status(400).json({ error: 'Partida no activa' });
      return;
    }

    const estado = partida.estado as any;
    if (estado.terminada) {
      res.status(400).json({ error: 'Partida terminada' });
      return;
    }
    // Cada ciclo se cierra votando las causas principales y escribiendo los 5 porqués
    if (!espinaDe(estado).votaciones.some(v => v.ciclo === estado.cicloActual)) {
      res.status(400).json({ error: 'Antes de avanzar, vota tus causas principales y escribe tus 5 porqués.', requiereVotacion: true });
      return;
    }

    const resultado = procesarCiclo(estado, config.acciones as any, config.eventos);

    const extras: Record<string, unknown> = {};
    if (estado.terminada) {
      extras.fase = 'finalizada';
    }

    await actualizarPartida(jugador.id, estado, partida.estado_dialogo as any, extras as any);
    res.json({ resultado, estado: estadoPublico({ ...partida, estado, fase: extras.fase ?? partida.fase }) });
  } catch (err) {
    responderError(res, 'Error al avanzar ciclo', err);
  }
});

app.get('/api/partida/dialogos', autenticarJugador, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }

    const estado = partida.estado as any;
    const estadoDialogo = deserializarDialogo(partida.estado_dialogo as any);
    const ciclo = estado.cicloActual as number || 1;

    const personajes = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego'];
    const resultado: Record<string, unknown>[] = [];

    for (const p of personajes) {
      const nodos = dialogos[p]!;
      const apertura = nodos.find(n => n.ciclo === ciclo && n.fase === 'apertura');
      if (!apertura) continue;

      const respuestas = filtrarRespuestas(apertura.respuestas, estadoDialogo);

      const nodoData: Record<string, unknown> = {
        personaje: p,
        nodoId: apertura.id,
        fase: 'apertura',
        expresion: apertura.expresion,
        lineas: apertura.lineas,
        pendiente: apertura.pendiente ?? null,
        afirmacion: apertura.afirmacion ?? null,
        respuestas: respuestas.map(r => ({
          texto: r.texto,
          efecto: r.efecto,
          credibilidad: r.credibilidad,
        })),
      };

      resultado.push(nodoData);

      if (p === 'diego') {
        const segundo = nodos.find(n => n.ciclo === ciclo && n.fase === 'segundo');
        if (segundo) {
          resultado.push({
            personaje: p,
            nodoId: segundo.id,
            fase: 'segundo',
            expresion: segundo.expresion,
            lineas: segundo.lineas,
            pendiente: segundo.pendiente ?? null,
            afirmacion: segundo.afirmacion ?? null,
            respuestas: filtrarRespuestas(segundo.respuestas, estadoDialogo).map(r => ({
              texto: r.texto, efecto: r.efecto, credibilidad: r.credibilidad,
            })),
          });
        }
        const tercero = nodos.find(n => n.ciclo === ciclo && n.fase === 'tercero');
        if (tercero) {
          resultado.push({
            personaje: p,
            nodoId: tercero.id,
            fase: 'tercero',
            expresion: tercero.expresion,
            lineas: tercero.lineas,
            pendiente: tercero.pendiente ?? null,
            afirmacion: tercero.afirmacion ?? null,
            respuestas: filtrarRespuestas(tercero.respuestas, estadoDialogo).map(r => ({
              texto: r.texto, efecto: r.efecto, credibilidad: r.credibilidad,
            })),
          });
        }
      }

      const reacciones = nodos.filter(n => n.ciclo === ciclo && n.fase === 'reaccion');
      for (const r of reacciones) {
        if (r.condicion && evaluarCondicion(r.condicion, estado, estadoDialogo)) {
          resultado.push({
            personaje: p,
            nodoId: r.id,
            fase: 'reaccion',
            expresion: r.expresion,
            lineas: r.lineas,
            pendiente: r.pendiente ?? null,
            respuestas: [],
          });
        }
      }
    }

    const ramonNodos = dialogos['ramon']!;
    const ultimoResultado = estado.resultadosCiclo?.[estado.resultadosCiclo.length - 1];
    if (ultimoResultado) {
      if (ultimoResultado.vidaPerdida) {
        const vidaR = ramonNodos.find(n =>
          n.fase === 'vida_perdida' && n.condicion?.valor === estado.vidas
        );
        if (vidaR) {
          resultado.push({
            personaje: 'ramon',
            nodoId: vidaR.id,
            fase: 'vida_perdida',
            expresion: vidaR.expresion,
            lineas: vidaR.lineas,
            respuestas: [],
          });
        }
      } else {
        const tipo = ultimoResultado.cumplioCompromiso ? 'compromiso_cumplido' : 'compromiso_no_cumplido';
        const retroR = ramonNodos.find(n => n.fase === 'retro' && n.condicion?.tipo === tipo);
        if (retroR) {
          resultado.push({
            personaje: 'ramon',
            nodoId: retroR.id,
            fase: 'retro',
            expresion: retroR.expresion,
            lineas: retroR.lineas,
            respuestas: [],
          });
        }
      }
    }

    if (estado.destituido) {
      const dest = ramonNodos.find(n => n.fase === 'destitucion');
      if (dest) {
        resultado.push({
          personaje: 'ramon',
          nodoId: dest.id,
          fase: 'destitucion',
          expresion: dest.expresion,
          lineas: dest.lineas,
          respuestas: [],
        });
      }
    }

    res.json(resultado);
  } catch (err) {
    responderError(res, 'Error al obtener diálogos', err);
  }
});

app.post('/api/partida/respuesta', autenticarJugador, sesionActiva, async (req, res) => {
  const { nodoId, efecto, personaje } = req.body;
  if (!efecto) {
    res.status(400).json({ error: 'efecto requerido' });
    return;
  }

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') {
      res.status(400).json({ error: 'Partida no activa' });
      return;
    }

    const estado = partida.estado as any;
    const estadoDialogo = deserializarDialogo(partida.estado_dialogo as any);

    if (efecto === 'refutar' && nodoId) {
      const nodos = dialogos[personaje as string];
      if (nodos) {
        const nodo = nodos.find(n => n.id === nodoId);
        if (nodo?.afirmacion) {
          estadoDialogo.refutaciones.add(nodo.afirmacion.id);
        }
      }
    }

    aplicarEfecto(efecto, estadoDialogo, personaje ?? '');

    const credDelta = calcularCredibilidadRespuesta(efecto);
    estado.credibilidad = Math.max(0, Math.min(100, estado.credibilidad + credDelta));

    await actualizarPartida(jugador.id, estado, serializarDialogo(estadoDialogo));

    let siguienteNodo: Record<string, unknown> | null = null;
    if (efecto === 'refutar' && nodoId && personaje) {
      const nodos = dialogos[personaje as string];
      if (nodos) {
        const nodoOrig = nodos.find(n => n.id === nodoId);
        if (nodoOrig?.afirmacion) {
          const refutado = nodos.find(n =>
            n.fase === 'refutado' && n.condicion?.afirmacion === nodoOrig.afirmacion!.id
          );
          if (refutado) {
            siguienteNodo = {
              nodoId: refutado.id,
              personaje,
              fase: 'refutado',
              expresion: refutado.expresion,
              lineas: refutado.lineas,
              pendiente: refutado.pendiente ?? null,
              respuestas: filtrarRespuestas(refutado.respuestas, estadoDialogo).map(r => ({
                texto: r.texto, efecto: r.efecto, credibilidad: r.credibilidad,
              })),
            };
          }
        }
      }
    }

    // "¿Qué propones?" abre la recomendación de esa persona
    if (efecto.startsWith('pedir_consejo:')) {
      const quien = efecto.slice('pedir_consejo:'.length);
      const consejo = dialogos[quien]?.find(n => n.fase === 'consejo');
      if (consejo) {
        siguienteNodo = {
          nodoId: consejo.id,
          personaje: quien,
          fase: 'consejo',
          expresion: consejo.expresion,
          lineas: consejo.lineas,
          pendiente: consejo.pendiente ?? null,
          respuestas: filtrarRespuestas(consejo.respuestas, estadoDialogo).map(r => ({
            texto: r.texto, efecto: r.efecto, credibilidad: r.credibilidad,
          })),
        };
      }
    }

    res.json({ ok: true, credibilidad: estado.credibilidad, siguienteNodo });
  } catch (err) {
    responderError(res, 'Error al procesar respuesta', err);
  }
});

function calcularCredibilidadRespuesta(efecto: string): number {
  if (efecto === 'refutar') return 5;
  if (efecto.startsWith('convencer:')) return 8;
  if (efecto === 'insistir_sin_datos') return -5;
  if (efecto === 'postergar') return -2;
  if (efecto === 'rechazar') return -3;
  if (efecto === 'escuchar') return 1;
  if (efecto.startsWith('aceptar')) return 2;
  return 0;
}

// ╔══════════════════════════════════════╗
// ║     MÉTODO (EVENTOS)                 ║
// ╚══════════════════════════════════════╝

// El registro del método no debe interrumpir el juego si la telemetría falla
async function registrarMetodo(partidaId: string, jugador: RequestJugador['jugador'], tipo: string, datos: Record<string, unknown>) {
  try {
    await registrarEvento(partidaId, jugador.id, jugador.sesionId, tipo, datos);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] No se registró el evento ${tipo}:`, err);
  }
}

async function eventosDe(partidaId: string) {
  try { return await listarEventosPartida(partidaId); } catch { return []; }
}

// Eventos que envía el navegador; el ciclo y la hora los pone el servidor
const EVENTOS_CLIENTE = new Set(['analisis', 'vista', 'proceso_etapa', 'espina_tarjeta', 'evidencia']);

app.post('/api/eventos', autenticarJugador, async (req, res) => {
  const { tipo, datos } = req.body ?? {};
  if (!EVENTOS_CLIENTE.has(tipo)) { res.status(400).json({ error: 'Evento no reconocido' }); return; }
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando' || jugador.sesionEstado === 'finalizada') { res.json({ ok: false }); return; }
    const texto = JSON.stringify(datos ?? {});
    if (texto.length > 2000) { res.status(400).json({ error: 'Evento demasiado grande' }); return; }
    const limpio = JSON.parse(texto);
    await registrarMetodo(partida.id, jugador, tipo, { ...limpio, ciclo: (partida.estado as any).cicloActual ?? 1 });
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// Línea de tiempo del método por participante, para el panel del profesor
app.get('/api/profesor/sesion/:id/linea-tiempo', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    const sesionId = idParam(req);
    const [jugadores, partidas, telemetria] = await Promise.all([
      listarJugadoresSesion(sesionId), listarEstadosPartidasSesion(sesionId), obtenerTelemetriaSesion(sesionId),
    ]);
    const tipos = new Set<string>(TIPOS_EVENTO);
    res.json(jugadores.map((j: any) => {
      const partida = partidas.find((p: any) => p.jugador_id === j.id);
      const eventos = telemetria
        .filter((e: any) => e.jugador_id === j.id && tipos.has(e.tipo))
        .map((e: any) => ({ tipo: e.tipo, datos: e.datos ?? {}, momento: e.created_at }));
      return { id: j.id, nombre: j.nombre, eventos, hitos: evaluarHitos(eventos, espinaDe((partida?.estado ?? {}) as Record<string, unknown>)) };
    }));
  } catch (err) {
    responderError(res, 'Error al obtener la línea de tiempo', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     ESPINA DE PESCADO                ║
// ╚══════════════════════════════════════╝

// La espina vive dentro del estado de la partida (JSONB); el motor conserva las claves extra
function espinaDe(estado: Record<string, unknown>): Espina {
  return (estado['espina'] as Espina | undefined) ?? ESPINA_VACIA;
}

app.get('/api/partida/espina', autenticarJugador, async (req, res) => {
  try {
    const partida = await obtenerPartida((req as RequestJugador).jugador.id);
    if (!partida) { res.status(404).json({ error: 'Partida no encontrada' }); return; }
    res.json(espinaDe(partida.estado as Record<string, unknown>));
  } catch (err) {
    responderError(res, 'Error al leer la espina de pescado', err);
  }
});

app.put('/api/partida/espina', autenticarJugador, sesionActiva, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') { res.status(400).json({ error: 'Partida no activa' }); return; }
    const estado = partida.estado as Record<string, unknown>;
    const espina = normalizarEspina(req.body, await listarVerificaciones(partida.id), espinaDe(estado));
    estado['espina'] = espina;
    await actualizarPartida(jugador.id, estado as any, partida.estado_dialogo as any);
    res.json(espina);
  } catch (err) {
    responderError(res, 'Error al guardar la espina de pescado', err);
  }
});

app.post('/api/partida/votacion', autenticarJugador, soloModoCompleto, sesionActiva, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') { res.status(400).json({ error: 'Partida no activa' }); return; }
    const estado = partida.estado as Record<string, unknown>;
    const espina = espinaDe(estado);
    const r = validarVotacion(espina, req.body?.causas, req.body?.porques);
    if (!r.ok) { res.status(400).json({ error: r.error }); return; }
    const ciclo = Number(estado['cicloActual']) || 1;
    estado['espina'] = { ...espina, votaciones: [...espina.votaciones.filter(v => v.ciclo !== ciclo), { ciclo, ...r.votacion }] };
    await actualizarPartida(jugador.id, estado as any, partida.estado_dialogo as any);
    await registrarMetodo(partida.id, jugador, 'votacion', { ciclo, causas: r.votacion.causas });
    res.json(estado['espina']);
  } catch (err) {
    responderError(res, 'Error al guardar la votación', err);
  }
});

app.post('/api/partida/cierre', autenticarJugador, soloModoCompleto, async (req, res) => {

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }

    const estado = partida.estado as any;
    // Tras finalizar la sesión solo puede declarar causas quien completó los ciclos
    if (jugador.sesionEstado === 'finalizada' && !estado.terminada) {
      rechazarSesionFinalizada(res);
      return;
    }
    const estadoDialogo = deserializarDialogo(partida.estado_dialogo as any);

    const verificaciones = await listarVerificaciones(partida.id);
    const refutaciones = estadoDialogo.refutaciones.size;
    const metodo = resumirMetodo(await eventosDe(partida.id), espinaDe(estado));

    const desglose = evaluarPartida(
      estado,
      { ...config.kpisIniciales },
      causasDesdeEspina(espinaDe(estado)),
      verificaciones.length,
      refutaciones,
      metodo.accionesSinVerificar,
      metodo.herramientas,
      { hitos: metodo.hitos, capacitoSinEstratificar: metodo.capacitoSinEstratificar },
      config.puntuacion
    );

    const desenlace = determinarDesenlace(desglose.total, estado.destituido, config.desenlaces);

    await actualizarPartida(
      jugador.id, estado, serializarDialogo(estadoDialogo),
      { fase: 'finalizada', puntuacion: desglose.total, desenlace_id: desenlace.id }
    );

    const ramonCierre = dialogos['ramon']!.find(n =>
      n.ciclo === 4 && n.condicion?.valor === desenlace.id
    );

    res.json({
      desglose,
      desenlace,
      ramonCierre: ramonCierre ? { lineas: ramonCierre.lineas, expresion: ramonCierre.expresion } : null,
    });
  } catch (err) {
    responderError(res, 'Error al evaluar cierre', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE CONFIG                 ║
// ╚══════════════════════════════════════╝

app.get('/api/config/acciones', autenticarJugador, (_req, res) => {
  res.json(config.acciones.map(a => ({
    id: a.id,
    nombre: a.nombre,
    costo: a.costo,
    demora: a.demora,
    descripcion: a.descripcion,
  })));
});

app.get('/api/config/metricas', autenticarJugador, async (_req, res) => {
  const { METRICAS_DISPONIBLES } = await import('../motor/ciclos.js');
  res.json(METRICAS_DISPONIBLES);
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE EXPERIMENTO (ADENDA)   ║
// ╚══════════════════════════════════════╝

app.post('/api/profesor/sesion/:id/experimento', autenticarProfesor, sesionPropia, async (req, res) => {
  const { modoExperimento, pctTratamiento } = req.body;
  try {
    await actualizarSesionExperimento(
      idParam(req),
      modoExperimento ?? false,
      pctTratamiento ?? 50
    );
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al configurar experimento', err);
  }
});

app.post('/api/consentimiento', autenticarJugador, async (req, res) => {
  const { acepta } = req.body;
  try {
    const jugador = (req as RequestJugador).jugador;
    await registrarConsentimiento(jugador.id, acepta ?? false);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al registrar consentimiento', err);
  }
});

app.get('/api/experimento/info', autenticarJugador, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    const sesion = await obtenerSesionPorId(jugador.sesionId);
    res.json({
      modoExperimento: sesion.modo_experimento ?? false,
      grupo: jugador.grupo ?? null,
      consentimiento: jugador.consentimiento ?? false,
      config: jugador.config,
    });
  } catch (err) {
    responderError(res, 'Error al obtener info del experimento', err);
  }
});

app.get('/api/experimento/recomendacion', autenticarJugador, soloModoCompleto, async (req, res) => {
  try {
    const jugador = (req as RequestJugador).jugador;
    if (jugador.grupo !== 'tratamiento') {
      res.status(403).json({ error: 'No disponible para tu grupo' });
      return;
    }

    const partida = await obtenerPartida(jugador.id);
    if (!partida || partida.fase !== 'jugando') {
      res.status(400).json({ error: 'Partida no activa' });
      return;
    }

    const estado = partida.estado as any;
    const rec = generarRecomendacion(estado, config.acciones as any);

    await registrarEvento(partida.id, jugador.id, jugador.sesionId, 'consulta_asesor_algoritmico', {
      recomendacion: rec,
      ciclo: estado.cicloActual,
    });

    res.json(rec);
  } catch (err) {
    responderError(res, 'Error al generar recomendación', err);
  }
});

app.post('/api/telemetria', autenticarJugador, async (req, res) => {
  const { tipo, datos } = req.body;
  if (!tipo) {
    res.status(400).json({ error: 'tipo requerido' });
    return;
  }

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }

    await registrarEvento(partida.id, jugador.id, jugador.sesionId, tipo, datos ?? {});
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al registrar evento', err);
  }
});

app.get('/api/profesor/sesion/:id/telemetria', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    const data = await obtenerTelemetriaSesion(idParam(req));
    res.json(data);
  } catch (err) {
    responderError(res, 'Error al obtener telemetría', err);
  }
});

app.get('/api/profesor/sesion/:id/resumen-experimento', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    const resumen = await obtenerResumenExperimento(idParam(req));
    res.json(resumen);
  } catch (err) {
    responderError(res, 'Error al obtener resumen', err);
  }
});

app.get('/api/profesor/sesion/:id/exportar', async (req, res) => {
  const tokenQuery = req.query['token'] as string | undefined;
  if (tokenQuery && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${tokenQuery}`;
  }
  await new Promise<void>((resolve, reject) => {
    autenticarProfesor(req, res, ((err?: any) => err ? reject(err) : resolve()) as any);
  }).catch(() => { return; });
  if (res.headersSent) return;

  if (!(await esSesionDelProfesor(idParam(req), (req as unknown as RequestProfesor).profesorId))) {
    res.status(404).json({ error: 'Sesión no encontrada' });
    return;
  }

  const formato = (req.query['formato'] as string) ?? 'json';

  try {
    const [telemetria, resumen] = await Promise.all([
      obtenerTelemetriaSesion(idParam(req)),
      obtenerResumenExperimento(idParam(req)),
    ]);

    if (formato === 'csv') {
      const lineas = ['timestamp,jugador,grupo,tipo,datos'];
      for (const e of telemetria) {
        const nombre = (e.jugadores as any)?.nombre ?? '';
        const grupo = (e.jugadores as any)?.grupo ?? '';
        const datosStr = JSON.stringify(e.datos).replace(/"/g, '""');
        lineas.push(`${e.created_at},"${nombre}","${grupo}","${e.tipo}","${datosStr}"`);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=telemetria_${req.params.id}.csv`);
      res.send(lineas.join('\n'));
    } else {
      res.json({ resumen, telemetria });
    }
  } catch (err) {
    responderError(res, 'Error al exportar', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     TABLERO DEL EQUIPO              ║
// ╚══════════════════════════════════════╝

app.get('/api/tablero', autenticarJugador, async (req, res) => {
  try {
    const fila = await obtenerTablero((req as RequestJugador).jugador.id);
    res.json(fila ? normalizarTablero(fila.contenido) : tableroVacio());
  } catch (err) {
    responderError(res, 'Error al cargar el tablero', err);
  }
});

app.put('/api/tablero', autenticarJugador, sesionActiva, async (req, res) => {
  const jugador = (req as RequestJugador).jugador;
  try {
    const tablero = normalizarTablero(req.body);
    await guardarTablero(jugador.id, jugador.sesionId, tablero);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, 'Error al guardar el tablero', err);
  }
});

// El profesor ve los tableros de todos los equipos, en solo lectura, con los datos de la sesión para dibujarlos
app.get('/api/profesor/sesion/:id/tableros', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    const sesionId = idParam(req);
    const [sesion, jugadores, tableros] = await Promise.all([obtenerSesionPorId(sesionId), listarJugadoresSesion(sesionId), listarTablerosSesion(sesionId)]);
    const nombres = new Map(jugadores.map((j: any) => [j.id, j.nombre]));
    res.json({
      config: configDeSesion(sesion),
      tableros: tableros
        .map((t: any) => ({ jugadorId: t.jugador_id, nombre: nombres.get(t.jugador_id) ?? '', actualizado: t.updated_at, tablero: normalizarTablero(t.contenido) }))
        .filter(t => t.tablero.graficos.length > 0 || Object.values(t.tablero.textos).some(Boolean)),
    });
  } catch (err) {
    responderError(res, 'Error al cargar los tableros', err);
  }
});

app.get('/api/profesor/sesion/:id/datos', autenticarProfesor, sesionPropia, async (req, res) => {
  try {
    const config = configDeSesion(await obtenerSesionPorId(idParam(req)));
    const clave = claveDatos(config);
    const comentarios = clave === 'R2' && config.idioma === 'en' ? todosLosDatos.R2.comentariosEn ?? todosLosDatos.R2.comentarios : todosLosDatos[clave].comentarios;
    res.json({ solicitudes: datosPublicos[clave].solicitudes, comentarios, columnas: columnasDe(config.idioma, clave) });
  } catch (err) {
    responderError(res, 'Error al cargar los datos de la sesión', err);
  }
});

// ╔══════════════════════════════════════╗
// ║     INICIO                          ║
// ╚══════════════════════════════════════╝

if (fs.existsSync(clientePath)) {
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientePath, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
  });
}

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

cargarDatosInicio();
console.log(`Datos cargados: ${CLAVES_DATOS.map((c) => `${c} ${todosLosDatos[c].solicitudes.length}`).join(', ')}`);

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});

export default app;
