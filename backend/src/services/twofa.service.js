const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { generateSecret, generateURI, verify } = require('otplib');

const pool = require('../config/db');
const { cifrar, descifrar } = require('../utils/cifrado');
const { generarToken, verificarTokenParcial } = require('../utils/jwt');
const logs = require('./logs.service');

const EMISOR = process.env.TOTP_ISSUER || 'Tutorias Pares USB';
// Tolerancia de 30 s: acepta tambien el codigo de la ventana anterior, para
// cubrir relojes ligeramente desfasados entre el telefono y el servidor.
const TOLERANCIA_SEGUNDOS = 30;
const CANTIDAD_CODIGOS_RESPALDO = 8;

function errorHttp(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

async function obtenerUsuario(usuarioId) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [usuarioId]);
  if (rows.length === 0) throw errorHttp('Usuario no encontrado', 404);
  return rows[0];
}

function normalizarCodigo(codigo) {
  return String(codigo || '').replace(/[\s-]/g, '').toUpperCase();
}

// Genera codigos legibles del tipo 7K4M-9QX2, sin caracteres ambiguos
function generarCodigosRespaldo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigos = [];
  for (let i = 0; i < CANTIDAD_CODIGOS_RESPALDO; i += 1) {
    const bytes = crypto.randomBytes(8);
    const letras = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
    codigos.push(`${letras.slice(0, 4)}-${letras.slice(4, 8)}`);
  }
  return codigos;
}

async function guardarCodigosRespaldo(usuarioId, codigos) {
  await pool.query('DELETE FROM totp_codigos_respaldo WHERE usuario_id = $1', [usuarioId]);
  for (const codigo of codigos) {
    const hash = await bcrypt.hash(normalizarCodigo(codigo), 10);
    await pool.query(
      'INSERT INTO totp_codigos_respaldo (usuario_id, codigo_hash) VALUES ($1, $2)',
      [usuarioId, hash]
    );
  }
}

// Consume un codigo de respaldo si coincide con alguno sin usar
async function consumirCodigoRespaldo(usuarioId, codigo) {
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) return false;

  const { rows } = await pool.query(
    'SELECT id, codigo_hash FROM totp_codigos_respaldo WHERE usuario_id = $1 AND usado_en IS NULL',
    [usuarioId]
  );

  for (const fila of rows) {
    if (await bcrypt.compare(normalizado, fila.codigo_hash)) {
      await pool.query('UPDATE totp_codigos_respaldo SET usado_en = NOW() WHERE id = $1', [fila.id]);
      return true;
    }
  }
  return false;
}

async function validarCodigoTotp(secretoCifrado, codigo) {
  if (!secretoCifrado) return false;
  const limpio = normalizarCodigo(codigo);
  if (!/^\d{6}$/.test(limpio)) return false;

  const resultado = await verify({
    secret: descifrar(secretoCifrado),
    token: limpio,
    epochTolerance: TOLERANCIA_SEGUNDOS,
  });
  return Boolean(resultado.valid);
}

