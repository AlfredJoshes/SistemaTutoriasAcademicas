import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { AlertCircle, CheckCircle2, X, Clock } from 'lucide-react';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const INICIALES_DIA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const hhmm = (h) => (h ? h.slice(0, 5) : '');

const TutoresPage = () => {
  const [tutores, setTutores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  // Estado del modal de solicitud de sesion
  const [tutorSeleccionado, setTutorSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    tema: '',
  });
  const [errorModal, setErrorModal] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [exitoModal, setExitoModal] = useState(false);

  // Horarios libres que devuelve el backend para la fecha elegida
  const [slots, setSlots] = useState([]);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [duracion, setDuracion] = useState(60);

  const { usuario } = useContext(AuthContext);
  const navigate = useNavigate();

  const cargarTutores = async () => {
    try {
      setCargando(true);
      setErrorGlobal(null);
      const res = await api.get('/usuarios/tutores');
      setTutores(res.data);
    } catch (err) {
      console.error(err);
      setErrorGlobal(err.response?.data?.error || 'Error al cargar la lista de tutores');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTutores();
  }, []);

  // El backend calcula los bloques libres: disponibilidad menos sesiones tomadas
  const cargarSlots = useCallback(async (tutorId, fecha, minutos) => {
    if (!tutorId || !fecha) {
      setSlots([]);
      return;
    }
    try {
      setCargandoSlots(true);
      const res = await api.get(`/disponibilidad/${tutorId}/slots`, {
        params: { fecha, duracion: minutos },
      });
      setSlots(res.data.slots || []);
    } catch (err) {
      console.error(err);
      setSlots([]);
      setErrorModal(err.response?.data?.error || 'No se pudieron cargar los horarios libres');
    } finally {
      setCargandoSlots(false);
    }
  }, []);

  useEffect(() => {
    if (tutorSeleccionado && formData.fecha) {
      cargarSlots(tutorSeleccionado.id, formData.fecha, duracion);
    }
  }, [tutorSeleccionado, formData.fecha, duracion, cargarSlots]);

  const abrirModal = (tutor) => {
    setTutorSeleccionado(tutor);
    setFormData({
      fecha: '',
      hora_inicio: '',
      hora_fin: '',
      tema: '',
    });
    setSlots([]);
    setDuracion(60);
    setErrorModal(null);
    setExitoModal(false);
  };

  const cerrarModal = () => {
    setTutorSeleccionado(null);
    setSlots([]);
    setErrorModal(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Al cambiar la fecha se descarta el horario elegido: ya no aplica
    setFormData((previo) => ({
      ...previo,
      [name]: value,
      ...(name === 'fecha' ? { hora_inicio: '', hora_fin: '' } : {}),
    }));
    if (errorModal) setErrorModal(null);
  };

  const elegirSlot = (slot) => {
    setFormData((previo) => ({
      ...previo,
      hora_inicio: slot.hora_inicio,
      hora_fin: slot.hora_fin,
    }));
    if (errorModal) setErrorModal(null);
  };

  const handleSolicitar = async (e) => {
    e.preventDefault();
    setErrorModal(null);
    setEnviando(true);

    try {
      const payload = {
        tutor_id: tutorSeleccionado.id,
        fecha: formData.fecha,
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        tema: formData.tema,
      };

      await api.post('/sesiones', payload);
      setExitoModal(true);

      setTimeout(() => {
        cerrarModal();
        navigate('/sesiones');
      }, 1500);
    } catch (err) {
      console.error(err);
      // Captura explicita del error HTTP 409 u otros devueltos por el backend
      const msg = err.response?.data?.error || 'Error al solicitar la sesión de tutoría';
      setErrorModal(msg);
    } finally {
      setEnviando(false);
    }
  };

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? tutores.filter(
        (t) =>
          t.nombre_completo?.toLowerCase().includes(termino) ||
          t.area_apoyo?.toLowerCase().includes(termino)
      )
    : tutores;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Directorio</span>
          <h1>Tutores</h1>
          <p>
            Revisa la especialidad y los días que atiende cada tutor antes de solicitar una
            sesión.
          </p>
        </div>

        <div className="page-head-aside">
          <div className="filter">
            <label htmlFor="busqueda">Buscar</label>
            <input
              id="busqueda"
              type="search"
              placeholder="Nombre o área"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="stack">
        {errorGlobal && (
          <div className="notice notice-error">
            <AlertCircle size={16} />
            <span>{errorGlobal}</span>
          </div>
        )}

        <div className="panel">
          <div className="panel-head">
            <h2>Tutores registrados</h2>
            <span className="eyebrow">
              {cargando ? '—' : `${visibles.length} de ${tutores.length}`}
            </span>
          </div>

          {cargando ? (
            <>
              <div className="loadbar" />
              <p className="loading-note">Consultando el directorio…</p>
            </>
          ) : visibles.length === 0 ? (
            <div className="empty">
              <strong>
                {tutores.length === 0
                  ? 'Todavía no hay tutores registrados'
                  : 'Ningún tutor coincide con la búsqueda'}
              </strong>
              <span>
                {tutores.length === 0
                  ? 'Cuando un tutor cree su cuenta aparecerá en esta lista.'
                  : 'Prueba con otro nombre o área de apoyo.'}
              </span>
            </div>
          ) : (
            <div className="record-list">
              {visibles.map((tutor) => {
                const franjas = tutor.disponibilidad || [];
                const diasActivos = new Set(franjas.map((d) => d.dia_semana));

                return (
                  <article key={tutor.id} className="record">
                    <div className="record-main">
                      <h3 className="record-title">{tutor.nombre_completo}</h3>
                      <p className="record-sub">{tutor.correo}</p>

                      <div className="record-area">
                        <span className="eyebrow">Área de apoyo</span>
                        {tutor.area_apoyo || 'Sin especificar'}
                      </div>

                      {franjas.length > 0 ? (
                        <dl className="slot-list">
                          {franjas.map((d) => (
                            <div key={d.id} className="slot-line">
                              <dt>{DIAS[d.dia_semana]}</dt>
                              <dd>
                                {hhmm(d.hora_inicio)} – {hhmm(d.hora_fin)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="slot-none">Sin horarios publicados.</p>
                      )}
                    </div>

                    <div className="record-side">
                      <div>
                        <span className="eyebrow" style={{ display: 'block', marginBottom: '0.4rem' }}>
                          Semana
                        </span>
                        <div className="week">
                          {INICIALES_DIA.map((inicial, i) => (
                            <span
                              key={i}
                              className={`week-day ${diasActivos.has(i) ? 'is-on' : ''}`}
                              title={`${DIAS[i]}: ${
                                diasActivos.has(i) ? 'atiende' : 'sin horario'
                              }`}
                            >
                              {inicial}
                            </span>
                          ))}
                        </div>
                      </div>

                      {usuario?.rol === 'estudiante' && (
                        <button onClick={() => abrirModal(tutor)} className="btn btn-solid">
                          Solicitar sesión
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Solicitud de Sesion */}
      {tutorSeleccionado && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && cerrarModal()}>
          <div className="dialog" role="dialog" aria-modal="true">
            <div className="dialog-head">
              <div>
                <span className="eyebrow">Nueva solicitud</span>
                <h2>{tutorSeleccionado.nombre_completo}</h2>
              </div>
              <button onClick={cerrarModal} className="btn btn-quiet" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            {exitoModal ? (
              <div className="dialog-body">
                <div className="notice notice-ok">
                  <CheckCircle2 size={16} />
                  <span>Solicitud enviada. Abriendo tus sesiones…</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSolicitar}>
                <div className="dialog-body">
                  <dl className="recap">
                    <dt>Área</dt>
                    <dd>{tutorSeleccionado.area_apoyo || 'Sin especificar'}</dd>
                    <dt>Correo</dt>
                    <dd>{tutorSeleccionado.correo}</dd>
                    <dt>Atiende</dt>
                    <dd>
                      {tutorSeleccionado.disponibilidad?.length
                        ? [...new Set(tutorSeleccionado.disponibilidad.map((d) => d.dia_semana))]
                            .sort()
                            .map((d) => DIAS[d])
                            .join(', ')
                        : 'Sin horarios publicados'}
                    </dd>
                  </dl>

                  {errorModal && (
                    <div className="notice notice-error" style={{ marginTop: '1rem' }}>
                      <AlertCircle size={16} />
                      <span>{errorModal}</span>
                    </div>
                  )}

                  <div className="form" style={{ marginTop: '1.25rem' }}>
                    <div className="field">
                      <label htmlFor="fecha">Fecha</label>
                      <input
                        type="date"
                        id="fecha"
                        name="fecha"
                        min={new Date().toISOString().split('T')[0]}
                        value={formData.fecha}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="duracion">Duración</label>
                      <select
                        id="duracion"
                        value={duracion}
                        onChange={(e) => setDuracion(Number(e.target.value))}
                      >
                        <option value={30}>30 minutos</option>
                        <option value={60}>1 hora</option>
                        <option value={90}>1 hora 30 minutos</option>
                        <option value={120}>2 horas</option>
                      </select>
                    </div>

                    {/* Bloques libres calculados por el backend: disponibilidad
                        del tutor menos las sesiones ya tomadas */}
                    <div className="field">
                      <label>Horario disponible</label>

                      {!formData.fecha ? (
                        <p className="slot-none">Elige primero una fecha.</p>
                      ) : cargandoSlots ? (
                        <p className="slot-none">Consultando horarios libres…</p>
                      ) : slots.length === 0 ? (
                        <p className="slot-none">
                          El tutor no tiene bloques de {duracion} minutos libres ese día. Prueba con
                          otra fecha o una duración menor.
                        </p>
                      ) : (
                        <div className="slot-picker">
                          {slots.map((slot) => {
                            const elegido = formData.hora_inicio === slot.hora_inicio;
                            return (
                              <button
                                key={slot.hora_inicio}
                                type="button"
                                className={`slot-chip ${elegido ? 'is-on' : ''}`}
                                onClick={() => elegirSlot(slot)}
                                aria-pressed={elegido}
                              >
                                <Clock size={12} />
                                {slot.hora_inicio} – {slot.hora_fin}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <span className="field-hint">
                        Solo se muestran los bloques dentro de la disponibilidad publicada por el
                        tutor que todavía están libres.
                      </span>
                    </div>

                    <div className="field">
                      <label htmlFor="tema">Tema a consultar</label>
                      <input
                        type="text"
                        id="tema"
                        name="tema"
                        placeholder="Revisión del marco teórico"
                        value={formData.tema}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="dialog-foot">
                  <button
                    type="button"
                    onClick={cerrarModal}
                    className="btn"
                    disabled={enviando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-solid"
                    disabled={enviando || !formData.hora_inicio}
                  >
                    {enviando ? 'Enviando…' : 'Enviar solicitud'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TutoresPage;
