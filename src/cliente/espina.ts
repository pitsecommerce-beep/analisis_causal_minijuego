import { useEffect, useState } from 'react';
import { api } from './api.js';
import { registrarEvento } from './eventos.js';
import { ESPINA_VACIA } from '../compartido/espina.js';
import type { Espina, Evidencia, Origen, Rama, Tarjeta } from '../compartido/espina.js';

// Estado de la espina compartido por las pestañas. El servidor es la fuente de verdad:
// cada cambio se aplica al momento en pantalla y se guarda poco después.
let actual: Espina = ESPINA_VACIA;
let ciclo = 1;
let temporizador: number | undefined;
let version = 0;
const EVENTO = 'espina-cambio';

function emitir() { window.dispatchEvent(new Event(EVENTO)); }

function nuevoId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

export function fijarCicloEspina(c: number) { ciclo = c; }

export async function cargarEspina() {
  try { actual = await api.partida.espina(); emitir(); } catch { /* se reintenta al volver a entrar */ }
}

function cambiar(nueva: Espina) {
  actual = nueva;
  emitir();
  const mia = ++version;
  window.clearTimeout(temporizador);
  temporizador = window.setTimeout(async () => {
    try {
      const guardada = await api.partida.guardarEspina({ tarjetas: actual.tarjetas, evidencias: actual.evidencias });
      // Si hubo otro cambio mientras se guardaba, se conserva el local
      if (mia === version) { actual = guardada; emitir(); }
    } catch { /* el siguiente cambio vuelve a intentar */ }
  }, 400);
}

export function useEspina(): Espina {
  const [e, setE] = useState(actual);
  useEffect(() => {
    const f = () => setE(actual);
    window.addEventListener(EVENTO, f);
    f();
    return () => window.removeEventListener(EVENTO, f);
  }, []);
  return e;
}

export function agregarTarjeta(datos: { rama: Rama; texto: string; origen: Origen; pendienteId?: string | null }): string {
  const id = nuevoId();
  const t: Tarjeta = { id, rama: datos.rama, texto: datos.texto.trim(), origen: datos.origen, estado: 'hipotesis', evidencias: [], pendienteId: datos.pendienteId ?? null, ciclo, creada: new Date().toISOString() };
  cambiar({ ...actual, tarjetas: [...actual.tarjetas, t] });
  registrarEvento('espina_tarjeta', { rama: t.rama, origen: t.origen });
  return id;
}

export function actualizarTarjeta(id: string, cambios: Partial<Pick<Tarjeta, 'texto' | 'rama' | 'origen' | 'estado'>>) {
  cambiar({
    ...actual,
    tarjetas: actual.tarjetas.map(t => {
      if (t.id !== id) return t;
      const sig = { ...t, ...cambios };
      // Solo una gráfica o cálculo de la pestaña Datos verifica una causa
      if (sig.estado === 'verificada' && sig.evidencias.length === 0) sig.estado = 'hipotesis';
      return sig;
    }),
  });
}

export function eliminarTarjeta(id: string) {
  cambiar({ ...actual, tarjetas: actual.tarjetas.filter(t => t.id !== id) });
}

export function agregarEvidencia(datos: Omit<Evidencia, 'id' | 'ciclo' | 'creada'>, tarjetaId?: string): string {
  const id = nuevoId();
  const ev: Evidencia = { ...datos, id, ciclo, creada: new Date().toISOString() };
  registrarEvento('evidencia', { herramienta: datos.herramienta, columna: datos.columna, verificacionId: datos.verificacionId, adjuntada: !!tarjetaId });
  cambiar({
    ...actual,
    evidencias: [...actual.evidencias, ev],
    tarjetas: tarjetaId ? actual.tarjetas.map(t => t.id === tarjetaId ? { ...t, evidencias: [...t.evidencias, id] } : t) : actual.tarjetas,
  });
  return id;
}

export function adjuntarEvidencia(tarjetaId: string, evidenciaId: string) {
  cambiar({ ...actual, tarjetas: actual.tarjetas.map(t => t.id === tarjetaId && !t.evidencias.includes(evidenciaId) ? { ...t, evidencias: [...t.evidencias, evidenciaId] } : t) });
}

export function quitarEvidencia(tarjetaId: string, evidenciaId: string) {
  cambiar({
    ...actual,
    tarjetas: actual.tarjetas.map(t => {
      if (t.id !== tarjetaId) return t;
      const evidencias = t.evidencias.filter(x => x !== evidenciaId);
      return { ...t, evidencias, estado: t.estado === 'verificada' && evidencias.length === 0 ? 'hipotesis' : t.estado };
    }),
  });
}

// Guarda de inmediato lo pendiente (por ejemplo, antes de votar)
async function guardarYa() {
  window.clearTimeout(temporizador);
  version++;
  actual = await api.partida.guardarEspina({ tarjetas: actual.tarjetas, evidencias: actual.evidencias });
}

export async function votar(causas: string[], porques: string[]) {
  await guardarYa();
  actual = await api.partida.votar(causas, porques);
  emitir();
}
