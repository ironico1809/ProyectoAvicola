/**
 * useUsuario
 *
 * Lee el objeto usuario guardado en localStorage tras el login.
 * Devuelve el usuario y helpers de rol para condicionar la UI.
 */
export function useUsuario() {
  let usuario = null;
  try {
    const raw = localStorage.getItem("usuario");
    if (raw) usuario = JSON.parse(raw);
  } catch {
    usuario = null;
  }

  const tipo = usuario?.tipo_usuario ?? "";

  return {
    usuario,
    esSuperAdmin: tipo === "Superusuario",
    esAdmin:      tipo === "Administrador" || tipo === "Admin",
    esOperador:   tipo === "Operario" || tipo === "Operador",
    tipo,
  };
}
