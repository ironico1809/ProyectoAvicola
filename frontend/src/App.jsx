import { BrowserRouter, Routes, Route } from "react-router-dom";
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/galpones" element={<Galpones />} />
        <Route path="/lotes" element={<Lotes />} />
        <Route path="/alimentacion" element={<Alimentacion />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/inventario/insumos" element={<Insumos />} />
        <Route path="/inventario/proveedores" element={<Proveedores />} />
        <Route path="/inventario/movimientos" element={<Movimientos />} />

        <Route path="/sanitario/registro" element={<RegistroSanitario />} />
        <Route path="/sanitario/historial" element={<HistorialClinico />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/estado" element={<Estado />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/bitacora" element={<Bitacora />} />
        <Route path="/permisos" element={<Permisos />} />
        <Route path="/roles" element={<Roles />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
