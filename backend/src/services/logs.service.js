const pool = require('../config/db');
const { obtenerIp, obtenerUserAgent } = require('../utils/peticion');

const EVENTOS = [
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
  'bloqueo_temporal',
];

// Limites de intentos fallidos antes de bloquear temporalmente
const LIMITE_LOGIN = { intentos: 10, minutos: 15 };
const LIMITE_2FA = { intentos: 5, minutos: 10 };

/**
 * Registra un evento de acceso. Nunca lanza: una falla al auditar no debe
 * tumbar la peticion del usuario, solo se reporta en consola.
 */
async function registrar(req, { usuario_id, correo, evento, exito, detalle }) {
  try {
    await pool.query(
      `INSERT INTO logs_acceso (usuario_id, correo_intento, evento, exito, ip, user_agent, detalle)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        usuario_id || null,
        correo ? String(correo).toLowerCase().slice(0, 150) : null,
        evento,
        exito !== undefined ? Boolean(exito) : true,
        req ? obtenerIp(req) : null,
        req ? obtenerUserAgent(req) : null,
        detalle ? String(detalle).slice(0, 255) : null,
      ]
    );
  } catch (err) {
    console.error('No se pudo registrar el log de acceso:', err.message);
  }
}

// Cuenta eventos fallidos recientes para frenar ataques de fuerza bruta
async function contarIntentosRecientes({ correo, usuario_id, evento, minutos }) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM logs_acceso
      WHERE evento = $1
        AND exito = FALSE
        AND creado_en > NOW() - ($2 || ' minutes')::interval
        AND ((${correo ? 'correo_intento = $3' : 'usuario_id = $3'}))`,
    [evento, String(minutos), correo ? String(correo).toLowerCase() : usuario_id]
  );
  return rows[0].total;
}

async function verificarBloqueoLogin(correo) {
  const intentos = await contarIntentosRecientes({
    correo,
    evento: 'login_fallido',
    minutos: LIMITE_LOGIN.minutos,
  });
  if (intentos >= LIMITE_LOGIN.intentos) {
    const error = new Error(
      `Demasiados intentos fallidos. Espera ${LIMITE_LOGIN.minutos} minutos antes de volver a intentar.`
    );
    error.status = 429;
    error.bloqueo = true;
    throw error;
  }
}

async function verificarBloqueo2fa(usuarioId) {
  const intentos = await contarIntentosRecientes({
    usuario_id: usuarioId,
    evento: '2fa_fallido',
    minutos: LIMITE_2FA.minutos,
  });
  if (intentos >= LIMITE_2FA.intentos) {
    const error = new Error(
      `Demasiados códigos incorrectos. Espera ${LIMITE_2FA.minutos} minutos e inicia sesión de nuevo.`
    );
    error.status = 429;
    error.bloqueo = true;
    throw error;
  }
}

/**
 * Lista la bitacora con filtros y paginacion.
 * Cada usuario ve su propia actividad; solo la coordinacion academica puede
 * consultar la de todos los usuarios pasando alcance='todos'.
 */
async function listarLogs(solicitante, filtros = {}) {
  const { evento, exito, correo, desde, hasta, alcance } = filtros;

  const verTodos = solicitante.rol === 'coordinador' && alcance !== 'propio';

  const condiciones = [];
  const valores = [];

  if (!verTodos) {
    valores.push(solicitante.id);
    condiciones.push(`l.usuario_id = $${valores.length}`);
  }

  if (evento) {
    if (!EVENTOS.includes(evento)) {
      const error = new Error('Evento no válido');
      error.status = 400;
      throw error;
    }
    valores.push(evento);
    condiciones.push(`l.evento = $${valores.length}`);
  }

  if (exito !== undefined && exito !== '' && exito !== null) {
    valores.push(exito === true || exito === 'true');
    condiciones.push(`l.exito = $${valores.length}`);
  }

  if (correo) {
    valores.push(`%${String(correo).toLowerCase()}%`);
    condiciones.push(
      `(LOWER(l.correo_intento) LIKE $${valores.length} OR LOWER(u.correo) LIKE $${valores.length})`
    );
  }

  if (desde) {
    valores.push(desde);
    condiciones.push(`l.creado_en >= $${valores.length}::date`);
  }

  if (hasta) {
    valores.push(hasta);
    condiciones.push(`l.creado_en < ($${valores.length}::date + INTERVAL '1 day')`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const limite = Math.min(Math.max(parseInt(filtros.limite, 10) || 50, 1), 200);
  const pagina = Math.max(parseInt(filtros.pagina, 10) || 1, 1);
  const desplazamiento = (pagina - 1) * limite;

  const totalQuery = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM logs_acceso l
       LEFT JOIN usuarios u ON u.id = l.usuario_id
       ${where}`,
    valores
  );

  const { rows } = await pool.query(
    `SELECT l.id, l.usuario_id, l.correo_intento, l.evento, l.exito, l.ip,
            l.user_agent, l.detalle, l.creado_en,
            u.nombre_completo, u.rol, u.correo
       FROM logs_acceso l
       LEFT JOIN usuarios u ON u.id = l.usuario_id
       ${where}
      ORDER BY l.creado_en DESC, l.id DESC
      LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
    [...valores, limite, desplazamiento]
  );

  return {
    logs: rows,
    total: totalQuery.rows[0].total,
    pagina,
    limite,
    paginas: Math.max(Math.ceil(totalQuery.rows[0].total / limite), 1),
    alcance: verTodos ? 'todos' : 'propio',
  };
}

// Tarjetas de resumen para la pantalla de registros
async function resumenLogs(solicitante, filtros = {}) {
  const verTodos = solicitante.rol === 'coordinador' && filtros.alcance !== 'propio';
  const dias = Math.min(Math.max(parseInt(filtros.dias, 10) || 30, 1), 365);

  const valores = [String(dias)];
  let filtroUsuario = '';
  if (!verTodos) {
    valores.push(solicitante.id);
    filtroUsuario = `AND usuario_id = $2`;
  }

  const { rows } = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE evento = 'login_exitoso')::int  AS accesos_exitosos,
        COUNT(*) FILTER (WHERE evento = 'login_fallido')::int   AS accesos_fallidos,
        COUNT(*) FILTER (WHERE evento = '2fa_fallido')::int     AS codigos_fallidos,
        COUNT(*) FILTER (WHERE evento = 'bloqueo_temporal')::int AS bloqueos,
        COUNT(*)::int AS total_eventos,
        MAX(creado_en) FILTER (WHERE evento = 'login_exitoso')  AS ultimo_acceso
       FROM logs_acceso
      WHERE creado_en > NOW() - ($1 || ' days')::interval
      ${filtroUsuario}`,
    valores
  );

  return { ...rows[0], dias, alcance: verTodos ? 'todos' : 'propio' };
}

module.exports = {
  EVENTOS,
  registrar,
  listarLogs,
  resumenLogs,
  verificarBloqueoLogin,
  verificarBloqueo2fa,
};
