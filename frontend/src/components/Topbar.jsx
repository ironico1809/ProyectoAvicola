import { User, Menu } from 'lucide-react'

function Topbar({ titulo, subtitulo, sidebarOpen, setSidebarOpen }) {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}')

  return (
    <div className="topbar-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={menuBtnStyle} type="button">
            <Menu size={20} color="#78350f" />
          </button>
        )}
        <div className="topbar-title-wrapper">
          <h1 className="topbar-title">{titulo}</h1>
          <p className="topbar-subtitle">{subtitulo}</p>
        </div>
      </div>
      <div className="topbar-badge" style={badgeStyle}>
        <div style={userAvatarStyle}>
          <User size={16} color="#78350f" />
        </div>
        <span style={badgeTextStyle}>{usuario.nom_usuario || 'Usuario'}</span>
      </div>

      <style>{`
        .topbar-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          animation: fadeSlideDown 0.35s ease;
          width: 100%;
          gap: 16px;
        }
        .topbar-title-wrapper {
          min-width: 0;
          flex: 1;
        }
        .topbar-title {
          font-size: 22px;
          font-weight: 700;
          color: #1c1c1c;
          margin: 0;
          white-space: normal;
          word-break: break-word;
        }
        .topbar-subtitle {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 2px;
          white-space: normal;
          word-break: break-word;
        }
        @media (max-width: 768px) {
          .topbar-container {
            flex-direction: column-reverse;
            align-items: stretch;
            gap: 12px;
          }
          .topbar-badge {
            align-self: flex-end;
          }
        }
        @keyframes fadeSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const menuBtnStyle = {
  background: 'white',
  border: '1.5px solid #e5e7eb',
  borderRadius: '10px',
  padding: '8px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  flexShrink: 0,
  transition: 'all 0.2s ease',
}
const badgeStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: 'white',
  padding: '6px 16px 6px 6px',
  borderRadius: '100px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  transition: 'all 0.2s ease',
  flexShrink: 0,
}
const userAvatarStyle = {
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  background: '#fef3c7',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const badgeTextStyle = {
  fontSize: '13px',
  fontWeight: '600',
  color: '#78350f',
}

export default Topbar

