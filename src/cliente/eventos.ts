import { api } from './api.js';

// Registro del método: qué analiza el participante, con qué columnas y filtros, y cuándo.
// El servidor agrega la hora y el ciclo.
export function registrarEvento(tipo: 'analisis' | 'vista' | 'proceso_etapa' | 'espina_tarjeta' | 'evidencia', datos: Record<string, unknown> = {}) {
  if (localStorage.getItem('tipoAuth') !== 'jugador') return;
  api.eventos.registrar(tipo, datos);
}
