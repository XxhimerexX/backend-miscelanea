const DashboardModel = require('../models/dashboard.model');
const CajaModel = require('../models/caja.model');
const { detalleError } = require('../utils/errorResponse');

const obtenerResumen = async (req, res) => {
  try {
    const [totalVentasDia, productosStockBajo, cajaAbierta] = await Promise.all([
      DashboardModel.ventasDelDia(),
      DashboardModel.productosStockBajo(),
      CajaModel.obtenerCajaAbierta()
    ]);

    res.status(200).json({
      totalVentasDia,
      productosStockBajo,
      cajaAbierta: !!cajaAbierta
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen del dashboard', detalle: detalleError(error) });
  }
};

const obtenerVentasPorPeriodo = async (req, res) => {
  try {
    const { periodo, fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin son obligatorios' });
    }
    const periodoValido = ['dia', 'mes', 'anio'].includes(periodo) ? periodo : 'mes';
    const finConHora = `${fechaFin} 23:59:59`;

    const datos = await DashboardModel.ventasPorPeriodo(periodoValido, fechaInicio, finConHora);
    res.status(200).json({ periodo: periodoValido, datos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas por periodo', detalle: detalleError(error) });
  }
};

module.exports = { obtenerResumen, obtenerVentasPorPeriodo };