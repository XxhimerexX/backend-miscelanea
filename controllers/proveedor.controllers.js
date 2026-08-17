const ProveedorModel = require('../models/proveedor.models');
const { detalleError } = require('../utils/errorResponse');

const listarProveedores = async (req, res) => {
    try {
        const soloActivos = req.query.activos === 'true';
        const proveedores = await ProveedorModel.listar(soloActivos);
        res.json(proveedores);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar los proveedores', detalle: detalleError(error) });
    }
};

const obtenerProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const proveedor = await ProveedorModel.obtenerPorId(id);
        if (!proveedor) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
        }
        res.json(proveedor);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el proveedor', detalle: detalleError(error) });
    }
};

const crearProveedor = async (req, res) => {
    try {
        const { RazonSocial, NIT } = req.body;
        if (!RazonSocial || !NIT) {
            return res.status(400).json({ mensaje: 'Los campos RazonSocial y NIT son obligatorios.' });
        }

        const nuevoProveedor = await ProveedorModel.crear(req.body);
        res.status(201).json({ mensaje: 'Proveedor registrado con éxito', proveedorId: nuevoProveedor.id });
    } catch (error) {
        if (error.number === 2627 || error.number === 2601) { // violación de UNIQUE (NIT)
            return res.status(400).json({ mensaje: 'Ya existe un proveedor registrado con ese NIT.' });
        }
        console.error('Error en crearProveedor controller:', error);
        res.status(500).json({ error: 'Error al registrar el proveedor', detalle: detalleError(error) });
    }
};

const actualizarProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { RazonSocial, NIT } = req.body;
        if (!RazonSocial || !NIT) {
            return res.status(400).json({ mensaje: 'Los campos RazonSocial y NIT son obligatorios.' });
        }

        const proveedor = await ProveedorModel.obtenerPorId(id);
        if (!proveedor) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
        }

        await ProveedorModel.actualizar(id, req.body);
        res.json({ mensaje: 'Proveedor actualizado con éxito', proveedorId: id });
    } catch (error) {
        if (error.number === 2627 || error.number === 2601) {
            return res.status(400).json({ mensaje: 'Ya existe un proveedor registrado con ese NIT.' });
        }
        console.error('Error en actualizarProveedor controller:', error);
        res.status(500).json({ error: 'Error al actualizar el proveedor', detalle: detalleError(error) });
    }
};

const cambiarEstadoProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        if (typeof activo !== 'boolean') {
            return res.status(400).json({ mensaje: 'El campo activo (booleano) es obligatorio.' });
        }

        const proveedor = await ProveedorModel.obtenerPorId(id);
        if (!proveedor) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
        }

        await ProveedorModel.cambiarEstado(id, activo);
        res.json({ mensaje: `Proveedor ${activo ? 'activado' : 'desactivado'} con éxito`, proveedorId: id });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar el estado del proveedor', detalle: detalleError(error) });
    }
};

module.exports = {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    actualizarProveedor,
    cambiarEstadoProveedor
};
