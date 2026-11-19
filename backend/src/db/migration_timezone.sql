-- Migracion: Manejo integral de zonas horarias (America/La_Paz, UTC-4)
-- Convierte columnas TIMESTAMP a TIMESTAMPTZ para garantizar serializacion ISO UTC estandar y soporte preciso de hora local.

ALTER TABLE usuarios 
    ALTER COLUMN creado_en TYPE TIMESTAMPTZ USING creado_en AT TIME ZONE 'UTC',
    ALTER COLUMN totp_activado_en TYPE TIMESTAMPTZ USING totp_activado_en AT TIME ZONE 'UTC';

ALTER TABLE sesiones 
    ALTER COLUMN creado_en TYPE TIMESTAMPTZ USING creado_en AT TIME ZONE 'UTC';

ALTER TABLE bitacora_sesion 
    ALTER COLUMN registrado_en TYPE TIMESTAMPTZ USING registrado_en AT TIME ZONE 'UTC';

ALTER TABLE totp_codigos_respaldo 
    ALTER COLUMN usado_en TYPE TIMESTAMPTZ USING usado_en AT TIME ZONE 'UTC',
    ALTER COLUMN creado_en TYPE TIMESTAMPTZ USING creado_en AT TIME ZONE 'UTC';

ALTER TABLE logs_acceso 
    ALTER COLUMN creado_en TYPE TIMESTAMPTZ USING creado_en AT TIME ZONE 'UTC';

ALTER TABLE notificaciones 
    ALTER COLUMN leida_en TYPE TIMESTAMPTZ USING leida_en AT TIME ZONE 'UTC',
    ALTER COLUMN creada_en TYPE TIMESTAMPTZ USING creada_en AT TIME ZONE 'UTC';
