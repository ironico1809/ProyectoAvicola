import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import './ChangePasswordPage.css';

/**
 * Pantalla de cambio de contraseña obligatorio para nuevos suscriptores.
 * Se muestra cuando el usuario tiene must_change_password === true.
 * Una vez exitoso, actualiza localStorage y redirige al dashboard.
 */
function ChangePasswordPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nueva_password: '',
    confirmar_password: '',
  });
  const [showPass, setShowPass] = useState({ nueva: false, confirmar: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Información del usuario actual (para mostrar su nombre)
  const usuarioRaw = localStorage.getItem('usuario');
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // Validación de fortaleza simple
  const getStrength = (pwd) => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const map = [
      { level: 0, label: '', color: '' },
      { level: 1, label: 'Débil', color: '#ef4444' },
      { level: 2, label: 'Regular', color: '#f59e0b' },
      { level: 3, label: 'Buena', color: '#3b82f6' },
      { level: 4, label: 'Fuerte', color: '#22c55e' },
    ];
    return map[score];
  };

  const strength = getStrength(form.nueva_password);
  const passwordsMatch =
    form.confirmar_password.length > 0 &&
    form.nueva_password === form.confirmar_password;
  const passwordsMismatch =
    form.confirmar_password.length > 0 &&
    form.nueva_password !== form.confirmar_password;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.nueva_password !== form.confirmar_password) {
      setError('Las contraseñas no coinciden. Verifica e intenta de nuevo.');
      return;
    }
    if (form.nueva_password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/usuarios/cambiar-password-obligatorio/', {
        nueva_password: form.nueva_password,
        confirmar_password: form.confirmar_password,
      });

      // Actualizar usuario en localStorage con must_change_password: false
      const usuarioActualizado = res.data.usuario;
      if (usuarioActualizado) {
        localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
      } else {
        // Fallback: actualizar campo manualmente
        const actual = JSON.parse(localStorage.getItem('usuario') || '{}');
        actual.must_change_password = false;
        localStorage.setItem('usuario', JSON.stringify(actual));
      }

      setSuccess(true);

      // Redirigir al dashboard tras breve pausa de éxito
      setTimeout(() => navigate('/dashboard'), 1800);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Error al actualizar la contraseña. Intenta de nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ── Pantalla de éxito ── */
  if (success) {
    return (
      <div className="cp-root">
        <div className="cp-bg" />
        <div className="cp-overlay" />
        <div className="cp-card cp-card--success">
          <div className="cp-success-icon">
            <CheckCircle size={56} color="#22c55e" />
          </div>
          <h2 className="cp-success-title">¡Contraseña actualizada!</h2>
          <p className="cp-success-subtitle">
            Redirigiendo al dashboard…
          </p>
          <div className="cp-success-bar" />
        </div>
      </div>
    );
  }

  return (
    <div className="cp-root">
      <div className="cp-bg" />
      <div className="cp-overlay" />

      <div className="cp-card">
        {/* Header */}
        <div className="cp-header">
          <div className="cp-lock-icon">
            <Lock size={28} color="#d97706" />
          </div>
          <h1 className="cp-title">Configura tu Contraseña</h1>
          <p className="cp-subtitle">
            {usuario?.nom_usuario && (
              <span>Hola, <strong>{usuario.nom_usuario}</strong>. </span>
            )}
            Por seguridad, debes establecer una contraseña personal antes de continuar.
          </p>
        </div>

        {/* Aviso informativo */}
        <div className="cp-info-banner">
          🔑 Recibirás acceso completo al sistema una vez que establezcas tu contraseña.
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="cp-form">
          {/* Nueva contraseña */}
          <div className="cp-form-group">
            <label className="cp-label" htmlFor="cp-nueva">
              Nueva contraseña
            </label>
            <div className="cp-input-wrap">
              <Lock size={16} className="cp-input-icon" />
              <input
                id="cp-nueva"
                name="nueva_password"
                type={showPass.nueva ? 'text' : 'password'}
                className="cp-input"
                placeholder="Mínimo 8 caracteres"
                value={form.nueva_password}
                onChange={handleChange}
                required
                autoFocus
                autoComplete="new-password"
              />
              <button
                type="button"
                className="cp-eye-btn"
                onClick={() => setShowPass((s) => ({ ...s, nueva: !s.nueva }))}
                aria-label="Mostrar/ocultar contraseña"
              >
                {showPass.nueva ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Barra de fortaleza */}
            {form.nueva_password.length > 0 && (
              <div className="cp-strength">
                <div className="cp-strength-bars">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="cp-strength-bar"
                      style={{
                        background:
                          n <= strength.level ? strength.color : '#e2e8f0',
                      }}
                    />
                  ))}
                </div>
                {strength.label && (
                  <span
                    className="cp-strength-label"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div className="cp-form-group">
            <label className="cp-label" htmlFor="cp-confirmar">
              Confirmar contraseña
            </label>
            <div
              className={`cp-input-wrap${passwordsMatch ? ' cp-input-wrap--ok' : ''}${passwordsMismatch ? ' cp-input-wrap--err' : ''}`}
            >
              <Lock size={16} className="cp-input-icon" />
              <input
                id="cp-confirmar"
                name="confirmar_password"
                type={showPass.confirmar ? 'text' : 'password'}
                className="cp-input"
                placeholder="Repite la contraseña"
                value={form.confirmar_password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="cp-eye-btn"
                onClick={() =>
                  setShowPass((s) => ({ ...s, confirmar: !s.confirmar }))
                }
                aria-label="Mostrar/ocultar confirmación"
              >
                {showPass.confirmar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordsMatch && (
              <span className="cp-match-ok">✓ Las contraseñas coinciden</span>
            )}
            {passwordsMismatch && (
              <span className="cp-match-err">✗ Las contraseñas no coinciden</span>
            )}
          </div>

          {/* Error global */}
          {error && <p className="cp-error">⚠️ {error}</p>}

          {/* Botón */}
          <button
            id="cp-submit-btn"
            type="submit"
            className={`cp-btn${loading ? ' cp-btn--loading' : ''}`}
            disabled={loading || passwordsMismatch}
          >
            {loading ? (
              <><span className="cp-spinner" /> Actualizando…</>
            ) : (
              <>🔒 Establecer Contraseña y Entrar</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordPage;
