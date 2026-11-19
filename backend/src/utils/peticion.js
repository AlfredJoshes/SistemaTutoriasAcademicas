// Datos del cliente que se guardan en la bitacora de accesos
function obtenerIp(req) {
  const reenviada = req.headers['x-forwarded-for'];
  const ip = reenviada ? String(reenviada).split(',')[0].trim() : req.ip || req.socket?.remoteAddress;
  if (!ip) return null;
  // Normaliza el formato IPv6 con el que Node reporta las direcciones locales
  return ip.replace(/^::ffff:/, '').slice(0, 45);
}

function obtenerUserAgent(req) {
  const ua = req.headers['user-agent'];
  return ua ? String(ua).slice(0, 255) : null;
}

module.exports = { obtenerIp, obtenerUserAgent };
