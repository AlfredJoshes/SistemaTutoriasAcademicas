import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

const DIAS_SEMANA = [
  { val: 0, label: 'Domingo', inicial: 'D' },
  { val: 1, label: 'Lunes', inicial: 'L' },
  { val: 2, label: 'Martes', inicial: 'M' },
  { val: 3, label: 'Miércoles', inicial: 'M' },
  { val: 4, label: 'Jueves', inicial: 'J' },
  { val: 5, label: 'Viernes', inicial: 'V' },
  { val: 6, label: 'Sábado', inicial: 'S' },
];

const hhmm = (h) => (h ? h.slice(0, 5) : '');

// Duración de la franja en horas, a partir de dos horas "HH:MM"
const duracion = (inicio, fin) => {
  const [hi, mi] = hhmm(inicio).split(':').map(Number);
  const [hf, mf] = hhmm(fin).split(':').map(Number);
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  if (!Number.isFinite(minutos) || minutos <= 0) return null;
  return minutos / 60;
};

const DisponibilidadPage = () => {
  const [disponibilidades, setDisponibilidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  const [formData, setFormData] = useState({
    dia_semana: '1',
    hora_inicio: '09:00',
    hora_fin: '12:00',
  });
  const [creando, setCreando] = useState(false);

  const cargarDisponibilidad = async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await api.get('/disponibilidad/mias');
      setDisponibilidades(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar disponibilidades');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDisponibilidad();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError(null);
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    setError(null);
    setExito(null);
    setCreando(true);

    try {
      await api.post('/disponibilidad', {
        dia_semana: Number(formData.dia_semana),
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
      });

      setExito('Franja agregada.');
      cargarDisponibilidad();
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al agregar disponibilidad');
    } finally {
      setCreando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta franja de disponibilidad?')) return;
    setError(null);
    setExito(null);

    try {
      await api.delete(`/disponibilidad/${id}`);
      setExito('Franja eliminada.');
      setDisponibilidades(disponibilidades.filter((d) => d.id !== id));
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al eliminar disponibilidad');
    }
  };

  // Ordenar por dia y luego por hora de inicio
  const ordenadas = [...disponibilidades].sort(
    (a, b) =>
      a.dia_semana - b.dia_semana || hhmm(a.hora_inicio).localeCompare(hhmm(b.hora_inicio))
  );

  const diasActivos = new Set(disponibilidades.map((d) => d.dia_semana));
  const horasSemana = disponibilidades.reduce(
    (total, d) => total + (duracion(d.hora_inicio, d.hora_fin) || 0),
    0
  );

  const vistaPrevia = duracion(formData.hora_inicio, formData.hora_fin);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Agenda del tutor</span>
          <h1>Disponibilidad</h1>
          <p>
            Las franjas que publiques aquí son las únicas en las que los estudiantes podrán
            solicitarte una sesión.
          </p>
        </div>

        <div className="page-head-aside">
          <div className="week">
            {DIAS_SEMANA.map((d) => (
              <span
                key={d.val}
                className={`week-day ${diasActivos.has(d.val) ? 'is-on' : ''}`}
                title={`${d.label}: ${diasActivos.has(d.val) ? 'con franjas' : 'libre'}`}
              >
                {d.inicial}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="stack">
        {error && (
          <div className="notice notice-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {exito && (
          <div className="notice notice-ok">
            <CheckCircle2 size={16} />
            <span>{exito}</span>
          </div>
        )}

        <div className="cols-2">
          {/* Formulario de Creacion */}
          <div className="panel">
            <div className="panel-head">
              <h2>Agregar franja</h2>
            </div>
            <div className="panel-body">
              <form onSubmit={handleCrear} className="form">
                <div className="field">
                  <label htmlFor="dia_semana">Día</label>
                  <select
                    id="dia_semana"
                    name="dia_semana"
                    value={formData.dia_semana}
                    onChange={handleChange}
                    required
                  >
                    {DIAS_SEMANA.map((d) => (
                      <option key={d.val} value={d.val}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-pair">
                  <div className="field">
                    <label htmlFor="hora_inicio">Desde</label>
                    <input
                      type="time"
                      id="hora_inicio"
                      name="hora_inicio"
                      value={formData.hora_inicio}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="hora_fin">Hasta</label>
                    <input
                      type="time"
                      id="hora_fin"
                      name="hora_fin"
                      value={formData.hora_fin}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-solid btn-block" disabled={creando}>
                  {creando ? 'Guardando…' : 'Agregar franja'}
                </button>
              </form>
            </div>
            <p className="panel-note">
              {vistaPrevia
                ? `Esta franja aporta ${vistaPrevia.toFixed(1)} h a tu semana.`
                : 'La hora de fin debe ser posterior a la de inicio.'}
            </p>
          </div>

          {/* Lista de Disponibilidades */}
          <div className="panel">
            <div className="panel-head">
              <h2>Franjas publicadas</h2>
              <span className="eyebrow">
                {cargando
                  ? '—'
                  : `${ordenadas.length} franja${ordenadas.length === 1 ? '' : 's'} · ${horasSemana.toFixed(1)} h`}
              </span>
            </div>

            {cargando ? (
              <>
                <div className="loadbar" />
                <p className="loading-note">Cargando tu agenda…</p>
              </>
            ) : ordenadas.length === 0 ? (
              <div className="empty">
                <strong>Sin franjas publicadas</strong>
                <span>
                  Mientras no publiques horarios no apareces como disponible en el directorio.
                </span>
              </div>
            ) : (
              <div>
                {ordenadas.map((d) => {
                  const horas = duracion(d.hora_inicio, d.hora_fin);
                  return (
                    <div key={d.id} className="slot-row">
                      <span className="slot-row-day">
                        {DIAS_SEMANA.find((ds) => ds.val === d.dia_semana)?.label}
                      </span>
                      <span className="slot-row-time">
                        {hhmm(d.hora_inicio)} – {hhmm(d.hora_fin)}
                      </span>
                      {horas && <span className="slot-row-dur">{horas.toFixed(1)} h</span>}
                      <button
                        onClick={() => handleEliminar(d.id)}
                        className="btn btn-quiet btn-danger-text"
                        title="Eliminar franja"
                        aria-label="Eliminar franja"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisponibilidadPage;
