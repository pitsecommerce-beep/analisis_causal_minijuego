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

export function obtenerSupabaseAnon(): SupabaseClient {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_ANON_KEY'];

  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en variables de entorno');
  }

  return createClient(url, key);
}
