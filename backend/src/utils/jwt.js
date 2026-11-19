const jwt = require('jsonwebtoken');
require('dotenv').config();

// Token definitivo: da acceso a toda la API
function generarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      rol: usuario.rol,
      correo: usuario.correo,
      nombre_completo: usuario.nombre_completo,
      tipo: 'acceso',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// Token parcial: solo sirve para completar el segundo factor en /auth/2fa/verificar
function generarTokenParcial(usuario) {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, tipo: '2fa_pendiente' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_2FA_EXPIRES_IN || '5m' }
  );
}

function verificarToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Solo acepta el token parcial emitido tras validar la contraseña
function verificarTokenParcial(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.tipo !== '2fa_pendiente') {
    const error = new Error('Token de verificación inválido');
    error.status = 401;
    throw error;
  }
  return payload;
}

module.exports = { generarToken, generarTokenParcial, verificarToken, verificarTokenParcial };
