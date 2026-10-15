import type { Request, Response, NextFunction } from 'express';
import { obtenerSupabase } from '../db/supabase.js';
import { obtenerJugadorPorToken } from '../db/consultas.js';
import { esCorreoProfesor, MENSAJE_DOMINIO } from './dominio.js';
import { configDeSesion } from '../../compartido/configuracion.js';
import type { ConfigSesion } from '../../compartido/configuracion.js';

export interface RequestProfesor extends Request {
  profesorId: string;
}

export interface RequestJugador extends Request {
  jugador: {
    id: string;
    nombre: string;
    sesionId: string;
    sesionEstado: string;
    grupo: string | null;
    consentimiento: boolean;
    config: ConfigSesion;
  };
}

export async function autenticarProfesor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }

  const token = auth.slice(7);
  const sb = obtenerSupabase();
  const { data, error } = await sb.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Token inválido' });
    return;
  }
  // También bloquea cuentas creadas antes de la restricción de dominio
  if (!esCorreoProfesor(data.user.email)) {
    res.status(403).json({ error: MENSAJE_DOMINIO });
    return;
  }

  (req as RequestProfesor).profesorId = data.user.id;
  next();
}

export async function autenticarJugador(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' });
    return;
  }

  const token = auth.slice(7);

  try {
    const jugador = await obtenerJugadorPorToken(token);
    if (!jugador) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }

    const sesion = jugador.sesiones_juego as Record<string, unknown>;
    (req as RequestJugador).jugador = {
      id: jugador.id,
      nombre: jugador.nombre,
      sesionId: sesion.id as string,
      sesionEstado: sesion.estado as string,
      grupo: jugador.grupo ?? null,
      consentimiento: jugador.consentimiento ?? false,
      config: configDeSesion(sesion),
    };
    next();
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error de autenticación de jugador:`, err);
    res.status(500).json({ error: 'Error de autenticación' });
  }
}

// Las rutas de juego (decisiones, ciclos, votación y cierre) no existen en el modo informativo
export function soloModoCompleto(req: Request, res: Response, next: NextFunction): void {
  if ((req as RequestJugador).jugador?.config?.modo === 'informativo') {
    res.status(403).json({ error: 'Esta función no está disponible en esta sesión.', modoInformativo: true });
    return;
  }
  next();
}
