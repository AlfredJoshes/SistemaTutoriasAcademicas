const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

// Garantizar que la sesion de PostgreSQL use la zona horaria local (America/La_Paz, UTC-4)
pool.on('connect', (client) => {
  client.query("SET TIME ZONE 'America/La_Paz'").catch((err) => {
    console.error('Error al establecer TIME ZONE en cliente de PostgreSQL:', err.message);
  });
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = pool;
