const pool = require('./src/config/db');

async function testTz3() {
  const client = await pool.connect();
  try {
    // Set session timezone to America/La_Paz
    await client.query("SET TIME ZONE 'America/La_Paz'");

    // Create a temporary table with TIMESTAMPTZ and TIMESTAMP
    await client.query("CREATE TEMP TABLE test_tz_table (id SERIAL, created_ts TIMESTAMP DEFAULT NOW(), created_tsz TIMESTAMPTZ DEFAULT NOW())");
    await client.query("INSERT INTO test_tz_table DEFAULT VALUES");

    const res = await client.query("SELECT * FROM test_tz_table");
    console.log('Inserted row:');
    console.log('created_ts (TIMESTAMP):', res.rows[0].created_ts.toISOString());
    console.log('created_tsz (TIMESTAMPTZ):', res.rows[0].created_tsz.toISOString());

    // Local time formatted in JS
    const dateTs = res.rows[0].created_ts;
    const dateTsz = res.rows[0].created_tsz;

    console.log('Formatted ts es-BO America/La_Paz:', dateTs.toLocaleString('es-BO', { timeZone: 'America/La_Paz' }));
    console.log('Formatted tsz es-BO America/La_Paz:', dateTsz.toLocaleString('es-BO', { timeZone: 'America/La_Paz' }));

  } finally {
    client.release();
    pool.end();
  }
}

testTz3();
