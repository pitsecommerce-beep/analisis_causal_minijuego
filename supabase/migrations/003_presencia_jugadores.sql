-- Presencia de jugadores: ultima vez que el navegador del participante reporto actividad
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_jugadores_actividad ON jugadores(sesion_id, ultima_actividad);
