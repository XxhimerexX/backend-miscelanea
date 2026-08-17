const CajaModel = require('../models/caja.model');
const { detalleError } = require('../utils/errorResponse');

const obtenerEstadoCaja = async (req, res) => {
    try {
        const turnoAbierto = await CajaModel.obtenerCajaAbierta();
        if (!turnoAbierto) {
            return res.status(200).json({ abierta: false });
        }
        res.status(200).json({ abierta: true, turno: turnoAbierto });
    } catch (error) {
        console.error('Error al obtener estado de caja:', error);
        res.status(500).json({ error: 'Error al consultar el estado de la caja', detalle: detalleError(error) });
    }
};

const abrirCaja = async (req, res) => {
    try {
        // Aceptamos tanto 'baseInicial' como 'montoInicial' para evitar confusiones
        const { usuarioId, baseInicial, montoInicial } = req.body;
        const valorBase = baseInicial !== undefined ? baseInicial : (montoInicial !== undefined ? montoInicial : 0);

        // Validar si ya existe una caja abierta
        const cajaExistente = await CajaModel.obtenerCajaAbierta();
        if (cajaExistente) {
            return res.status(400).json({ error: 'Ya existe un turno de caja abierto actualmente.' });
        }

        const nuevoTurno = await CajaModel.abrirTurno(usuarioId || 1, valorBase);
        res.status(201).json({
            success: true,
            mensaje: 'Caja abierta con éxito',
            turno: nuevoTurno
        });
    } catch (error) {
        console.error('Error al abrir la caja:', error);
        res.status(500).json({ error: 'Error al abrir la caja', detalle: detalleError(error) });
    }
};

const cerrarCaja = async (req, res) => {
    try {
        const { turnoId, totalEfectivoSistema, totalDigitalSistema, totalVentasGeneral, montoFinalReal, diferencia } = req.body;

        await CajaModel.cerrarTurno(turnoId, totalEfectivoSistema, totalDigitalSistema, totalVentasGeneral, montoFinalReal, diferencia);
        res.status(200).json({ success: true, mensaje: 'Caja cerrada correctamente' });
    } catch (error) {
        console.error('Error al cerrar la caja:', error);
        res.status(500).json({ error: 'Error al cerrar la caja', detalle: detalleError(error) });
    }
};


const obtenerResumenTurno = async (req, res) => {
    try {
        const cajaAbierta = await CajaModel.obtenerCajaAbierta();
        if (!cajaAbierta) {
            return res.status(400).json({ error: 'No hay ninguna caja abierta actualmente.' });
        }

        const resumen = await CajaModel.obtenerResumenVentasTurno(cajaAbierta.Id);

        res.status(200).json({
            turnoId: cajaAbierta.Id,
            baseInicial: cajaAbierta.BaseInicial,
            totalEfectivoSistema: resumen.totalEfectivoSistema,
            totalDigitalSistema: resumen.totalDigitalSistema
        });
    } catch (error) {
        console.error('Error al obtener resumen del turno:', error);
        res.status(500).json({ error: 'Error al obtener el resumen del turno', detalle: detalleError(error) });
    }
};

module.exports = {
    obtenerEstadoCaja,
    abrirCaja,
    cerrarCaja,
    obtenerResumenTurno
};