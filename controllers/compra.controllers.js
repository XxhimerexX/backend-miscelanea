const CompraModel = require('../models/compra.models');
const PDFDocument = require('pdfkit');
const path = require('path');
const { detalleError } = require('../utils/errorResponse');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-tedi.png');

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
        if (error.message.includes('Ítem de orden inválido') || error.message.includes('Descuento inválido')) {
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

function formatearMoneda(numero) {
    return Math.round(numero || 0).toLocaleString('es-CO');
}

// Genera el documento PDF de la orden de compra: datos de la empresa y del lugar
// donde se recibe la mercancía, número de OC, proveedor, líneas con descuento y
// observación individual, observación general, y total.
const generarOrdenCompraPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const orden = await CompraModel.obtenerPorId(id);

        if (!orden) {
            return res.status(404).json({ error: 'Orden de compra no encontrada.' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=OrdenCompra_${orden.Id}.pdf`);

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        const xIzq = 40;
        const xDer = 555;

        function lineaSeparadora(gruesa = false) {
            const y = doc.y + 4;
            doc.moveTo(xIzq, y).lineTo(xDer, y).lineWidth(gruesa ? 1.2 : 0.5).strokeColor('#000000').stroke();
            doc.moveDown(0.8);
        }

        // --- LOGO Y DATOS DE LA EMPRESA (quien hace el pedido y recibe la mercancía) ---
        const logoAncho = 55;
        try {
            doc.image(LOGO_PATH, xIzq, doc.y, { width: logoAncho });
        } catch (errLogo) {
            console.warn('No se pudo cargar el logo:', errLogo.message);
        }

        const xTextoEmpresa = xIzq + logoAncho + 15;
        const yInicioEmpresa = doc.y;
        doc.font('Helvetica-Bold').fontSize(14).text('TEDI HOLDING FAMILIAR S.A.S.', xTextoEmpresa, yInicioEmpresa, { width: xDer - xTextoEmpresa });
        doc.font('Helvetica').fontSize(9);
        doc.text('NIT: 123.456.789-0', xTextoEmpresa, doc.y, { width: xDer - xTextoEmpresa });
        doc.text('Dirección de recepción: Calle Principal # 45 - 28, Cali - Colombia', xTextoEmpresa, doc.y, { width: xDer - xTextoEmpresa });
        doc.text('Teléfono: +57 310 000 0000', xTextoEmpresa, doc.y, { width: xDer - xTextoEmpresa });
        doc.text('Horario de recibo de mercancía: Lunes a Sábado, 8:00 a.m. - 5:00 p.m.', xTextoEmpresa, doc.y, { width: xDer - xTextoEmpresa });

        doc.y = Math.max(doc.y, yInicioEmpresa + logoAncho) + 10;
        lineaSeparadora();

        // --- DATOS DE LA ORDEN Y DEL PROVEEDOR ---
        doc.font('Helvetica-Bold').fontSize(13).text(`ORDEN DE COMPRA N.° ${orden.Id}`, xIzq);
        doc.moveDown(0.3);

        doc.font('Helvetica').fontSize(9);
        doc.text(`Fecha de emisión: ${new Date(orden.FechaCreacion).toLocaleDateString('es-CO')}`);
        if (orden.FechaEsperada) {
            doc.text(`Fecha esperada de entrega: ${new Date(orden.FechaEsperada).toLocaleDateString('es-CO')}`);
        }
        doc.text(`Estado: ${orden.Estado}`);
        doc.text(`Solicitado por: ${orden.Usuario}`);
        doc.moveDown(0.4);

        doc.font('Helvetica-Bold').fontSize(10).text('Proveedor');
        doc.font('Helvetica').fontSize(9);
        doc.text(orden.Proveedor);
        if (orden.ProveedorNIT) doc.text(`NIT: ${orden.ProveedorNIT}`);
        if (orden.ProveedorTelefono) doc.text(`Teléfono: ${orden.ProveedorTelefono}`);
        if (orden.ProveedorCorreo) doc.text(`Correo: ${orden.ProveedorCorreo}`);
        if (orden.ProveedorContacto) doc.text(`Contacto: ${orden.ProveedorContacto}`);
        doc.moveDown(0.6);

        lineaSeparadora();

        // --- TABLA DE PRODUCTOS: Producto | Cant | Costo Unit. | Dcto % | Observación | Subtotal ---
        const colProd = xIzq;
        const anchoProd = 140;
        const colCant = colProd + anchoProd + 5;
        const anchoCant = 35;
        const colCosto = colCant + anchoCant + 5;
        const anchoCosto = 65;
        const colDcto = colCosto + anchoCosto + 5;
        const anchoDcto = 40;
        const colObs = colDcto + anchoDcto + 5;
        const anchoObs = 130;
        const colSubtotal = colObs + anchoObs + 5;
        const anchoSubtotal = xDer - colSubtotal;

        doc.font('Helvetica-Bold').fontSize(8.5);
        let yEnc = doc.y;
        doc.text('PRODUCTO', colProd, yEnc, { width: anchoProd });
        doc.text('CANT', colCant, yEnc, { width: anchoCant, align: 'center' });
        doc.text('COSTO UNIT.', colCosto, yEnc, { width: anchoCosto, align: 'right' });
        doc.text('DCTO %', colDcto, yEnc, { width: anchoDcto, align: 'center' });
        doc.text('OBSERVACIÓN', colObs, yEnc, { width: anchoObs });
        doc.text('SUBTOTAL', colSubtotal, yEnc, { width: anchoSubtotal, align: 'right' });
        doc.moveDown(0.6);

        lineaSeparadora();

        doc.font('Helvetica').fontSize(8.5);
        orden.items.forEach((item) => {
            const yFila = doc.y;
            const altoProducto = doc.heightOfString(item.ProductoNombre, { width: anchoProd });
            const altoObs = item.Observacion ? doc.heightOfString(item.Observacion, { width: anchoObs }) : 8;
            const altoFila = Math.max(altoProducto, altoObs, 10);

            doc.text(item.ProductoNombre, colProd, yFila, { width: anchoProd });
            doc.text(item.CantidadPedida.toString(), colCant, yFila, { width: anchoCant, align: 'center' });
            doc.text(`$${formatearMoneda(item.CostoUnitario)}`, colCosto, yFila, { width: anchoCosto, align: 'right' });
            doc.text(`${item.DescuentoPorcentaje || 0}%`, colDcto, yFila, { width: anchoDcto, align: 'center' });
            doc.text(item.Observacion || '-', colObs, yFila, { width: anchoObs });
            doc.text(`$${formatearMoneda(item.Subtotal)}`, colSubtotal, yFila, { width: anchoSubtotal, align: 'right' });

            doc.y = yFila + altoFila + 6;
        });

        doc.moveDown(0.2);
        lineaSeparadora();

        // --- TOTAL ---
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text(`TOTAL DE LA ORDEN: $${formatearMoneda(orden.Total)}`, xIzq, doc.y, { width: xDer - xIzq, align: 'right' });
        doc.moveDown(0.8);

        // --- OBSERVACIÓN GENERAL ---
        if (orden.Observaciones) {
            lineaSeparadora();
            doc.font('Helvetica-Bold').fontSize(9).text('Observación general:');
            doc.font('Helvetica').fontSize(9).text(orden.Observaciones, { width: xDer - xIzq });
            doc.moveDown(0.5);
        }

        lineaSeparadora(true);
        doc.font('Helvetica').fontSize(8).fillColor('#555555').text(
            'Este documento es una orden de compra interna, no constituye una factura de venta.',
            { align: 'center' }
        );

        doc.end();
    } catch (error) {
        console.error('Error al generar el PDF de la orden de compra:', error);
        res.status(500).json({ error: 'Error al generar el PDF de la orden de compra', detalle: detalleError(error) });
    }
};

module.exports = {
    crearOrden,
    obtenerOrdenes,
    obtenerOrdenPorId,
    cancelarOrden,
    recibirOrden,
    generarOrdenCompraPDF
};