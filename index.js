require('dotenv').config();

const express = require('express');
const cors = require('cors');

const productosRoutes = require('./routes/productos.route');
const ventasRoutes = require('./routes/ventas.route');
const categoriasRoutes = require('./routes/categorias.route');
const cajaRoutes = require('./routes/caja.route');
const authRoutes = require('./routes/auth.route');
const dashboardRoutes = require('./routes/dashboard.route');
const menuRoutes = require('./routes/menu.route');
const proveedoresRoutes = require('./routes/proveedores.route');
const comprasRoutes = require('./routes/compras.route');
const devolucionesRoutes = require('./routes/devoluciones.route');
const reportesRoutes = require('./routes/reportes.route');

const app = express();

app.use(express.json());
app.use(cors());

// Vinculamos las rutas de productos bajo el prefijo /api/productos
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/devoluciones', devolucionesRoutes);
app.use('/api/reportes', reportesRoutes);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores centralizado (atrapa, por ejemplo, JSON mal formado en el body)
app.use((err, req, res, next) => {
    console.error('Error no controlado:', err);
    const esProduccion = process.env.NODE_ENV === 'production';
    res.status(err.status || 500).json({
        error: 'Error interno del servidor',
        detalle: esProduccion ? undefined : err.message
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor backend de la miscelánea corriendo en el puerto ${PORT}`);
});

module.exports = app;