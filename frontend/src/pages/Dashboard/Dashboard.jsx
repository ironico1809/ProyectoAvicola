import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Bird, Skull, Thermometer,
  Package, LogOut, User
} from 'lucide-react'
import './Dashboard.css'

const navItems = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', active: true },
  { icon: <Bird size={20} />, label: 'Galpones' },
  { icon: <Package size={20} />, label: 'Inventario' },
  { icon: <Thermometer size={20} />, label: 'Clima' },
]

const cards = [
  {
    label: 'Total de Pollos',
    value: '4,280',
    trend: '+120 hoy',
    trendType: 'trend-up',
    icon: <Bird size={24} color="#f59e0b" />,
    iconBg: '#fef3c7',
  },
  {
    label: 'Mortalidad del Día',
    value: '12',
    trend: '+3 vs ayer',
    trendType: 'trend-down',
    icon: <Skull size={24} color="#dc2626" />,
    iconBg: '#fee2e2',
  },
  {
    label: 'Stock de Alimento',
    value: '850 kg',
    trend: 'Bajo stock',
    trendType: 'trend-warn',
    icon: <Package size={24} color="#d97706" />,
    iconBg: '#fef3c7',
  },
  {
    label: 'Temperatura Galpón',
    value: '28°C',
    trend: 'Normal',
    trendType: 'trend-up',
    icon: <Thermometer size={24} color="#2563eb" />,
    iconBg: '#dbeafe',
  },
]

const alerts = [
  { type: 'warn', icon: <Package size={20} color="#d97706" />, title: 'Stock de alimento bajo', desc: 'Quedan menos de 1000 kg en inventario' },
  { type: 'danger', icon: <Thermometer size={20} color="#dc2626" />, title: 'Temperatura crítica en Galpón 3', desc: 'Se detectaron 35°C, revisar ventilación' },
  { type: 'info', icon: <Bird size={20} color="#2563eb" />, title: 'Lote #5 listo para comercialización', desc: '800 pollos alcanzaron el peso ideal' },
]

function Dashboard() {
  const navigate = useNavigate()

  const handleLogout = () => {
    navigate('/')
  }

  return (
    <div className="dashboard-page">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="logo" />
          <span>AviGranja</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => (
            <button key={i} className={`nav-item ${item.active ? 'active' : ''}`}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className="main-content">
        <div className="topbar">
          <div>
            <h1>Dashboard</h1>
            <p>Resumen general de la granja</p>
          </div>
          <div className="user-badge">
            <User size={18} color="#78350f" />
            <span>Administrador</span>
          </div>
        </div>

        {/* Tarjetas */}
        <div className="cards-grid">
          {cards.map((card, i) => (
            <div key={i} className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon" style={{ background: card.iconBg }}>
                  {card.icon}
                </div>
                <span className={`stat-card-trend ${card.trendType}`}>{card.trend}</span>
              </div>
              <div className="stat-card-value">{card.value}</div>
              <div className="stat-card-label">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Alertas */}
        <div className="alerts-section">
          <h2>Alertas Recientes</h2>
          {alerts.map((alert, i) => (
            <div key={i} className={`alert-item ${alert.type}`}>
              {alert.icon}
              <div className="alert-text">
                <strong>{alert.title}</strong>
                <span>{alert.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </main>

    </div>
  )
}

export default Dashboard
