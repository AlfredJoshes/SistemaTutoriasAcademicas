import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import { GraduationCap, AlertCircle, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import './LoginPage.css';

// El token temporal del segundo factor dura 5 minutos (JWT_2FA_EXPIRES_IN)
const SEGUNDOS_VERIFICACION = 300;

const mmss = (total) => {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const LoginPage = () => {
  const [modoRegister, setModoRegister] = useState(false);
  const [formData, setFormData] = useState({
    nombre_completo: '',
    correo: '',
    password: '',
    rol: 'estudiante',
    area_apoyo: '',
  });

  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  // Segundo factor: se activa cuando el backend responde requiere_2fa
  const [verificacion, setVerificacion] = useState(null); // { token_temporal, nombre_completo }
  const [codigo, setCodigo] = useState('');
  const [usarRespaldo, setUsarRespaldo] = useState(false);
  const [restante, setRestante] = useState(SEGUNDOS_VERIFICACION);

  const panelRef = useRef(null);
  const codigoRef = useRef(null);

  const { login, usuario, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();

  const destinoPorRol = (rol) => {
    if (rol === 'tutor') return '/disponibilidad';
    if (rol === 'coordinador') return '/registros';
    return '/tutores';
  };

  // Si el usuario ya está autenticado, redirigir inmediatamente a su vista según rol
  useEffect(() => {
    if (isAuthenticated && usuario?.rol) {
      navigate(destinoPorRol(usuario.rol), { replace: true });
    }
  }, [isAuthenticated, usuario, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError(null);
  };

  const cambiarModo = (registro) => {
    setModoRegister(registro);
    setError(null);
  };

  // Realce del panel siguiendo al cursor (sin re-render)
  const handlePanelMove = (e) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panel.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    panel.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const detectarCaps = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'));
    }
  };

  // Cuenta atras del token temporal: al agotarse hay que iniciar sesion de nuevo
  useEffect(() => {
    if (!verificacion) return undefined;

    setRestante(SEGUNDOS_VERIFICACION);
    codigoRef.current?.focus();

    const reloj = setInterval(() => {
      setRestante((previo) => {
        if (previo <= 1) {
          clearInterval(reloj);
          setVerificacion(null);
          setCodigo('');
          setError('La verificación expiró. Ingresa tu contraseña de nuevo.');
          return 0;
        }
        return previo - 1;
      });
    }, 1000);

    return () => clearInterval(reloj);
  }, [verificacion]);

  const volverACredenciales = () => {
    setVerificacion(null);
    setCodigo('');
    setUsarRespaldo(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      if (modoRegister) {
        // Peticion a POST /api/auth/registro
        const payload = {
          nombre_completo: formData.nombre_completo,
          correo: formData.correo,
          password: formData.password,
          rol: formData.rol,
          area_apoyo: formData.rol === 'tutor' ? formData.area_apoyo : null,
        };

        const response = await api.post('/auth/registro', payload);
        login(response.data.usuario, response.data.token);
        navigate(destinoPorRol(response.data.usuario.rol));
      } else {
        // Peticion a POST /api/auth/login
        const response = await api.post('/auth/login', {
          correo: formData.correo,
          password: formData.password,
        });

        // La contraseña es correcta pero la cuenta tiene autenticador activo
        if (response.data.requiere_2fa) {
          setVerificacion({
            token_temporal: response.data.token_temporal,
            nombre_completo: response.data.nombre_completo,
          });
          setFormData((previo) => ({ ...previo, password: '' }));
          return;
        }

        login(response.data.usuario, response.data.token);
        navigate(destinoPorRol(response.data.usuario.rol));
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Ocurrió un error al procesar la solicitud';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  // Paso 2: envia el codigo del autenticador o uno de respaldo
  const handleVerificar = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);

    try {
      const response = await api.post('/auth/2fa/verificar', {
        token_temporal: verificacion.token_temporal,
        codigo: codigo.trim(),
      });

      login(response.data.usuario, response.data.token);
      navigate(destinoPorRol(response.data.usuario.rol));
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'No se pudo verificar el código');
      setCodigo('');
      codigoRef.current?.focus();

      // Token temporal vencido o inválido: se vuelve al primer paso
      if (err.response?.status === 401 && /expir/i.test(err.response?.data?.error || '')) {
        setVerificacion(null);
      }
    } finally {
      setCargando(false);
    }
  };

  const handleCodigoChange = (e) => {
    const valor = e.target.value;
    // El autenticador da 6 digitos; los codigos de respaldo son alfanumericos
    setCodigo(usarRespaldo ? valor.toUpperCase().slice(0, 9) : valor.replace(/\D/g, '').slice(0, 6));
    if (error) setError(null);
  };

  const codigoCompleto = usarRespaldo ? codigo.replace(/-/g, '').length >= 8 : codigo.length === 6;

  return (
    <div className="login-page">
      {/* ---------- Panel institucional ---------- */}
      <aside className="lp-panel" ref={panelRef} onMouseMove={handlePanelMove}>
        <div className="lp-panel-head">
          <GraduationCap size={20} strokeWidth={1.75} />
          <span>Seguimiento de Tutorías Académicas</span>
        </div>

        <div className="lp-panel-body">
          <p className="lp-kicker">Universidad Salesiana de Bolivia</p>
          <h1>Sistema Web de Gestión y Seguimiento de Tutorías
          Académicas para Proyectos de Grado y Tesis
          </h1>
          <div className="lp-rule" />
          <p className="lp-lead">
            Plataforma interna para coordinar tutorías: publicación de
            disponibilidad, solicitud y confirmación de sesiones, y registro de bitácoras
            por cada encuentro.
          </p>

          <div className="lp-note">
            El acceso está habilitado para estudiantes y tutores registrados con correo
            institucional, correo electromico <strong>@usalesiana.edu.bo / @gmail.com</strong>.
          </div>
        </div>

        <div className="lp-panel-foot">
          <dl className="lp-meta">
            <div>
              <dt>Soporte</dt>
              <dd>soporte.tutorias@usalesiana.edu.bo</dd>
            </div>
            <div>
              <dt>Atención</dt>
              <dd>Lun a Vie · 08:00 – 18:00</dd>
            </div>
          </dl>
        </div>
      </aside>

      {/* ---------- Formulario ---------- */}
      <main className="lp-main">
        <div className="lp-topbar">
          <GraduationCap size={19} strokeWidth={1.75} />
          <span>Seguimiento de Tutorías Académicas</span>
        </div>

        {/* ===== Paso 2: verificación en dos pasos ===== */}
        {verificacion ? (
          <div className="lp-form-wrap">
            <div className="lp-form-head">
              <span className="lp-step-badge">
                <ShieldCheck size={15} strokeWidth={1.9} />
                Verificación en dos pasos
              </span>
              <h2>Ingresa el código</h2>
              <p>
                {verificacion.nombre_completo
                  ? `Hola, ${verificacion.nombre_completo.split(' ')[0]}. `
                  : ''}
                {usarRespaldo
                  ? 'Escribe uno de los códigos de respaldo que guardaste al activar el autenticador.'
                  : 'Abre tu aplicación de autenticación y escribe el código de 6 dígitos vigente.'}
              </p>
            </div>

            {error && (
              <div className="lp-alert" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerificar} className="lp-form">
              <div className="lp-field">
                <div className="lp-label-row">
                  <label htmlFor="codigo">
                    {usarRespaldo ? 'Código de respaldo' : 'Código del autenticador'}
                  </label>
                  <span className={`lp-countdown ${restante <= 30 ? 'is-low' : ''}`}>
                    {mmss(restante)}
                  </span>
                </div>
                <input
                  ref={codigoRef}
                  type="text"
                  id="codigo"
                  name="codigo"
                  className="lp-otp"
                  inputMode={usarRespaldo ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  placeholder={usarRespaldo ? 'XXXX-XXXX' : '000000'}
                  value={codigo}
                  onChange={handleCodigoChange}
                  required
                />
                <span className="lp-hint">
                  {usarRespaldo
                    ? 'Cada código de respaldo sirve una sola vez.'
                    : 'El código cambia cada 30 segundos.'}
                </span>
              </div>

              <button type="submit" className="lp-submit" disabled={cargando || !codigoCompleto}>
                <span>{cargando ? 'Verificando…' : 'Verificar e ingresar'}</span>
                {cargando && <span className="lp-progress" />}
              </button>
            </form>

            <div className="lp-form-foot">
              <p>
                <button
                  type="button"
                  className="lp-link"
                  onClick={() => {
                    setUsarRespaldo(!usarRespaldo);
                    setCodigo('');
                    setError(null);
                    codigoRef.current?.focus();
                  }}
                >
                  <KeyRound size={13} />
                  {usarRespaldo
                    ? 'Usar el código de la aplicación'
                    : 'No tengo mi teléfono: usar un código de respaldo'}
                </button>
              </p>
              <p>
                <button type="button" className="lp-link" onClick={volverACredenciales}>
                  <ArrowLeft size={13} />
                  Volver al inicio de sesión
                </button>
              </p>
              <p className="lp-foot-note">
                Soporte: soporte.tutorias@usalesiana.edu.bo · Lun a Vie 08:00 – 18:00
              </p>
            </div>
          </div>
        ) : (
          /* ===== Paso 1: correo y contraseña ===== */
          <div className="lp-form-wrap">
            <div className="lp-form-head">
              <h2>{modoRegister ? 'Crear una cuenta' : 'Acceso al sistema'}</h2>
              <p>
                {modoRegister
                  ? 'Completa los datos para habilitar tu cuenta en la plataforma.'
                  : 'Ingresa con tu correo institucional y contraseña.'}
              </p>
            </div>

            <div className="lp-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!modoRegister}
                className={!modoRegister ? 'is-active' : ''}
                onClick={() => cambiarModo(false)}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modoRegister}
                className={modoRegister ? 'is-active' : ''}
                onClick={() => cambiarModo(true)}
              >
                Registrarse
              </button>
              <span className={`lp-tab-bar ${modoRegister ? 'is-register' : ''}`} />
            </div>

            {error && (
              <div className="lp-alert" role="alert">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="lp-form">
              {/* Nombre completo — solo en registro */}
              <div
                className={`lp-collapse lp-collapse-top ${modoRegister ? 'is-open' : ''}`}
                aria-hidden={!modoRegister}
              >
                <div>
                  <div className="lp-collapse-inner">
                    <div className="lp-field">
                      <label htmlFor="nombre_completo">Nombre completo</label>
                      <input
                        type="text"
                        id="nombre_completo"
                        name="nombre_completo"
                        autoComplete="name"
                        value={formData.nombre_completo}
                        onChange={handleChange}
                        required={modoRegister}
                        disabled={!modoRegister}
                        tabIndex={modoRegister ? 0 : -1}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="lp-field">
                <label htmlFor="correo">Correo institucional</label>
                <input
                  type="email"
                  id="correo"
                  name="correo"
                  placeholder="nombre.apellido@usalesiana.edu.bo"
                  autoComplete="email"
                  value={formData.correo}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="lp-field">
                <div className="lp-label-row">
                  <label htmlFor="password">Contraseña</label>
                  <button
                    type="button"
                    className="lp-toggle"
                    onClick={() => setVerPassword(!verPassword)}
                  >
                    {verPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <input
                  type={verPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  autoComplete={modoRegister ? 'new-password' : 'current-password'}
                  value={formData.password}
                  onChange={handleChange}
                  onKeyUp={detectarCaps}
                  onKeyDown={detectarCaps}
                  onBlur={() => setCapsLock(false)}
                  required
                />
                {capsLock && (
                  <span className="lp-caps">
                    <AlertCircle size={13} />
                    Bloq Mayús está activado
                  </span>
                )}
                {modoRegister && !capsLock && (
                  <span className="lp-hint">Usa al menos 8 caracteres.</span>
                )}
              </div>

              {/* Rol y especialidad — solo en registro */}
              <div
                className={`lp-collapse lp-collapse-bottom ${modoRegister ? 'is-open' : ''}`}
                aria-hidden={!modoRegister}
              >
                <div>
                  <div className="lp-collapse-inner">
                    <div className="lp-field">
                      <label htmlFor="rol">Rol en la plataforma</label>
                      <select
                        id="rol"
                        name="rol"
                        value={formData.rol}
                        onChange={handleChange}
                        disabled={!modoRegister}
                        tabIndex={modoRegister ? 0 : -1}
                      >
                        <option value="estudiante">Estudiante</option>
                        <option value="tutor">Tutor académico</option>
                      </select>
                    </div>

                    {formData.rol === 'tutor' && (
                      <div className="lp-field">
                        <label htmlFor="area_apoyo">Área de apoyo</label>
                        <input
                          type="text"
                          id="area_apoyo"
                          name="area_apoyo"
                          placeholder="Metodología de la investigación, SPSS, Álgebra"
                          value={formData.area_apoyo}
                          onChange={handleChange}
                          required={modoRegister && formData.rol === 'tutor'}
                          disabled={!modoRegister}
                          tabIndex={modoRegister ? 0 : -1}
                        />
                        <span className="lp-hint">
                          Materias o herramientas en las que puedes orientar. Sepáralas con comas.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button type="submit" className="lp-submit" disabled={cargando}>
                <span>
                  {cargando
                    ? modoRegister
                      ? 'Creando cuenta…'
                      : 'Verificando…'
                    : modoRegister
                    ? 'Crear cuenta'
                    : 'Ingresar'}
                </span>
                {cargando && <span className="lp-progress" />}
              </button>
            </form>

            <div className="lp-form-foot">
              {modoRegister ? (
                <p>
                  ¿Ya tienes una cuenta?{' '}
                  <button type="button" className="lp-link" onClick={() => cambiarModo(false)}>
                    Inicia sesión
                  </button>
                </p>
              ) : (
                <p>
                  ¿Primera vez en la plataforma?{' '}
                  <button type="button" className="lp-link" onClick={() => cambiarModo(true)}>
                    Crear una cuenta
                  </button>
                </p>
              )}
              <p className="lp-foot-note">
                Soporte: soporte.tutorias@usalesiana.edu.bo · Lun a Vie 08:00 – 18:00
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LoginPage;
