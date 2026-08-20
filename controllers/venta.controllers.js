const VentaModel = require('../models/venta.models');
const CajaModel = require('../models/caja.model');
const PDFDocument = require('pdfkit');
const path = require('path');
const { detalleError } = require('../utils/errorResponse');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-tedi.png');

function formatearMoneda(numero) {
    return Math.round(numero || 0).toLocaleString('es-CO');
}

const crearVenta = async (req, res) => {
    try {
        const datosVenta = req.body;

        if (!datosVenta.items || datosVenta.items.length === 0) {
            return res.status(400).json({ mensaje: 'No se puede registrar una venta sin productos.' });
        }

        const cajaAbierta = await CajaModel.obtenerCajaAbierta();
        if (!cajaAbierta) {
            return res.status(400).json({
                error: 'No hay una caja abierta. Debes abrir turno antes de registrar ventas.'
            });
        }

        const resultado = await VentaModel.registrarVenta(datosVenta);
        res.status(201).json({ mensaje: '¡Factura generada y venta registrada con éxito!', ...resultado });
    } catch (error) {
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

// Generador de Ticket Térmico en PDF (80mm / 226 pt)
const generarTicketPDF = async (req, res) => {
    try {
        const ventaId = req.params.id;
        const venta = await VentaModel.obtenerPorId(ventaId);

        if (!venta) {
            return res.status(404).json({ error: 'Factura no encontrada en la base de datos.' });
        }

        // Cálculo dinámico de altura del ticket para evitar cortes
        const cantidadItems = (venta.items || []).length;
        const altoDinamico = 380 + (cantidadItems * 20);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Factura_${venta.NumeroFactura}.pdf`);

        const doc = new PDFDocument({ 
            size: [226, altoDinamico], 
            margin: 10,
            autoFirstPage: true
        });
        doc.pipe(res);

        const xIzq = 10;
        const xDer = 216;

        function lineaSeparadora(gruesa = false) {
            const y = doc.y + 2;
            doc.moveTo(xIzq, y).lineTo(xDer, y).lineWidth(gruesa ? 1.2 : 0.5).strokeColor('#000000').stroke();
            doc.moveDown(0.6);
        }

        // --- LOGO ---
        const logoAncho = 60;
        try {
            const xLogo = xIzq + (xDer - xIzq - logoAncho) / 2;
            doc.image(LOGO_PATH, xLogo, doc.y, { width: logoAncho });
            doc.y += logoAncho + 4;
        } catch (errLogo) {
            console.warn('No se pudo cargar el logo en el ticket:', errLogo.message);
        }

        // --- ENCABEZADO ---
        doc.font('Helvetica-Bold').fontSize(10.5).text('TEDI HOLDING FAMILIAR S.A.S.', { align: 'center' });
        doc.moveDown(0.15);
        doc.font('Helvetica').fontSize(6.5).text('Legado • Unidad • Valores • Confianza • Crecimiento', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(7.5);
        doc.text('NIT: 123.456.789-0', { align: 'center' });
        doc.text('Régimen Simple de Tributación', { align: 'center' });
        doc.text('Dir: Calle Principal # 45 - 28', { align: 'center' });
        doc.text('Tel / WhatsApp: +57 310 000 0000', { align: 'center' });
        doc.text('Cali - Colombia', { align: 'center' });
        doc.moveDown(0.4);

        lineaSeparadora();

        // --- INFO FACTURA ---
        doc.font('Helvetica-Bold').fontSize(8).text(`FACTURA DE VENTA: #${venta.NumeroFactura}`);
        doc.font('Helvetica').fontSize(8);
        doc.text(`Fecha: ${new Date(venta.FechaVenta).toLocaleDateString('es-CO')}   Hora: ${new Date(venta.FechaVenta).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`);
        doc.text(`Caja: POS-01   Cajero: ${venta.Usuario || 'Sistema'}`);
        doc.text(`Pago: ${venta.MetodoPago || 'Efectivo'}`);
        doc.moveDown(0.4);

        lineaSeparadora();

        // --- CABECERA TABLA ---
        const colDesc = xIzq;
        const anchoDesc = 96;
        const colCant = colDesc + anchoDesc + 2;
        const anchoCant = 22;
        const colPUnit = colCant + anchoCant + 2;
        const anchoPUnit = 42;
        const colTotal = colPUnit + anchoPUnit + 2;
        const anchoTotal = xDer - colTotal;

        doc.font('Helvetica-Bold').fontSize(6.5);
        let yEnc = doc.y;
        doc.text('DESCRIPCIÓN', colDesc, yEnc, { width: anchoDesc });
        doc.text('CANT', colCant, yEnc, { width: anchoCant, align: 'center' });
        doc.text('P.UNIT', colPUnit, yEnc, { width: anchoPUnit, align: 'right' });
        doc.text('TOTAL', colTotal, yEnc, { width: anchoTotal, align: 'right' });
        doc.moveDown(0.5);

        lineaSeparadora();

        // --- FILAS DE PRODUCTOS ---
        if (venta.items && venta.items.length > 0) {
            doc.font('Helvetica').fontSize(7);
            venta.items.forEach((item) => {
                const yFila = doc.y;
                const nombreProd = item.ProductoNombre || item.Nombre || 'Producto';
                const altoNombre = doc.heightOfString(nombreProd, { width: anchoDesc });
                const altoFila = Math.max(altoNombre, 8);

                doc.text(nombreProd, colDesc, yFila, { width: anchoDesc });
                doc.text(item.Cantidad.toString(), colCant, yFila, { width: anchoCant, align: 'center' });
                doc.text(formatearMoneda(item.PrecioUnitario), colPUnit, yFila, { width: anchoPUnit, align: 'right' });
                doc.text(formatearMoneda(item.Subtotal), colTotal, yFila, { width: anchoTotal, align: 'right' });

                doc.y = yFila + altoFila + 3;
            });
        }

        doc.moveDown(0.2);
        lineaSeparadora();

        // --- TOTALES ---
        const totalLabelX = xIzq + 80;
        const totalValueWidth = xDer - totalLabelX;

        doc.font('Helvetica').fontSize(8);
        let yTotales = doc.y;
        doc.text('Subtotal:', totalLabelX, yTotales, { width: 55 });
        doc.text(`$ ${formatearMoneda(venta.Subtotal)}`, totalLabelX, yTotales, { width: totalValueWidth, align: 'right' });
        doc.moveDown(0.45);

        yTotales = doc.y;
        doc.text('Descuento:', totalLabelX, yTotales, { width: 55 });
        doc.text('$ 0', totalLabelX, yTotales, { width: totalValueWidth, align: 'right' });
        doc.moveDown(0.45);

        yTotales = doc.y;
        doc.text(`IVA (${venta.PorcentajeIvaFactura || 19}% incl.):`, totalLabelX, yTotales, { width: 65 });
        doc.text(`$ ${formatearMoneda(venta.Impuestos)}`, totalLabelX, yTotales, { width: totalValueWidth, align: 'right' });
        doc.moveDown(0.5);

        // Línea punteada antes del total
        const yLineaTotal = doc.y;
        doc.moveTo(totalLabelX, yLineaTotal).lineTo(xDer, yLineaTotal).lineWidth(0.5).dash(1, { space: 1 }).stroke();
        doc.undash();
        doc.moveDown(0.3);

        doc.font('Helvetica-Bold').fontSize(9.5);
        yTotales = doc.y;
        doc.text('TOTAL A PAGAR:', totalLabelX, yTotales, { width: 75 });
        doc.text(`$ ${formatearMoneda(venta.Total)}`, totalLabelX, yTotales, { width: totalValueWidth, align: 'right' });
        doc.moveDown(0.5);

        if (venta.MetodoPago === 'Efectivo') {
            doc.font('Helvetica').fontSize(8);
            yTotales = doc.y;
            doc.text('Efectivo Recibido:', totalLabelX, yTotales, { width: 65 });
            doc.text(`$ ${formatearMoneda(venta.MontoRecibido)}`, totalLabelX, yTotales, { width: totalValueWidth, align: 'right' });
            doc.moveDown(0.45);

            yTotales = doc.y;
            doc.text('Cambio:', totalLabelX, yTotales, { width: 55 });
            doc.text(`$ ${formatearMoneda(venta.CambioDevuelto)}`, totalLabelX, yTotales, { width: totalValueWidth, align: 'right' });
            doc.moveDown(0.5);
        }

        lineaSeparadora(true);

        // --- PIE DE PÁGINA ---
        doc.font('Helvetica-Bold').fontSize(8).text('¡GRACIAS POR SU COMPRA!', { align: 'center' });
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(6.5).text(
            'Garantía y devoluciones: 15 días calendario desde la fecha de compra, sujeto a las políticas de la compañía.',
            { align: 'center' }
        );
        doc.moveDown(0.2);
        doc.text('Conserve esta factura.', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Error al generar el PDF:', error);
        res.status(500).json({ error: 'Error al generar el ticket PDF', detalle: detalleError(error) });
    }
};

module.exports = { crearVenta, obtenerVentas, obtenerVentaPorId, anularVenta, generarTicketPDF };