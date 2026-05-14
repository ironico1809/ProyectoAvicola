import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import "./MaintenanceScreen.css";

/**
 * MaintenanceScreen — Pantalla de bloqueo global durante el Modo Mantenimiento.
 *
 * Props:
 *   hasta        {string|null}  ISO timestamp de auto-desactivación
 *   segundosInit {number}       Segundos restantes al montar el componente
 */
function MaintenanceScreen({ hasta, segundosInit = 300 }) {
  const [segundos, setSegundos] = useState(Math.max(0, segundosInit));
  const totalSegundos = 300; // 5 min — referencia para la barra de progreso

  // Contador local en el cliente (tick cada segundo)
  useEffect(() => {
    if (segundos <= 0) return;
    const timer = setInterval(() => {
      setSegundos((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Actualizar contador si llegan nuevos props desde el polling
  useEffect(() => {
    setSegundos(Math.max(0, segundosInit));
  }, [segundosInit]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const porcentajeRestante = Math.min(100, (segundos / totalSegundos) * 100);

  return (
    <div className="mnt-screen-overlay" role="alert" aria-live="polite">
      {/* Logo */}
      <div className="mnt-screen-logo">
        <img src="/logo.png" alt="AviGranja" />
        <span className="mnt-screen-logo-text">AviGranja</span>
      </div>

      {/* Spinner con ícono centrado */}
      <div className="mnt-screen-spinner-wrap">
        <div className="mnt-screen-spinner" />
        <div className="mnt-screen-icon">
          <Database size={28} />
        </div>
      </div>

      {/* Textos */}
      <h1 className="mnt-screen-title">
        Sistema en Mantenimiento Preventivo
      </h1>
      <p className="mnt-screen-desc">
        AviGranja está optimizando y restaurando la base de datos para
        garantizar la integridad de sus datos. El sistema estará disponible
        en unos momentos<span className="mnt-screen-dots" />.
      </p>

      {/* Contador regresivo */}
      <div className="mnt-screen-countdown-wrap">
        <span className="mnt-screen-countdown-label">Tiempo estimado restante</span>
        <span className="mnt-screen-countdown-value">
          {segundos > 0 ? formatTime(segundos) : "Finalizando…"}
        </span>
        <span className="mnt-screen-countdown-sub">minutos : segundos</span>
      </div>

      {/* Barra de progreso inversa (va de lleno a vacío) */}
      <div className="mnt-screen-progress-wrap">
        <div
          className="mnt-screen-progress-bar"
          style={{ width: `${porcentajeRestante}%` }}
        />
      </div>

      <p className="mnt-screen-footer">
        Por favor no cierre ni recargue esta ventana.
        {hasta && (
          <><br />Habilitación automática: {new Date(hasta).toLocaleTimeString("es-ES")}</>
        )}
      </p>
    </div>
  );
}

export default MaintenanceScreen;
