const pool = require('./src/config/db');

async function testMigration() {
  const client = await pool.connect();
  try {
    await client.query("SET TIME ZONE 'America/La_Paz'");

    console.log('--- Inspecting log id 10 BEFORE column type change ---');
    const logBefore = await client.query("SELECT id, creado_en FROM logs_acceso WHERE id = 10");
    if (logBefore.rows.length > 0) {
      console.log('Before creado_en raw:', logBefore.rows[0].creado_en);
      console.log('Before creado_en ISO:', logBefore.rows[0].creado_en.toISOString());
      console.log('Before formatted (es-BO, America/La_Paz):', logBefore.rows[0].creado_en.toLocaleString('es-BO', { timeZone: 'America/La_Paz' }));
    }

    console.log('\n--- Converting logs_acceso.creado_en to TIMESTAMPTZ USING creado_en AT TIME ZONE \'UTC\' ---');
    await client.query("ALTER TABLE logs_acceso ALTER COLUMN creado_en TYPE TIMESTAMPTZ USING creado_en AT TIME ZONE 'UTC'");

    const logAfter = await client.query("SELECT id, creado_en FROM logs_acceso WHERE id = 10");
    if (logAfter.rows.length > 0) {
      console.log('After creado_en raw:', logAfter.rows[0].creado_en);
      console.log('After creado_en ISO:', logAfter.rows[0].creado_en.toISOString());
      console.log('After formatted (es-BO, America/La_Paz):', logAfter.rows[0].creado_en.toLocaleString('es-BO', { timeZone: 'America/La_Paz' }));
    }

  } catch (err) {
    console.error('Error during migration test:', err);
  } finally {
    client.release();
    pool.end();
  }
}

testMigration();
