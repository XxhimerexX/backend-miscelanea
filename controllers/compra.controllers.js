const CompraModel = require('../models/compra.models');
const { detalleError } = require('../utils/errorResponse');

const crearOrden = async (req, res) => {
    try {
        const { proveedorId, fechaEsperada, observaciones, items } = req.body;

        if (!proveedorId) {
            return res.status(400).json({ mensaje: 'El proveedor es obligatorio.' });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ mensaje: 'No se puede registrar una orden de compra sin productos.' });
        }

        const datosOrden = {
            proveedorId,
            usuarioId: req.usuario.id,
            fechaEsperada,
            observaciones,
            items
        };

        const resultado = await CompraModel.registrarOrden(datosOrden);
        res.status(201).json({ mensaje: 'Orden de compra registrada con éxito', ...resultado });
    } catch (error) {
        if (error.message.includes('Ítem de orden inválido')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error en crearOrden controller:', error);
        res.status(500).json({ error: 'Error al registrar la orden de compra', detalle: detalleError(error) });
    }
};

const obtenerOrdenes = async (req, res) => {
    try {
        const { estado } = req.query;
        const ordenes = await CompraModel.obtenerTodas(estado);
        res.status(200).json(ordenes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las órdenes de compra', detalle: detalleError(error) });
    }
};

const obtenerOrdenPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const orden = await CompraModel.obtenerPorId(id);
        if (!orden) {
            return res.status(404).json({ mensaje: 'Orden de compra no encontrada' });
        }
        res.status(200).json(orden);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la orden de compra', detalle: detalleError(error) });
    }
};

const cancelarOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const orden = await CompraModel.obtenerPorId(id);
        if (!orden) {
            return res.status(404).json({ mensaje: 'Orden de compra no encontrada' });
        }
        await CompraModel.cancelar(id);
        res.status(200).json({ mensaje: 'Orden de compra cancelada con éxito' });
    } catch (error) {
        if (error.message.includes('ya está cancelada') || error.message.includes('ya fue recibida')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error al cancelar la orden de compra', detalle: detalleError(error) });
    }
};

const recibirOrden = async (req, res) => {
    try {
        const { id } = req.params;
        const { observaciones, items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ mensaje: 'Debes indicar al menos una línea recibida.' });
        }

        const datosRecepcion = {
            usuarioId: req.usuario.id,
            observaciones,
            items
        };

        const resultado = await CompraModel.registrarRecepcion(id, datosRecepcion);
        res.status(201).json({ mensaje: '¡Recepción registrada con éxito!', ...resultado });
    } catch (error) {
        if (error.message.includes('no existe') || error.message.includes('No se puede registrar recepción') ||
            error.message.includes('Cantidad recibida inválida') || error.message.includes('no pertenece') ||
            error.message.includes('Línea de recepción inválida')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error en recibirOrden controller:', error);
        res.status(500).json({ error: 'Error al registrar la recepción', detalle: detalleError(error) });
    }
};

module.exports = {
    crearOrden,
    obtenerOrdenes,
    obtenerOrdenPorId,
    cancelarOrden,
    recibirOrden
};
