const { Router } = require('express');
const {
    buscarVentaParaDevolucion,
    crearDevolucion,
    obtenerDevoluciones,
    obtenerDevolucionPorId,
    autorizarDevolucion,
    rechazarDevolucion
} = require('../controllers/devolucion.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/', verificarPermiso('devoluciones.ver'), obtenerDevoluciones);
router.get('/buscar-venta/:numeroFactura', verificarPermiso('devoluciones.crear'), buscarVentaParaDevolucion);
router.get('/:id', verificarPermiso('devoluciones.ver'), obtenerDevolucionPorId);
router.post('/', verificarPermiso('devoluciones.crear'), crearDevolucion);
router.post('/:id/autorizar', verificarPermiso('devoluciones.autorizar'), autorizarDevolucion);
router.post('/:id/rechazar', verificarPermiso('devoluciones.autorizar'), rechazarDevolucion);

module.exports = router;
