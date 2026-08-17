const { Router } = require('express');
const {
    buscarProducto,
    mostrarTodosLosProductos,
    registrarProducto,
    actualizarProducto,
    eliminarProducto
} = require('../controllers/producto.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/:busqueda', verificarPermiso('productos.ver'), buscarProducto);
router.get('/', verificarPermiso('productos.ver'), mostrarTodosLosProductos);
router.post('/', verificarPermiso('productos.crear'), registrarProducto);
router.put('/:id', verificarPermiso('productos.editar'), actualizarProducto);
router.delete('/:id', verificarPermiso('productos.eliminar'), eliminarProducto);
module.exports = router;