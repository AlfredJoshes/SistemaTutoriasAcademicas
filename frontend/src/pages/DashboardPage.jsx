import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

const DashboardPage = () => {
  const { usuario } = useContext(AuthContext);

  const [data, setData] = useState({
    sesiones_completadas: 0,
    horas_totales: 0,
    temas_frecuentes: [],
    asistencia: { asistidas: 0, con_bitacora: 0 },
    pendientes: { solicitadas: 0, confirmadas: 0 },
    alcance: 'propio',
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarDashboard = async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await api.get('/bitacora/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar los datos del dashboard');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const temas = data.temas_frecuentes || [];
  const maximo = temas[0]?.veces || 1;

  const rol = usuario?.rol;
  const esCoordinador = rol === 'coordinador';
  const esTutor = rol === 'tutor';

  const descripcion = esCoordinador
    ? 'Cifras de toda la plataforma a partir de las bitácoras registradas por los tutores.'
    : esTutor
    ? 'Cifras de las tutorías que dictaste, a partir de las bitácoras que registraste.'
    : 'Cifras de las tutorías que recibiste, a partir de las bitácoras registradas por tus tutores.';

  const asistencia = data.asistencia || { asistidas: 0, con_bitacora: 0 };
  const pendientes = data.pendientes || { solicitadas: 0, confirmadas: 0 };
  const porcentajeAsistencia =
    asistencia.con_bitacora > 0
      ? Math.round((asistencia.asistidas / asistencia.con_bitacora) * 100)
      : null;

  // Promedio de duración por sesión completada
  const promedio =
    data.sesiones_completadas > 0 ? data.horas_totales / data.sesiones_completadas : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Seguimiento</span>
          <h1>Resumen</h1>
          <p>{descripcion}</p>
        </div>
        <div className="page-head-aside">
          <span className="state state-confirmada">
            {esCoordinador ? 'Toda la plataforma' : 'Mi actividad'}
          </span>
        </div>
      </div>

      <div className="stack">
        {error && (
          <div className="notice notice-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="panel">
            <div className="loadbar" />
            <p className="loading-note">Calculando métricas…</p>
          </div>
        ) : (
          <>
            <div className="metrics">
              <div className="metric">
                <span className="eyebrow">Sesiones completadas</span>
                <p className="metric-value num">{data.sesiones_completadas}</p>
                <p className="metric-foot">Con bitácora cerrada por el tutor.</p>
              </div>

              <div className="metric">
                <span className="eyebrow">Horas acumuladas</span>
                <p className="metric-value num">
                  {data.horas_totales.toFixed(1)}
                  <span className="metric-unit">h</span>
                </p>
                <p className="metric-foot">
                  {promedio > 0
                    ? `Promedio de ${promedio.toFixed(1)} h por sesión.`
                    : 'Aún sin horas registradas.'}
                </p>
              </div>

              <div className="metric">
                <span className="eyebrow">Asistencia</span>
                <p className="metric-value num">
                  {porcentajeAsistencia === null ? '—' : porcentajeAsistencia}
                  {porcentajeAsistencia !== null && <span className="metric-unit">%</span>}
                </p>
                <p className="metric-foot">
                  {asistencia.con_bitacora > 0
                    ? `${asistencia.asistidas} de ${asistencia.con_bitacora} bitácoras con asistencia.`
                    : 'Aún sin bitácoras registradas.'}
                </p>
              </div>

              <div className="metric">
                <span className="eyebrow">Por atender</span>
                <p className="metric-value num">
                  {pendientes.solicitadas + pendientes.confirmadas}
                </p>
                <p className="metric-foot">
                  {pendientes.solicitadas} solicitada(s) y {pendientes.confirmadas} confirmada(s).
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Temas más trabajados</h2>
                <span className="eyebrow">Primeros {Math.min(5, temas.length) || 5}</span>
              </div>

              {temas.length === 0 ? (
                <div className="empty">
                  <strong>Sin temas registrados</strong>
                  <span>
                    El ranking se arma con el contenido que los tutores anotan en cada bitácora.
                  </span>
                </div>
              ) : (
                <div className="rank-list">
                  {temas.map((item, index) => (
                    <div key={index} className="rank-row">
                      <span className="rank-n">{index + 1}</span>
                      <div>
                        <span className="rank-label" title={item.tema_avanzado}>
                          {item.tema_avanzado}
                        </span>
                        <div className="rank-track">
                          <div
                            className="rank-fill"
                            style={{
                              width: `${Math.min(100, (item.veces / maximo) * 100)}%`,
                              animationDelay: `${index * 70}ms`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="rank-count">
                        {item.veces} {item.veces === 1 ? 'sesión' : 'sesiones'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
