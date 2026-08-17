// Solo exponemos el detalle interno del error cuando NO estamos en producción,
// para evitar filtrar mensajes de la base de datos u otros detalles internos al cliente.
const detalleError = (error) => (process.env.NODE_ENV === 'production' ? undefined : error.message);

module.exports = { detalleError };
