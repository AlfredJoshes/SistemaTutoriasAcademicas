const pool = require('../config/db');
const notificaciones = require('./notificaciones.service');
const { hhmm } = require('../utils/horarios');

const fechaCorta = (fecha) => {
  const iso = fecha instanceof Date ? fecha.toISOString().split('T')[0] : String(fecha);
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

async function registrarBitacora(tutorId, { sesion_id, asistio, tema_avanzado, notas }) {
  if (!sesion_id) {
    const error = new Error('El campo sesion_id es obligatorio');
    error.status = 400;
    throw error;
  }

  // Verificar que la sesión pertenezca al tutor autenticado
  const sesionQuery = await pool.query(
    'SELECT * FROM sesiones WHERE id = $1 AND tutor_id = $2',
    [sesion_id, tutorId]
  );

  if (sesionQuery.rows.length === 0) {
    const error = new Error('Sesión no encontrada o no pertenece al tutor autenticado');
    error.status = 404;
    throw error;
  }

  const asistioBool = asistio !== undefined ? Boolean(asistio) : true;

  // Insertar o actualizar la bitacora de forma 1:1
  const { rows } = await pool.query(
    `INSERT INTO bitacora_sesion (sesion_id, asistio, tema_avanzado, notas)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (sesion_id) DO UPDATE
       SET asistio = EXCLUDED.asistio,
           tema_avanzado = EXCLUDED.tema_avanzado,
           notas = EXCLUDED.notas,
           registrado_en = NOW()
     RETURNING *`,
    [sesion_id, asistioBool, tema_avanzado || null, notas || null]
  );

  // Requerimiento explicito: Marcar automáticamente la sesión como 'completada' al guardar bitácora
  await pool.query(
    `UPDATE sesiones SET estado = 'completada' WHERE id = $1`,
    [sesion_id]
  );

  // Avisar al estudiante de que su sesión quedó cerrada con bitácora
  const sesion = sesionQuery.rows[0];
  const { rows: tutor } = await pool.query('SELECT nombre_completo FROM usuarios WHERE id = $1', [
    tutorId,
  ]);
  await notificaciones.crear({
    usuario_id: sesion.estudiante_id,
    tipo: 'bitacora_registrada',
    sesion_id: sesion.id,
    mensaje: `${tutor[0]?.nombre_completo || 'Tu tutor'} registró la bitácora de la tutoría del ${fechaCorta(
      sesion.fecha
    )} (${hhmm(sesion.hora_inicio)}–${hhmm(sesion.hora_fin)}).`,
  });

  return rows[0];
}

/**
 * Resumen de seguimiento. Cada usuario ve sus propias cifras: el tutor las de
 * las sesiones que dictó, el estudiante las que recibió y la coordinación las
 * de toda la plataforma.
 */
async function obtenerResumenDashboard(usuario) {
  const { id, rol } = usuario;

  let filtro = '';
  const valores = [];

  if (rol === 'tutor') {
    valores.push(id);
    filtro = 'AND s.tutor_id = $1';
  } else if (rol === 'estudiante') {
    valores.push(id);
    filtro = 'AND s.estudiante_id = $1';
  }

  const { rows: totales } = await pool.query(
    `SELECT COUNT(*)::int AS sesiones_completadas,
            COALESCE(SUM(EXTRACT(EPOCH FROM (s.hora_fin - s.hora_inicio)) / 3600), 0)::float AS horas_totales
       FROM sesiones s
      WHERE s.estado = 'completada' ${filtro}`,
    valores
  );

  const { rows: temas } = await pool.query(
    `SELECT b.tema_avanzado, COUNT(*)::int AS veces
       FROM bitacora_sesion b
       JOIN sesiones s ON s.id = b.sesion_id
      WHERE b.tema_avanzado IS NOT NULL
        AND TRIM(b.tema_avanzado) != ''
        ${filtro}
      GROUP BY b.tema_avanzado
      ORDER BY veces DESC
      LIMIT 5`,
    valores
  );

  // Asistencia registrada en las bitácoras del alcance
  const { rows: asistencia } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE b.asistio)::int AS asistidas,
            COUNT(*)::int AS con_bitacora
       FROM bitacora_sesion b
       JOIN sesiones s ON s.id = b.sesion_id
      WHERE TRUE ${filtro}`,
    valores
  );

  // Sesiones aún abiertas, para saber qué queda por atender
  const { rows: pendientes } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE s.estado = 'solicitada')::int  AS solicitadas,
            COUNT(*) FILTER (WHERE s.estado = 'confirmada')::int  AS confirmadas
       FROM sesiones s
      WHERE TRUE ${filtro}`,
    valores
  );

  return {
    sesiones_completadas: totales[0].sesiones_completadas,
    horas_totales: totales[0].horas_totales,
    temas_frecuentes: temas,
    asistencia: asistencia[0],
    pendientes: pendientes[0],
    alcance: rol === 'coordinador' ? 'plataforma' : 'propio',
  };
}

module.exports = {
  registrarBitacora,
  obtenerResumenDashboard,
};
