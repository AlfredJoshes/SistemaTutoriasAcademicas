// Aritmetica de horarios compartida por disponibilidad y sesiones.
// Las horas se manejan como minutos desde medianoche para poder comparar y
// sumar sin depender de zonas horarias.

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function aMinutos(hora) {
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + (m || 0);
}

function aHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 'HH:MM:SS' -> 'HH:MM' (PostgreSQL devuelve TIME con segundos)
function hhmm(hora) {
  return hora ? String(hora).slice(0, 5) : '';
}

function validarFecha(fecha) {
  if (!FORMATO_FECHA.test(String(fecha || ''))) {
    const error = new Error('La fecha debe tener el formato AAAA-MM-DD');
    error.status = 400;
    throw error;
  }
  return String(fecha);
}

// 0 = domingo ... 6 = sabado, igual que disponibilidad.dia_semana
function diaSemana(fecha) {
  const [a, m, d] = validarFecha(fecha).split('-').map(Number);
  return new Date(a, m - 1, d).getDay();
}

function hoyISO() {
  const ahora = new Date();
  return [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, '0'),
    String(ahora.getDate()).padStart(2, '0'),
  ].join('-');
}

function esHoy(fecha) {
  return validarFecha(fecha) === hoyISO();
}

function esFechaPasada(fecha) {
  return validarFecha(fecha) < hoyISO();
}

function minutosAhora() {
  const ahora = new Date();
  return ahora.getHours() * 60 + ahora.getMinutes();
}

// Dos intervalos se cruzan si cada uno empieza antes de que el otro termine
function seCruzan(inicioA, finA, inicioB, finB) {
  return inicioA < finB && inicioB < finA;
}

module.exports = {
  aMinutos,
  aHora,
  hhmm,
  validarFecha,
  diaSemana,
  hoyISO,
  esHoy,
  esFechaPasada,
  minutosAhora,
  seCruzan,
};
