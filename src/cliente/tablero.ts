import { useSyncExternalStore } from 'react';
import { api } from './api.js';
import { tableroVacio } from '../compartido/tablero.js';
import type { GraficoTablero, SeccionA3, Tablero, TextoA3 } from '../compartido/tablero.js';
import type { Spec } from './constructor.js';

// Estado del tablero compartido entre el constructor (que agrega) y la pestaña Tablero (que edita).
// Cada cambio se guarda en el servidor un momento después, para no enviar cada tecla.
type Estado = { tablero: Tablero; cargado: boolean; error: boolean; guardando: boolean; errorGuardar: boolean };

let estado: Estado = { tablero: tableroVacio(), cargado: false, error: false, guardando: false, errorGuardar: false };
const oyentes = new Set<() => void>();
let temporizador: number | undefined;
let carga: Promise<void> | null = null;

function emitir(cambio: Partial<Estado>) {
  estado = { ...estado, ...cambio };
  for (const o of oyentes) o();
}

export function cargarTablero(): Promise<void> {
  carga ??= api.tablero.obtener()
    .then(t => emitir({ tablero: t, cargado: true, error: false }))
    .catch(() => { carga = null; emitir({ error: true }); });
  return carga;
}

function programarGuardado() {
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(async () => {
    emitir({ guardando: true });
    try {
      await api.tablero.guardar(estado.tablero);
      emitir({ guardando: false, errorGuardar: false });
    } catch {
      emitir({ guardando: false, errorGuardar: true });
    }
  }, 700);
}

function cambiar(f: (t: Tablero) => Tablero) {
  emitir({ tablero: f(estado.tablero) });
  programarGuardado();
}

export const accionesTablero = {
  async agregar(spec: Spec, titulo: string) {
    await cargarTablero();
    const g: GraficoTablero = { id: Math.random().toString(36).slice(2, 10), spec: { ...spec }, titulo, conclusion: '', seccion: 'analisis' };
    cambiar(t => ({ ...t, graficos: [...t.graficos, g] }));
  },
  actualizar(id: string, c: Partial<Pick<GraficoTablero, 'titulo' | 'conclusion' | 'seccion'>>) {
    cambiar(t => ({ ...t, graficos: t.graficos.map(g => (g.id === id ? { ...g, ...c } : g)) }));
  },
  // Mueve dentro de su sección del A3, en el orden en que se muestran
  mover(id: string, delta: -1 | 1) {
    cambiar(t => {
      const graficos = enOrdenA3(t.graficos);
      const i = graficos.findIndex(g => g.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= graficos.length || graficos[j]!.seccion !== graficos[i]!.seccion) return t;
      [graficos[i], graficos[j]] = [graficos[j]!, graficos[i]!];
      return { ...t, graficos };
    });
  },
  eliminar(id: string) {
    cambiar(t => ({ ...t, graficos: t.graficos.filter(g => g.id !== id) }));
  },
  texto(clave: TextoA3, valor: string) {
    cambiar(t => ({ ...t, textos: { ...t.textos, [clave]: valor } }));
  },
  reintentarGuardado() {
    programarGuardado();
  },
};

export function useTablero(): Estado {
  return useSyncExternalStore(
    o => { oyentes.add(o); return () => oyentes.delete(o); },
    () => estado,
  );
}

// Orden de presentación: por sección del A3 y, dentro de cada una, en el orden que eligió el equipo
export function enOrdenA3(graficos: GraficoTablero[]): GraficoTablero[] {
  const orden: SeccionA3[] = ['situacion', 'analisis', 'seguimiento'];
  return [...graficos].sort((a, b) => orden.indexOf(a.seccion) - orden.indexOf(b.seccion));
}
