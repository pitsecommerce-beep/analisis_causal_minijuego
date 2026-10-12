import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let instancia: SupabaseClient | null = null;

export function obtenerSupabase(): SupabaseClient {
  if (instancia) return instancia;

  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en variables de entorno');
  }

  instancia = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return instancia;
}

// Cliente desechable para iniciar sesión o renovar tokens. signInWithPassword guarda la sesión
// en el cliente que lo llama; si fuera el compartido, sus consultas usarían el token del
// profesor (con RLS) en vez de la clave de servicio, y fallarían cuando ese token expire.
export function obtenerSupabaseAuth(): SupabaseClient {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'];

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en variables de entorno');
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function obtenerSupabaseAnon(): SupabaseClient {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_ANON_KEY'];

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en variables de entorno');
  }

  return createClient(url, key);
}
