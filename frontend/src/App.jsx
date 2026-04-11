import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Register from './pages/Register/Register'
import Galpones from './pages/Galpones/Galpones'
import Usuarios from './pages/Usuarios/Usuarios'
import Bitacora from './pages/Bitacora/Bitacora'
import Permisos from './pages/Permisos/Permisos'
import Roles from './pages/Roles/Roles'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/galpones" element={<Galpones />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/bitacora" element={<Bitacora />} />
        <Route path="/permisos" element={<Permisos />} />
        <Route path="/roles" element={<Roles />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App