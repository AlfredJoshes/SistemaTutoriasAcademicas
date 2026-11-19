const pool = require('./src/config/db');

async function test() {
  try {
    const res = await pool.query('SELECT NOW() as db_now, CURRENT_TIMESTAMP as db_ct');
    console.log('Postgres NOW():', res.rows[0]);

    const logsRes = await pool.query('SELECT id, creado_en FROM logs_acceso ORDER BY id DESC LIMIT 1');
    if (logsRes.rows.length > 0) {
      const log = logsRes.rows[0];
      console.log('Log row raw:', log);
      console.log('Log creado_en instance:', log.creado_en.constructor.name);
      console.log('Log creado_en toString():', log.creado_en.toString());
      console.log('Log creado_en toISOString():', log.creado_en.toISOString());
      console.log('JSON stringified:', JSON.stringify(log));
    } else {
      console.log('No logs found');
    }
    
    // Check timezone of session
    const tzRes = await pool.query('SHOW TIMEZONE');
    console.log('Postgres session TIMEZONE:', tzRes.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

test();
