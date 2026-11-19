-- Migracion: rol coordinador + notificaciones internas
-- Es idempotente: se puede ejecutar sobre una base de datos que ya tiene datos.
-- Uso: psql -U postgres -d tutorias_pares -f src/db/migration_coordinador_notificaciones.sql

-- 1) Tercer rol: coordinador academico (supervisa, no dicta ni solicita tutorias)
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
    CHECK (rol IN ('tutor', 'estudiante', 'coordinador'));

-- 2) Notificaciones internas de la plataforma
CREATE TABLE IF NOT EXISTS notificaciones (
    id         SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo       VARCHAR(40) NOT NULL CHECK (tipo IN (
                   'sesion_solicitada',
                   'sesion_confirmada',
                   'sesion_rechazada',
                   'sesion_cancelada',
                   'bitacora_registrada'
               )),
    mensaje    VARCHAR(255) NOT NULL,
    sesion_id  INTEGER REFERENCES sesiones(id) ON DELETE CASCADE,
    leida_en   TIMESTAMP,
    creada_en  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Consulta habitual: no leidas de un usuario, lo mas reciente primero
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario
    ON notificaciones(usuario_id, leida_en, creada_en DESC);
