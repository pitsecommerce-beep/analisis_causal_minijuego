import { randomBytes } from 'node:crypto';
import { obtenerSupabase } from './supabase.js';
import type { EstadoPartida } from '../motor/ciclos.js';
import type { EstadoDialogoJSON } from './serializar.js';

const sb = () => obtenerSupabase();

function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    codigo += chars[bytes[i]! % chars.length];
  }
  return codigo;
}

function generarToken(): string {
  return randomBytes(32).toString('hex');
}

// --- Sesiones ---

export async function crearSesion(profesorId: string, nombre: string, semilla: number) {
  const codigo = generarCodigo();
  const { data, error } = await sb()
    .from('sesiones_juego')
    .insert({ codigo, profesor_id: profesorId, nombre, semilla })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerSesionPorCodigo(codigo: string) {
  const { data, error } = await sb()
    .from('sesiones_juego')
    .select('*')
    .eq('codigo', codigo.toUpperCase())
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function obtenerSesionPorId(id: string) {
  const { data, error } = await sb()
    .from('sesiones_juego')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarEstadoSesion(id: string, estado: string) {
  const { error } = await sb()
    .from('sesiones_juego')
    .update({ estado })
    .eq('id', id);
  if (error) throw error;
}

export async function listarSesionesProfesor(profesorId: string) {
  const { data, error } = await sb()
    .from('sesiones_juego')
    .select('*')
    .eq('profesor_id', profesorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// --- Jugadores ---

export async function registrarJugador(sesionId: string, nombre: string, email?: string) {
  const token = generarToken();
  const { data, error } = await sb()
    .from('jugadores')
    .insert({ sesion_id: sesionId, nombre, email, token })
    .select()
    .single();
  if (error) throw error;
  return { ...data, token };
}

export async function obtenerJugadorPorToken(token: string) {
  const { data, error } = await sb()
    .from('jugadores')
    .select('*, sesiones_juego(*)')
    .eq('token', token)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function contarJugadores(sesionId: string): Promise<number> {
  const { count, error } = await sb()
    .from('jugadores')
    .select('*', { count: 'exact', head: true })
    .eq('sesion_id', sesionId);
  if (error) throw error;
  return count ?? 0;
}

export async function listarJugadoresSesion(sesionId: string) {
  const { data, error } = await sb()
    .from('jugadores')
    .select('id, nombre, email, created_at')
    .eq('sesion_id', sesionId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

// --- Partidas ---

export async function crearPartidaDB(
  jugadorId: string,
  sesionId: string,
  estado: EstadoPartida,
  estadoDialogo: EstadoDialogoJSON
) {
  const { data, error } = await sb()
    .from('partidas')
    .insert({
      jugador_id: jugadorId,
      sesion_id: sesionId,
      estado,
      estado_dialogo: estadoDialogo,
      fase: 'jugando',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerPartida(jugadorId: string) {
  const { data, error } = await sb()
    .from('partidas')
    .select('*')
    .eq('jugador_id', jugadorId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function actualizarPartida(
  jugadorId: string,
  estado: EstadoPartida,
  estadoDialogo: EstadoDialogoJSON,
  extras?: { fase?: string; puntuacion?: number; desenlace_id?: string }
) {
  const update: Record<string, unknown> = { estado, estado_dialogo: estadoDialogo };
  if (extras?.fase) update['fase'] = extras.fase;
  if (extras?.puntuacion != null) update['puntuacion'] = extras.puntuacion;
  if (extras?.desenlace_id) update['desenlace_id'] = extras.desenlace_id;

  const { error } = await sb()
    .from('partidas')
    .update(update)
    .eq('jugador_id', jugadorId);
  if (error) throw error;
}

export async function listarPartidasSesion(sesionId: string) {
  const { data, error } = await sb()
    .from('partidas')
    .select('jugador_id, fase, puntuacion, desenlace_id, jugadores(nombre)')
    .eq('sesion_id', sesionId);
  if (error) throw error;
  return data ?? [];
}

// --- Verificaciones ---

export async function registrarVerificacion(
  partidaId: string,
  verificacionId: string,
  herramienta?: string
) {
  const { error } = await sb()
    .from('verificaciones_jugador')
    .upsert(
      { partida_id: partidaId, verificacion_id: verificacionId, herramienta },
      { onConflict: 'partida_id,verificacion_id' }
    );
  if (error) throw error;
}

export async function listarVerificaciones(partidaId: string): Promise<string[]> {
  const { data, error } = await sb()
    .from('verificaciones_jugador')
    .select('verificacion_id')
    .eq('partida_id', partidaId);
  if (error) throw error;
  return (data ?? []).map((r) => r.verificacion_id);
}

// --- Experimento ---

export async function actualizarSesionExperimento(
  id: string,
  modoExperimento: boolean,
  pctTratamiento: number
) {
  const { error } = await sb()
    .from('sesiones_juego')
    .update({ modo_experimento: modoExperimento, pct_tratamiento: pctTratamiento })
    .eq('id', id);
  if (error) throw error;
}

export async function asignarGrupoJugador(jugadorId: string, grupo: 'control' | 'tratamiento') {
  const { error } = await sb()
    .from('jugadores')
    .update({ grupo })
    .eq('id', jugadorId);
  if (error) throw error;
}

export async function registrarConsentimiento(jugadorId: string, acepta: boolean) {
  const update: Record<string, unknown> = {
    consentimiento: acepta,
    consentimiento_at: new Date().toISOString(),
  };
  const { error } = await sb()
    .from('jugadores')
    .update(update)
    .eq('id', jugadorId);
  if (error) throw error;
}

// --- Telemetria ---

export async function registrarEvento(
  partidaId: string,
  jugadorId: string,
  sesionId: string,
  tipo: string,
  datos: Record<string, unknown> = {}
) {
  const { error } = await sb()
    .from('telemetria')
    .insert({ partida_id: partidaId, jugador_id: jugadorId, sesion_id: sesionId, tipo, datos });
  if (error) throw error;
}

export async function obtenerTelemetriaSesion(sesionId: string) {
  const { data, error } = await sb()
    .from('telemetria')
    .select('*, jugadores(nombre, grupo)')
    .eq('sesion_id', sesionId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function obtenerResumenExperimento(sesionId: string) {
  const { data: jugadores, error: errJ } = await sb()
    .from('jugadores')
    .select('id, nombre, grupo, consentimiento')
    .eq('sesion_id', sesionId);
  if (errJ) throw errJ;

  const { data: partidas, error: errP } = await sb()
    .from('partidas')
    .select('jugador_id, fase, puntuacion, desenlace_id')
    .eq('sesion_id', sesionId);
  if (errP) throw errP;

  const { count: totalEventos, error: errT } = await sb()
    .from('telemetria')
    .select('*', { count: 'exact', head: true })
    .eq('sesion_id', sesionId);
  if (errT) throw errT;

  return {
    jugadores: jugadores ?? [],
    partidas: partidas ?? [],
    totalEventos: totalEventos ?? 0,
  };
}
