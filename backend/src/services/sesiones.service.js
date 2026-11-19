const pool = require('../config/db');
const { franjaQueContiene } = require('./disponibilidad.service');
const notificaciones = require('./notificaciones.service');
const {
  hhmm,
  validarFecha,
  esHoy,
  esFechaPasada,
  minutosAhora,
  aMinutos,
} = require('../utils/horarios');

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Fecha corta para el texto de las notificaciones
const fechaCorta = (fecha) => {
  const iso = fecha instanceof Date ? fecha.toISOString().split('T')[0] : String(fecha);
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

async function solicitarSesion(estudianteId, { tutor_id, fecha, hora_inicio, hora_fin, tema }) {
  if (!tutor_id || !fecha || !hora_inicio || !hora_fin) {
    const error = new Error('Los campos tutor_id, fecha, hora_inicio y hora_fin son obligatorios');
    error.status = 400;
    throw error;
  }

  validarFecha(fecha);

  if (hora_inicio >= hora_fin) {
    const error = new Error('hora_fin debe ser posterior a hora_inicio');
    error.status = 400;
    throw error;
  }

  // No se agendan tutorías en el pasado
  if (esFechaPasada(fecha)) {
    const error = new Error('No puedes solicitar una sesión en una fecha que ya pasó');
    error.status = 400;
    throw error;
  }

  if (esHoy(fecha) && aMinutos(hora_inicio) <= minutosAhora()) {
    const error = new Error('La hora de inicio ya pasó. Elige un horario posterior.');
    error.status = 400;
    throw error;
  }

  // Validar existencia del tutor
  const tutorCheck = await pool.query(
    `SELECT id, nombre_completo FROM usuarios WHERE id = $1 AND rol = 'tutor'`,
    [tutor_id]
  );
  if (tutorCheck.rows.length === 0) {
    const error = new Error('El tutor especificado no existe o no tiene rol de tutor');
    error.status = 404;
    throw error;
  }

  // El horario pedido debe caer dentro de una franja publicada por el tutor
  const franja = await franjaQueContiene(tutor_id, fecha, hora_inicio, hora_fin);
  if (!franja) {
    const { rows: franjasDia } = await pool.query(
      `SELECT hora_inicio, hora_fin
         FROM disponibilidad
        WHERE tutor_id = $1 AND dia_semana = EXTRACT(DOW FROM $2::date)
        ORDER BY hora_inicio ASC`,
      [tutor_id, fecha]
    );

    const detalle = franjasDia.length
      ? `Ese día atiende de ${franjasDia
          .map((f) => `${hhmm(f.hora_inicio)} a ${hhmm(f.hora_fin)}`)
          .join(' y de ')}.`
      : 'El tutor no publicó horarios para ese día de la semana.';

    const error = new Error(
      `El horario solicitado está fuera de la disponibilidad del tutor. ${detalle}`
    );
    error.status = 409;
    throw error;
  }

  // Validacion de cruce de horarios usando el operador OVERLAPS de PostgreSQL
  const cruce = await pool.query(
    `SELECT id FROM sesiones
     WHERE tutor_id = $1
       AND fecha = $2
       AND estado IN ('solicitada', 'confirmada')
       AND (hora_inicio, hora_fin) OVERLAPS ($3::time, $4::time)`,
    [tutor_id, fecha, hora_inicio, hora_fin]
  );

  if (cruce.rows.length > 0) {
    const error = new Error('El tutor ya tiene una sesión agendada que se cruza en ese horario');
    error.status = 409;
    throw error;
  }

  const { rows } = await pool.query(
    `INSERT INTO sesiones (estudiante_id, tutor_id, fecha, hora_inicio, hora_fin, tema, estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'solicitada')
     RETURNING *`,
    [estudianteId, tutor_id, fecha, hora_inicio, hora_fin, tema || null]
  );

  const sesion = rows[0];

  // Avisar al tutor de la nueva solicitud
  const { rows: estudiante } = await pool.query(
    'SELECT nombre_completo FROM usuarios WHERE id = $1',
    [estudianteId]
  );
  await notificaciones.crear({
    usuario_id: tutor_id,
    tipo: 'sesion_solicitada',
    sesion_id: sesion.id,
    mensaje: `${estudiante[0]?.nombre_completo || 'Un estudiante'} solicitó una tutoría para el ${
      DIAS[new Date(`${fecha}T00:00:00`).getDay()]
    } ${fechaCorta(fecha)} de ${hhmm(hora_inicio)} a ${hhmm(hora_fin)}.`,
  });

  return sesion;
}

async function listarSesionesUsuario(usuarioId, rol) {
  const columna = rol === 'tutor' ? 'tutor_id' : 'estudiante_id';

  const { rows } = await pool.query(
    `SELECT s.*,
            e.nombre_completo AS estudiante_nombre,
            e.correo AS estudiante_correo,
            t.nombre_completo AS tutor_nombre,
            t.correo AS tutor_correo,
            t.area_apoyo AS tutor_area_apoyo,
            b.id AS bitacora_id,
            b.asistio AS bitacora_asistio,
            b.tema_avanzado AS bitacora_tema_avanzado,
            b.notas AS bitacora_notas
     FROM sesiones s
     JOIN usuarios e ON e.id = s.estudiante_id
     JOIN usuarios t ON t.id = s.tutor_id
     LEFT JOIN bitacora_sesion b ON b.sesion_id = s.id
     WHERE s.${columna} = $1
     ORDER BY s.fecha DESC, s.hora_inicio DESC`,
    [usuarioId]
  );

  return rows;
}

async function actualizarEstadoSesion(sesionId, usuario, estado) {
  const { id: usuarioId, rol } = usuario;

  if (!estado) {
    const error = new Error('El campo estado es obligatorio');
    error.status = 400;
    throw error;
  }

  // Regla de negocio: El estado 'completada' está reservado para la bitácora
  if (estado === 'completada') {
    const error = new Error("El estado 'completada' no puede ser asignado desde este endpoint. Se asigna automáticamente al registrar la bitácora (POST /api/bitacora).");
    error.status = 403;
    throw error;
  }

  // Validaciones de rol y estados permitidos por rol
  if (rol === 'tutor') {
    if (!['confirmada', 'rechazada'].includes(estado)) {
      const error = new Error("Como tutor solo tienes permiso para cambiar el estado de una sesión a 'confirmada' o 'rechazada'.");
      error.status = 403;
      throw error;
    }
  } else if (rol === 'estudiante') {
    if (estado !== 'cancelada') {
      const error = new Error("Como estudiante solo tienes permiso para cambiar el estado de una sesión a 'cancelada'.");
      error.status = 403;
      throw error;
    }
  } else {
    const error = new Error('Rol no autorizado para modificar el estado de sesiones.');
    error.status = 403;
    throw error;
  }

  // Verificar existencia de la sesión
  const sesionQuery = await pool.query('SELECT * FROM sesiones WHERE id = $1', [sesionId]);
  if (sesionQuery.rows.length === 0) {
    const error = new Error('Sesión no encontrada');
    error.status = 404;
    throw error;
  }

  const sesion = sesionQuery.rows[0];

  // Validar pertenencia a la sesión según el rol
  if (rol === 'tutor' && sesion.tutor_id !== usuarioId) {
    const error = new Error('No tienes permiso para modificar esta sesión porque no eres el tutor asignado.');
    error.status = 403;
    throw error;
  }

  if (rol === 'estudiante' && sesion.estudiante_id !== usuarioId) {
    const error = new Error('No tienes permiso para modificar esta sesión porque no eres el estudiante solicitante.');
    error.status = 403;
    throw error;
  }

  // Actualizar el estado
  const { rows } = await pool.query(
    `UPDATE sesiones SET estado = $1 WHERE id = $2 RETURNING *`,
    [estado, sesionId]
  );

  const actualizada = rows[0];

  // Avisar a la contraparte: el tutor decide, el estudiante cancela
  const { rows: personas } = await pool.query(
    `SELECT e.nombre_completo AS estudiante, t.nombre_completo AS tutor
       FROM sesiones s
       JOIN usuarios e ON e.id = s.estudiante_id
       JOIN usuarios t ON t.id = s.tutor_id
      WHERE s.id = $1`,
    [sesionId]
  );
  const cuando = `${fechaCorta(actualizada.fecha)} de ${hhmm(actualizada.hora_inicio)} a ${hhmm(
    actualizada.hora_fin
  )}`;

  if (estado === 'cancelada') {
    await notificaciones.crear({
      usuario_id: actualizada.tutor_id,
      tipo: 'sesion_cancelada',
      sesion_id: actualizada.id,
      mensaje: `${personas[0]?.estudiante || 'El estudiante'} canceló la tutoría del ${cuando}.`,
    });
  } else {
    await notificaciones.crear({
      usuario_id: actualizada.estudiante_id,
      tipo: estado === 'confirmada' ? 'sesion_confirmada' : 'sesion_rechazada',
      sesion_id: actualizada.id,
      mensaje: `${personas[0]?.tutor || 'El tutor'} ${
        estado === 'confirmada' ? 'confirmó' : 'rechazó'
      } tu tutoría del ${cuando}.`,
    });
  }

  return actualizada;
}

module.exports = {
  solicitarSesion,
  listarSesionesUsuario,
  actualizarEstadoSesion,
};
