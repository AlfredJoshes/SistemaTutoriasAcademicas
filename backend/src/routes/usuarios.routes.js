const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { listarTutores, obtenerPerfil } = require('../controllers/usuarios.controller');

const router = Router();

router.get('/tutores', requireAuth, listarTutores);
router.get('/perfil', requireAuth, obtenerPerfil);

module.exports = router;
