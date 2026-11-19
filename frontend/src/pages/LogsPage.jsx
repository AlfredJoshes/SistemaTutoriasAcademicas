import React, { useState, useEffect, useContext, useCallback } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { AlertCircle, RefreshCw, Monitor, MapPin } from 'lucide-react';

// Etiqueta legible y color de cada evento auditado
const EVENTOS = {
  registro: { texto: 'Cuenta creada', tono: 'neutro' },
  login_exitoso: { texto: 'Acceso correcto', tono: 'ok' },
  login_fallido: { texto: 'Acceso rechazado', tono: 'mal' },
  '2fa_requerido': { texto: 'Código solicitado', tono: 'aviso' },
  '2fa_exitoso': { texto: 'Código correcto', tono: 'ok' },
  '2fa_fallido': { texto: 'Código incorrecto', tono: 'mal' },
  '2fa_activado': { texto: 'Autenticador activado', tono: 'ok' },
  '2fa_desactivado': { texto: 'Autenticador desactivado', tono: 'aviso' },
  codigo_respaldo_usado: { texto: 'Código de respaldo usado', tono: 'aviso' },
  logout: { texto: 'Sesión cerrada', tono: 'neutro' },
  acceso_denegado: { texto: 'Acceso denegado', tono: 'mal' },
  bloqueo_temporal: { texto: 'Bloqueo temporal', tono: 'mal' },
};

