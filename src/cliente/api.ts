import type { ConfigSesion } from '../compartido/configuracion.js';
import type { Espina } from '../compartido/espina.js';
import type { Evento, Hitos } from '../compartido/metodo.js';

export interface LineaParticipante { id: string; nombre: string; eventos: Evento[]; hitos: Hitos }

const BASE = '/api';
export const EVENTO_SESION_FINALIZADA = 'sesion-finalizada';
export const EVENTO_VERIFICACION = 'verificacion-registrada';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// Renueva el token del profesor una sola vez aunque varias peticiones fallen a la vez
let renovacion: Promise<boolean> | null = null;

function renovarTokenProfesor(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken || localStorage.getItem('tipoAuth') !== 'profesor') return Promise.resolve(false);
  renovacion ??= fetch(`${BASE}/profesor/refrescar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async res => {
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    })
    .catch(() => false)
    .finally(() => { renovacion = null; });
  return renovacion;
}

async function request<T>(method: string, path: string, body?: unknown, reintento = false): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : null,
  });
  const esAcceso = path === '/profesor/login' || path === '/profesor/registrar';
  if (res.status === 401 && !reintento && !esAcceso && localStorage.getItem('tipoAuth') === 'profesor') {
    if (await renovarTokenProfesor()) return request<T>(method, path, body, true);
    // Sin forma de renovar: se pide iniciar sesión de nuevo
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    window.location.assign('/profesor');
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
  }
  // Avisa a la pantalla de juego para que muestre el cierre en cuanto el servidor rechaza una jugada
  if (data?.sesionFinalizada) window.dispatchEvent(new Event(EVENTO_SESION_FINALIZADA));
  if (!res.ok) throw new Error(data?.error ?? 'Error desconocido');
  return data as T;
}

export const api = {
  profesor: {
    registrar: (email: string, password: string) =>
      request<{ id: string }>('POST', '/profesor/registrar', { email, password }),
    login: (email: string, password: string) =>
      request<{ token: string; refreshToken: string; profesorId: string }>('POST', '/profesor/login', { email, password }),
    sesiones: () => request<any[]>('GET', '/profesor/sesiones'),
    sesion: (id: string) => request<any>('GET', `/profesor/sesion/${id}`),
    lineaTiempo: (id: string) => request<LineaParticipante[]>('GET', `/profesor/sesion/${id}/linea-tiempo`),
    iniciarSesion: (id: string) => request<any>('POST', `/profesor/sesion/${id}/iniciar`),
    finalizarSesion: (id: string) => request<any>('POST', `/profesor/sesion/${id}/finalizar`),
    eliminarSesion: (id: string) => request<{ ok: boolean; eliminadas: number }>('DELETE', `/profesor/sesion/${id}`),
    eliminarSesiones: (ids: string[]) =>
      request<{ ok: boolean; eliminadas: number }>('POST', '/profesor/sesiones/eliminar', { ids }),
  },
  sesion: {
    buscar: (codigo: string) => request<any>('GET', `/sesion/${codigo}`),
    crear: (nombre: string, config: ConfigSesion) => request<any>('POST', '/sesion', { nombre, ...config }),
    unirse: (codigo: string, nombre: string, email?: string) =>
      request<{ jugadorId: string; token: string; sesion: any; reconectado?: boolean }>('POST', `/sesion/${codigo}/unirse`, { nombre, email }),
  },
  eventos: {
    // keepalive: el evento se envía aunque el participante cambie de página
    registrar: (tipo: string, datos: Record<string, unknown>) =>
      fetch(`${BASE}/eventos`, { method: 'POST', headers: headers(), body: JSON.stringify({ tipo, datos }), keepalive: true }).catch(() => {}),
  },
  jugador: {
    latido: () => request<{ sesionEstado: string }>('POST', '/jugador/latido'),
    salir: () => request<{ ok: boolean }>('POST', '/jugador/salir'),
  },
  partida: {
    iniciar: () => request<any>('POST', '/partida/iniciar'),
    estado: () => request<any>('GET', '/partida'),
    acciones: (acciones: { accionId: number; tarjetaId?: string | null }[]) =>
      request<any>('POST', '/partida/acciones', { acciones }),
    compromiso: (metrica: string, valorPrometido: number) =>
      request<any>('POST', '/partida/compromiso', { metrica, valorPrometido }),
    avanzar: () => request<any>('POST', '/partida/avanzar'),
    dialogos: () => request<any[]>('GET', '/partida/dialogos'),
    espina: () => request<Espina>('GET', '/partida/espina'),
    guardarEspina: (espina: Pick<Espina, 'tarjetas' | 'evidencias'>) => request<Espina>('PUT', '/partida/espina', espina),
    votar: (causas: string[], porques: string[]) => request<Espina>('POST', '/partida/votacion', { causas, porques }),
    respuesta: (nodoId: string, efecto: string, personaje: string) =>
      request<any>('POST', '/partida/respuesta', { nodoId, efecto, personaje }),
    cierre: () => request<any>('POST', '/partida/cierre', {}),
  },
  datos: {
    solicitudes: () => request<any[]>('GET', '/datos/solicitudes'),
    comentarios: () => request<any[]>('GET', '/datos/comentarios'),
    columnas: () => request<any>('GET', '/datos/columnas'),
    verificar: (verificacionId: string, herramienta?: string) =>
      request<any>('POST', '/datos/verificacion', { verificacionId, herramienta }),
    verificaciones: () => request<string[]>('GET', '/datos/verificaciones'),
  },
  config: {
    acciones: () => request<any[]>('GET', '/config/acciones'),
    metricas: () => request<any[]>('GET', '/config/metricas'),
  },
  experimento: {
    info: () => request<{ modoExperimento: boolean; grupo: string | null; consentimiento: boolean }>('GET', '/experimento/info'),
    consentimiento: (acepta: boolean) => request<any>('POST', '/consentimiento', { acepta }),
    recomendacion: () => request<any>('GET', '/experimento/recomendacion'),
    configurar: (sesionId: string, modoExperimento: boolean, pctTratamiento: number) =>
      request<any>('POST', `/profesor/sesion/${sesionId}/experimento`, { modoExperimento, pctTratamiento }),
    telemetria: (sesionId: string) => request<any[]>('GET', `/profesor/sesion/${sesionId}/telemetria`),
    resumen: (sesionId: string) => request<any>('GET', `/profesor/sesion/${sesionId}/resumen-experimento`),
    exportarUrl: (sesionId: string, formato: string) => `${BASE}/profesor/sesion/${sesionId}/exportar?formato=${formato}`,
  },
  telemetria: {
    registrar: (tipo: string, datos?: Record<string, unknown>) =>
      request<any>('POST', '/telemetria', { tipo, datos }),
  },
};
