import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Eye, Search, ChevronLeft, ChevronRight, Mail, Shield, User } from 'lucide-react'
import Sidebar from '../../components/Sidebar'
import Topbar from '../../components/Topbar'
import Modal from '../../components/Modal'
import InputField from '../../components/InputField'
import Button from '../../components/Button'
import api from '../../api/axios'

function Usuarios() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Modales
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [filtro, setFiltro] = useState('')

  const [form, setForm] = useState({ 
    nom_usuario: '', 
    email: '', 
    password: '', 
    tipo_usuario: 'Operario', 
    estado: 'Activo' 
  })

  useEffect(() => { fetchUsuarios() }, [])

  const fetchUsuarios = async () => {
    try {
      const res = await api.get('/usuarios/')
      setUsuarios(res.data)
    } catch {
      setError('Error al cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setFormError('')
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Ruta de registro confirmada por tu mapa de Django
      await api.post('/usuarios/registro/', form)
      setShowModal(false)
      resetForm()
      fetchUsuarios()
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Error al crear el usuario')
    } finally {
      setSaving(false)
    }
  }

  const handleEditarClick = (u) => {
    setUsuarioSeleccionado(u)
    setForm({ 
      nom_usuario: u.nom_usuario, 
      email: u.email, 
      password: '', // Obligatorio llenar por el backend
      tipo_usuario: u.tipo_usuario || 'Operario', 
      estado: u.estado 
    })
    setShowEditModal(true)
  }

  const handleEditar = async (e) => {
    e.preventDefault()
    if (!form.password) {
      setFormError("El servidor requiere la contraseña para aplicar cambios.");
      return;
    }
    setSaving(true)
    try {
      // Usamos PATCH y la ruta con ID
      await api.patch(`/usuarios/${usuarioSeleccionado.id}/`, form)
      setShowEditModal(false)
      fetchUsuarios()
    } catch (err) {
      setFormError(err.response?.data?.password?.[0] || 'Error al editar');
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async () => {
    setSaving(true)
    try {
      await api.delete(`/usuarios/${usuarioSeleccionado.id}/`)
      setShowDeleteModal(false)
      fetchUsuarios()
    } catch {
      setFormError('Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setForm({ nom_usuario: '', email: '', password: '', tipo_usuario: 'Operario', estado: 'Activo' })
    setFormError('')
  }

  const usuariosFiltrados = usuarios.filter(u => 
    u.nom_usuario.toLowerCase().includes(filtro.toLowerCase()) ||
    u.email.toLowerCase().includes(filtro.toLowerCase())
  )

  const formFields = (
    <form onSubmit={showEditModal ? handleEditar : handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <InputField name="nom_usuario" placeholder="Nombre de usuario" onChange={handleChange} value={form.nom_usuario} />
      <InputField name="email" type="email" placeholder="Correo electrónico" onChange={handleChange} value={form.email} />
      
      <div style={securitySectionStyle}>
        {showEditModal && <p style={securityNoteStyle}>Confirmar contraseña actual o ingresar nueva:</p>}
        <InputField name="password" type="password" placeholder="Contraseña" onChange={handleChange} value={form.password} />
      </div>

      <div style={selectGroupStyle}><select name="tipo_usuario" onChange={handleChange} value={form.tipo_usuario} style={selectStyle}>
          <option value="Administrador">Administrador</option>
          <option value="Veterinario">Veterinario</option>
          <option value="Operario">Operario</option>
      </select></div>

      <div style={selectGroupStyle}><select name="estado" onChange={handleChange} value={form.estado} style={selectStyle}>
          <option value="Activo">Activo</option>
          <option value="Inactivo">Inactivo</option>
      </select></div>

      {formError && <p style={{ color: '#dc2626', fontSize: '12px', margin: 0 }}>⚠️ {formError}</p>}
      <Button text={showEditModal ? 'Guardar Cambios' : 'Registrar Usuario'} loading={saving} icon={<Plus size={18} />} />
    </form>
  )

  return (
    <div style={layoutStyle}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <main style={{ ...mainContentStyle, marginLeft: sidebarOpen ? '240px' : '70px' }}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Gestión de Usuarios</h1>
            <p style={subtitleStyle}>Administrar los usuarios del sistema</p>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true) }} style={btnAgregarStyle}>
            <Plus size={18} style={{ marginRight: '8px' }} /> Agregar Usuario
          </button>
        </div>

        <div style={containerStyle}>
          <div style={searchWrapperStyle}>
            <Search size={18} color="#9ca3af" />
            <input type="text" placeholder="Buscar usuario..." style={searchInputStyle} onChange={(e) => setFiltro(e.target.value)} />
          </div>

          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr style={theadRowStyle}>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Correo</th>
                  <th style={thStyle}>Rol</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} style={trStyle}>
                    <td style={tdStyle}><strong>{u.nom_usuario}</strong></td>
                    <td style={tdEmailStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.tipo_usuario || 'Operario'}</td>
                    <td style={tdStyle}><span style={badgeStyle(u.estado)}>{u.estado}</span></td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditarClick(u)} style={actionBtnStyle('#f59e0b')}><Edit size={16} /></button>
                        <button onClick={() => { setUsuarioSeleccionado(u); setShowDeleteModal(true) }} style={actionBtnStyle('#dc2626')}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={tableFooterStyle}>
            <span style={footerTextStyle}>Mostrando {usuariosFiltrados.length} usuarios</span>
            <div style={paginationStyle}>
              <button style={pageBtnStyle}><ChevronLeft size={16} /> Anterior</button>
              <button style={activePageBtnStyle}>1</button>
              <button style={pageBtnStyle}>Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </main>

      {showModal && <Modal titulo="Nuevo Usuario" onClose={() => setShowModal(false)}>{formFields}</Modal>}
      {showEditModal && <Modal titulo="Editar Usuario" onClose={() => setShowEditModal(false)}>{formFields}</Modal>}
      {showDeleteModal && (
        <Modal titulo="Eliminar Usuario" onClose={() => setShowDeleteModal(false)}>
          <p style={{ color: '#4b5563', marginBottom: '20px' }}>¿Eliminar a <strong>{usuarioSeleccionado?.nom_usuario}</strong>?</p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowDeleteModal(false)} style={btnCancelarStyle}>Cancelar</button>
            <button onClick={handleEliminar} style={btnEliminarStyle} disabled={saving}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ESTILOS BASADOS EN TU IMAGEN
const layoutStyle = { display: 'flex', minHeight: '100vh', background: '#f9fafb', fontFamily: "'Poppins', sans-serif" }
const mainContentStyle = { flex: 1, padding: '40px', transition: 'margin-left 0.3s ease' }
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }
const titleStyle = { fontSize: '24px', fontWeight: '700', color: '#1c1c1c', margin: 0 }
const subtitleStyle = { fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }
const btnAgregarStyle = { background: '#f59e0b', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.2)' }
const containerStyle = { background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }
const searchWrapperStyle = { display: 'flex', alignItems: 'center', background: '#f9fafb', padding: '10px 16px', borderRadius: '12px', width: '300px', marginBottom: '24px', border: '1px solid #f3f4f6' }
const searchInputStyle = { border: 'none', background: 'transparent', outline: 'none', marginLeft: '10px', fontSize: '14px', width: '100%' }
const tableWrapperStyle = { overflowX: 'auto' }
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' }
const theadRowStyle = { borderBottom: '1px solid #f3f4f6' }
const thStyle = { padding: '16px', color: '#6b7280', fontSize: '14px', fontWeight: '500' }
const trStyle = { borderBottom: '1px solid #f8fafc' }
const tdStyle = { padding: '16px', fontSize: '14px', color: '#1c1c1c' }
const tdEmailStyle = { ...tdStyle, color: '#9ca3af' }
const selectGroupStyle = { background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '0 16px' }
const selectStyle = { width: '100%', border: 'none', background: 'transparent', padding: '14px 0', fontSize: '14px', color: '#111827', outline: 'none' }
const actionBtnStyle = (color) => ({ background: color, color: 'white', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex' })
const tableFooterStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }
const footerTextStyle = { fontSize: '13px', color: '#6b7280' }
const paginationStyle = { display: 'flex', gap: '8px' }
const pageBtnStyle = { display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', fontSize: '13px' }
const activePageBtnStyle = { ...pageBtnStyle, background: '#fff', border: '1px solid #e5e7eb', color: '#1c1c1c' }
const badgeStyle = (status) => ({ background: status?.toLowerCase() === 'activo' ? '#dcfce7' : '#fee2e2', color: status?.toLowerCase() === 'activo' ? '#16a34a' : '#dc2626', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' })
const securitySectionStyle = { borderTop: '1px solid #f3f4f6', paddingTop: '10px' }
const securityNoteStyle = { fontSize: '12px', color: '#6b7280', marginBottom: '8px' }
const btnCancelarStyle = { flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: 'transparent', cursor: 'pointer', color: '#6b7280', fontWeight: '600' }
const btnEliminarStyle = { flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: '600' }

export default Usuarios;
