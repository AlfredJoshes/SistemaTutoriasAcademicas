const pool = require('../config/db');
const {
  aMinutos,
  aHora,
  hhmm,
  diaSemana,
  esHoy,
  esFechaPasada,
  minutosAhora,
  seCruzan,
} = require('../utils/horarios');

// Duracion por defecto de una tutoria, en minutos
const DURACION_POR_DEFECTO = 60;

async function crearDisponibilidad(tutorId, { dia_semana, hora_inicio, hora_fin }) {
  if (dia_semana === undefined || dia_semana === null || !hora_inicio || !hora_fin) {
    const error = new Error('Los campos dia_semana, hora_inicio y hora_fin son obligatorios');
    error.status = 400;
    throw error;
  }

  const diaNum = Number(dia_semana);
  if (isNaN(diaNum) || diaNum < 0 || diaNum > 6) {
    const error = new Error('dia_semana debe ser un número entero entre 0 (domingo) y 6 (sábado)');
    error.status = 400;
    throw error;
  }

  if (hora_inicio >= hora_fin) {
    const error = new Error('hora_fin debe ser posterior a hora_inicio');
    error.status = 400;
    throw error;
  }

  const { rows } = await pool.query(
    `INSERT INTO disponibilidad (tutor_id, dia_semana, hora_inicio, hora_fin)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tutorId, diaNum, hora_inicio, hora_fin]
  );

  return rows[0];
}

async function obtenerDisponibilidadTutor(tutorId) {
  const { rows } = await pool.query(
    `SELECT * FROM disponibilidad
     WHERE tutor_id = $1
     ORDER BY dia_semana ASC, hora_inicio ASC`,
    [tutorId]
  );

  return rows;
}

async function eliminarDisponibilidad(disponibilidadId, tutorId) {
  const { rowCount } = await pool.query(
    `DELETE FROM disponibilidad
     WHERE id = $1 AND tutor_id = $2`,
    [disponibilidadId, tutorId]
  );

  if (rowCount === 0) {
    const error = new Error('Franja de disponibilidad no encontrada o no pertenece al tutor');
    error.status = 404;
    throw error;
  }

  return true;
}

/**
 * Comprueba que el horario pedido esté contenido en una franja publicada por el
 * tutor para ese día de la semana. Lo usa sesiones.service al crear una sesión.
 * Un horario que cruce dos franjas contiguas se considera fuera de disponibilidad.
 */
async function franjaQueContiene(tutorId, fecha, hora_inicio, hora_fin) {
  const { rows } = await pool.query(
    `SELECT id, hora_inicio, hora_fin
       FROM disponibilidad
      WHERE tutor_id = $1
        AND dia_semana = $2
        AND hora_inicio <= $3::time
        AND hora_fin >= $4::time
      LIMIT 1`,
    [tutorId, diaSemana(fecha), hora_inicio, hora_fin]
  );

  return rows[0] || null;
}

/**
 * Bloques libres de un tutor en una fecha concreta: parte de las franjas
 * publicadas para ese día de la semana, las corta en bloques de `duracion`
 * minutos y descarta los que ya están tomados por una sesión vigente o los
 * que quedaron en el pasado si la fecha es hoy.
 */
async function obtenerSlotsLibres(tutorId, fecha, duracion) {
  const minutosBloque = Math.min(Math.max(parseInt(duracion, 10) || DURACION_POR_DEFECTO, 15), 240);

  const tutor = await pool.query(`SELECT id FROM usuarios WHERE id = $1 AND rol = 'tutor'`, [
    tutorId,
  ]);
  if (tutor.rows.length === 0) {
    const error = new Error('El tutor especificado no existe o no tiene rol de tutor');
    error.status = 404;
    throw error;
  }

  const dia = diaSemana(fecha);

  // Una fecha pasada no tiene bloques: se responde vacío en lugar de error
  if (esFechaPasada(fecha)) {
    return { fecha, dia_semana: dia, duracion: minutosBloque, franjas: [], slots: [] };
  }

  const { rows: franjas } = await pool.query(
    `SELECT id, hora_inicio, hora_fin
       FROM disponibilidad
      WHERE tutor_id = $1 AND dia_semana = $2
      ORDER BY hora_inicio ASC`,
    [tutorId, dia]
  );

  const { rows: ocupadas } = await pool.query(
    `SELECT hora_inicio, hora_fin
       FROM sesiones
      WHERE tutor_id = $1
        AND fecha = $2::date
        AND estado IN ('solicitada', 'confirmada')`,
    [tutorId, fecha]
  );

  const tomadas = ocupadas.map((o) => [aMinutos(o.hora_inicio), aMinutos(o.hora_fin)]);
  const desde = esHoy(fecha) ? minutosAhora() : -1;

  const slots = [];
  for (const franja of franjas) {
    const finFranja = aMinutos(franja.hora_fin);
    for (
      let inicio = aMinutos(franja.hora_inicio);
      inicio + minutosBloque <= finFranja;
      inicio += minutosBloque
    ) {
      const fin = inicio + minutosBloque;
      const ocupado = tomadas.some(([oi, of_]) => seCruzan(inicio, fin, oi, of_));
      if (!ocupado && inicio >= desde) {
        slots.push({ hora_inicio: aHora(inicio), hora_fin: aHora(fin) });
      }
    }
  }

  return {
    fecha,
    dia_semana: dia,
    duracion: minutosBloque,
    franjas: franjas.map((f) => ({
      id: f.id,
      hora_inicio: hhmm(f.hora_inicio),
      hora_fin: hhmm(f.hora_fin),
    })),
    slots,
  };
}

module.exports = {
  crearDisponibilidad,
  obtenerDisponibilidadTutor,
  eliminarDisponibilidad,
  franjaQueContiene,
  obtenerSlotsLibres,
};
