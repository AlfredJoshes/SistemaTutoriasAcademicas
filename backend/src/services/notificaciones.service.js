const pool = require('../config/db');

const TIPOS = [
  'sesion_solicitada',
  'sesion_confirmada',
  'sesion_rechazada',
  'sesion_cancelada',
  'bitacora_registrada',
];

/**
 * Crea una notificacion para un usuario. Igual que la bitacora de accesos, es
 * best-effort: si falla no interrumpe la operacion que la origino.
 */
async function crear({ usuario_id, tipo, mensaje, sesion_id }) {
  try {
    if (!TIPOS.includes(tipo)) {
      throw new Error(`Tipo de notificación desconocido: ${tipo}`);
    }
    const { rows } = await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, mensaje, sesion_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [usuario_id, tipo, String(mensaje).slice(0, 255), sesion_id || null]
    );
    return rows[0];
  } catch (err) {
    console.error('No se pudo crear la notificación:', err.message);
    return null;
  }
}

async function listar(usuarioId, { solo_no_leidas, limite } = {}) {
  const tope = Math.min(Math.max(parseInt(limite, 10) || 20, 1), 100);
  const filtro = solo_no_leidas === true || solo_no_leidas === 'true' ? 'AND n.leida_en IS NULL' : '';

  const { rows } = await pool.query(
    `SELECT n.id, n.tipo, n.mensaje, n.sesion_id, n.leida_en, n.creada_en,
            s.fecha, s.hora_inicio, s.hora_fin, s.estado
       FROM notificaciones n
       LEFT JOIN sesiones s ON s.id = n.sesion_id
      WHERE n.usuario_id = $1 ${filtro}
      ORDER BY n.creada_en DESC, n.id DESC
      LIMIT $2`,
    [usuarioId, tope]
  );

  const { rows: conteo } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE leida_en IS NULL)::int AS no_leidas,
            COUNT(*)::int AS total
       FROM notificaciones WHERE usuario_id = $1`,
    [usuarioId]
  );

  return { notificaciones: rows, ...conteo[0] };
}

async function contarNoLeidas(usuarioId) {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS no_leidas FROM notificaciones WHERE usuario_id = $1 AND leida_en IS NULL',
    [usuarioId]
  );
  return rows[0];
}

async function marcarLeida(notificacionId, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE notificaciones
        SET leida_en = NOW()
      WHERE id = $1 AND usuario_id = $2 AND leida_en IS NULL
      RETURNING *`,
    [notificacionId, usuarioId]
  );

  if (rows.length === 0) {
    // Puede ser de otro usuario, no existir o ya estar leida
    const existe = await pool.query(
      'SELECT id FROM notificaciones WHERE id = $1 AND usuario_id = $2',
      [notificacionId, usuarioId]
    );
    if (existe.rows.length === 0) {
      const error = new Error('Notificación no encontrada');
      error.status = 404;
      throw error;
    }
  }

  return rows[0] || { id: Number(notificacionId), ya_leida: true };
}

async function marcarTodasLeidas(usuarioId) {
  const { rowCount } = await pool.query(
    'UPDATE notificaciones SET leida_en = NOW() WHERE usuario_id = $1 AND leida_en IS NULL',
    [usuarioId]
  );
  return { marcadas: rowCount };
}

module.exports = {
  TIPOS,
  crear,
  listar,
  contarNoLeidas,
  marcarLeida,
  marcarTodasLeidas,
};
