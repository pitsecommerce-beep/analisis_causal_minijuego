-- ADENDA: modo experimento con telemetria, asesor algoritmico y consentimiento

-- Columnas nuevas en sesiones_juego para modo experimento
ALTER TABLE sesiones_juego
  ADD COLUMN IF NOT EXISTS modo_experimento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pct_tratamiento INTEGER DEFAULT 50
    CHECK (pct_tratamiento BETWEEN 0 AND 100);

-- Grupo asignado al jugador (control o tratamiento)
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS grupo VARCHAR(20) DEFAULT NULL
    CHECK (grupo IS NULL OR grupo IN ('control', 'tratamiento')),
  ADD COLUMN IF NOT EXISTS consentimiento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consentimiento_at TIMESTAMPTZ;

-- Tabla de telemetria: cada evento del jugador
CREATE TABLE IF NOT EXISTS telemetria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  jugador_id UUID NOT NULL REFERENCES jugadores(id) ON DELETE CASCADE,
  sesion_id UUID NOT NULL REFERENCES sesiones_juego(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,
  datos JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetria_partida ON telemetria(partida_id);
CREATE INDEX IF NOT EXISTS idx_telemetria_sesion ON telemetria(sesion_id);
CREATE INDEX IF NOT EXISTS idx_telemetria_tipo ON telemetria(tipo);

ALTER TABLE telemetria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_bypass_telemetria" ON telemetria
  FOR ALL USING (true) WITH CHECK (true);
