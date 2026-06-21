import { useEffect, useState, useCallback } from "react";
import { Thermometer, Brain, X } from "lucide-react";
import api from "../api/axios";
import { useLocation } from "react-router-dom";
import { useUsuario } from "../hooks/useUsuario";
import "./TemperatureAlert.css";

function TemperatureAlert() {
  const location = useLocation();
  const { esSuperAdmin } = useUsuario();

  const POLL_MS = 30000;

  const [alertas, setAlertas] = useState([]);
  const [predictivas, setPredictivas] = useState([]);
  const [dismissed, setDismissed] = useState(false);

  const token = localStorage.getItem("access_token");
  const estaAutenticado = token && token !== "null" && token !== "undefined";

  const ocultar =
    !estaAutenticado ||
    esSuperAdmin ||
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/cambio-password" ||
    location.pathname === "/pago-exitoso";

  const cargarAlertas = useCallback(async () => {
    try {
      const [resAlertas, resPred] = await Promise.all([
        api.get("/temperatura/alertas/"),
        api.get("/temperatura/prediccion/ultimas/"),
      ]);

      const rawAlertas = Array.isArray(resAlertas.data) ? resAlertas.data : [];
      const filtradas = rawAlertas.filter((a) => {
        const temp = parseFloat(a?.temperatura);
        return !isNaN(temp) && temp >= 0 && temp <= 60;
      });

      const preds = Array.isArray(resPred.data) ? resPred.data : [];
      const alertasPred = preds.filter((p) => p.umbral_superado);

      setAlertas(filtradas);
      setPredictivas(alertasPred);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    if (ocultar) return;
    cargarAlertas();
    const intervalo = setInterval(cargarAlertas, POLL_MS);
    return () => clearInterval(intervalo);
  }, [ocultar, cargarAlertas]);

  // Re-mostrar si hay nuevas alertas
  useEffect(() => {
    if (alertas.length > 0 || predictivas.length > 0) {
      setDismissed(false);
    }
  }, [alertas.length, predictivas.length]);

  const total = alertas.length + predictivas.length;
  if (ocultar || total === 0 || dismissed) return null;

  const hayCalor = alertas.some((a) => a.estado === "CALOR") || predictivas.some((p) => p.estado_predicho === "CALOR");
  const borderClass = total === 0 ? "" : hayCalor ? "alerta-calor" : "alerta-frio";

  const tipoLabel =
    predictivas.length > 0 && alertas.length === 0
      ? "Alerta Predictiva"
      : alertas.length > 0 && predictivas.length === 0
        ? "Alerta de Temperatura"
        : "Alertas de Temperatura";

  return (
    <div className={`temperature-alert ${borderClass}`}>
      <div className="temperature-alert-icon" style={{ color: hayCalor ? "#ef4444" : "#3b82f6" }}>
        {predictivas.length > 0 ? <Brain size={22} /> : <Thermometer size={22} />}
      </div>

      <div className="temperature-alert-content">
        <div className="temperature-alert-header">
          <h3>{tipoLabel}</h3>
          <span className="temperature-alert-count">{total}</span>
        </div>

        <div className="temperature-alert-scroll">
          {predictivas.length > 0 && (
            <div className="temperature-alert-list">
              {predictivas.map((p) => (
                <div key={`pred-${p.id}`} className={`temperature-alert-item ${p.estado_predicho === "CALOR" ? "item-calor" : "item-frio"}`}>
                  <div className="temperature-alert-item-head">
                    <strong>{p.galpon_nombre}</strong>
                    <span className="temperature-alert-item-tag">Predictiva</span>
                  </div>
                  <span>{p.mensaje}</span>
                </div>
              ))}
            </div>
          )}

          {alertas.length > 0 && (
            <div className="temperature-alert-list">
              {alertas.map((a) => (
                <div key={`alert-${a.id}`} className={`temperature-alert-item ${a.estado === "CALOR" ? "item-calor" : "item-frio"}`}>
                  <div className="temperature-alert-item-head">
                    <strong>{a.galpon_nombre}</strong>
                    <span className="temperature-alert-item-temp">{a.temperatura}°C</span>
                  </div>
                  <span>{a.mensaje}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <small className="temperature-alert-hint">
          {predictivas.length > 0 ? "Revise la sección Predicción IA" : "Haga clic en Temperatura para ver detalles"}
        </small>
      </div>

      <button className="temperature-alert-close" onClick={() => setDismissed(true)} type="button" aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  );
}

export default TemperatureAlert;
