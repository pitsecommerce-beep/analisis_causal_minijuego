// Configuración que el profesor fija al crear la sesión. No cambia una vez creada.

export const MODOS = ['completo', 'informativo'] as const;
export const VERSIONES = ['extendida', 'original'] as const;
export const BASES = ['A', 'B'] as const;
export const IDIOMAS = ['es', 'en'] as const;

export type Modo = typeof MODOS[number];
export type Version = typeof VERSIONES[number];
export type Base = typeof BASES[number];
export type Idioma = typeof IDIOMAS[number];

export interface ConfigSesion {
  modo: Modo;
  version: Version;
  base: Base;
  idioma: Idioma;
}

// Las sesiones creadas antes de la migración 004 no tienen columnas: se leen con estos valores
export const CONFIG_POR_DEFECTO: ConfigSesion = { modo: 'completo', version: 'extendida', base: 'A', idioma: 'es' };

export type ClaveDatos = 'R2' | 'A_es' | 'A_en' | 'B_es' | 'B_en';
export const CLAVES_DATOS: ClaveDatos[] = ['R2', 'A_es', 'A_en', 'B_es', 'B_en'];

const VERSION_DE_MODO: Record<Modo, Version> = { completo: 'extendida', informativo: 'original' };
const MODO_DE_VERSION: Record<Version, Modo> = { extendida: 'completo', original: 'informativo' };

// Ajusta la configuración tras cambiar un parámetro: modo y versión van juntos,
// y la base solo aplica a la versión original (R2 está construida sobre la geografía de A)
export function vincular(actual: ConfigSesion, cambio: Partial<ConfigSesion>): ConfigSesion {
  const c = { ...actual, ...cambio };
  if (cambio.modo) c.version = VERSION_DE_MODO[cambio.modo];
  else if (cambio.version) c.modo = MODO_DE_VERSION[cambio.version];
  if (c.version === 'extendida') c.base = 'A';
  return c;
}

export type ResultadoValidacion = { ok: true; config: ConfigSesion } | { ok: false; error: string };

// Valida lo que llega del panel del profesor. Los campos ausentes toman el valor por defecto
// de su vínculo, pero una combinación contradictoria se rechaza en lugar de corregirse.
export function validarConfig(entrada: Record<string, unknown> | null | undefined): ResultadoValidacion {
  const e = entrada ?? {};
  const leer = <T extends string>(campo: string, permitidos: readonly T[]): T | undefined | null => {
    const v = e[campo];
    if (v == null || v === '') return undefined;
    return (permitidos as readonly string[]).includes(String(v)) ? (v as T) : null;
  };
  const modo = leer('modo', MODOS);
  const version = leer('version', VERSIONES);
  const base = leer('base', BASES);
  const idioma = leer('idioma', IDIOMAS);
  if (modo === null) return { ok: false, error: 'Modo no válido' };
  if (version === null) return { ok: false, error: 'Versión no válida' };
  if (base === null) return { ok: false, error: 'Base no válida' };
  if (idioma === null) return { ok: false, error: 'Idioma no válido' };

  const m = modo ?? (version ? MODO_DE_VERSION[version] : CONFIG_POR_DEFECTO.modo);
  const v = version ?? VERSION_DE_MODO[m];
  if (VERSION_DE_MODO[m] !== v) {
    return { ok: false, error: 'El modo informativo usa la versión original y el modo completo usa la extendida' };
  }
  if (v === 'extendida' && base === 'B') {
    return { ok: false, error: 'La versión extendida solo existe sobre la base A' };
  }
  return { ok: true, config: { modo: m, version: v, base: base ?? 'A', idioma: idioma ?? CONFIG_POR_DEFECTO.idioma } };
}

// Lee la configuración de una fila de sesiones_juego, tolerando sesiones anteriores a la migración
export function configDeSesion(fila: Record<string, unknown> | null | undefined): ConfigSesion {
  const r = validarConfig({ modo: fila?.['modo'], version: fila?.['version'], base: fila?.['base'], idioma: fila?.['idioma'] });
  return r.ok ? r.config : CONFIG_POR_DEFECTO;
}

export function claveDatos(c: ConfigSesion): ClaveDatos {
  return c.version === 'extendida' ? 'R2' : `${c.base}_${c.idioma}`;
}
