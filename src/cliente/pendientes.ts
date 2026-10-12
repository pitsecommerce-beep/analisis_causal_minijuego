import { useEffect, useState } from 'react';

// Notas que el equipo deja en la Sala de Juntas: afirmaciones por validar y recomendaciones
export interface Pendiente {
  id: string;
  personaje: string;
  texto: string;
  afirmacion: string | null;
  hecho: boolean;
}

export const CLAVE_PENDIENTES = 'pendientes:v1';
// Conversaciones vistas y respondidas en la Sala de Juntas (por pestaña)
export const CLAVE_MEMORIA_SALA = 'salaJuntas:v1';

// Lo que el navegador recuerda de una partida no debe pasar a la siguiente participación
export function olvidarPartidaAnterior() {
  try {
    localStorage.removeItem(CLAVE_PENDIENTES);
    sessionStorage.removeItem(CLAVE_MEMORIA_SALA);
  } catch { /* sin almacenamiento */ }
}
const EVENTO = 'pendientes-cambio';

function leer(): Pendiente[] {
  try { return JSON.parse(localStorage.getItem(CLAVE_PENDIENTES) ?? '[]'); } catch { return []; }
}

function guardar(lista: Pendiente[]) {
  try { localStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(lista)); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(EVENTO));
}

// Devuelve true si la nota es nueva
export function agregarPendiente(p: Omit<Pendiente, 'hecho'>): boolean {
  const lista = leer();
  if (lista.some(x => x.id === p.id)) return false;
  guardar([...lista, { ...p, hecho: false }]);
  return true;
}

export function alternarPendiente(id: string) {
  guardar(leer().map(p => p.id === id ? { ...p, hecho: !p.hecho } : p));
}

export function usePendientes(): Pendiente[] {
  const [lista, setLista] = useState(leer);
  useEffect(() => {
    const actualizar = () => setLista(leer());
    window.addEventListener(EVENTO, actualizar);
    return () => window.removeEventListener(EVENTO, actualizar);
  }, []);
  return lista;
}