const fechaHora = (iso) => {
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

// Resume el user-agent a algo que se pueda leer en una tabla
const navegador = (ua) => {
  if (!ua) return 'Desconocido';
  const motor = /Edg/.test(ua)
    ? 'Edge'
    : /OPR|Opera/.test(ua)
    ? 'Opera'
    : /Chrome/.test(ua)
    ? 'Chrome'
    : /Safari/.test(ua)
    ? 'Safari'
    : /Firefox/.test(ua)
    ? 'Firefox'
    : /axios|node|curl/i.test(ua)
    ? 'Cliente API'
    : 'Otro';
  const sistema = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Mac OS/.test(ua)
    ? 'macOS'
    : /Linux/.test(ua)
    ? 'Linux'
    : '';
  return sistema ? `${motor} · ${sistema}` : motor;
};

const FILTROS_INICIALES = {
  evento: '',
  exito: '',
  correo: '',
  desde: '',
  hasta: '',
};

const LogsPage = () => {
  const { usuario } = useContext(AuthContext);
  const puedeVerTodo = usuario?.rol === 'coordinador';
  const [datos, setDatos] = useState({ logs: [], total: 0, pagina: 1, paginas: 1 });
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [alcance, setAlcance] = useState('todos');
  const [pagina, setPagina] = useState(1);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);

      const params = { pagina, limite: 25, alcance };
      Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor !== '') params[clave] = valor;
      });

      const [listado, tarjetas] = await Promise.all([
        api.get('/logs', { params }),
        api.get('/logs/resumen', { params: { dias: 30, alcance } }),
      ]);

      setDatos(listado.data);
      setResumen(tarjetas.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al cargar la bitácora de accesos');
    } finally {
      setCargando(false);
    }
  }, [filtros, alcance, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleFiltro = (e) => {
    setFiltros({ ...filtros, [e.target.name]: e.target.value });
    setPagina(1);
  };

  const limpiar = () => {
    setFiltros(FILTROS_INICIALES);
    setPagina(1);
  };

  const hayFiltros = Object.values(filtros).some((v) => v !== '');
  const logs = datos.logs || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Auditoría de Seguridad</span>
          <h1>Registros de acceso</h1>
          <p>
            Supervisión de accesos, verificaciones 2FA y eventos de seguridad de toda la plataforma.
          </p>
        </div>
        <div className="page-head-aside">
          <button type="button" className="btn btn-sm" onClick={cargar} disabled={cargando}>
            <RefreshCw size={14} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="stack">
        {error && (
          <div className="notice notice-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {resumen && (
          <div className="metrics">
            <div className="metric">
              <span className="eyebrow">Accesos correctos</span>
              <p className="metric-value num">{resumen.accesos_exitosos}</p>
              <p className="metric-foot">Últimos {resumen.dias} días.</p>
            </div>
            <div className="metric">
              <span className="eyebrow">Intentos rechazados</span>
              <p className="metric-value num">{resumen.accesos_fallidos}</p>
              <p className="metric-foot">Contraseña incorrecta o correo inexistente.</p>
            </div>
            <div className="metric">
              <span className="eyebrow">Códigos incorrectos</span>
              <p className="metric-value num">{resumen.codigos_fallidos}</p>
              <p className="metric-foot">
                {resumen.bloqueos > 0
                  ? `${resumen.bloqueos} bloqueo(s) temporal(es) aplicado(s).`
                  : 'Sin bloqueos temporales.'}
              </p>
            </div>
            <div className="metric">
              <span className="eyebrow">Último acceso</span>
              <p className="metric-value metric-value-sm">{fechaHora(resumen.ultimo_acceso)}</p>
              <p className="metric-foot">{resumen.total_eventos} eventos registrados.</p>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-head">
            <h2>Eventos</h2>
            <span className="eyebrow">
              {datos.total} en total · página {datos.pagina} de {datos.paginas}
            </span>
          </div>

          <div className="panel-body">
            <div className="log-filters">
              {puedeVerTodo && (
                <div className="filter">
                  <label htmlFor="alcance">Alcance</label>
                  <select
                    id="alcance"
                    value={alcance}
                    onChange={(e) => {
                      setAlcance(e.target.value);
                      setPagina(1);
                    }}
                  >
                    <option value="propio">Mi actividad</option>
                    <option value="todos">Toda la plataforma</option>
                  </select>
                </div>
              )}

              <div className="filter">
                <label htmlFor="evento">Evento</label>
                <select id="evento" name="evento" value={filtros.evento} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  {Object.entries(EVENTOS).map(([clave, info]) => (
                    <option key={clave} value={clave}>
                      {info.texto}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter">
                <label htmlFor="exito">Resultado</label>
                <select id="exito" name="exito" value={filtros.exito} onChange={handleFiltro}>
                  <option value="">Todos</option>
                  <option value="true">Correcto</option>
                  <option value="false">Rechazado</option>
                </select>
              </div>

              <div className="filter">
                <label htmlFor="desde">Desde</label>
                <input
                  type="date"
                  id="desde"
                  name="desde"
                  value={filtros.desde}
                  onChange={handleFiltro}
                />
              </div>

              <div className="filter">
                <label htmlFor="hasta">Hasta</label>
                <input
                  type="date"
                  id="hasta"
                  name="hasta"
                  value={filtros.hasta}
                  onChange={handleFiltro}
                />
              </div>

              {alcance === 'todos' && (
                <div className="filter">
                  <label htmlFor="correo">Correo</label>
                  <input
                    type="search"
                    id="correo"
                    name="correo"
                    placeholder="nombre@usalesiana.edu.bo"
                    value={filtros.correo}
                    onChange={handleFiltro}
                  />
                </div>
              )}

              {hayFiltros && (
                <button type="button" className="btn btn-sm btn-quiet" onClick={limpiar}>
                  Limpiar filtros
                </button>
              )}
            </div>

            {cargando ? (
              <>
                <div className="loadbar" />
                <p className="loading-note">Leyendo la bitácora…</p>
              </>
            ) : logs.length === 0 ? (
              <div className="empty">
                <strong>Sin eventos</strong>
                <span>
                  {hayFiltros
                    ? 'Ningún registro coincide con los filtros aplicados.'
                    : 'Todavía no hay actividad auditada para esta cuenta.'}
                </span>
              </div>
            ) : (
              <div className="log-table-wrap">
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Fecha y hora</th>
                      <th>Evento</th>
                      {alcance === 'todos' && <th>Usuario</th>}
                      <th>Origen</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const info = EVENTOS[log.evento] || { texto: log.evento, tono: 'neutro' };
                      return (
                        <tr key={log.id} className={log.exito ? '' : 'is-fallido'}>
                          <td className="num log-when">{fechaHora(log.creado_en)}</td>
                          <td>
                            <span className={`log-tag log-tag-${info.tono}`}>{info.texto}</span>
                          </td>
                          {alcance === 'todos' && (
                            <td className="log-user">
                              <span className="log-user-name">
                                {log.nombre_completo || 'Cuenta inexistente'}
                              </span>
                              <span className="log-user-mail">
                                {log.correo || log.correo_intento || '—'}
                              </span>
                            </td>
                          )}
                          <td className="log-origen">
                            <span>
                              <MapPin size={12} />
                              {log.ip || '—'}
                            </span>
                            <span>
                              <Monitor size={12} />
                              {navegador(log.user_agent)}
                            </span>
                          </td>
                          <td className="log-detalle">{log.detalle || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {datos.paginas > 1 && (
              <div className="log-pager">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina <= 1 || cargando}
                >
                  Anterior
                </button>
                <span className="log-pager-info num">
                  {datos.pagina} / {datos.paginas}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setPagina((p) => Math.min(datos.paginas, p + 1))}
                  disabled={pagina >= datos.paginas || cargando}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
