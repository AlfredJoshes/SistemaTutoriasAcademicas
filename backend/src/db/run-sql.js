const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Cargar variables de entorno desde .env si existe
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const host = process.env.PGHOST || 'localhost';
const port = parseInt(process.env.PGPORT || '5432', 10);
const user = process.env.PGUSER || 'postgres';
const password = process.env.PGPASSWORD || 'postgres';
const targetDb = process.env.PGDATABASE || 'tutorias_pares';

async function asegurarBaseDeDatos() {
  const adminClient = new Client({
    host,
    port,
    user,
    password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDb]
    );

    if (res.rows.length === 0) {
      console.log(`[INFO] La base de datos '${targetDb}' no existe. Creándola...`);
      // Evitar SQL injection en nombre de base de datos
      const nombreLimpio = targetDb.replace(/"/g, '""');
      await adminClient.query(`CREATE DATABASE "${nombreLimpio}"`);
      console.log(`[OK] Base de datos '${targetDb}' creada exitosamente.`);
    }
  } catch (err) {
    tratarErrorConexion(err);
    throw err;
  } finally {
    await adminClient.end().catch(() => {});
  }
}

function tratarErrorConexion(err) {
  if (err.code === '28P01') {
    console.error(`\n[ERROR CRÍTICO] Autenticación fallida para el usuario '${user}'.`);
    console.error(`  -> Revisa 'PGPASSWORD' y 'PGUSER' en tu archivo 'backend/.env'.`);
  } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    console.error(`\n[ERROR CRÍTICO] No se pudo conectar al servidor PostgreSQL en ${host}:${port}.`);
    console.error(`  -> Asegúrate de que el servicio de PostgreSQL esté iniciado en tu laptop.`);
  } else if (err.code === '3D000') {
    console.error(`\n[ERROR CRÍTICO] La base de datos especificada no existe.`);
  } else {
    console.error(`\n[ERROR POSTGRESQL] ${err.message}`);
  }
}

async function ejecutarArchivosSQL(archivos) {
  if (!archivos || archivos.length === 0) {
    console.error('[ERROR] No se especificaron archivos .sql para ejecutar.');
    process.exit(1);
  }

  try {
    await asegurarBaseDeDatos();
  } catch (err) {
    process.exit(1);
  }

  const client = new Client({
    host,
    port,
    user,
    password,
    database: targetDb,
  });

  try {
    await client.connect();
  } catch (err) {
    tratarErrorConexion(err);
    process.exit(1);
  }

  for (const relPath of archivos) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[ERROR] El archivo SQL no existe: ${relPath}`);
      await client.end();
      process.exit(1);
    }

    try {
      console.log(`[EJECUTANDO] ${relPath} ...`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      console.log(`[OK] ${relPath} ejecutado correctamente.`);
    } catch (err) {
      console.error(`\n[ERROR AL EJECUTAR ${relPath}]`);
      console.error(`  Mensaje: ${err.message}`);
      if (err.position) {
        console.error(`  Posición en el archivo: caracter ${err.position}`);
      }
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('[ÉXITO] Operación completada exitosamente.');
}

const archivosInput = process.argv.slice(2);
ejecutarArchivosSQL(archivosInput);
