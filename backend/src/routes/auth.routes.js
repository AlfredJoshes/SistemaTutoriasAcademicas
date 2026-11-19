const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { registrar, login, logout, perfil } = require('../controllers/auth.controller');
const twofa = require('../controllers/twofa.controller');

const router = Router();

router.post('/registro', registrar);
router.post('/login', login);
router.post('/logout', requireAuth, logout);
router.get('/perfil', requireAuth, perfil);

// Segundo factor (autenticador TOTP)
router.post('/2fa/verificar', twofa.verificar); // paso 2 del login, usa el token temporal
router.get('/2fa/estado', requireAuth, twofa.estado);
router.post('/2fa/configurar', requireAuth, twofa.configurar);
router.post('/2fa/activar', requireAuth, twofa.activar);
router.post('/2fa/desactivar', requireAuth, twofa.desactivar);
router.post('/2fa/codigos-respaldo', requireAuth, twofa.regenerarCodigos);

module.exports = router;
