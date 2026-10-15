import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { traductor, LOCALES } from '../compartido/i18n/index.js';
import type { Traductor } from '../compartido/i18n/index.js';
import { CONFIG_POR_DEFECTO, configDeSesion } from '../compartido/configuracion.js';
import type { ConfigSesion } from '../compartido/configuracion.js';
import { fijarLocale } from './analisis.js';

// El idioma lo define la sesión, no el navegador. Se guarda al unirse y se confirma al entrar al juego.
const CLAVE = 'configSesion';

function leerGuardada(): ConfigSesion {
  try {
    const t = localStorage.getItem(CLAVE);
    return t ? configDeSesion(JSON.parse(t)) : CONFIG_POR_DEFECTO;
  } catch {
    return CONFIG_POR_DEFECTO;
  }
}

interface ValorSesion { config: ConfigSesion; t: Traductor; fijarConfig: (c: Partial<ConfigSesion>) => void }

const inicial = leerGuardada();
fijarLocale(LOCALES[inicial.idioma]);
const Contexto = createContext<ValorSesion>({ config: inicial, t: traductor(inicial.idioma), fijarConfig: () => {} });

// configFija: para mostrar el contenido de otra sesión (por ejemplo, el profesor viendo un tablero) sin tocar la del navegador
export function ProveedorSesion({ children, configFija }: { children: ReactNode; configFija?: ConfigSesion }) {
  const [guardada, setConfig] = useState<ConfigSesion>(inicial);
  const config = configFija ?? guardada;
  const fijarConfig = useCallback((c: Partial<ConfigSesion>) => {
    setConfig(prev => {
      const nueva = configDeSesion({ ...prev, ...c });
      try { localStorage.setItem(CLAVE, JSON.stringify(nueva)); } catch { /* sin almacenamiento local */ }
      fijarLocale(LOCALES[nueva.idioma]);
      document.documentElement.lang = nueva.idioma;
      return nueva;
    });
  }, []);
  const valor = useMemo(() => ({ config, t: traductor(config.idioma), fijarConfig }), [config, fijarConfig]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useT(): Traductor {
  return useContext(Contexto).t;
}

export function useSesion(): ValorSesion {
  return useContext(Contexto);
}
