const ReporteModel = require('../models/reporte.model');
const { detalleError } = require('../utils/errorResponse');

function validarRangoFechas(req, res) {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
        res.status(400).json({ error: 'fechaInicio y fechaFin son obligatorios' });
        return null;
    }
    return { fechaInicio, fechaFin: `${fechaFin} 23:59:59` };
}

const obtenerVentasPorPeriodo = async (req, res) => {
    try {
        const rango = validarRangoFechas(req, res);
        if (!rango) return;

        const periodoValido = ['dia', 'semana', 'mes'].includes(req.query.periodo) ? req.query.periodo : 'dia';
        const datos = await ReporteModel.ventasPorPeriodo(periodoValido, rango.fechaInicio, rango.fechaFin);
        res.status(200).json({ periodo: periodoValido, datos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ventas por período', detalle: detalleError(error) });
    }
};

const obtenerVentasPorProducto = async (req, res) => {
    try {
        const rango = validarRangoFechas(req, res);
        if (!rango) return;

        const agruparPor = req.query.agruparPor === 'categoria' ? 'categoria' : 'producto';
        const datos = await ReporteModel.ventasPorProductoCategoria(rango.fechaInicio, rango.fechaFin, agruparPor);
        res.status(200).json({ agruparPor, datos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ventas por producto/categoría', detalle: detalleError(error) });
    }
};

const obtenerMargenes = async (req, res) => {
    try {
        const rango = validarRangoFechas(req, res);
        if (!rango) return;

        const agruparPor = req.query.agruparPor === 'categoria' ? 'categoria' : 'producto';
        const datos = await ReporteModel.margenes(rango.fechaInicio, rango.fechaFin, agruparPor);
        res.status(200).json({ agruparPor, datos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener márgenes de ganancia', detalle: detalleError(error) });
    }
};

const obtenerKardex = async (req, res) => {
    try {
        const productoId = parseInt(req.params.productoId, 10);
        if (!Number.isInteger(productoId)) {
            return res.status(400).json({ error: 'productoId inválido' });
        }
        const { fechaInicio, fechaFin } = req.query;
        const datos = await ReporteModel.kardex(
            productoId,
            fechaInicio || null,
            fechaFin ? `${fechaFin} 23:59:59` : null
        );
        res.status(200).json({ productoId, datos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener kardex del producto', detalle: detalleError(error) });
    }
};

const obtenerStockBajo = async (req, res) => {
    try {
        const datos = await ReporteModel.stockBajo();
        res.status(200).json({ datos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos con stock bajo', detalle: detalleError(error) });
    }
};

const obtenerBajaRotacion = async (req, res) => {
    try {
        const dias = parseInt(req.query.dias, 10);
        const diasValido = Number.isInteger(dias) && dias > 0 ? dias : 30;
        const datos = await ReporteModel.bajaRotacion(diasValido);
        res.status(200).json({ dias: diasValido, datos });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos de baja rotación', detalle: detalleError(error) });
    }
};

module.exports = {
    obtenerVentasPorPeriodo,
    obtenerVentasPorProducto,
    obtenerMargenes,
    obtenerKardex,
    obtenerStockBajo,
    obtenerBajaRotacion
};
