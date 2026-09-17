-- Esquema inicial para el simulador de analisis causal
-- Ejecutar en Supabase SQL Editor o via CLI

CREATE TABLE IF NOT EXISTS sesiones_juego (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(8) UNIQUE NOT NULL,
  profesor_id UUID NOT NULL REFERENCES auth.users(id),
  nombre VARCHAR(200) NOT NULL,
  estado VARCHAR(20) DEFAULT 'abierta'
    CHECK (estado IN ('abierta', 'en_curso', 'finalizada')),
  semilla INTEGER NOT NULL,
  max_jugadores INTEGER DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jugadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id UUID NOT NULL REFERENCES sesiones_juego(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  token VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sesion_id, nombre)
);

CREATE TABLE IF NOT EXISTS partidas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jugador_id UUID UNIQUE NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  sesion_id UUID NOT NULL REFERENCES sesiones_juego(id) ON DELETE CASCADE,
  estado JSONB NOT NULL DEFAULT '{}',
  estado_dialogo JSONB NOT NULL DEFAULT '{}',
  fase VARCHAR(30) DEFAULT 'esperando'
    CHECK (fase IN ('esperando', 'jugando', 'finalizada')),
  puntuacion INTEGER,
  desenlace_id VARCHAR(30),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verificaciones_jugador (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  verificacion_id VARCHAR(50) NOT NULL,
  herramienta VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partida_id, verificacion_id)
);

CREATE INDEX IF NOT EXISTS idx_jugadores_sesion ON jugadores(sesion_id);
CREATE INDEX IF NOT EXISTS idx_jugadores_token ON jugadores(token);
CREATE INDEX IF NOT EXISTS idx_partidas_sesion ON partidas(sesion_id);
CREATE INDEX IF NOT EXISTS idx_partidas_jugador ON partidas(jugador_id);
CREATE INDEX IF NOT EXISTS idx_verificaciones_partida ON verificaciones_jugador(partida_id);

ALTER TABLE sesiones_juego ENABLE ROW LEVEL SECURITY;
ALTER TABLE jugadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE verificaciones_jugador ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_bypass_sesiones" ON sesiones_juego
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bypass_jugadores" ON jugadores
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bypass_partidas" ON partidas
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bypass_verificaciones" ON verificaciones_jugador
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_partidas_updated
  BEFORE UPDATE ON partidas
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
