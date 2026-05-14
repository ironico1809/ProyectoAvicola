import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import './LandingPage.css';

/* ────────────────────────────────────────────────
   Datos estáticos de características
──────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: '📊',
    title: 'Monitoreo 24/7',
    desc: 'Visualiza en tiempo real el estado de tus galpones, temperatura y alertas críticas desde cualquier dispositivo.',
  },
  {
    icon: '📋',
    title: 'Reportes Inteligentes',
    desc: 'Genera reportes de productividad, mortalidad y consumo con un clic. Exporta a Excel para análisis avanzados.',
  },
  {
    icon: '💰',
    title: 'Control de Gastos',
    desc: 'Gestiona insumos, proveedores y movimientos de almacén. Conoce el costo real por lote en todo momento.',
  },
  {
    icon: '🔒',
    title: 'Multi-Empresa Seguro',
    desc: 'Arquitectura multi-tenant que garantiza que los datos de tu granja sean completamente privados y aislados.',
  },
];

/* ────────────────────────────────────────────────
   Modal de Onboarding
──────────────────────────────────────────────── */
function OnboardingModal({ plan, onClose }) {
  // Inicialización de la llave pública de Stripe desde las variables de entorno
  const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  const [form, setForm] = useState({ nombre_empresa: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripePublicKey) {
      setError('Falta configurar VITE_STRIPE_PUBLIC_KEY en el archivo .env del frontend.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/pagos/crear-sesion/', {
        plan_id: plan.id,
        email: form.email,
        nombre_empresa: form.nombre_empresa,
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError('No se pudo obtener el enlace de pago. Intenta nuevamente.');
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Error al conectar con el servidor. Intenta más tarde.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Cerrar al hacer clic en el overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="lp-modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="lp-modal">
        <button className="lp-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>

        <div className="lp-modal-header">
          <span className="lp-modal-plan-badge">{plan.nombre}</span>
          <h3 className="lp-modal-title">¡Un paso para comenzar!</h3>
          <p className="lp-modal-subtitle">
            Completa tu información y te redirigiremos al pago seguro con Stripe.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="lp-modal-form">
          <div className="lp-form-group">
            <label className="lp-form-label" htmlFor="modal-empresa">
              🏢 Nombre de tu Granja / Empresa
            </label>
            <input
              id="modal-empresa"
              name="nombre_empresa"
              type="text"
              className="lp-form-input"
              placeholder="Ej: Granja Los Álamos"
              value={form.nombre_empresa}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="lp-form-group">
            <label className="lp-form-label" htmlFor="modal-email">
              ✉️ Correo de Contacto
            </label>
            <input
              id="modal-email"
              name="email"
              type="email"
              className="lp-form-input"
              placeholder="Ej: gerente@migranja.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            <span className="lp-form-hint">
              Recibirás tus credenciales de acceso en este correo.
            </span>
          </div>

          {error && <p className="lp-modal-error">⚠️ {error}</p>}

          <div className="lp-modal-price-summary">
            <span>Total mensual</span>
            <span className="lp-modal-price-amount">
              ${parseFloat(plan.precio_mensual).toFixed(2)} / mes
            </span>
          </div>

          <button
            type="submit"
            className={`lp-modal-btn${loading ? ' lp-modal-btn--loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="lp-spinner" /> Redirigiendo a Stripe…
              </>
            ) : (
              <>🔒 Continuar al Pago Seguro</>
            )}
          </button>

          <p className="lp-modal-security">
            🛡 Pago 100% seguro procesado por Stripe. No guardamos datos de tarjeta.
          </p>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────
   Componente principal
──────────────────────────────────────────────── */
function LandingPage() {
  const navigate = useNavigate();
  const [planes, setPlanes] = useState([]);
  const [loadingPlanes, setLoadingPlanes] = useState(true);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [navScrolled, setNavScrolled] = useState(false);

  // Fetch de planes desde el backend
  useEffect(() => {
    api
      .get('/pagos/planes/')
      .then((res) => setPlanes(Array.isArray(res.data) ? res.data : []))
      .catch(() => setPlanes([]))
      .finally(() => setLoadingPlanes(false));
  }, []);

  // Efecto de scroll para el navbar
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  // Detectar el plan más popular (mayor precio = premium, o marcar manualmente)
  const planMasPopular = planes.length > 1 ? planes[planes.length - 1] : null;

  return (
    <div className="lp-root">

      {/* ── NAVBAR ── */}
      <nav className={`lp-nav${navScrolled ? ' lp-nav--scrolled' : ''}`}>
        <div className="lp-nav-container">
          <div className="lp-nav-brand">
            <img src="/logo.png" alt="AviGranja Logo" className="lp-nav-logo" />
            <span className="lp-nav-brand-name">AviGranja <span className="lp-nav-pro">Pro</span></span>
          </div>

          <ul className="lp-nav-links">
            <li><button onClick={() => scrollTo('inicio')} className="lp-nav-link">Inicio</button></li>
            <li><button onClick={() => scrollTo('caracteristicas')} className="lp-nav-link">Características</button></li>
            <li><button onClick={() => scrollTo('planes')} className="lp-nav-link">Planes</button></li>
          </ul>

          <button
            id="nav-login-btn"
            className="lp-nav-cta"
            onClick={() => navigate('/login')}
          >
            Iniciar Sesión →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section id="inicio" className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-overlay" />

        <div className="lp-hero-content">
          <span className="lp-hero-badge">🐔 Software Avícola Profesional</span>
          <h1 className="lp-hero-title">
            Controla tu Granja.<br />
            <span className="lp-hero-title-accent">Maximiza tu Producción.</span>
          </h1>
          <p className="lp-hero-subtitle">
            La plataforma SaaS diseñada para productores avícolas que quieren tomar
            decisiones inteligentes basadas en datos reales, desde cualquier lugar.
          </p>
          <div className="lp-hero-actions">
            <button
              id="hero-ver-planes-btn"
              className="lp-btn-primary"
              onClick={() => scrollTo('planes')}
            >
              Ver Planes y Precios
            </button>
            <button
              className="lp-btn-ghost"
              onClick={() => scrollTo('caracteristicas')}
            >
              Conocer más ↓
            </button>
          </div>

          <div className="lp-hero-stats">
            <div className="lp-hero-stat">
              <span className="lp-hero-stat-number">24/7</span>
              <span className="lp-hero-stat-label">Monitoreo</span>
            </div>
            <div className="lp-hero-stat-divider" />
            <div className="lp-hero-stat">
              <span className="lp-hero-stat-number">100%</span>
              <span className="lp-hero-stat-label">En la Nube</span>
            </div>
            <div className="lp-hero-stat-divider" />
            <div className="lp-hero-stat">
              <span className="lp-hero-stat-number">Multi</span>
              <span className="lp-hero-stat-label">Empresa</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CARACTERÍSTICAS ── */}
      <section id="caracteristicas" className="lp-features">
        <div className="lp-section-container">
          <div className="lp-section-header">
            <span className="lp-section-eyebrow">¿Por qué AviGranja Pro?</span>
            <h2 className="lp-section-title">Todo lo que tu granja necesita</h2>
            <p className="lp-section-subtitle">
              Herramientas diseñadas específicamente para la industria avícola,
              sin curvas de aprendizaje complicadas.
            </p>
          </div>

          <div className="lp-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" className="lp-pricing">
        <div className="lp-section-container">
          <div className="lp-section-header">
            <span className="lp-section-eyebrow">Precios Transparentes</span>
            <h2 className="lp-section-title">Elige tu Plan</h2>
            <p className="lp-section-subtitle">
              Sin costos ocultos. Cancela cuando quieras.
            </p>
          </div>

          {loadingPlanes ? (
            <div className="lp-pricing-loading">
              <div className="lp-spinner lp-spinner--dark" />
              <span>Cargando planes…</span>
            </div>
          ) : planes.length === 0 ? (
            <p className="lp-pricing-empty">No hay planes disponibles por el momento.</p>
          ) : (
            <div className="lp-pricing-grid">
              {planes.map((plan) => {
                const isPopular = planMasPopular?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`lp-plan-card${isPopular ? ' lp-plan-card--popular' : ''}`}
                  >
                    {isPopular && (
                      <div className="lp-plan-badge">⭐ Más Popular</div>
                    )}
                    <div className="lp-plan-header">
                      <h3 className="lp-plan-name">{plan.nombre}</h3>
                      <div className="lp-plan-price">
                        <span className="lp-plan-currency">$</span>
                        <span className="lp-plan-amount">
                          {parseFloat(plan.precio_mensual).toFixed(0)}
                        </span>
                        <span className="lp-plan-period">/mes</span>
                      </div>
                    </div>

                    <ul className="lp-plan-features">
                      {plan.max_galpones ? (
                        <li>✓ Hasta {plan.max_galpones} galpones</li>
                      ) : (
                        <li>✓ Galpones ilimitados</li>
                      )}
                      {plan.max_usuarios ? (
                        <li>✓ Hasta {plan.max_usuarios} usuarios</li>
                      ) : (
                        <li>✓ Usuarios ilimitados</li>
                      )}
                      <li>✓ Monitoreo de temperatura</li>
                      <li>✓ Control de lotes y mortalidad</li>
                      <li>✓ Reportes exportables</li>
                      <li>✓ Soporte por email</li>
                      {isPopular && <li>✓ Soporte prioritario</li>}
                    </ul>

                    <button
                      id={`plan-contratar-${plan.id}`}
                      className={`lp-plan-btn${isPopular ? ' lp-plan-btn--popular' : ''}`}
                      onClick={() => setPlanSeleccionado(plan)}
                    >
                      Contratar Plan →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-container">
          <div className="lp-footer-brand">
            <img src="/logo.png" alt="AviGranja" className="lp-footer-logo" />
            <span className="lp-footer-brand-name">AviGranja Pro</span>
          </div>
          <p className="lp-footer-copy">
            © 2026 AviGranja Pro · Todos los derechos reservados · UAGRM
          </p>
          <button
            className="lp-footer-login"
            onClick={() => navigate('/login')}
          >
            Iniciar Sesión
          </button>
        </div>
      </footer>

      {/* ── MODAL ── */}
      {planSeleccionado && (
        <OnboardingModal
          plan={planSeleccionado}
          onClose={() => setPlanSeleccionado(null)}
        />
      )}
    </div>
  );
}

export default LandingPage;
