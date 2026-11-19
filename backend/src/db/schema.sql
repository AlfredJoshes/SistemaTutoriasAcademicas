-- Sistema Web de Gestion y Seguimiento de Tutorias Academicas entre Pares
-- Esquema clasico (sin ORM), PostgreSQL

DROP TABLE IF EXISTS notificaciones CASCADE;
DROP TABLE IF EXISTS logs_acceso CASCADE;
DROP TABLE IF EXISTS totp_codigos_respaldo CASCADE;
DROP TABLE IF EXISTS bitacora_sesion CASCADE;
DROP TABLE IF EXISTS sesiones CASCADE;
DROP TABLE IF EXISTS disponibilidad CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 1) Usuarios (tutores, estudiantes y coordinacion academica)
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    correo          VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('tutor', 'estudiante', 'coordinador')),
    area_apoyo      VARCHAR(150),          -- solo aplica a tutores (ej: "Metodologia", "Estadistica")
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Autenticador de segundo factor (TOTP, compatible con Google Authenticator)
    totp_secret      VARCHAR(255),          -- secreto base32 cifrado con AES-256-GCM
    totp_habilitado  BOOLEAN NOT NULL DEFAULT FALSE,
    totp_activado_en TIMESTAMPTZ
);

-- 2) Disponibilidad de los tutores
CREATE TABLE disponibilidad (
    id          SERIAL PRIMARY KEY,
    tutor_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    dia_semana  SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo ... 6=sabado
    hora_inicio TIME NOT NULL,
    hora_fin    TIME NOT NULL,
    CHECK (hora_fin > hora_inicio)
);

-- 3) Sesiones (fusiona solicitud + sesion en una sola tabla con estado)
CREATE TABLE sesiones (
    id              SERIAL PRIMARY KEY,
    estudiante_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tutor_id        INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha           DATE NOT NULL,
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    tema            VARCHAR(200),
    estado          VARCHAR(20) NOT NULL DEFAULT 'solicitada'
                    CHECK (estado IN ('solicitada', 'confirmada', 'rechazada', 'completada', 'cancelada')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (hora_fin > hora_inicio)
);

-- 4) Bitacora de cada sesion (asistencia + avance)
CREATE TABLE bitacora_sesion (
    id              SERIAL PRIMARY KEY,
    sesion_id       INTEGER NOT NULL UNIQUE REFERENCES sesiones(id) ON DELETE CASCADE,
    asistio         BOOLEAN NOT NULL DEFAULT TRUE,
    tema_avanzado   VARCHAR(200),
    notas           TEXT,
    registrado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Codigos de respaldo del autenticador (un solo uso, hasheados con bcrypt)
CREATE TABLE totp_codigos_respaldo (
    id          SERIAL PRIMARY KEY,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    codigo_hash VARCHAR(255) NOT NULL,
    usado_en    TIMESTAMPTZ,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) Bitacora de accesos (auditoria de seguridad)
CREATE TABLE logs_acceso (
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
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7) Notificaciones internas de la plataforma
CREATE TABLE notificaciones (
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
    leida_en   TIMESTAMPTZ,
    creada_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disponibilidad_tutor ON disponibilidad(tutor_id);
CREATE INDEX idx_sesiones_tutor ON sesiones(tutor_id);
CREATE INDEX idx_sesiones_estudiante ON sesiones(estudiante_id);
CREATE INDEX idx_respaldo_usuario ON totp_codigos_respaldo(usuario_id);
CREATE INDEX idx_logs_acceso_usuario ON logs_acceso(usuario_id);
CREATE INDEX idx_logs_acceso_fecha ON logs_acceso(creado_en DESC);
CREATE INDEX idx_logs_acceso_correo ON logs_acceso(correo_intento);
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leida_en, creada_en DESC);
