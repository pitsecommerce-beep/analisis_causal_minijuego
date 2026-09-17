import type { Request, Response, NextFunction } from 'express';
import { obtenerSupabase } from '../db/supabase.js';
import { obtenerJugadorPorToken } from '../db/consultas.js';

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
    res.status(401).json({ error: 'Token invalido' });
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
      res.status(401).json({ error: 'Token invalido' });
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
    };
    next();
  } catch {
    res.status(500).json({ error: 'Error de autenticacion' });
  }
}
