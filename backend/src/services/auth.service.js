const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generarToken, generarTokenParcial } = require('../utils/jwt');
const logs = require('./logs.service');

// Campos publicos del usuario: nunca se devuelven el hash ni el secreto TOTP
const CAMPOS_PUBLICOS = `id, nombre_completo, correo, rol, area_apoyo, creado_en,
                         totp_habilitado, totp_activado_en`;

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nombre_completo: usuario.nombre_completo,
    correo: usuario.correo,
    rol: usuario.rol,
    area_apoyo: usuario.area_apoyo,
    creado_en: usuario.creado_en,
    totp_habilitado: usuario.totp_habilitado,
    totp_activado_en: usuario.totp_activado_en,
  };
}

async function registrarUsuario(req, { nombre_completo, correo, password, rol, area_apoyo }) {
  if (!nombre_completo || !correo || !password || !rol) {
    const error = new Error('Faltan campos obligatorios');
    error.status = 400;
    throw error;
  }

  if (!['tutor', 'estudiante'].includes(rol)) {
    const error = new Error('Rol invalido. Debe ser tutor o estudiante');
    error.status = 400;
    throw error;
  }

  const existe = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
  if (existe.rows.length > 0) {
    const error = new Error('Ya existe un usuario registrado con ese correo');
    error.status = 409;
    throw error;
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    `INSERT INTO usuarios (nombre_completo, correo, password_hash, rol, area_apoyo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${CAMPOS_PUBLICOS}`,
    [nombre_completo, correo, password_hash, rol, area_apoyo || null]
  );

  const usuario = rows[0];
  const token = generarToken(usuario);

  await logs.registrar(req, {
    usuario_id: usuario.id,
    correo: usuario.correo,
    evento: 'registro',
    exito: true,
    detalle: `Cuenta creada con rol ${usuario.rol}`,
  });
  await logs.registrar(req, {
    usuario_id: usuario.id,
    correo: usuario.correo,
    evento: 'login_exitoso',
    exito: true,
    detalle: 'Acceso automático tras el registro',
  });

  return { usuario, token };
}

/**
 * Paso 1 del login. Si la cuenta tiene el autenticador activo NO se entrega el
 * token de acceso, sino un token parcial de corta vida para /auth/2fa/verificar.
 */
async function loginUsuario(req, { correo, password }) {
  if (!correo || !password) {
    const error = new Error('Correo y contraseña son obligatorios');
    error.status = 400;
    throw error;
  }

  // Corta los ataques de fuerza bruta contra un mismo correo
  try {
    await logs.verificarBloqueoLogin(correo);
  } catch (err) {
    await logs.registrar(req, {
      correo,
      evento: 'bloqueo_temporal',
      exito: false,
      detalle: err.message,
    });
    throw err;
  }

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);

  if (rows.length === 0) {
    await logs.registrar(req, {
      correo,
      evento: 'login_fallido',
      exito: false,
      detalle: 'El correo no está registrado',
    });
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  const usuario = rows[0];
  const passwordOk = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordOk) {
    await logs.registrar(req, {
      usuario_id: usuario.id,
      correo,
      evento: 'login_fallido',
      exito: false,
      detalle: 'Contraseña incorrecta',
    });
    const error = new Error('Credenciales invalidas');
    error.status = 401;
    throw error;
  }

  // Contraseña correcta: falta el segundo factor si la cuenta lo tiene activo
  if (usuario.totp_habilitado) {
    await logs.registrar(req, {
      usuario_id: usuario.id,
      correo,
      evento: '2fa_requerido',
      exito: true,
      detalle: 'Contraseña válida, se solicitó el código del autenticador',
    });

    return {
      requiere_2fa: true,
      token_temporal: generarTokenParcial(usuario),
      nombre_completo: usuario.nombre_completo,
    };
  }

  const token = generarToken(usuario);

  await logs.registrar(req, {
    usuario_id: usuario.id,
    correo,
    evento: 'login_exitoso',
    exito: true,
    detalle: 'Acceso con contraseña (sin segundo factor)',
  });

  return { usuario: usuarioPublico(usuario), token, requiere_2fa: false };
}

async function cerrarSesion(req, usuarioAutenticado) {
  await logs.registrar(req, {
    usuario_id: usuarioAutenticado.id,
    correo: usuarioAutenticado.correo || null,
    evento: 'logout',
    exito: true,
    detalle: 'Sesión cerrada por el usuario',
  });
  return { mensaje: 'Sesión cerrada' };
}

// Datos frescos del usuario autenticado (util tras activar o quitar el 2FA)
async function obtenerPerfil(usuarioId) {
  const { rows } = await pool.query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = $1`, [
    usuarioId,
  ]);
  if (rows.length === 0) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }
  return rows[0];
}

module.exports = {
  registrarUsuario,
  loginUsuario,
  cerrarSesion,
  obtenerPerfil,
};
