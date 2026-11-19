const { Router } = require('express');

const authRoutes = require('./auth.routes');
const usuariosRoutes = require('./usuarios.routes');
const disponibilidadRoutes = require('./disponibilidad.routes');
const sesionesRoutes = require('./sesiones.routes');
const bitacoraRoutes = require('./bitacora.routes');
const logsRoutes = require('./logs.routes');
const notificacionesRoutes = require('./notificaciones.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/disponibilidad', disponibilidadRoutes);
router.use('/sesiones', sesionesRoutes);
router.use('/bitacora', bitacoraRoutes);
router.use('/logs', logsRoutes);
router.use('/notificaciones', notificacionesRoutes);

module.exports = router;
