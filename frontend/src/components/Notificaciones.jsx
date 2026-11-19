import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Bell, CalendarPlus, CheckCircle2, XCircle, CalendarX, NotebookPen } from 'lucide-react';

// Cada cuánto se vuelve a consultar el contador, en milisegundos
const INTERVALO_SONDEO = 60000;

const ICONOS = {
  sesion_solicitada: CalendarPlus,
  sesion_confirmada: CheckCircle2,
  sesion_rechazada: XCircle,
  sesion_cancelada: CalendarX,
  bitacora_registrada: NotebookPen,
};

const TONOS = {
  sesion_solicitada: 'aviso',
  sesion_confirmada: 'ok',
  sesion_rechazada: 'mal',
  sesion_cancelada: 'mal',
  bitacora_registrada: 'ok',
};

// "hace 5 min", "hace 2 h", "hace 3 d"
const hace = (iso) => {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} d`;
};

const Notificaciones = () => {
  const [abierto, setAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cajaRef = useRef(null);
  const navigate = useNavigate();

  // El contador se consulta en segundo plano aunque el panel esté cerrado
  const cargarContador = useCallback(async () => {
    try {
      const res = await api.get('/notificaciones/contador');
      setNoLeidas(res.data.no_leidas);
    } catch (err) {
      console.error('No se pudo consultar las notificaciones:', err);
    }
  }, []);

  useEffect(() => {
    cargarContador();
    const reloj = setInterval(cargarContador, INTERVALO_SONDEO);
    return () => clearInterval(reloj);
  }, [cargarContador]);

  const cargarListado = async () => {
    try {
      setCargando(true);
      const res = await api.get('/notificaciones', { params: { limite: 15 } });
      setItems(res.data.notificaciones || []);
      setNoLeidas(res.data.no_leidas);
    } catch (err) {
      console.error('No se pudieron cargar las notificaciones:', err);
    } finally {
      setCargando(false);
    }
  };

  const alternar = () => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente) cargarListado();
  };

  // Cerrar al hacer clic fuera del panel o con Escape
  useEffect(() => {
    if (!abierto) return undefined;

    const fuera = (e) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const abrirSesion = async (notificacion) => {
    if (!notificacion.leida_en) {
      try {
        await api.patch(`/notificaciones/${notificacion.id}/leida`);
        setItems((previos) =>
          previos.map((n) =>
            n.id === notificacion.id ? { ...n, leida_en: new Date().toISOString() } : n
          )
        );
        setNoLeidas((n) => Math.max(0, n - 1));
      } catch (err) {
        console.error('No se pudo marcar la notificación:', err);
      }
    }
    setAbierto(false);
    navigate('/sesiones');
  };

  const marcarTodas = async () => {
    try {
      await api.post('/notificaciones/leidas');
      const ahora = new Date().toISOString();
      setItems((previos) => previos.map((n) => ({ ...n, leida_en: n.leida_en || ahora })));
      setNoLeidas(0);
    } catch (err) {
      console.error('No se pudieron marcar las notificaciones:', err);
    }
  };

  return (
    <div className="notif" ref={cajaRef}>
      <button
        type="button"
        className={`notif-bell ${noLeidas > 0 ? 'has-news' : ''}`}
        onClick={alternar}
        aria-label={`Notificaciones${noLeidas > 0 ? `: ${noLeidas} sin leer` : ''}`}
        aria-expanded={abierto}
      >
        <Bell size={17} strokeWidth={1.9} />
        {noLeidas > 0 && <span className="notif-count num">{noLeidas > 9 ? '9+' : noLeidas}</span>}
      </button>

      {abierto && (
        <div className="notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-panel-head">
            <span className="eyebrow">Notificaciones</span>
            {noLeidas > 0 && (
              <button type="button" className="notif-mark" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>

          {cargando ? (
            <p className="notif-empty">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="notif-empty">No tienes avisos por ahora.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => {
                const Icono = ICONOS[n.tipo] || Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`notif-item ${n.leida_en ? '' : 'is-nueva'}`}
                      onClick={() => abrirSesion(n)}
                    >
                      <span className={`notif-icon notif-icon-${TONOS[n.tipo] || 'neutro'}`}>
                        <Icono size={14} />
                      </span>
                      <span className="notif-text">
                        <span className="notif-msg">{n.mensaje}</span>
                        <span className="notif-time">{hace(n.creada_en)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default Notificaciones;
