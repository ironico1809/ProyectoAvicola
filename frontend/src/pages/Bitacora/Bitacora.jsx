import { useState, useEffect } from 'react'
import { ClipboardList, Calendar, User, Activity, Search } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'
import api from '../../api/axios'

function Bitacora() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    fetchBitacora()
  }, [])

  const fetchBitacora = async () => {
    try {
      // Ajusta la URL según tu backend, ej: /bitacora/ o /usuarios/bitacora/
      const res = await api.get('/bitacora/')
      setLogs(res.data)
    } catch (error) {
      console.error("Error al cargar bitácora", error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrado simple por nombre de usuario o acción
  const logsFiltrados = logs.filter(log => 
    log.nom_usuario?.toLowerCase().includes(filtro.toLowerCase()) ||
    log.accion?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif" }}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main style={{ marginLeft: sidebarOpen ? '240px' : '70px', flex: 1, padding: '32px', transition: 'margin-left 0.3s ease' }}>
        <Topbar titulo="Bitácora" subtitulo="Historial de actividades del sistema" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Buscador */}
        <div style={searchContainerStyle}>
          <Search size={18} color="#9ca3af" />
          <input 
            type="text" 
            placeholder="Buscar por usuario o acción..." 
            style={searchInputStyle}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        <div style={tableCardStyle}>
          {loading ? (
            <p style={{ color: '#9ca3af', padding: '20px' }}>Cargando historial...</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={headerRowStyle}>
                  <th style={thStyle}><User size={14} style={iconMargin} /> Usuario</th>
                  <th style={thStyle}><Activity size={14} style={iconMargin} /> Acción</th>
                  <th style={thStyle}><Calendar size={14} style={iconMargin} /> Fecha y Hora</th>
                </tr>
              </thead>
              <tbody>
                {logsFiltrados.map((log, i) => (
                  <tr key={i} style={rowStyle}>
                    <td style={tdStyle}><strong>{log.nom_usuario}</strong></td>
                    <td style={tdStyle}>{log.accion}</td>
                    <td style={tdStyle}>{new Date(log.fecha).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}

// ESTILOS (Siguiendo tu línea de diseño)
const searchContainerStyle = { display: 'flex', alignItems: 'center', background: '#fff', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '24px', width: 'fit-content', gap: '10px' }
const searchInputStyle = { border: 'none', outline: 'none', fontSize: '14px', width: '250px' }
const tableCardStyle = { background: '#fff', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' }
const headerRowStyle = { background: '#f8fafc', borderBottom: '2px solid #f1f5f9' }
const thStyle = { padding: '16px', fontSize: '13px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }
const rowStyle = { borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }
const tdStyle = { padding: '16px', fontSize: '14px', color: '#334155' }
const iconMargin = { marginRight: '6px', verticalAlign: 'middle' }

export default Bitacora
