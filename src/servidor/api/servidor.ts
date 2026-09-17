import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { obtenerSupabase } from '../db/supabase.js';
import {
  crearSesion, obtenerSesionPorCodigo, obtenerSesionPorId,
  actualizarEstadoSesion, listarSesionesProfesor,
  registrarJugador, contarJugadores, listarJugadoresSesion,
  crearPartidaDB, obtenerPartida, actualizarPartida,
  listarPartidasSesion, registrarVerificacion, listarVerificaciones,
} from '../db/consultas.js';
import { serializarDialogo, deserializarDialogo } from '../db/serializar.js';
import { autenticarProfesor, autenticarJugador } from './middleware.js';
import type { RequestProfesor, RequestJugador } from './middleware.js';
import { crearPartida, elegirAcciones, declararCompromiso, procesarCiclo } from '../motor/ciclos.js';
import { evaluarPartida, determinarDesenlace } from '../puntuacion/evaluacion.js';
import { crearEstadoDialogo, obtenerNodosCiclo, filtrarRespuestas, evaluarCondicion, aplicarEfecto } from '../dialogos/motor-dialogos.js';
import type { NodoDialogo } from '../dialogos/motor-dialogos.js';
import { cargarTodo } from '../datos/cargador.js';
import type { DatosCargados } from '../datos/cargador.js';
import config from '../../../config/simulador.json' with { type: 'json' };
import verificacionesConfig from '../../../config/verificaciones.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const clientePath = path.resolve(__dirname, '../../../dist/cliente');
if (fs.existsSync(clientePath)) {
  app.use(express.static(clientePath));
}

// --- Datos cargados al inicio ---

let datosJuego: DatosCargados;
const dialogos: Record<string, NodoDialogo[]> = {};

function cargarDatosInicio() {
  datosJuego = cargarTodo();

  const dirDialogos = path.resolve(__dirname, '../../../datos/dialogos');
  const personajes = ['bernardo', 'oscar', 'paulina', 'silvia', 'diego', 'ramon'];
  for (const p of personajes) {
    dialogos[p] = JSON.parse(fs.readFileSync(path.join(dirDialogos, `${p}.json`), 'utf-8'));
  }
}

// --- Utilidades ---

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
    })),
    comentarios: datos.comentarios,
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

  const sb = obtenerSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({
    token: data.session.access_token,
    profesorId: data.user.id,
    email: data.user.email,
  });
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE SESION                 ║
// ╚══════════════════════════════════════╝

app.post('/api/sesion', autenticarProfesor, async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) {
    res.status(400).json({ error: 'Nombre de sesion requerido' });
    return;
  }

  const semilla = Date.now() % 100000000;
  const profesorId = (req as RequestProfesor).profesorId;

  try {
    const sesion = await crearSesion(profesorId, nombre, semilla);
    res.json(sesion);
  } catch (err: unknown) {
    res.status(500).json({ error: 'Error al crear sesion' });
  }
});

app.get('/api/sesion/:codigo', async (req, res) => {
  try {
    const sesion = await obtenerSesionPorCodigo(req.params.codigo!);
    if (!sesion) {
      res.status(404).json({ error: 'Sesion no encontrada' });
      return;
    }
    res.json({
      id: sesion.id,
      codigo: sesion.codigo,
      nombre: sesion.nombre,
      estado: sesion.estado,
    });
  } catch {
    res.status(500).json({ error: 'Error al buscar sesion' });
  }
});

