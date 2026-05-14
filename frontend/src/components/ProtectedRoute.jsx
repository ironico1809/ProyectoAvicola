import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute — Guard de ruta que maneja dos protecciones:
 *
 * 1. Si el usuario NO está autenticado (sin access_token), redirige a /login.
 * 2. Si el usuario está autenticado PERO tiene must_change_password = true,
 *    redirige forzosamente a /cambio-password para cualquier ruta protegida.
 *
 * Uso en App.jsx:
 *   <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
 */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('access_token');

  // Sin token → redirigir al login
  if (!token || token === 'null' || token === 'undefined') {
    return <Navigate to="/login" replace />;
  }

  // Leer must_change_password del objeto usuario guardado en localStorage
  try {
    const usuarioRaw = localStorage.getItem('usuario');
    if (usuarioRaw) {
      const usuario = JSON.parse(usuarioRaw);
      if (usuario.must_change_password === true) {
        return <Navigate to="/cambio-password" replace />;
      }
    }
  } catch {
    // Si hay error de parseo, ignorar el guard de must_change_password
  }

  return children;
}

export default ProtectedRoute;
