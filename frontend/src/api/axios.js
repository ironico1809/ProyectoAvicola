import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
const baseURL = String(rawBaseUrl).replace(/\/+$/, "");

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// INTERCEPTOR DE PETICIÓN (Lo que ya tienes)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// INTERCEPTOR DE RESPUESTA (Lo que te falta para evitar el 401 infinito)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si el servidor responde 401, significa que el token de localStorage ya no sirve
    if (error.response && error.response.status === 401) {
      console.warn("Token expirado o inválido. Limpiando sesión...");

      localStorage.removeItem("access_token"); // Borra el token culpable

      // Opcional: Redirigir al usuario al login automáticamente
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
