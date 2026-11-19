import React, { useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  KeyRound,
  Copy,
  Download,
} from 'lucide-react';

const fechaHora = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SeguridadPage = () => {
  const { usuario, actualizarUsuario } = useContext(AuthContext);

  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Activación: datos del QR y código de confirmación
  const [configuracion, setConfiguracion] = useState(null); // { qr, secreto, uri }
  const [codigo, setCodigo] = useState('');
  const [verSecreto, setVerSecreto] = useState(false);

  // Códigos de respaldo recién emitidos (se muestran una sola vez)
  const [codigosRespaldo, setCodigosRespaldo] = useState(null);

  // Desactivación
  const [desactivando, setDesactivando] = useState(false);
  const [passwordBaja, setPasswordBaja] = useState('');
  const [codigoBaja, setCodigoBaja] = useState('');

  const cargarEstado = async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await api.get('/auth/2fa/estado');
      setEstado(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al consultar el estado del autenticador');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  // Mantiene el usuario en sesión al día con el estado del segundo factor
  const sincronizarUsuario = (habilitado) => {
    if (usuario && usuario.totp_habilitado !== habilitado) {
      actualizarUsuario({ ...usuario, totp_habilitado: habilitado });
    }
  };

  const handleConfigurar = async () => {
    setError(null);
    setExito(null);
    setProcesando(true);
    try {
      const res = await api.post('/auth/2fa/configurar');
      setConfiguracion(res.data);
      setCodigo('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'No se pudo generar el código QR');
    } finally {
      setProcesando(false);
    }
  };

  const handleActivar = async (e) => {
    e.preventDefault();
    setError(null);
    setExito(null);
    setProcesando(true);
    try {
      const res = await api.post('/auth/2fa/activar', { codigo: codigo.trim() });
      setCodigosRespaldo(res.data.codigos_respaldo);
      setConfiguracion(null);
      setCodigo('');
      setExito('Autenticador activado. Guarda tus códigos de respaldo antes de continuar.');
      sincronizarUsuario(true);
      cargarEstado();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'No se pudo activar el autenticador');
      setCodigo('');
    } finally {
      setProcesando(false);
    }
  };

  const handleDesactivar = async (e) => {
    e.preventDefault();
    setError(null);
    setExito(null);
    setProcesando(true);
    try {
      await api.post('/auth/2fa/desactivar', {
        password: passwordBaja,
        codigo: codigoBaja.trim(),
      });
      setDesactivando(false);
      setPasswordBaja('');
      setCodigoBaja('');
      setCodigosRespaldo(null);
      setExito('El autenticador quedó desactivado. Tu cuenta ahora entra solo con contraseña.');
      sincronizarUsuario(false);
      cargarEstado();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'No se pudo desactivar el autenticador');
    } finally {
      setProcesando(false);
    }
  };

  const handleRegenerar = async () => {
    const password = window.prompt('Confirma tu contraseña para emitir códigos nuevos:');
    if (!password) return;

    setError(null);
    setExito(null);
    setProcesando(true);
    try {
      const res = await api.post('/auth/2fa/codigos-respaldo', { password });
      setCodigosRespaldo(res.data.codigos_respaldo);
      setExito('Se emitieron códigos nuevos. Los anteriores dejaron de servir.');
      cargarEstado();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'No se pudieron generar los códigos');
    } finally {
      setProcesando(false);
    }
  };

  const copiarCodigos = async () => {
    try {
      await navigator.clipboard.writeText(codigosRespaldo.join('\n'));
      setExito('Códigos copiados al portapapeles.');
    } catch {
      setError('El navegador no permitió copiar. Anótalos manualmente.');
    }
  };

  const descargarCodigos = () => {
    const contenido = [
      'Códigos de respaldo - Seguimiento de Tutorías Académicas',
      `Cuenta: ${usuario?.correo || ''}`,
      `Emitidos: ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}`,
      '',
      'Cada código sirve una sola vez.',
      '',
      ...codigosRespaldo.map((c, i) => `${i + 1}. ${c}`),
    ].join('\n');

    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/plain' }));
    enlace.download = 'codigos-respaldo-tutorias.txt';
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  const habilitado = estado?.habilitado;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Cuenta</span>
          <h1>Seguridad</h1>
          <p>
            Agrega un segundo factor al inicio de sesión: además de tu contraseña se pedirá un
            código temporal generado en tu teléfono.
          </p>
        </div>
        <div className="page-head-aside">
          <span className={`state ${habilitado ? 'state-completada' : 'state-cancelada'}`}>
            {habilitado ? 'Autenticador activo' : 'Solo contraseña'}
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

        {exito && (
          <div className="notice notice-ok">
            <CheckCircle2 size={16} />
            <span>{exito}</span>
          </div>
        )}

        {cargando ? (
          <div className="panel">
            <div className="loadbar" />
            <p className="loading-note">Consultando el estado de tu cuenta…</p>
          </div>
        ) : (
          <>
            {/* ---------- Estado actual ---------- */}
            <div className="panel">
              <div className="panel-head">
                <h2>Verificación en dos pasos</h2>
                <span className="eyebrow">{habilitado ? 'Activa' : 'Inactiva'}</span>
              </div>

              <div className="panel-body">
                <div className="sec-state">
                  <span className={`sec-badge ${habilitado ? 'is-on' : ''}`} aria-hidden="true">
                    {habilitado ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
                  </span>
                  <div>
                    <p className="sec-state-title">
                      {habilitado
                        ? 'Tu cuenta pide un código además de la contraseña'
                        : 'Tu cuenta entra solo con la contraseña'}
                    </p>
                    <p className="sec-state-sub">
                      {habilitado
                        ? `Activado el ${fechaHora(estado.activado_en)} · ${
                            estado.codigos_respaldo_disponibles
                          } de ${estado.codigos_respaldo_total} códigos de respaldo sin usar.`
                        : 'Si alguien obtuviera tu contraseña podría entrar al sistema con tu nombre.'}
                    </p>
                  </div>
                </div>

                {habilitado ? (
                  <div className="sec-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleRegenerar}
                      disabled={procesando}
                    >
                      <KeyRound size={14} />
                      Emitir códigos de respaldo nuevos
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-text"
                      onClick={() => setDesactivando(!desactivando)}
                      disabled={procesando}
                    >
                      Desactivar el autenticador
                    </button>
                  </div>
                ) : (
                  !configuracion && (
                    <button
                      type="button"
                      className="btn btn-solid"
                      onClick={handleConfigurar}
                      disabled={procesando}
                    >
                      <ShieldCheck size={15} />
                      {procesando ? 'Generando…' : 'Activar el autenticador'}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* ---------- Alta: QR + confirmación ---------- */}
            {configuracion && (
              <div className="panel">
                <div className="panel-head">
                  <h2>Vincula tu aplicación</h2>
                  <span className="eyebrow">Paso 1 de 2</span>
                </div>

                <div className="panel-body">
                  <div className="sec-setup">
                    <div className="sec-qr">
                      <img src={configuracion.qr} alt="Código QR del autenticador" />
                    </div>

                    <div className="sec-setup-steps">
                      <ol className="sec-steps">
                        <li>
                          <Smartphone size={14} />
                          Instala Google Authenticator, Microsoft Authenticator o similar.
                        </li>
                        <li>Elige “Escanear código QR” y apunta a la imagen de la izquierda.</li>
                        <li>Escribe abajo el código de 6 dígitos que aparece en la aplicación.</li>
                      </ol>

                      <div className="sec-secret">
                        <span className="eyebrow">Si no puedes escanear</span>
                        <p className="sec-secret-row">
                          <code className="code">
                            {verSecreto ? configuracion.secreto : '•'.repeat(32)}
                          </code>
                          <button
                            type="button"
                            className="btn btn-sm btn-quiet"
                            onClick={() => setVerSecreto(!verSecreto)}
                          >
                            {verSecreto ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </p>
                        <span className="field-hint">
                          Ingresa esta clave manualmente en tu aplicación y no la compartas con
                          nadie.
                        </span>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleActivar} className="form sec-confirm">
                    <div className="field">
                      <label htmlFor="codigo-activacion">Código de 6 dígitos</label>
                      <input
                        type="text"
                        id="codigo-activacion"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        required
                      />
                      <span className="field-hint">
                        El código cambia cada 30 segundos. Si falla, revisa que la hora del
                        teléfono esté en automático.
                      </span>
                    </div>

                    <div className="sec-actions">
                      <button
                        type="submit"
                        className="btn btn-solid"
                        disabled={procesando || codigo.length !== 6}
                      >
                        {procesando ? 'Verificando…' : 'Confirmar y activar'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => {
                          setConfiguracion(null);
                          setCodigo('');
                        }}
                        disabled={procesando}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ---------- Códigos de respaldo (una sola vez) ---------- */}
            {codigosRespaldo && (
              <div className="panel">
                <div className="panel-head">
                  <h2>Códigos de respaldo</h2>
                  <span className="eyebrow">Se muestran una sola vez</span>
                </div>

                <div className="panel-body">
                  <p className="panel-note">
                    Guárdalos en un lugar seguro. Cada código permite entrar una vez si pierdes el
                    acceso a tu teléfono. No volverán a mostrarse: el sistema solo conserva su
                    huella cifrada.
                  </p>

                  <ul className="sec-codes">
                    {codigosRespaldo.map((codigoRespaldo) => (
                      <li key={codigoRespaldo} className="code">
                        {codigoRespaldo}
                      </li>
                    ))}
                  </ul>

                  <div className="sec-actions">
                    <button type="button" className="btn btn-sm" onClick={copiarCodigos}>
                      <Copy size={14} />
                      Copiar
                    </button>
                    <button type="button" className="btn btn-sm" onClick={descargarCodigos}>
                      <Download size={14} />
                      Descargar .txt
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-quiet"
                      onClick={() => setCodigosRespaldo(null)}
                    >
                      Ya los guardé
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------- Baja del autenticador ---------- */}
            {habilitado && desactivando && (
              <div className="panel">
                <div className="panel-head">
                  <h2>Desactivar el autenticador</h2>
                  <span className="eyebrow">Requiere confirmación</span>
                </div>

                <div className="panel-body">
                  <p className="panel-note">
                    Al desactivarlo tu cuenta volverá a entrar solo con la contraseña y los códigos
                    de respaldo actuales se eliminarán.
                  </p>

                  <form onSubmit={handleDesactivar} className="form">
                    <div className="field-pair">
                      <div className="field">
                        <label htmlFor="password-baja">Tu contraseña</label>
                        <input
                          type="password"
                          id="password-baja"
                          autoComplete="current-password"
                          value={passwordBaja}
                          onChange={(e) => setPasswordBaja(e.target.value)}
                          required
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="codigo-baja">Código actual o de respaldo</label>
                        <input
                          type="text"
                          id="codigo-baja"
                          inputMode="text"
                          placeholder="000000"
                          value={codigoBaja}
                          onChange={(e) => setCodigoBaja(e.target.value.toUpperCase())}
                          required
                        />
                      </div>
                    </div>

                    <div className="sec-actions">
                      <button
                        type="submit"
                        className="btn btn-danger"
                        disabled={procesando}
                      >
                        {procesando ? 'Desactivando…' : 'Confirmar desactivación'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => {
                          setDesactivando(false);
                          setPasswordBaja('');
                          setCodigoBaja('');
                        }}
                        disabled={procesando}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SeguridadPage;
