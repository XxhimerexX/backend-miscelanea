const { Router } = require('express');
const { obtenerCategorias } = require('../controllers/categoria.controllers');

const router = Router();

// Ruta para mostrar todos los productos
router.get('/', obtenerCategorias);

module.exports = router;