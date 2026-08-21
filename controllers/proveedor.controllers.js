const ProveedorModel = require('../models/proveedor.models');
const { detalleError } = require('../utils/errorResponse');
const multer = require('multer');
const path = require('path');

const TIPOS_VALIDOS = ['RUT', 'CAMARA_COMERCIO', 'LISTA_PRECIOS', 'OTRO'];
const EXTENSIONES_VALIDAS = ['.pdf', '.xls', '.xlsx'];

// Almacenamiento en memoria: el archivo llega como Buffer en req.file.buffer,
// nunca se escribe al disco del servidor. Se guarda directo en la base de datos.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB máximo por archivo
    fileFilter: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        if (!EXTENSIONES_VALIDAS.includes(extension)) {
            return cb(new Error('Solo se permiten archivos PDF, XLS o XLSX.'));
        }
        cb(null, true);
    }
}).single('archivo');

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

// --- Productos que vende el proveedor ---

const asociarProductos = async (req, res) => {
    try {
        const { id } = req.params;
        const { productoIds } = req.body;

        if (!Array.isArray(productoIds)) {
            return res.status(400).json({ mensaje: 'productoIds debe ser un arreglo (puede ir vacío para quitar todos).' });
        }

        const proveedor = await ProveedorModel.obtenerPorId(id);
        if (!proveedor) {
            return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
        }

        const resultado = await ProveedorModel.asociarProductos(id, productoIds);
        res.json({ mensaje: 'Productos del proveedor actualizados con éxito', ...resultado });
    } catch (error) {
        console.error('Error en asociarProductos controller:', error);
        res.status(500).json({ error: 'Error al asociar los productos', detalle: detalleError(error) });
    }
};

const obtenerProductosDeProveedor = async (req, res) => {
    try {
        const { id } = req.params;
        const productos = await ProveedorModel.obtenerProductos(id);
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los productos del proveedor', detalle: detalleError(error) });
    }
};

// --- Documentos del proveedor (guardados directo en la base de datos) ---

const subirDocumento = (req, res) => {
    upload(req, res, async (errorUpload) => {
        try {
            if (errorUpload) {
                return res.status(400).json({ mensaje: errorUpload.message });
            }
            if (!req.file) {
                return res.status(400).json({ mensaje: 'Debes adjuntar un archivo.' });
            }

            const { id } = req.params;
            const { tipoDocumento } = req.body;

            if (!TIPOS_VALIDOS.includes(tipoDocumento)) {
                return res.status(400).json({ mensaje: `Tipo de documento inválido. Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
            }

            const proveedor = await ProveedorModel.obtenerPorId(id);
            if (!proveedor) {
                return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
            }

            const documento = await ProveedorModel.guardarDocumento({
                proveedorId: id,
                tipoDocumento,
                nombreOriginal: req.file.originalname,
                archivoContenido: req.file.buffer,
                archivoMimeType: req.file.mimetype,
                archivoTamano: req.file.size,
                usuarioId: req.usuario.id
            });

            res.status(201).json({ mensaje: 'Documento subido con éxito', documentoId: documento.id });
        } catch (error) {
            console.error('Error en subirDocumento controller:', error);
            res.status(500).json({ error: 'Error al subir el documento', detalle: detalleError(error) });
        }
    });
};

const listarDocumentos = async (req, res) => {
    try {
        const { id } = req.params;
        const documentos = await ProveedorModel.listarDocumentos(id);
        res.json(documentos);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar los documentos', detalle: detalleError(error) });
    }
};

const descargarDocumento = async (req, res) => {
    try {
        const { documentoId } = req.params;
        const documento = await ProveedorModel.obtenerDocumentoPorId(documentoId);
        if (!documento || !documento.ArchivoContenido) {
            return res.status(404).json({ mensaje: 'Documento no encontrado' });
        }

        res.setHeader('Content-Type', documento.ArchivoMimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${documento.NombreOriginal}"`);
        res.send(documento.ArchivoContenido);
    } catch (error) {
        res.status(500).json({ error: 'Error al descargar el documento', detalle: detalleError(error) });
    }
};

const eliminarDocumento = async (req, res) => {
    try {
        const { documentoId } = req.params;
        const documento = await ProveedorModel.obtenerDocumentoPorId(documentoId);
        if (!documento) {
            return res.status(404).json({ mensaje: 'Documento no encontrado' });
        }

        await ProveedorModel.eliminarDocumento(documentoId);
        res.json({ mensaje: 'Documento eliminado con éxito' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar el documento', detalle: detalleError(error) });
    }
};

module.exports = {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    actualizarProveedor,
    cambiarEstadoProveedor,
    asociarProductos,
    obtenerProductosDeProveedor,
    subirDocumento,
    listarDocumentos,
    descargarDocumento,
    eliminarDocumento
};