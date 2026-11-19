const { verificarToken } = require('../utils/jwt');
const logs = require('../services/logs.service');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logs.registrar(req, {
      evento: 'acceso_denegado',
      exito: false,
      detalle: `Petición sin token: ${req.method} ${req.originalUrl}`,
    });
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  let payload;
  try {
    const token = header.split(' ')[1];
    payload = verificarToken(token);
  } catch (err) {
    logs.registrar(req, {
      evento: 'acceso_denegado',
      exito: false,
      detalle: `Token inválido o expirado: ${req.method} ${req.originalUrl}`,
    });
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }

  // El token parcial del segundo factor no habilita el resto de la API
  if (payload.tipo === '2fa_pendiente') {
    logs.registrar(req, {
      usuario_id: payload.id,
      evento: 'acceso_denegado',
      exito: false,
      detalle: `Token de 2FA pendiente usado en ${req.method} ${req.originalUrl}`,
    });
    return res.status(401).json({ error: 'Debes completar la verificación en dos pasos' });
  }

  req.usuario = payload;
  return next();
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      logs.registrar(req, {
        usuario_id: req.usuario?.id,
        correo: req.usuario?.correo,
        evento: 'acceso_denegado',
        exito: false,
        detalle: `Rol ${req.usuario?.rol || 'desconocido'} sin permiso para ${req.method} ${req.originalUrl}`,
      });
      return res.status(403).json({ error: 'No tienes permiso para esta accion' });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
