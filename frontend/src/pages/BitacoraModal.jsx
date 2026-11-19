import React, { useState } from 'react';
import api from '../api/axios';
import { X, AlertCircle } from 'lucide-react';

const hhmm = (h) => (h ? h.slice(0, 5) : '');

const BitacoraModal = ({ sesion, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    asistio: true,
    tema_avanzado: sesion?.tema || '',
    notas: '',
  });

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      await api.post('/bitacora', {
        sesion_id: sesion.id,
        asistio: formData.asistio,
        tema_avanzado: formData.tema_avanzado,
        notas: formData.notas,
      });

      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Error al registrar la bitácora de la sesión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
        <div className="dialog-head">
          <div>
            <span className="eyebrow">
              Bitácora · <span className="code">S-{String(sesion.id).padStart(4, '0')}</span>
            </span>
            <h2>Cierre de sesión</h2>
          </div>
          <button onClick={onClose} className="btn btn-quiet" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <dl className="recap">
              <dt>Estudiante</dt>
              <dd>{sesion.estudiante_nombre}</dd>
              <dt>Fecha</dt>
              <dd>
                {sesion.fecha} · {hhmm(sesion.hora_inicio)}–{hhmm(sesion.hora_fin)}
              </dd>
              <dt>Tema solicitado</dt>
              <dd>{sesion.tema || 'Sin especificar'}</dd>
            </dl>

            {error && (
              <div className="notice notice-error" style={{ marginTop: '1rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form" style={{ marginTop: '1.25rem' }}>
              <label className="check">
                <input
                  type="checkbox"
                  name="asistio"
                  checked={formData.asistio}
                  onChange={handleChange}
                />
                <span>
                  El estudiante asistió a la sesión
                  <br />
                  <span className="field-hint">
                    Desmárcalo si la sesión se dio por no realizada.
                  </span>
                </span>
              </label>

              <div className="field">
                <label htmlFor="tema_avanzado">Contenido tratado</label>
                <input
                  type="text"
                  id="tema_avanzado"
                  name="tema_avanzado"
                  placeholder="Hipótesis y formulación de variables"
                  value={formData.tema_avanzado}
                  onChange={handleChange}
                  required
                />
                <span className="field-hint">
                  Este texto alimenta el ranking de temas del resumen.
                </span>
              </div>

              <div className="field">
                <label htmlFor="notas">Observaciones</label>
                <textarea
                  id="notas"
                  name="notas"
                  rows="4"
                  placeholder="Avances logrados, acuerdos y tareas pendientes."
                  value={formData.notas}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="dialog-foot">
            <button type="button" onClick={onClose} className="btn" disabled={enviando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-solid" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar y completar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BitacoraModal;
