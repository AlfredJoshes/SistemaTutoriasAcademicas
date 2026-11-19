const crypto = require('crypto');
require('dotenv').config();

// El secreto TOTP es equivalente a una contraseña permanente: se guarda cifrado
// con AES-256-GCM y no en texto plano. La llave se deriva de TOTP_ENC_KEY
// (o de JWT_SECRET como respaldo, para no romper instalaciones existentes).
function obtenerLlave() {
  const base = process.env.TOTP_ENC_KEY || process.env.JWT_SECRET;
  if (!base) {
    throw new Error('Falta TOTP_ENC_KEY (o JWT_SECRET) en el archivo .env');
  }
  return crypto.createHash('sha256').update(String(base)).digest();
}

function cifrar(textoPlano) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', obtenerLlave(), iv);
  const cifrado = Buffer.concat([cipher.update(String(textoPlano), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato almacenado: iv.tag.datos (todo en base64url)
  return [iv.toString('base64url'), tag.toString('base64url'), cifrado.toString('base64url')].join('.');
}

function descifrar(valorGuardado) {
  const partes = String(valorGuardado || '').split('.');
  if (partes.length !== 3) {
    throw new Error('El secreto del autenticador está corrupto');
  }
  const [iv, tag, datos] = partes.map((p) => Buffer.from(p, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', obtenerLlave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
}

module.exports = { cifrar, descifrar };
