import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import api from "../api/axios";
import "./TemperatureAlert.css";
import { useLocation } from "react-router-dom";

function TemperatureAlert() {
  const location = useLocation();

  const POLL_MS = 15000;
  const SNOOZE_MS = 5 * 60 * 1000;

  const ocultarAlertaEnRuta =
    location.pathname === "/" ||
    location.pathname === "/register" ||
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
  */
  const cargarAlertas = async () => {
    try {
      const respuesta = await api.get("/temperatura/alertas/");

      const data = Array.isArray(respuesta.data) ? respuesta.data : [];

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
    Tomamos la primera alerta para mostrarla arriba.
    Si hay más de una, abajo mostramos el contador.
  */
  const alertaPrincipal = alertas[0];

  return (
    <div className="temperature-alert alerta-multiple">
      <div className="temperature-alert-icon">
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
            ? "Se detectó 1 galpón con temperatura fuera del rango normal."
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
                  ? "Alerta de calor"
                  : "Alerta de frío"}{" "}
                - {alerta.temperatura}°C
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
