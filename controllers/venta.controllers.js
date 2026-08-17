const VentaModel = require('../models/venta.models');
const CajaModel = require('../models/caja.model');
const PDFDocument = require('pdfkit');
const { detalleError } = require('../utils/errorResponse');

const crearVenta = async (req, res) => {
    try {
        const datosVenta = req.body;

        // Validación básica de campos requeridos
        if (!datosVenta.items || datosVenta.items.length === 0) {
            return res.status(400).json({ mensaje: 'No se puede registrar una venta sin productos.' });
        }

        // validación: no se puede vender sin una caja abierta
        const cajaAbierta = await CajaModel.obtenerCajaAbierta();
        if (!cajaAbierta) {
            return res.status(400).json({
                error: 'No hay una caja abierta. Debes abrir turno antes de registrar ventas.'
            });
        }

        const resultado = await VentaModel.registrarVenta(datosVenta);
        res.status(201).json({ mensaje: '¡Factura generada y venta registrada con éxito!', ...resultado });
    } catch (error) {
        // El modelo envuelve el error original con un prefijo, por eso usamos includes() en vez de startsWith()
        if (error.message.includes('Stock insuficiente') || error.message.includes('Ítem de venta inválido')) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Error en crearVenta controller:', error);
        res.status(500).json({ error: 'Error al registrar la venta', detalle: detalleError(error) });
    }
};

const obtenerVentas = async (req, res) => {
    try {
        const ventas = await VentaModel.obtenerTodas();
        res.status(200).json(ventas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener las ventas', detalle: detalleError(error) });
    }
};

const obtenerVentaPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const venta = await VentaModel.obtenerPorId(id);
        if (!venta) {
            return res.status(404).json({ mensaje: 'Venta no encontrada' });
        }
        res.status(200).json(venta);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener la venta', detalle: detalleError(error) });
    }
};

const anularVenta = async (req, res) => {
    try {
        const { id } = req.params;
        const venta = await VentaModel.obtenerPorId(id);
        if (!venta) {
            return res.status(404).json({ mensaje: 'Venta no encontrada para anular' });
        }
        await VentaModel.anularVenta(id);
        res.status(200).json({ mensaje: 'Venta anulada con éxito y stock restaurado' });
    } catch (error) {
        if (error.message.includes('ya está anulada')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error al anular la venta', detalle: detalleError(error) });
    }
};

// Función para generar y descargar el ticket en PDF
const generarTicketPDF = async (req, res) => {
try {
        const ventaId = req.params.id;
        const venta = await VentaModel.obtenerPorId(ventaId);

        if (!venta) {
            return res.status(404).json({ error: 'Factura no encontrada en la base de datos.' });
        }

        // Configurar cabeceras HTTP para PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Factura_${venta.NumeroFactura}.pdf`);

        // Ancho de ticket térmico estándar (~80mm equivalen a 226 puntos)
        const doc = new PDFDocument({ size: [226, 600], margin: 10 });
        doc.pipe(res);

        // --- ENCABEZADO ---
        doc.font('Helvetica-Bold').fontSize(13).text('MISCELÁNEA TEDI', { align: 'center' });
        doc.font('Helvetica').fontSize(8).text('NIT: 123.456.789-0', { align: 'center' });
        doc.text('Cali, Colombia', { align: 'center' });
        doc.moveDown(0.5);

        doc.text(`Factura N°: ${venta.NumeroFactura}`, { align: 'left' });
        doc.text(`Fecha: ${new Date(venta.FechaVenta).toLocaleString()}`, { align: 'left' });
        doc.text(`Cajero / Usuario: ${venta.Usuario || 'Sistema'}`, { align: 'left' });
        doc.text(`Método de Pago: ${venta.MetodoPago || 'Efectivo'}`, { align: 'left' });
        
        doc.text('------------------------------------------------------------', { align: 'center' });

        // --- ENCABEZADOS DE TABLA ---
        // Coordenadas fijas para columnas limpias (Ancho total útil ~206 puntos)
        const colCant = 10;
        const colProd = 45;
        const colSubtotal = 160;

        let currentY = doc.y;
        doc.font('Helvetica-Bold').fontSize(8);
        doc.text('Cant', colCant, currentY);
        doc.text('Producto', colProd, currentY);
        doc.text('Subtotal', colSubtotal, currentY, { align: 'right', width: 55 });

        doc.moveDown(0.5);
        doc.text('------------------------------------------------------------', { align: 'center' });

        // --- DETALLE DE PRODUCTOS ---
        doc.font('Helvetica').fontSize(8);
        if (venta.items && venta.items.length > 0) {
            venta.items.forEach(item => {
                let yItem = doc.y;
                // Cantidad
                doc.text(item.Cantidad.toString(), colCant, yItem);
                // Nombre del producto (limitado en ancho para que baje de línea si es largo)
                doc.text(item.ProductoNombre, colProd, yItem, { width: 110 });
                // Subtotal alineado a la derecha
                doc.text(`$${item.Subtotal.toFixed(2)}`, colSubtotal, yItem, { align: 'right', width: 55 });
                doc.moveDown(0.8);
            });
        }

        doc.text('------------------------------------------------------------', { align: 'center' });

        // --- TOTALES ---
        const totalX = 110;
        const valX = 160;

        doc.font('Helvetica').fontSize(8);
        let yTotales = doc.y;
        doc.text('Subtotal:', totalX, yTotales);
        doc.text(`$${(venta.Subtotal || venta.Total).toFixed(2)}`, valX, yTotales, { align: 'right', width: 55 });
        
        doc.moveDown(0.4);
        yTotales = doc.y;
        doc.text('Impuestos:', totalX, yTotales);
        doc.text(`$${(venta.Impuestos || 0).toFixed(2)}`, valX, yTotales, { align: 'right', width: 55 });

        doc.moveDown(0.6);
        yTotales = doc.y;
        doc.font('Helvetica-Bold').fontSize(10);
        doc.text('TOTAL:', totalX, yTotales);
        doc.text(`$${venta.Total.toFixed(2)}`, valX - 10, yTotales, { align: 'right', width: 65 });

        doc.moveDown(1);
        doc.text('------------------------------------------------------------', { align: 'center' });

        // --- PIE DE PÁGINA ---
        doc.font('Helvetica').fontSize(8).text('¡Gracias por su compra!', { align: 'center' });
        doc.text('Conserve este ticket para cambios o garantías.', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error al generar el PDF:', error);
        res.status(500).json({ error: 'Error al generar el ticket PDF', detalle: detalleError(error) });
    }
};

module.exports = { crearVenta, obtenerVentas, obtenerVentaPorId, anularVenta, generarTicketPDF };