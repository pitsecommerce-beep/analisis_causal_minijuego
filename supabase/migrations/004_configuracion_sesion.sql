-- Configuración de la sesión: modo de juego, versión de la base, base original e idioma.
-- Los valores por defecto mantienen las sesiones existentes como modo completo en español.
ALTER TABLE sesiones_juego
  ADD COLUMN IF NOT EXISTS modo VARCHAR(20) NOT NULL DEFAULT 'completo'
    CHECK (modo IN ('completo', 'informativo')),
  ADD COLUMN IF NOT EXISTS version VARCHAR(20) NOT NULL DEFAULT 'extendida'
    CHECK (version IN ('extendida', 'original')),
  ADD COLUMN IF NOT EXISTS base CHAR(1) NOT NULL DEFAULT 'A'
    CHECK (base IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS idioma VARCHAR(2) NOT NULL DEFAULT 'es'
    CHECK (idioma IN ('es', 'en'));

-- Modo y versión van vinculados; la versión extendida solo existe sobre la base A
ALTER TABLE sesiones_juego DROP CONSTRAINT IF EXISTS sesiones_config_vinculada;
ALTER TABLE sesiones_juego ADD CONSTRAINT sesiones_config_vinculada CHECK (
  (modo = 'completo' AND version = 'extendida' AND base = 'A')
  OR (modo = 'informativo' AND version = 'original')
);

-- La configuración no se puede cambiar una vez creada la sesión
CREATE OR REPLACE FUNCTION bloquear_config_sesion() RETURNS trigger AS $$
BEGIN
  IF NEW.modo IS DISTINCT FROM OLD.modo OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.base IS DISTINCT FROM OLD.base OR NEW.idioma IS DISTINCT FROM OLD.idioma THEN
    RAISE EXCEPTION 'La configuración de la sesión no se puede cambiar';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_config_sesion ON sesiones_juego;
CREATE TRIGGER trg_bloquear_config_sesion BEFORE UPDATE ON sesiones_juego
  FOR EACH ROW EXECUTE FUNCTION bloquear_config_sesion();
