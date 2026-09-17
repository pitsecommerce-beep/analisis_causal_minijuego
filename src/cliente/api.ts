const BASE = '/api';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  const tipo = localStorage.getItem('tipoAuth');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
  return data as T;
}

export const api = {
  profesor: {
    registrar: (email: string, password: string) =>
      request<{ id: string }>('POST', '/profesor/registrar', { email, password }),
    login: (email: string, password: string) =>
      request<{ token: string; profesorId: string }>('POST', '/profesor/login', { email, password }),
    sesiones: () => request<any[]>('GET', '/profesor/sesiones'),
    sesion: (id: string) => request<any>('GET', `/profesor/sesion/${id}`),
    iniciarSesion: (id: string) => request<any>('POST', `/profesor/sesion/${id}/iniciar`),
    finalizarSesion: (id: string) => request<any>('POST', `/profesor/sesion/${id}/finalizar`),
  },
  sesion: {
    buscar: (codigo: string) => request<any>('GET', `/sesion/${codigo}`),
    crear: (nombre: string) => request<any>('POST', '/sesion', { nombre }),
    unirse: (codigo: string, nombre: string, email?: string) =>
      request<{ jugadorId: string; token: string; sesion: any }>('POST', `/sesion/${codigo}/unirse`, { nombre, email }),
  },
  partida: {
    iniciar: () => request<any>('POST', '/partida/iniciar'),
    estado: () => request<any>('GET', '/partida'),
    acciones: (acciones: { accionId: number }[]) =>
      request<any>('POST', '/partida/acciones', { acciones }),
    compromiso: (metrica: string, valorPrometido: number) =>
      request<any>('POST', '/partida/compromiso', { metrica, valorPrometido }),
    avanzar: () => request<any>('POST', '/partida/avanzar'),
    dialogos: () => request<any[]>('GET', '/partida/dialogos'),
    respuesta: (nodoId: string, efecto: string, personaje: string) =>
      request<any>('POST', '/partida/respuesta', { nodoId, efecto, personaje }),
    cierre: (causas: any[], herramientas: string[], consultoGuia: boolean, pasosEnOrden: boolean) =>
      request<any>('POST', '/partida/cierre', { causas, herramientas, consultoGuia, pasosEnOrden }),
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
};
