import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage/LandingPage";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Register from "./pages/Register/Register";
import Galpones from "./pages/Galpones/Galpones";
import Usuarios from "./pages/Usuarios/Usuarios";
import Bitacora from "./pages/Bitacora/Bitacora";
import Permisos from "./pages/Permisos/Permisos";
import Roles from "./pages/Roles/Roles";
import Lotes from "./pages/Lotes/Lotes";
import Estado from "./pages/Estado/Estado";
import Alimentacion from "./pages/Alimentacion/Alimentacion";
import Reportes from "./pages/Reportes/Reportes";
import Inventario from "./pages/Inventario/Inventario";

import Insumos from "./pages/Inventario/Insumos/Insumos";
import Proveedores from "./pages/Inventario/Proveedores/Proveedores";
import Movimientos from "./pages/Inventario/Movimientos/Movimientos";

import RegistroSanitario from "./pages/Sanitario/Registro/RegistroSanitario";
import HistorialClinico from "./pages/Sanitario/Historial/HistorialClinico";
import Temperatura from "./pages/Temperatura/Temperatura";
import TemperatureAlert from "./components/TemperatureAlert";
import Mortandad from "./pages/Mortandad/Mortandad";
import ChangePasswordPage from "./pages/ChangePasswordPage/ChangePasswordPage";
import SuccessPage from "./pages/SuccessPage/SuccessPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Zona pública: Landing y Auth ────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pago-exitoso" element={<SuccessPage />} />

        {/* ── Cambio de contraseña obligatorio (requiere token) ── */}
        <Route path="/cambio-password" element={<ChangePasswordPage />} />

        {/* ── Zona privada: Sistema de gestión avícola ────── */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/galpones" element={<ProtectedRoute><Galpones /></ProtectedRoute>} />
        <Route path="/lotes" element={<ProtectedRoute><Lotes /></ProtectedRoute>} />
        <Route path="/alimentacion" element={<ProtectedRoute><Alimentacion /></ProtectedRoute>} />
        <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
        <Route path="/inventario/insumos" element={<ProtectedRoute><Insumos /></ProtectedRoute>} />
        <Route path="/inventario/proveedores" element={<ProtectedRoute><Proveedores /></ProtectedRoute>} />
        <Route path="/inventario/movimientos" element={<ProtectedRoute><Movimientos /></ProtectedRoute>} />

        <Route path="/sanitario/registro" element={<ProtectedRoute><RegistroSanitario /></ProtectedRoute>} />
        <Route path="/sanitario/historial" element={<ProtectedRoute><HistorialClinico /></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute><Reportes /></ProtectedRoute>} />
        <Route path="/mortandad" element={<ProtectedRoute><Mortandad /></ProtectedRoute>} />
        <Route path="/estado" element={<ProtectedRoute><Estado /></ProtectedRoute>} />
        <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
        <Route path="/bitacora" element={<ProtectedRoute><Bitacora /></ProtectedRoute>} />
        <Route path="/permisos" element={<ProtectedRoute><Permisos /></ProtectedRoute>} />
        <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
        <Route path="/temperatura" element={<ProtectedRoute><Temperatura /></ProtectedRoute>} />
      </Routes>
      <TemperatureAlert />
    </BrowserRouter>
  );
}

export default App;

