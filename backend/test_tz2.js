const pool = require('./src/config/db');
const types = require('pg').types;

// Test 1: Default
async function testDefault() {
  const res = await pool.query("SELECT NOW() as now, CURRENT_TIMESTAMP as ct");
  console.log('Default PG NOW():', res.rows[0]);
  const log = await pool.query("SELECT creado_en FROM logs_acceso ORDER BY id DESC LIMIT 1");
  console.log('Default creado_en:', log.rows[0].creado_en.toISOString());
}

async function testWithTz() {
  const client = await pool.connect();
  await client.query("SET TIME ZONE 'America/La_Paz'");
  const res = await client.query("SELECT NOW() as now, CURRENT_TIMESTAMP as ct");
  console.log('America/La_Paz PG NOW():', res.rows[0]);
  
  // Insert a test row to see what NOW() produces in America/La_Paz
  const testInsert = await client.query("SELECT NOW()::timestamp as now_ts, NOW() as now_tz");
  console.log('now_ts:', testInsert.rows[0].now_ts);
  console.log('now_ts ISO:', testInsert.rows[0].now_ts.toISOString());
  console.log('now_tz ISO:', testInsert.rows[0].now_tz.toISOString());

  client.release();
}

async function run() {
  await testDefault();
  await testWithTz();
  pool.end();
}

run();
