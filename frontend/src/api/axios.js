import axios from "axios";

const rawBaseUrl = import.meta.env.VITE_API_URL;
const isDev = import.meta.env.DEV;

function normalizeBaseUrl(raw) {
  const str = String(raw || "").trim();
  if (!str) return "";

  // Si pegaron un link en formato Markdown: [texto](https://url)
  const mdMatch = str.match(/\((https?:\/\/[^)]+)\)/i);
  if (mdMatch?.[1]) return mdMatch[1].trim();

  // Si trae cualquier URL dentro del string, tomar la primera.
  const urlMatch = str.match(/https?:\/\/[^\s\]]+/i);
  if (urlMatch?.[0]) return urlMatch[0].trim();

  return str;
}

const normalizedBaseUrl = normalizeBaseUrl(rawBaseUrl);

if (!normalizedBaseUrl && !isDev) {
  throw new Error(
    "Missing VITE_API_URL. Set it in your hosting provider (e.g., Vercel) so the frontend can reach the backend.",
  );
}

const baseURL = String(normalizedBaseUrl || "http://localhost:8000")
  .replace(/\/+$/, "")
  .trim();

if (!isDev && baseURL && !/^https?:\/\//i.test(baseURL)) {
  throw new Error(
    `Invalid VITE_API_URL: "${rawBaseUrl}". Use a full URL like https://your-backend.com`,
  );
}

const finalBaseURL = baseURL.replace(/\/+$/, "");

const api = axios.create({
  baseURL: finalBaseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// INTERCEPTOR DE PETICIÓN (Lo que ya tienes)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    const url = String(config.url || "");
    const isAuthEndpoint =
      url.startsWith("/usuarios/login/") || url.startsWith("/usuarios/token/");

    if (token && token !== "null" && token !== "undefined" && !isAuthEndpoint) {
      config.headers = config.headers || {};
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
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/"
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
