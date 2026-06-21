import { useState } from 'react'
import { User, Lock, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { styles } from './Login.styles'

function Login() {
  const [form, setForm] = useState({ nom_usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [focusField, setFocusField] = useState(null)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/usuarios/login/', form)
      localStorage.setItem('access_token', res.data.access)
      localStorage.setItem('refresh_token', res.data.refresh)
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario))

      if (res.data.usuario?.must_change_password) {
        navigate('/cambio-password')
      } else if (res.data.usuario?.tipo_usuario === 'Superusuario') {
        navigate('/superadmin')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const inputGroupStyle = (field) => ({
    ...styles.inputGroup,
    ...(focusField === field ? styles.inputGroupFocus : {}),
  })

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div style={styles.pageBg} />

      <div style={styles.card}>
        <div style={styles.topPanel}>
          <div style={styles.topOverlay} />
          <div style={styles.topContent}>
            <div style={styles.logoWrapper}>
              <img src="/logo.png" alt="Logo" style={styles.logo} />
            </div>
            <h1 style={styles.brandTitle}>AviGranja</h1>
            <p style={styles.brandSubtitle}>Sistema de Gestión Avícola</p>
          </div>
        </div>

        <div style={styles.bottomPanel}>
          <h2 style={styles.welcomeText}>Iniciar Sesión</h2>
          <p style={styles.welcomeSub}>Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={inputGroupStyle('user')}>
              <User size={18} style={styles.inputIcon} />
              <input
                name="nom_usuario"
                placeholder="Usuario"
                value={form.nom_usuario}
                onChange={handleChange}
                onFocus={() => setFocusField('user')}
                onBlur={() => setFocusField(null)}
                style={styles.input}
                required
              />
            </div>

            <div style={inputGroupStyle('pass')}>
              <Lock size={18} style={styles.inputIcon} />
              <input
                name="password"
                type={showPass ? 'text' : 'password'}
                placeholder="Contraseña"
                value={form.password}
                onChange={handleChange}
                onFocus={() => setFocusField('pass')}
                onBlur={() => setFocusField(null)}
                style={styles.input}
                required
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={styles.togglePassBtn}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button type="button" onClick={() => alert('Comunícate con el administrador del sistema para restablecer tu contraseña.')} style={styles.forgotPass}>
              ¿Olvidaste tu contraseña?
            </button>

            {error && (
              <p style={styles.error}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              style={loading ? { ...styles.button, ...styles.buttonLoading } : styles.button}
              disabled={loading}
            >
              {loading ? <div style={styles.spinner} /> : <LogIn size={18} style={{ marginRight: '8px' }} />}
              {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
            </button>

            <button type="button" onClick={() => navigate('/register')} style={styles.registerBtn}>
              ¿No tienes cuenta? Regístrate
            </button>
          </form>
          <p style={styles.footer}>UAGRM · Sistema Avícola 2026</p>
        </div>
      </div>
    </div>
  )
}

export default Login