app.post('/api/sesion/:codigo/unirse', async (req, res) => {
  const { nombre, email } = req.body;
  if (!nombre) {
    res.status(400).json({ error: 'Nombre requerido' });
    return;
  }

  try {
    const sesion = await obtenerSesionPorCodigo(req.params.codigo!);
    if (!sesion) {
      res.status(404).json({ error: 'Sesion no encontrada' });
      return;
    }
    if (sesion.estado !== 'abierta' && sesion.estado !== 'en_curso') {
      res.status(400).json({ error: 'La sesion ya no acepta jugadores' });
      return;
    }

    const count = await contarJugadores(sesion.id);
    if (count >= sesion.max_jugadores) {
      res.status(400).json({ error: 'Sesion llena' });
      return;
    }

    const jugador = await registrarJugador(sesion.id, nombre, email);
    res.json({
      jugadorId: jugador.id,
      token: jugador.token,
      sesion: { id: sesion.id, nombre: sesion.nombre, estado: sesion.estado },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('duplicate') || msg.includes('unique')) {
      res.status(409).json({ error: 'Ese nombre ya esta registrado en esta sesion' });
      return;
    }
    res.status(500).json({ error: 'Error al unirse' });
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE PROFESOR               ║
// ╚══════════════════════════════════════╝

app.get('/api/profesor/sesiones', autenticarProfesor, async (req, res) => {
  try {
    const sesiones = await listarSesionesProfesor((req as RequestProfesor).profesorId);
    res.json(sesiones);
  } catch {
    res.status(500).json({ error: 'Error al listar sesiones' });
  }
});

app.get('/api/profesor/sesion/:id', autenticarProfesor, async (req, res) => {
  try {
    const sesion = await obtenerSesionPorId(req.params.id!);
    const jugadores = await listarJugadoresSesion(sesion.id);
    const partidas = await listarPartidasSesion(sesion.id);
    res.json({ sesion, jugadores, partidas });
  } catch {
    res.status(500).json({ error: 'Error al obtener sesion' });
  }
});

app.post('/api/profesor/sesion/:id/iniciar', autenticarProfesor, async (req, res) => {
  try {
    await actualizarEstadoSesion(req.params.id!, 'en_curso');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

app.post('/api/profesor/sesion/:id/finalizar', autenticarProfesor, async (req, res) => {
  try {
    await actualizarEstadoSesion(req.params.id!, 'finalizada');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al finalizar sesion' });
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE DATOS (HOJA)           ║
// ╚══════════════════════════════════════╝

app.get('/api/datos/solicitudes', autenticarJugador, (_req, res) => {
  res.json(datosParaJugador(datosJuego).solicitudes);
});

app.get('/api/datos/comentarios', autenticarJugador, (_req, res) => {
  res.json(datosParaJugador(datosJuego).comentarios);
});

app.get('/api/datos/columnas', autenticarJugador, (_req, res) => {
  res.json({
    solicitudes: [
      { campo: 'applicationNum', nombre: 'Application #', tipo: 'numero' },
      { campo: 'customerNum', nombre: 'Customer #', tipo: 'numero' },
      { campo: 'age', nombre: 'Age', tipo: 'numero' },
      { campo: 'maritalStatus', nombre: 'Marital Status', tipo: 'texto' },
      { campo: 'gender', nombre: 'Gender', tipo: 'texto' },
      { campo: 'state', nombre: 'State', tipo: 'texto' },
      { campo: 'branchNum', nombre: 'Branch #', tipo: 'numero' },
      { campo: 'yearsAsCustomer', nombre: 'Years as customer', tipo: 'numero' },
      { campo: 'creditBureauScore', nombre: 'Credit Bureau Score', tipo: 'numero' },
      { campo: 'etfBankScore', nombre: 'ETFBank Score', tipo: 'numero' },
      { campo: 'dateFirstInput', nombre: 'Date of first data input', tipo: 'fecha' },
      { campo: 'dateLastInput', nombre: 'Date of last data input', tipo: 'fecha' },
      { campo: 'numTries', nombre: '# of tries', tipo: 'numero' },
      { campo: 'dateDocsSent', nombre: 'Date documents sent', tipo: 'fecha' },
      { campo: 'dateDocsReceived', nombre: 'Date documents Received at CrOP', tipo: 'fecha' },
      { campo: 'creditBureauResult', nombre: 'Credit Bureau result', tipo: 'texto' },
      { campo: 'creditBureauRunDate', nombre: 'Credit Bureau run date', tipo: 'fecha' },
      { campo: 'etfBankScoreResult', nombre: 'ETFBank Score result', tipo: 'texto' },
      { campo: 'etfbScoreDate', nombre: 'ETFB Score Date', tipo: 'fecha' },
      { campo: 'datePlasticSent', nombre: 'Date Plastic Sent', tipo: 'fecha' },
      { campo: 'lastStatus', nombre: 'Last Status', tipo: 'texto' },
      { campo: 'creditLineGranted', nombre: 'Credit Line Granted', tipo: 'numero' },
      { campo: 'comments', nombre: 'Comments', tipo: 'texto' },
    ],
    comentarios: [
      { campo: 'solicitudNum', nombre: 'Solicitud #', tipo: 'numero' },
      { campo: 'estado', nombre: 'Estado', tipo: 'texto' },
      { campo: 'sucursalNum', nombre: 'Sucursal #', tipo: 'numero' },
      { campo: 'intentos', nombre: 'Intentos', tipo: 'numero' },
      { campo: 'canalCaptacion', nombre: 'Canal', tipo: 'texto' },
      { campo: 'fechaComentario', nombre: 'Fecha', tipo: 'fecha' },
      { campo: 'categoriaPrimaria', nombre: 'Categoria primaria', tipo: 'texto' },
      { campo: 'categoriaSecundaria', nombre: 'Categoria secundaria', tipo: 'texto' },
      { campo: 'comentarioCliente', nombre: 'Comentario', tipo: 'texto' },
    ],
  });
});

app.post('/api/datos/verificacion', autenticarJugador, async (req, res) => {
  const { verificacionId, herramienta } = req.body;
  if (!verificacionId) {
    res.status(400).json({ error: 'verificacionId requerido' });
    return;
  }

  const reglas = verificacionesConfig as Record<string, Record<string, unknown>>;
  const regla = reglas[verificacionId as string];
  if (!regla) {
    res.status(400).json({ error: 'Verificacion no reconocida' });
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
  } catch {
    res.status(500).json({ error: 'Error al registrar verificacion' });
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
  } catch {
    res.status(500).json({ error: 'Error al listar verificaciones' });
  }
});

// ╔══════════════════════════════════════╗
// ║     RUTAS DE PARTIDA                ║
// ╚══════════════════════════════════════╝

app.post('/api/partida/iniciar', autenticarJugador, async (req, res) => {
  const jugador = (req as RequestJugador).jugador;

  if (jugador.sesionEstado !== 'en_curso') {
    res.status(400).json({ error: 'La sesion aun no ha iniciado' });
    return;
  }

  try {
    const existente = await obtenerPartida(jugador.id);
    if (existente) {
      res.json(estadoPublico(existente));
      return;
    }

    const sesion = await obtenerSesionPorId(jugador.sesionId);
    const estado = crearPartida({ ...config.kpisIniciales }, sesion.semilla);
    const estadoDialogo = crearEstadoDialogo();

    await crearPartidaDB(jugador.id, jugador.sesionId, estado, serializarDialogo(estadoDialogo));
    const partida = await obtenerPartida(jugador.id);
    res.json(estadoPublico(partida!));
  } catch {
    res.status(500).json({ error: 'Error al iniciar partida' });
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
  } catch {
    res.status(500).json({ error: 'Error al obtener partida' });
  }
});

app.post('/api/partida/acciones', autenticarJugador, async (req, res) => {
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

    await actualizarPartida(jugador.id, estado, serializarDialogo(estadoDialogo));
    const actualizada = await obtenerPartida(jugador.id);
    res.json(estadoPublico(actualizada!));
  } catch {
    res.status(500).json({ error: 'Error al elegir acciones' });
  }
});

app.post('/api/partida/compromiso', autenticarJugador, async (req, res) => {
  const { metrica, valorPrometido } = req.body;
  if (!metrica || valorPrometido == null) {
    res.status(400).json({ error: 'metrica y valorPrometido requeridos' });
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
  } catch {
    res.status(500).json({ error: 'Error al declarar compromiso' });
  }
});

app.post('/api/partida/avanzar', autenticarJugador, async (req, res) => {
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

    const resultado = procesarCiclo(estado, config.acciones as any, config.eventos);

    const extras: Record<string, unknown> = {};
    if (estado.terminada) {
      extras.fase = 'finalizada';
    }

    await actualizarPartida(jugador.id, estado, partida.estado_dialogo as any, extras as any);
    res.json({ resultado, estado: estadoPublico({ ...partida, estado, fase: extras.fase ?? partida.fase }) });
  } catch {
    res.status(500).json({ error: 'Error al avanzar ciclo' });
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
  } catch {
    res.status(500).json({ error: 'Error al obtener dialogos' });
  }
});

app.post('/api/partida/respuesta', autenticarJugador, async (req, res) => {
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

    let siguienteNodo = null;
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
              respuestas: filtrarRespuestas(refutado.respuestas, estadoDialogo).map(r => ({
                texto: r.texto, efecto: r.efecto, credibilidad: r.credibilidad,
              })),
            };
          }
        }
      }
    }

    res.json({ ok: true, credibilidad: estado.credibilidad, siguienteNodo });
  } catch {
    res.status(500).json({ error: 'Error al procesar respuesta' });
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

app.post('/api/partida/cierre', autenticarJugador, async (req, res) => {
  const { causas, herramientas, consultoGuia, pasosEnOrden } = req.body;

  try {
    const jugador = (req as RequestJugador).jugador;
    const partida = await obtenerPartida(jugador.id);
    if (!partida) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }

    const estado = partida.estado as any;
    const estadoDialogo = deserializarDialogo(partida.estado_dialogo as any);

    const verificaciones = await listarVerificaciones(partida.id);
    const refutaciones = estadoDialogo.refutaciones.size;
    const accionesSinVerificar = 0;

    const desglose = evaluarPartida(
      estado,
      { ...config.kpisIniciales },
      causas ?? [],
      verificaciones.length,
      refutaciones,
      accionesSinVerificar,
      herramientas ?? [],
      consultoGuia ?? false,
      pasosEnOrden ?? false,
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
  } catch {
    res.status(500).json({ error: 'Error al evaluar cierre' });
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
// ║     INICIO                          ║
// ╚══════════════════════════════════════╝

if (fs.existsSync(clientePath)) {
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientePath, 'index.html'));
  });
}

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

cargarDatosInicio();
console.log(`Datos cargados: ${datosJuego.solicitudes.length} solicitudes, ${datosJuego.comentarios.length} comentarios`);

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});

export default app;
