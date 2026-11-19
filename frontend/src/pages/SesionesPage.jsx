import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import BitacoraModal from './BitacoraModal';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const ESTADOS = {
  solicitada: 'Solicitada',
  confirmada: 'Confirmada',
  rechazada: 'Rechazada',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

// Color del riel lateral segun el estado de la sesion
const RIEL = {
  solicitada: '#b45309',
  confirmada: '#1d4ed8',
  rechazada: '#be123c',
  completada: '#15803d',
  cancelada: '#c7ced8',
};

const hhmm = (h) => (h ? h.slice(0, 5) : '');

const fechaLarga = (iso) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('T')[0].split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.toLocaleDateString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

const SesionesPage = () => {
  const [sesiones, setSesiones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);

  // Filtro de estado
  const [filtroEstado, setFiltroEstado] = useState('todas');

  // Modal de Bitacora
  const [sesionParaBitacora, setSesionParaBitacora] = useState(null);

  const { usuario } = useContext(AuthContext);
  const isTutor = usuario?.rol === 'tutor';

  const cargarSesiones = async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await api.get('/sesiones/mias');
      setSesiones(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar las sesiones');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSesiones();
  }, []);

  const handleCambiarEstado = async (sesionId, nuevoEstado) => {
    setError(null);
    setExito(null);

    try {
      await api.patch(`/sesiones/${sesionId}/estado`, { estado: nuevoEstado });
      setExito(`Sesión #${sesionId} marcada como ${ESTADOS[nuevoEstado].toLowerCase()}.`);
      cargarSesiones();
      setTimeout(() => setExito(null), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al actualizar el estado de la sesión');
    }
  };

  const sesionesFiltradas = sesiones.filter((s) => {
    if (filtroEstado === 'todas') return true;
    return s.estado === filtroEstado;
  });

  // Conteo por estado para el resumen de la cabecera
  const conteo = sesiones.reduce((acc, s) => {
    acc[s.estado] = (acc[s.estado] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{isTutor ? 'Bandeja del tutor' : 'Mis solicitudes'}</span>
          <h1>Sesiones</h1>
          <p>
            {isTutor
              ? 'Confirma o rechaza las solicitudes recibidas y registra la bitácora al terminar cada sesión.'
              : 'Sigue el estado de cada solicitud y consulta la bitácora que registró tu tutor.'}
          </p>
        </div>

        <div className="page-head-aside">
          <div className="filter">
            <label htmlFor="filtroEstado">Estado</label>
            <select
              id="filtroEstado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todas">Todas</option>
              {Object.entries(ESTADOS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
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

        {!cargando && sesiones.length > 0 && (
          <div className="tally">
            <span>
              Total <b>{sesiones.length}</b>
            </span>
            {Object.entries(ESTADOS).map(([valor, label]) =>
              conteo[valor] ? (
                <span key={valor} className={`state state-${valor}`}>
                  {label} <b>{conteo[valor]}</b>
                </span>
              ) : null
            )}
          </div>
        )}

        {cargando ? (
          <div className="panel">
            <div className="loadbar" />
            <p className="loading-note">Cargando tus sesiones…</p>
          </div>
        ) : sesionesFiltradas.length === 0 ? (
          <div className="empty">
            <strong>
              {filtroEstado === 'todas'
                ? 'Todavía no hay sesiones registradas'
                : `Ninguna sesión en estado ${ESTADOS[filtroEstado].toLowerCase()}`}
            </strong>
            <span>
              {isTutor
                ? 'Las solicitudes de los estudiantes aparecerán aquí.'
                : 'Puedes agendar una desde el directorio de tutores.'}
            </span>
          </div>
        ) : (
          <div className="stack" style={{ gap: '0.75rem' }}>
            {sesionesFiltradas.map((s) => {
              const estado = ESTADOS[s.estado] ? s.estado : 'solicitada';

              // Determinar si la sesion requiere mostrar botones de accion o si se encuentra en estado terminal
              const esEstadoTerminal = ['completada', 'rechazada', 'cancelada'].includes(
                s.estado
              );
              const tieneAccionesDisponibles = !esEstadoTerminal;

              return (
                <article
                  key={s.id}
                  className="session"
                  style={{ '--rail': RIEL[estado] }}
                >
                  <div className="session-top">
                    <div className="session-ref">
                      <span className="session-code code">
                        S-{String(s.id).padStart(4, '0')}
                      </span>
                      <span className={`state state-${estado}`}>{ESTADOS[estado]}</span>
                    </div>
                    <div className="session-when">
                      {fechaLarga(s.fecha)}{' '}
                      <span>
                        · {hhmm(s.hora_inicio)}–{hhmm(s.hora_fin)}
                      </span>
                    </div>
                  </div>

                  <div className="session-grid">
                    <div>
                      <span className="eyebrow">{isTutor ? 'Estudiante' : 'Tutor'}</span>
                      <p className="session-value">
                        {isTutor ? s.estudiante_nombre : s.tutor_nombre}
                      </p>
                      <p className="session-value-sub">
                        {isTutor
                          ? s.estudiante_correo
                          : s.tutor_area_apoyo || 'Sin área especificada'}
                      </p>
                    </div>

                    <div>
                      <span className="eyebrow">Tema consultado</span>
                      <p className="session-text">{s.tema || 'Sin tema especificado'}</p>
                    </div>
                  </div>

                  {/* Si la sesion tiene bitacora registrada */}
                  {s.bitacora_id && (
                    <div className="session-log">
                      <div className="session-log-head">
                        <span className="eyebrow">Bitácora</span>
                        <span
                          className={`state ${
                            s.bitacora_asistio ? 'state-completada' : 'state-rechazada'
                          }`}
                        >
                          {s.bitacora_asistio ? 'Asistió' : 'No asistió'}
                        </span>
                      </div>
                      <dl className="log-rows">
                        <dt>Contenido</dt>
                        <dd>{s.bitacora_tema_avanzado || 'No registrado'}</dd>
                        {s.bitacora_notas && (
                          <>
                            <dt>Notas</dt>
                            <dd>{s.bitacora_notas}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Botones de Acciones condicionados estrictamente por Rol y Estado de la sesion */}
                  {tieneAccionesDisponibles && (
                    <div className="session-actions">
                      {/* Confirmar / Rechazar para Tutor (solo en solicitada) */}
                      {isTutor && s.estado === 'solicitada' && (
                        <>
                          <button
                            onClick={() => handleCambiarEstado(s.id, 'rechazada')}
                            className="btn btn-sm btn-danger-text"
                          >
                            Rechazar
                          </button>
                          <button
                            onClick={() => handleCambiarEstado(s.id, 'confirmada')}
                            className="btn btn-sm btn-solid"
                          >
                            Confirmar
                          </button>
                        </>
                      )}

                      {/* Registrar Bitacora para Tutor (solo en confirmada) */}
                      {isTutor && s.estado === 'confirmada' && (
                        <button
                          onClick={() => setSesionParaBitacora(s)}
                          className="btn btn-sm btn-solid"
                        >
                          Registrar bitácora
                        </button>
                      )}

                      {/* Cancelar para Estudiante (solo en solicitada o confirmada) */}
                      {!isTutor && (s.estado === 'solicitada' || s.estado === 'confirmada') && (
                        <button
                          onClick={() => handleCambiarEstado(s.id, 'cancelada')}
                          className="btn btn-sm btn-danger-text"
                        >
                          Cancelar sesión
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal para Registrar Bitacora por el Tutor */}
      {sesionParaBitacora && (
        <BitacoraModal
          sesion={sesionParaBitacora}
          onClose={() => setSesionParaBitacora(null)}
          onSuccess={() => {
            setSesionParaBitacora(null);
            setExito('Bitácora registrada. La sesión quedó marcada como completada.');
            cargarSesiones();
            setTimeout(() => setExito(null), 3500);
          }}
        />
      )}
    </div>
  );
};

export default SesionesPage;
