import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'
import Modal from '../../components/Modal'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import api from '../../api/axios'

function Galpones() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [galpones, setGalpones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showVerModal, setShowVerModal] = useState(false)
  const [galponSeleccionado, setGalponSeleccionado] = useState(null)
  const [form, setForm] = useState({ nombre: '', capacidad: '', descripcion: '', estado: 'activo' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => { fetchGalpones() }, [])

  const fetchGalpones = async () => {
    try {
      const res = await api.get('/galpones/')
      setGalpones(res.data)
    } catch {
      console.error('Error al cargar galpones')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setFormError('')
  }

  const resetForm = () => {
    setForm({ nombre: '', capacidad: '', descripcion: '', estado: 'activo' })
    setFormError('')
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/galpones/', { ...form, capacidad: Number(form.capacidad) })
      setShowModal(false)
      resetForm()
      fetchGalpones()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Error al crear el galpón')
    } finally {
      setSaving(false)
    }
  }

  const handleEditarClick = (g) => {
    setGalponSeleccionado(g)
    setForm({ nombre: g.nombre, capacidad: g.capacidad, descripcion: g.descripcion || '', estado: g.estado })
    setShowEditModal(true)
  }

  const handleEditar = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/galpones/${galponSeleccionado.id}/`, { ...form, capacidad: Number(form.capacidad) })
      setShowEditModal(false)
      fetchGalpones()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Error al editar el galpón')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async () => {
    setSaving(true)
    try {
      await api.delete(`/galpones/${galponSeleccionado.id}/`)
      setShowDeleteModal(false)
      fetchGalpones()
    } finally {
      setSaving(false)
    }
  }

  const galponesFiltrados = galpones.filter(g =>
    g.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
    (g.descripcion || '').toLowerCase().includes(filtro.toLowerCase())
  )

  const estadoBadge = (estado) => ({
    background: estado === 'activo' ? '#dcfce7' : '#fee2e2',
    color: estado === 'activo' ? '#16a34a' : '#dc2626',
    padding: '6px 12px', borderRadius: '20px',
    fontSize: '12px', fontWeight: '600',
  })

  const formFields = (
    <form onSubmit={showEditModal ? handleEditar : handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <InputField name="nombre" placeholder="Nombre del galpón" onChange={handleChange} value={form.nombre} />
      <InputField name="capacidad" type="number" placeholder="Capacidad (aves)" onChange={handleChange} value={form.capacidad} />
      <InputField name="descripcion" placeholder="Descripción (opcional)" onChange={handleChange} value={form.descripcion} />
      <div style={selectGroupStyle}>
        <select name="estado" onChange={handleChange} value={form.estado} style={selectStyle}>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
      </div>
      {formError && <p style={{ color: '#dc2626', fontSize: '12px', margin: 0 }}>⚠️ {formError}</p>}
      <Button text={showEditModal ? 'Guardar Cambios' : 'Crear Galpón'} loadingText="Guardando..." loading={saving} icon={<Plus size={18} />} />
    </form>
  )

  return (
    <div style={layoutStyle}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main style={{ ...mainContentStyle, marginLeft: sidebarOpen ? '240px' : '70px' }}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Gestión de Galpones</h1>
            <p style={subtitleStyle}>Administrar los galpones de la granja</p>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true) }} style={btnAgregarStyle}>
            <Plus size={18} style={{ marginRight: '8px' }} /> Nuevo Galpón
          </button>
        </div>

        <div style={containerStyle}>
          <div style={searchWrapperStyle}>
            <Search size={18} color="#9ca3af" />
            <input type="text" placeholder="Buscar galpón..." style={searchInputStyle} onChange={(e) => setFiltro(e.target.value)} />
          </div>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadRowStyle}>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Descripción</th>
                  <th style={thStyle}>Capacidad</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: '24px', color: '#9ca3af' }}>Cargando...</td></tr>
                ) : galponesFiltrados.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '24px', color: '#9ca3af' }}>No hay galpones registrados.</td></tr>
                ) : galponesFiltrados.map((g) => (
                  <tr key={g.id} style={trStyle}>
                    <td style={tdStyle}><strong>{g.nombre}</strong></td>
                    <td style={tdGrayStyle}>{g.descripcion || 'Sin descripción'}</td>
                    <td style={tdStyle}>{g.capacidad} aves</td>
                    <td style={tdStyle}><span style={estadoBadge(g.estado)}>{g.estado}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { setGalponSeleccionado(g); setShowVerModal(true) }} style={actionBtnStyle('#2563eb')}><Eye size={16} /></button>
                        <button onClick={() => handleEditarClick(g)} style={actionBtnStyle('#f59e0b')}><Edit size={16} /></button>
                        <button onClick={() => { setGalponSeleccionado(g); setShowDeleteModal(true) }} style={actionBtnStyle('#dc2626')}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={tableFooterStyle}>
            <span style={footerTextStyle}>Mostrando {galponesFiltrados.length} galpones</span>
            <div style={paginationStyle}>
              <button style={pageBtnStyle}><ChevronLeft size={16} /> Anterior</button>
              <button style={activePageBtnStyle}>1</button>
              <button style={pageBtnStyle}>Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </main>

      {showModal && <Modal titulo="Nuevo Galpón" onClose={() => setShowModal(false)}>{formFields}</Modal>}
      {showEditModal && <Modal titulo="Editar Galpón" onClose={() => setShowEditModal(false)}>{formFields}</Modal>}

      {showDeleteModal && (
        <Modal titulo="Eliminar Galpón" onClose={() => setShowDeleteModal(false)}>
          <p style={{ color: '#4b5563', marginBottom: '20px' }}>¿Eliminar <strong>{galponSeleccionado?.nombre}</strong>?</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowDeleteModal(false)} style={btnCancelarStyle}>Cancelar</button>
            <button onClick={handleEliminar} style={btnEliminarStyle} disabled={saving}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</button>
          </div>
        </Modal>
      )}

      {showVerModal && galponSeleccionado && (
        <Modal titulo="Detalle Galpón" onClose={() => setShowVerModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { label: 'Nombre', value: galponSeleccionado.nombre },
              { label: 'Capacidad', value: `${galponSeleccionado.capacidad} aves` },
              { label: 'Descripción', value: galponSeleccionado.descripcion || 'Sin descripción' },
              { label: 'Estado', value: galponSeleccionado.estado },
            ].map((item, i) => (
              <div key={i} style={detalleRowStyle}>
                <span style={detalleLabelStyle}>{item.label}</span>
                <span style={detalleValueStyle}>{item.value}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

const layoutStyle = { display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif" }
const mainContentStyle = { flex: 1, padding: '40px', transition: 'margin-left 0.3s ease' }
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }
const titleStyle = { fontSize: '24px', fontWeight: '700', color: '#1c1c1c', margin: 0 }
const subtitleStyle = { fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }
const btnAgregarStyle = { background: '#f59e0b', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.2)', fontFamily: "'Poppins', sans-serif" }
const containerStyle = { background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }
const searchWrapperStyle = { display: 'flex', alignItems: 'center', background: '#f9fafb', padding: '10px 16px', borderRadius: '12px', width: '300px', marginBottom: '24px', border: '1px solid #f3f4f6' }
const searchInputStyle = { border: 'none', background: 'transparent', outline: 'none', marginLeft: '10px', fontSize: '14px', width: '100%' }
const tableWrapperStyle = { overflowX: 'auto' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' }
const theadRowStyle = { borderBottom: '1px solid #f3f4f6' }
const thStyle = { padding: '16px', color: '#6b7280', fontSize: '14px', fontWeight: '500' }
const trStyle = { borderBottom: '1px solid #f8fafc' }
const tdStyle = { padding: '16px', fontSize: '14px', color: '#1c1c1c' }
const tdGrayStyle = { ...tdStyle, color: '#9ca3af' }
const selectGroupStyle = { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '0 16px' }
const selectStyle = { width: '100%', border: 'none', background: 'transparent', padding: '14px 0', fontSize: '14px', color: '#111827', outline: 'none', fontFamily: "'Poppins', sans-serif" }
const actionBtnStyle = (color) => ({ background: color, color: 'white', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex' })
const tableFooterStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }
const footerTextStyle = { fontSize: '13px', color: '#6b7280' }
const paginationStyle = { display: 'flex', gap: '8px' }
const pageBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', fontSize: '13px' }
const activePageBtnStyle = { ...pageBtnStyle, background: '#fff', border: '1px solid #e5e7eb', color: '#1c1c1c' }
const btnCancelarStyle = { flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#6b7280', fontWeight: '600', fontFamily: "'Poppins', sans-serif" }
const btnEliminarStyle = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: '600', fontFamily: "'Poppins', sans-serif" }
const detalleRowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }
const detalleLabelStyle = { fontSize: '13px', color: '#9ca3af', fontWeight: '500' }
const detalleValueStyle = { fontSize: '14px', color: '#1c1c1c', fontWeight: '600' }

export default Galpones