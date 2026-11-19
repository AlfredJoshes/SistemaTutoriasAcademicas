-- Migracion: autenticador TOTP (segundo factor) + bitacora de accesos
-- Es idempotente: se puede ejecutar sobre una base de datos que ya tiene datos.
-- Uso: psql -U postgres -d tutorias_pares -f src/db/migration_autenticador_logs.sql

-- 1) Columnas del autenticador en usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_secret      VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_habilitado  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_activado_en TIMESTAMP;

-- 2) Codigos de respaldo de un solo uso (hasheados con bcrypt)
CREATE TABLE IF NOT EXISTS totp_codigos_respaldo (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash VARCHAR(255) NOT NULL,
    usado_en    TIMESTAMP,
    creado_en   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3) Bitacora de accesos (auditoria)
CREATE TABLE IF NOT EXISTS logs_acceso (
    id             SERIAL PRIMARY KEY,
    usuario_id     INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    correo_intento VARCHAR(150),          -- se guarda incluso si el usuario no existe
    evento         VARCHAR(40) NOT NULL CHECK (evento IN (
                       'registro',
                       'login_exitoso',
                       'login_fallido',
                       '2fa_requerido',
                       '2fa_exitoso',
                       '2fa_fallido',
                       '2fa_activado',
                       '2fa_desactivado',
                       'codigo_respaldo_usado',
                       'logout',
                       'acceso_denegado',
                       'bloqueo_temporal'
                   )),
    exito          BOOLEAN NOT NULL DEFAULT TRUE,
    ip             VARCHAR(45),
    user_agent     VARCHAR(255),
    detalle        VARCHAR(255),
    creado_en      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_acceso_usuario ON logs_acceso(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_acceso_fecha   ON logs_acceso(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_logs_acceso_correo  ON logs_acceso(correo_intento);
CREATE INDEX IF NOT EXISTS idx_respaldo_usuario    ON totp_codigos_respaldo(usuario_id);