/** Estado del autenticador para la pantalla de seguridad */
async function obtenerEstado(usuarioId) {
  const usuario = await obtenerUsuario(usuarioId);
  const { rows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE usado_en IS NULL)::int AS disponibles,
            COUNT(*)::int AS total
       FROM totp_codigos_respaldo WHERE usuario_id = $1`,
    [usuarioId]
  );

  return {
    habilitado: usuario.totp_habilitado,
    configuracion_pendiente: !usuario.totp_habilitado && Boolean(usuario.totp_secret),
    activado_en: usuario.totp_activado_en,
    codigos_respaldo_disponibles: rows[0].disponibles,
    codigos_respaldo_total: rows[0].total,
  };
}

/**
 * Paso 1 de la activacion: genera un secreto nuevo y el QR para escanear.
 * El secreto queda guardado pero inactivo hasta que se confirme con un codigo.
 */
async function iniciarConfiguracion(usuarioId) {
  const usuario = await obtenerUsuario(usuarioId);
  if (usuario.totp_habilitado) {
    throw errorHttp('El autenticador ya está activo en esta cuenta', 409);
  }

  const secreto = generateSecret();
  const uri = generateURI({ issuer: EMISOR, label: usuario.correo, secret: secreto });

  await pool.query('UPDATE usuarios SET totp_secret = $1, totp_habilitado = FALSE WHERE id = $2', [
    cifrar(secreto),
    usuarioId,
  ]);

  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

  return { secreto, uri, qr };
}

/** Paso 2 de la activacion: confirma con un codigo y entrega los codigos de respaldo */
async function confirmarActivacion(req, usuarioId, codigo) {
  const usuario = await obtenerUsuario(usuarioId);

  if (usuario.totp_habilitado) {
    throw errorHttp('El autenticador ya está activo en esta cuenta', 409);
  }
  if (!usuario.totp_secret) {
    throw errorHttp('Primero genera el código QR de configuración', 400);
  }
  if (!codigo) {
    throw errorHttp('Ingresa el código de 6 dígitos de tu aplicación', 400);
  }

  if (!(await validarCodigoTotp(usuario.totp_secret, codigo))) {
    await logs.registrar(req, {
      usuario_id: usuarioId,
      correo: usuario.correo,
      evento: '2fa_fallido',
      exito: false,
      detalle: 'Código incorrecto al activar el autenticador',
    });
    throw errorHttp(
      'El código no es válido. Revisa la hora de tu teléfono e inténtalo de nuevo.',
      401
    );
  }

  await pool.query(
    'UPDATE usuarios SET totp_habilitado = TRUE, totp_activado_en = NOW() WHERE id = $1',
    [usuarioId]
  );

  const codigosRespaldo = generarCodigosRespaldo();
  await guardarCodigosRespaldo(usuarioId, codigosRespaldo);

  await logs.registrar(req, {
    usuario_id: usuarioId,
    correo: usuario.correo,
    evento: '2fa_activado',
    exito: true,
    detalle: 'Autenticador TOTP activado',
  });

  // Los codigos se muestran una unica vez: en la base solo queda su hash
  return { habilitado: true, codigos_respaldo: codigosRespaldo };
}

/** Desactiva el autenticador. Exige contraseña y un codigo vigente. */
async function desactivar(req, usuarioId, { password, codigo }) {
  const usuario = await obtenerUsuario(usuarioId);

  if (!usuario.totp_habilitado) {
    throw errorHttp('El autenticador no está activo', 400);
  }
  if (!password) {
    throw errorHttp('Confirma tu contraseña para desactivar el autenticador', 400);
  }

  if (!(await bcrypt.compare(password, usuario.password_hash))) {
    await logs.registrar(req, {
      usuario_id: usuarioId,
      correo: usuario.correo,
      evento: 'acceso_denegado',
      exito: false,
      detalle: 'Contraseña incorrecta al desactivar el autenticador',
    });
    throw errorHttp('La contraseña no es correcta', 401);
  }

  const codigoValido =
    (await validarCodigoTotp(usuario.totp_secret, codigo)) ||
    (await consumirCodigoRespaldo(usuarioId, codigo));

  if (!codigoValido) {
    await logs.registrar(req, {
      usuario_id: usuarioId,
      correo: usuario.correo,
      evento: '2fa_fallido',
      exito: false,
      detalle: 'Código incorrecto al desactivar el autenticador',
    });
    throw errorHttp('El código del autenticador no es válido', 401);
  }

  await pool.query(
    'UPDATE usuarios SET totp_secret = NULL, totp_habilitado = FALSE, totp_activado_en = NULL WHERE id = $1',
    [usuarioId]
  );
  await pool.query('DELETE FROM totp_codigos_respaldo WHERE usuario_id = $1', [usuarioId]);

  await logs.registrar(req, {
    usuario_id: usuarioId,
    correo: usuario.correo,
    evento: '2fa_desactivado',
    exito: true,
    detalle: 'Autenticador TOTP desactivado',
  });

  return { habilitado: false };
}

/** Emite un juego nuevo de codigos de respaldo e invalida los anteriores */
async function regenerarCodigosRespaldo(req, usuarioId, { password }) {
  const usuario = await obtenerUsuario(usuarioId);

  if (!usuario.totp_habilitado) {
    throw errorHttp('El autenticador no está activo', 400);
  }
  if (!password || !(await bcrypt.compare(password, usuario.password_hash))) {
    throw errorHttp('Confirma tu contraseña para generar códigos nuevos', 401);
  }

  const codigos = generarCodigosRespaldo();
  await guardarCodigosRespaldo(usuarioId, codigos);

  await logs.registrar(req, {
    usuario_id: usuarioId,
    correo: usuario.correo,
    evento: '2fa_activado',
    exito: true,
    detalle: 'Códigos de respaldo regenerados',
  });

  return { codigos_respaldo: codigos };
}

/**
 * Paso 2 del login: valida el codigo del autenticador (o uno de respaldo)
 * usando el token parcial y devuelve el token definitivo.
 */
async function verificarSegundoFactor(req, { token_temporal, codigo }) {
  if (!token_temporal) throw errorHttp('Falta el token de verificación', 400);
  if (!codigo) throw errorHttp('Ingresa el código del autenticador', 400);

  let payload;
  try {
    payload = verificarTokenParcial(token_temporal);
  } catch (err) {
    await logs.registrar(req, {
      evento: 'acceso_denegado',
      exito: false,
      detalle: 'Token de verificación 2FA inválido o expirado',
    });
    throw errorHttp('La verificación expiró. Inicia sesión de nuevo.', 401);
  }

  const usuario = await obtenerUsuario(payload.id);
  if (!usuario.totp_habilitado || !usuario.totp_secret) {
    throw errorHttp('Esta cuenta no tiene el autenticador activo', 400);
  }

  try {
    await logs.verificarBloqueo2fa(usuario.id);
  } catch (err) {
    await logs.registrar(req, {
      usuario_id: usuario.id,
      correo: usuario.correo,
      evento: 'bloqueo_temporal',
      exito: false,
      detalle: err.message,
    });
    throw err;
  }

  if (await validarCodigoTotp(usuario.totp_secret, codigo)) {
    await logs.registrar(req, {
      usuario_id: usuario.id,
      correo: usuario.correo,
      evento: '2fa_exitoso',
      exito: true,
      detalle: 'Código del autenticador correcto',
    });
  } else if (await consumirCodigoRespaldo(usuario.id, codigo)) {
    await logs.registrar(req, {
      usuario_id: usuario.id,
      correo: usuario.correo,
      evento: 'codigo_respaldo_usado',
      exito: true,
      detalle: 'Acceso con código de respaldo',
    });
  } else {
    await logs.registrar(req, {
      usuario_id: usuario.id,
      correo: usuario.correo,
      evento: '2fa_fallido',
      exito: false,
      detalle: 'Código del autenticador incorrecto',
    });
    throw errorHttp('El código no es válido o ya fue utilizado', 401);
  }

  const token = generarToken(usuario);

  await logs.registrar(req, {
    usuario_id: usuario.id,
    correo: usuario.correo,
    evento: 'login_exitoso',
    exito: true,
    detalle: 'Acceso completado con segundo factor',
  });

  delete usuario.password_hash;
  delete usuario.totp_secret;

  return { usuario, token };
}

module.exports = {
  obtenerEstado,
  iniciarConfiguracion,
  confirmarActivacion,
  desactivar,
  regenerarCodigosRespaldo,
  verificarSegundoFactor,
};
