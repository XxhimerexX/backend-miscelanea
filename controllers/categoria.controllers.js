const CategoriaModel = require("../models/categoria.model");
const { detalleError } = require('../utils/errorResponse');

const obtenerCategorias = async (req, res) => {
    try {
        const categorias = await CategoriaModel.obtenerCategorias();
        res.status(200).json(categorias);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener categorías', detalle: detalleError(error) });
    }
};

module.exports = { obtenerCategorias };