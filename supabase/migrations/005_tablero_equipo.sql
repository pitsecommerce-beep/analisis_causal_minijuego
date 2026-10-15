-- Tablero de cada equipo (un jugador por laptop): gráficos fijados y textos del A3
CREATE TABLE IF NOT EXISTS tableros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jugador_id UUID UNIQUE NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  sesion_id UUID NOT NULL REFERENCES sesiones_juego(id) ON DELETE CASCADE,
  contenido JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tableros_sesion ON tableros(sesion_id);

ALTER TABLE tableros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_bypass_tableros" ON tableros
  FOR ALL USING (true) WITH CHECK (true);
