function Modal({ titulo, onClose, children }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>{titulo}</h3>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>
        <div style={{ padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.4)',
  zIndex: 200, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
}
const modalStyle = {
  background: 'white', borderRadius: '20px',
  width: '100%', maxWidth: '460px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  fontFamily: "'Poppins', sans-serif",
}
const headerStyle = {
  display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', padding: '20px 24px',
  borderBottom: '1px solid #f3f4f6',
}
const titleStyle = {
  fontSize: '16px', fontWeight: '700',
  color: '#1c1c1c', margin: 0,
}
const closeBtnStyle = {
  background: 'transparent', border: 'none',
  fontSize: '18px', cursor: 'pointer',
  color: '#9ca3af',
}

export default Modal