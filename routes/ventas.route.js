const { Router } = require('express');
const { 
    crearVenta,
    obtenerVentas,
    obtenerVentaPorId,
    anularVenta,
    generarTicketPDF
} = require('../controllers/venta.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken); // Middleware para verificar el token JWT

// Rutas GET para obtener ventas
router.get('/', verificarPermiso('ventas.ver'), obtenerVentas);
router.get('/:id', verificarPermiso('ventas.ver'), obtenerVentaPorId);
router.get('/ticket/:id', verificarPermiso('ventas.ver'), generarTicketPDF);

// Endpoint POST para registrar la venta y generar la factura
router.post('/', verificarPermiso('ventas.crear'), crearVenta);

// Endpoint DELETE para anular una venta
router.delete('/:id', verificarPermiso('ventas.anular'), anularVenta);

module.exports = router;