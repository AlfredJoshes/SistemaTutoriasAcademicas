const pool = require('../config/db');

async function listarTutoresConDisponibilidad() {
  const { rows: tutores } = await pool.query(
    `SELECT id, nombre_completo, correo, area_apoyo, creado_en 
     FROM usuarios 
     WHERE rol = 'tutor' 
     ORDER BY nombre_completo ASC`
  );

  const { rows: disponibilidad } = await pool.query(
    `SELECT id, tutor_id, dia_semana, hora_inicio, hora_fin 
     FROM disponibilidad 
     ORDER BY dia_semana ASC, hora_inicio ASC`
  );

  const tutoresConDisponibilidad = tutores.map((tutor) => ({
    ...tutor,
    disponibilidad: disponibilidad.filter((d) => d.tutor_id === tutor.id),
  }));

  return tutoresConDisponibilidad;
}

async function obtenerPerfilUsuario(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, nombre_completo, correo, rol, area_apoyo, creado_en 
     FROM usuarios 
     WHERE id = $1`,
    [usuarioId]
  );

  if (rows.length === 0) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  return rows[0];
}

module.exports = {
  listarTutoresConDisponibilidad,
  obtenerPerfilUsuario,
};
