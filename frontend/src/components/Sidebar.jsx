import { LayoutDashboard, Bird, Package, Thermometer, LogOut, ChevronLeft, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { icon: <LayoutDashboard size={20} />, label: 'Dashboard', active: true },
  { icon: <Bird size={20} />, label: 'Galpones' },
  { icon: <Package size={20} />, label: 'Inventario' },
  { icon: <Thermometer size={20} />, label: 'Clima' },
]

function Sidebar({ open, setOpen }) {
  const navigate = useNavigate()

  return (
    <aside style={{ ...sidebarStyle, width: open ? '240px' : '70px' }}>
      {/* Logo */}
      <div style={logoStyle}>
        {open && <img src="/logo.png" alt="logo" style={imgStyle} />}
        {open && <span style={logoTextStyle}>AviGranja</span>}
        <button onClick={() => setOpen(!open)} style={{ ...toggleStyle, marginLeft: open ? 'auto' : '0' }}>
          {open ? <ChevronLeft size={18} color="#fef3c7" /> : <img src="/logo.png" alt="logo" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #fbbf24' }} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={navStyle}>
        {navItems.map((item, i) => (
          <button
            key={i}
            title={item.label}
            style={item.active ? { ...navItemStyle, ...activeStyle, justifyContent: open ? 'flex-start' : 'center' } : { ...navItemStyle, justifyContent: open ? 'flex-start' : 'center' }}
          >
            <span style={iconStyle}>{item.icon}</span>
            {open && <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={footerStyle}>
        <button
          title="Cerrar Sesión"
          style={{ ...logoutStyle, justifyContent: open ? 'flex-start' : 'center' }}
          onClick={() => navigate('/')}
        >
          <span style={iconStyle}><LogOut size={20} /></span>
          {open && <span style={{ fontSize: '14px', whiteSpace: 'nowrap' }}>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  )
}

const sidebarStyle = {
  background: 'linear-gradient(180deg, #78350f 0%, #92400e 100%)',
  display: 'flex',
  flexDirection: 'column',
  position: 'fixed',
  top: 0, left: 0,
  height: '100vh',
  zIndex: 100,
  transition: 'width 0.3s ease',
  overflow: 'hidden',
}
const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '16px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  minHeight: '70px',
}
const imgStyle = {
  width: '38px', height: '38px',
  borderRadius: '50%',
  objectFit: 'cover',
  border: '2px solid #fbbf24',
  flexShrink: 0,
}
const logoTextStyle = {
  fontSize: '17px', fontWeight: '700',
  color: '#fef3c7', flex: 1,
  whiteSpace: 'nowrap',
}
const toggleStyle = {
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: '8px',
  padding: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
}
const navStyle = {
  display: 'flex', flexDirection: 'column',
  padding: '16px 10px', gap: '4px', flex: 1,
}
const navItemStyle = {
  display: 'flex', alignItems: 'center',
  gap: '12px', padding: '12px 14px',
  borderRadius: '12px', color: 'rgba(255,255,255,0.75)',
  cursor: 'pointer', border: 'none',
  background: 'transparent', width: '100%',
  fontFamily: "'Poppins', sans-serif",
  transition: 'all 0.2s',
}
const activeStyle = { background: '#f59e0b', color: 'white' }
const iconStyle = { display: 'flex', alignItems: 'center', flexShrink: 0 }
const footerStyle = { padding: '16px 10px', borderTop: '1px solid rgba(255,255,255,0.1)' }
const logoutStyle = { ...navItemStyle, color: 'rgba(255,255,255,0.75)' }

export default Sidebar