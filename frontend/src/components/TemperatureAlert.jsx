import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import api from "../api/axios";
import "./TemperatureAlert.css";
import { useLocation } from "react-router-dom";
import { useUsuario } from "../hooks/useUsuario";

function TemperatureAlert() {
  const location = useLocation();
  const { esSuperAdmin } = useUsuario();

  const POLL_MS = 15000;
  const SNOOZE_MS = 5 * 60 * 1000;

  // No mostrar en rutas públicas ni sin sesión activa
  const token = localStorage.getItem("access_token");
  const estaAutenticado = token && token !== "null" && token !== "undefined";

  const ocultarAlertaEnRuta =
    !estaAutenticado ||
    esSuperAdmin ||
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/cambio-password" ||
    location.pathname === "/pago-exitoso" ||
    location.pathname.startsWith("/temperatura");
  /*
    alertas:
    Aquí guardamos las alertas que devuelve el backend.
    Si no hay alertas, queda como arreglo vacío [].
  */
  const [alertas, setAlertas] = useState([]);

  /*
    visible:
    Controla si la alerta flotante se muestra o no.
    Si el usuario cierra la alerta, visible pasa a false.
  */
  const [visible, setVisible] = useState(true);

  const lastSignatureRef = useRef("");
  const snoozedUntilRef = useRef(0);

  /*
    useEffect:
    Se ejecuta cuando carga la aplicación.
    Consulta las alertas de temperatura cada 10 segundos.
  */
  useEffect(() => {
    if (ocultarAlertaEnRuta) {
      return;
    }

    cargarAlertas();

    const intervalo = setInterval(() => {
      cargarAlertas();
    }, POLL_MS);

    return () => clearInterval(intervalo);
  }, [ocultarAlertaEnRuta]);

  /*
    cargarAlertas:
    Consulta el endpoint del backend:
    GET /temperatura/alertas/

    Ese endpoint devuelve solamente temperaturas con estado FRIO o CALOR.
    Filtramos además en el cliente para descartar cualquier valor fuera
    del rango lógico (0–60°C) que pudiera llegar por error.
  */
  const cargarAlertas = async () => {
    try {
      const respuesta = await api.get("/temperatura/alertas/");

      const raw = Array.isArray(respuesta.data) ? respuesta.data : [];

      // Guardia de rango lógico: descartar valores absurdos
      const data = raw.filter((a) => {
        const temp = parseFloat(a?.temperatura);
        return !isNaN(temp) && temp >= 0 && temp <= 60;
      });

      const signature = data
        .map((a) => `${a?.id ?? ""}:${a?.estado ?? ""}:${a?.temperatura ?? ""}`)
        .join("|");

      const changed = signature !== lastSignatureRef.current;
      lastSignatureRef.current = signature;

      setAlertas(data);

      /*
        Evitar saturación:
        - Si el usuario cerró la alerta, la "silenciamos" por un tiempo.
        - Solo reabrimos automáticamente cuando cambian las alertas.
      */
      if (data.length > 0 && changed && Date.now() >= snoozedUntilRef.current) {
        setVisible(true);
      }
    } catch (error) {
      /*
        Si falla, no rompemos la pantalla.
        Solo mostramos el error en consola.
      */
      console.error("Error al cargar alertas de temperatura:", error);
    }
  };

  if (ocultarAlertaEnRuta) {
    return null;
  }

  /*
    Si no hay alertas, no mostramos nada.
  */
  if (!visible || alertas.length === 0) {
    return null;
  }

  /*
    Tomamos la primera alerta para determinar el color dominante
    del contenedor cuando hay una sola alerta.
    Con múltiples alertas mezcladas usamos el color de advertencia (amarillo).
  */
  const alertaPrincipal = alertas[0];

  // Color dominante del contenedor:
  // - 1 alerta CALOR  → rojo
  // - 1 alerta FRIO   → azul
  // - varias alertas  → amarillo (mixto)
  // - todas CALOR     → rojo
  // - todas FRIO      → azul
  const todosCalor = alertas.every((a) => a.estado === "CALOR");
  const todosFrio  = alertas.every((a) => a.estado === "FRIO");

  const claseContenedor = todosCalor
    ? "alerta-calor"
    : todosFrio
    ? "alerta-frio"
    : "alerta-multiple";

  const colorIcono = todosCalor
    ? "#ef4444"
    : todosFrio
    ? "#3b82f6"
    : "#f59e0b";

  return (
    <div className={`temperature-alert ${claseContenedor}`}>
      <div className="temperature-alert-icon" style={{ color: colorIcono }}>
        <AlertTriangle size={24} />
      </div>

      <div className="temperature-alert-content">
        <h3>
          {alertas.length === 1
            ? "Alerta de temperatura"
            : "Alertas de temperatura"}
        </h3>

        <p>
          {alertas.length === 1
            ? `Se detectó 1 galpón con temperatura fuera del rango normal.`
            : `Se detectaron ${alertas.length} galpones con temperatura fuera del rango normal.`}
        </p>

        <div className="temperature-alert-list">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className={`temperature-alert-item ${
                alerta.estado === "CALOR" ? "item-calor" : "item-frio"
              }`}
            >
              <strong>{alerta.galpon_nombre}</strong>

              <span>
                {alerta.estado === "CALOR"
                  ? "🌡 Alerta de calor"
                  : "❄ Alerta de frío"}{" "}
                — {alerta.temperatura}°C
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="temperature-alert-close"
        onClick={() => {
          setVisible(false);
          snoozedUntilRef.current = Date.now() + SNOOZE_MS;
        }}
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export default TemperatureAlert;
