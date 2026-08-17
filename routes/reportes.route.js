const { Router } = require('express');
const {
    obtenerVentasPorPeriodo,
    obtenerVentasPorProducto,
    obtenerMargenes,
    obtenerKardex,
    obtenerStockBajo,
    obtenerBajaRotacion
} = require('../controllers/reporte.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);
router.use(verificarPermiso('reportes.ver'));

router.get('/ventas-periodo', obtenerVentasPorPeriodo);
router.get('/ventas-productos', obtenerVentasPorProducto);
router.get('/margenes', obtenerMargenes);
router.get('/kardex/:productoId', obtenerKardex);
router.get('/stock-bajo', obtenerStockBajo);
router.get('/baja-rotacion', obtenerBajaRotacion);

module.exports = router;
