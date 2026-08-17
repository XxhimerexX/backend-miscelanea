const sql = require('mssql');
require('dotenv').config(); // Carga las variables del archivo .env

// DB_ENCRYPT y DB_USE_UTC controlan el comportamiento según el entorno:
// - Local (SQL Server en tu PC): DB_ENCRYPT=false, DB_USE_UTC=false
//   (tu SQL Server local guarda GETDATE() en hora de Colombia, sin offset)
// - Azure SQL Database: DB_ENCRYPT=true, DB_USE_UTC=true
//   (Azure SQL Database SIEMPRE corre en UTC; con useUTC:true el driver marca
//   los timestamps como UTC reales, y el navegador los convierte solo a la
//   hora local del usuario — sin necesidad de ningún truco adicional)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: process.env.DB_ENCRYPT !== 'true',
        useUTC: process.env.DB_USE_UTC === 'true'
    }
};

let poolPromise = null;

// Reutilizamos un único pool de conexiones para toda la app en vez de abrir
// uno nuevo por cada request (mssql permite varias conexiones concurrentes
// sobre el mismo pool).
const getConnection = async () => {
    try {
        if (!poolPromise) {
            poolPromise = new sql.ConnectionPool(dbConfig).connect();
            poolPromise.catch(() => {
                // Si falla la conexión inicial, permitimos reintentar en la próxima llamada
                poolPromise = null;
            });
        }
        return await poolPromise;
    } catch (error) {
        console.error('Error al conectar a SQL Server:', error);
        throw error;
    }
};

module.exports = { getConnection, sql };