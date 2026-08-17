const ProductoModel = require('../models/producto.models');
const { detalleError } = require('../utils/errorResponse');

const buscarProducto = async (req, res) => {
    try {
        const { busqueda } = req.params;
        const productos = await ProductoModel.buscarPorCodigoONombre(busqueda);

        if (productos.length === 0) {
            return res.status(404).json({ mensaje: 'Producto no encontrado' });
        }

        res.json(productos);

    } catch (error) {
        res.status(500).json({ error: 'Error al buscar el producto', detalle: detalleError(error) });
    }
}

const mostrarTodosLosProductos = async (req, res) => {
    try {
        const productos = await ProductoModel.mostrarTodosLosProductos();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al mostrar los productos', detalle: detalleError(error) });
    }
}

const registrarProducto = async (req, res) => {
    try {
        let { CodigoBarras, Nombre, Descripcion, PrecioCosto, PorcentajeIva, MargenGanancia, CategoriaId, Stock, StockMinimo } = req.body;

        // --- Validaciones ---
        // PrecioVenta ya NO se valida aquí: siempre lo calcula el backend a partir de
        // PrecioCosto (costo sin IVA) + MargenGanancia + PorcentajeIva.
        if (!Nombre || !PrecioCosto || !CategoriaId) {
            return res.status(400).json({ mensaje: 'Los campos Nombre, PrecioCosto (sin IVA) y CategoriaId son obligatorios.' });
        }

        // Generar código de barras si no se proporciona
        if (!CodigoBarras || CodigoBarras.trim() === '') {
            CodigoBarras = `BAR-${Math.floor(100000 + Math.random() * 900000)}`;
        }

        // Si el stock no viene, se asume que es 0
        const stockInicial = Stock !== undefined && !isNaN(parseInt(Stock)) ? parseInt(Stock) : 0;

        // Si el stock mínimo no viene, se asume un valor (ej. 5)
        const stockMinimoInicial = StockMinimo !== undefined && !isNaN(parseInt(StockMinimo)) ? parseInt(StockMinimo) : 5;

        const datosProducto = {
            CodigoBarras, Nombre, Descripcion, PrecioCosto,
            PorcentajeIva, MargenGanancia, CategoriaId,
            Stock: stockInicial, StockMinimo: stockMinimoInicial
        };

        const nuevoProducto = await ProductoModel.registrarProducto(datosProducto);

        res.status(201).json({ mensaje: 'Producto registrado con éxito', productoId: nuevoProducto.id, precioVenta: nuevoProducto.precioVenta });

    } catch (error) {
        console.error('Error en registrarProducto controller:', error);
        res.status(500).json({ error: 'Error al registrar el producto', detalle: detalleError(error) });
    }
}

const actualizarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const datosProducto = req.body;

        // Validación básica (PrecioVenta ya no se pide, se calcula en el backend)
        if (!datosProducto.Nombre || !datosProducto.PrecioCosto || !datosProducto.CategoriaId) {
            return res.status(400).json({ mensaje: 'Los campos Nombre, PrecioCosto (sin IVA) y CategoriaId son obligatorios.' });
        }

        const resultado = await ProductoModel.actualizarProducto(id, datosProducto);

        res.json({ mensaje: 'Producto actualizado con éxito', productoId: id, precioVenta: resultado.precioVenta });

    } catch (error) {
        console.error('Error en actualizarProducto controller:', error);
        res.status(500).json({ error: 'Error al actualizar el producto', detalle: detalleError(error) });
    }
}

const eliminarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        await ProductoModel.eliminarProducto(id);
        res.status(200).json({ mensaje: 'Producto eliminado con éxito' });
    } catch (error) {
        console.error('Error en eliminarProducto controller:', error);
        res.status(500).json({ error: 'Error al eliminar el producto', detalle: detalleError(error) });
    }
}



module.exports = { buscarProducto, mostrarTodosLosProductos, registrarProducto, actualizarProducto, eliminarProducto };