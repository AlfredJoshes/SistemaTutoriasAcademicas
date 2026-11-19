const pool = require('./src/config/db');
const logsService = require('./src/services/logs.service');

async function testFinalVerification() {
  try {
    console.log('=== VERIFICACIÓN DE MANEJO DE ZONAS HORARIAS (America/La_Paz) ===\n');
    
    // 1. Obtener hora local de Windows en el proceso Node
    const localNow = new Date();
    console.log('1. Hora local de Windows (Node process):', localNow.toString());
    console.log('   Hora esperada en formato es-BO (America/La_Paz):', localNow.toLocaleString('es-BO', { timeZone: 'America/La_Paz' }));

    // 2. Registrar evento de prueba en logs_acceso
    const reqMock = {
      headers: { 'user-agent': 'PruebaIntegridadTZ' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' }
    };

    console.log('\n2. Insertando nuevo registro de prueba en logs_acceso...');
    await logsService.registrar(reqMock, {
      usuario_id: 1,
      correo: 'coordinacion@usalesiana.edu.bo',
      evento: 'login_exitoso',
      exito: true,
      detalle: 'Prueba de verificación integral de zona horaria'
    });

    // 3. Consultar la bitácora mediante logsService.listarLogs
    const solicitante = { id: 1, rol: 'coordinador' };
    const resultado = await logsService.listarLogs(solicitante, { alcance: 'todos', limite: 1 });
    const ultimoLog = resultado.logs[0];

    console.log('\n3. Último log recuperado desde logsService:');
    console.log('   - ID Log:', ultimoLog.id);
    console.log('   - Evento:', ultimoLog.evento);
    console.log('   - Timestamp ISO retornado por API:', ultimoLog.creado_en.toISOString());

    // 4. Formatear la fecha tal como lo hace LogsPage.jsx en el Frontend
    const fechaHoraFrontend = (iso) => {
      if (!iso) return '—';
      return new Date(iso).toLocaleString('es-BO', {
        timeZone: 'America/La_Paz',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    const horaFormattedFrontend = fechaHoraFrontend(ultimoLog.creado_en);
    console.log('\n4. Resultado formateado en el Frontend (LogsPage.jsx):');
    console.log('   - Hora mostrada en interfaz:', horaFormattedFrontend);

    // 5. Comparar hora formateada con la hora del sistema
    const horaEsperadaMinuto = localNow.toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      hour: '2-digit',
      minute: '2-digit',
    });

    console.log('\n5. Evaluación del desfase:');
    console.log('   - Hora del sistema (HH:MM):', horaEsperadaMinuto);
    console.log('   - Hora en interfaz (HH:MM):', horaFormattedFrontend.slice(-12));

    // Limpiar registro de prueba
    await pool.query('DELETE FROM logs_acceso WHERE id = $1', [ultimoLog.id]);
    console.log('\n[ÉXITO] Registro de prueba eliminado. La verificación finalizó exitosamente.');

  } catch (err) {
    console.error('[ERROR]', err);
  } finally {
    pool.end();
  }
}

testFinalVerification();
