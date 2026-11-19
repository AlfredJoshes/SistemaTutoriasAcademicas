const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listar, resumen, eventos } = require('../controllers/logs.controller');

const router = Router();

// Auditoría de seguridad y bitácora de accesos exclusiva para coordinación académica
router.use(requireAuth, requireRole('coordinador'));

router.get('/', listar);
router.get('/resumen', resumen);
router.get('/eventos', eventos);

module.exports = router;
