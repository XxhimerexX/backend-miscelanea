const DevolucionModel = require('../models/devolucion.models');
const { detalleError } = require('../utils/errorResponse');

const buscarVentaParaDevolucion = async (req, res) => {
    try {
        const { numeroFactura } = req.params;
        const venta = await DevolucionModel.buscarVentaParaDevolucion(numeroFactura);

        if (!venta) {
            return res.status(404).json({ mensaje: 'No se encontró ninguna factura con ese número.' });
        }

        res.status(200).json(venta);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar la venta', detalle: detalleError(error) });
    }
};

const crearDevolucion = async (req, res) => {
    try {
        const { ventaId, observaciones, items } = req.body;

        if (!ventaId) {
            return res.status(400).json({ mensaje: 'La venta de origen es obligatoria.' });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ mensaje: 'Debes indicar al menos una línea a devolver.' });
        }

        const resultado = await DevolucionModel.crear({
            ventaId,
            usuarioId: req.usuario.id,
            observaciones,
            items
        });

        res.status(201).json({ mensaje: 'Devolución registrada con éxito, queda pendiente de autorización.', ...resultado });
    } catch (error) {
        if (error.message.includes('no existe') || error.message.includes('no está activa') ||
            error.message.includes('inválida') || error.message.includes('inválido') ||
            error.message.includes('no pertenece') || error.message.includes('producto de reemplazo')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error en crearDevolucion controller:', error);
        res.status(500).json({ error: 'Error al registrar la devolución', detalle: detalleError(error) });
    }
};

const obtenerDevoluciones = async (req, res) => {
    try {
        const { estado, usuarioId, fechaInicio, fechaFin, motivo } = req.query;
        const devoluciones = await DevolucionModel.obtenerTodas({ estado, usuarioId, fechaInicio, fechaFin, motivo });
        res.status(200).json(devoluciones);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las devoluciones', detalle: detalleError(error) });
    }
};

const obtenerDevolucionPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const devolucion = await DevolucionModel.obtenerPorId(id);
        if (!devolucion) {
            return res.status(404).json({ mensaje: 'Devolución no encontrada' });
        }
        res.status(200).json(devolucion);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la devolución', detalle: detalleError(error) });
    }
};

const autorizarDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await DevolucionModel.autorizar(id, req.usuario.id);
        res.status(200).json({ mensaje: 'Devolución autorizada con éxito. Stock actualizado.', ...resultado });
    } catch (error) {
        if (error.message.includes('no existe') || error.message.includes('No se puede autorizar') ||
            error.message.includes('No se pudo autorizar') || error.message.includes('Stock insuficiente')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error en autorizarDevolucion controller:', error);
        res.status(500).json({ error: 'Error al autorizar la devolución', detalle: detalleError(error) });
    }
};

const rechazarDevolucion = async (req, res) => {
    try {
        const { id } = req.params;
        const devolucion = await DevolucionModel.obtenerPorId(id);
        if (!devolucion) {
            return res.status(404).json({ mensaje: 'Devolución no encontrada' });
        }
        await DevolucionModel.rechazar(id, req.usuario.id);
        res.status(200).json({ mensaje: 'Devolución rechazada.' });
    } catch (error) {
        if (error.message.includes('ya no está pendiente')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error al rechazar la devolución', detalle: detalleError(error) });
    }
};

module.exports = {
    buscarVentaParaDevolucion,
    crearDevolucion,
    obtenerDevoluciones,
    obtenerDevolucionPorId,
    autorizarDevolucion,
    rechazarDevolucion
};
