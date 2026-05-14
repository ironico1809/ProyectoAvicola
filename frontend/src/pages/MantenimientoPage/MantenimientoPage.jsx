import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database,
  Clock,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  LogOut,
} from "lucide-react";
import api from "../../api/axios";
import "./MantenimientoPage.css";

function MantenimientoPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ hora_automatica: "", activo: false });
  const [backups, setBackups] = useState([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // guarda el backup a restaurar
  const [toast, setToast] = useState(null); // { type: 'ok'|'err', msg: '' }

  // Cargar configuración y lista de backups al montar
  useEffect(() => {
    fetchConfig();
    fetchBackups();
  }, []);

  // Ocultar toast automáticamente tras 4 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchConfig = async () => {
    try {
      const res = await api.get("/mantenimiento/config/");
      if (res.data) {
        setConfig({
          hora_automatica: res.data.hora_automatica || "",
          activo: Boolean(res.data.activo),
        });
      }
    } catch (err) {
      console.error("Error al cargar configuración de respaldo:", err);
      setToast({ type: "err", msg: "Error al cargar la configuración." });
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get("/mantenimiento/backups/");
      if (Array.isArray(res.data)) {
        setBackups(res.data);
      }
    } catch (err) {
      console.error("Error al cargar historial de respaldos:", err);
      setToast({ type: "err", msg: "Error al cargar el historial de copias." });
    }
  };

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoadingConfig(true);
    try {
      const res = await api.put("/mantenimiento/config/", {
        hora_automatica: config.hora_automatica || null,
        activo: config.activo,
      });
      setConfig({
        hora_automatica: res.data.hora_automatica || "",
        activo: Boolean(res.data.activo),
      });
      setToast({ type: "ok", msg: "Horario de respaldo actualizado exitosamente." });
    } catch (err) {
      console.error("Error al guardar horario:", err);
      setToast({ type: "err", msg: "Error al actualizar la configuración." });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleGenerateManual = async () => {
    setLoadingManual(true);
    try {
      const res = await api.post("/mantenimiento/backup-manual/");
      if (res.data?.backup) {
        setBackups((prev) => [res.data.backup, ...prev]);
        setToast({ type: "ok", msg: "Copia de seguridad generada correctamente." });
      }
    } catch (err) {
      console.error("Error al generar backup manual:", err);
      setToast({
        type: "err",
        msg: err.response?.data?.error || "Error al generar la copia de seguridad.",
      });
    } finally {
      setLoadingManual(false);
    }
  };

  const handleDownload = async (backup) => {
    try {
      setToast({ type: "ok", msg: `Iniciando descarga: ${backup.nombre_archivo}` });
      const res = await api.get(`/mantenimiento/descargar/${backup.id}/`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", backup.nombre_archivo);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error en descarga:", err);
      setToast({ type: "err", msg: "Error al descargar el archivo de copia." });
    }
  };

  const handleConfirmRestore = async () => {
    const backup = confirmModal;
    if (!backup) return;
    setConfirmModal(null);
    setRestoringBackup(backup);

    try {
      const res = await api.post("/mantenimiento/restore/", { backup_id: backup.id });
      setToast({
        type: "ok",
        msg: res.data?.mensaje || "Sistema restaurado correctamente.",
      });
      // Recargar lista por si acaso
      fetchBackups();
    } catch (err) {
      console.error("Error al restaurar:", err);
      setToast({
        type: "err",
        msg: err.response?.data?.error || "Error crítico al restaurar el sistema.",
      });
    } finally {
      setRestoringBackup(null);
    }
  };

  return (
    <div className="mnt-layout" style={{ flexDirection: "column" }}>

      {/* ── HEADER SUPERADMIN (coherente con SuperAdmin.jsx) ── */}
      <header style={{
        background: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
        padding: "0 32px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="logo" style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid #fbbf24" }} />
          <span style={{ color: "#fef3c7", fontWeight: 800, fontSize: 18 }}>AviGranja</span>
          <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 8px" }}>|</span>
          <Globe size={17} color="#fbbf24" />
          <span style={{ color: "#fef3c7", fontWeight: 600, fontSize: 15 }}>Panel SuperAdmin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("usuario");
              navigate("/login");
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8, padding: "7px 14px", color: "#fef3c7",
              fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
            type="button"
          >
            <LogOut size={15} /> Salir
          </button>
        </div>
      </header>

      {/* ── BARRA DE PESTANAS (misma que SuperAdmin para coherencia) ── */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        padding: "0 32px",
        display: "flex",
        gap: 4,
        flexShrink: 0,
      }}>
        {[
          { id: "clientes",        label: "Clientes",        path: "/superadmin" },
          { id: "infraestructura", label: "Infraestructura", path: "/superadmin" },
          { id: "config-ia",       label: "Config IA",       path: "/superadmin" },
          { id: "auditoria",       label: "Auditoría",       path: "/superadmin" },
          { id: "mantenimiento",   label: "Mantenimiento",   path: "/mantenimiento", active: true },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(t.path)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "14px 18px", border: "none", background: "none",
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              color: t.active ? "#78350f" : "#6b7280",
              borderBottom: t.active ? "2px solid #78350f" : "2px solid transparent",
              transition: "all .15s",
            }}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="mnt-main">
        <section className="mnt-section">
          <h1 className="mnt-section-title">
            <Database size={22} color="#f59e0b" /> Mantenimiento Técnico y Respaldos
          </h1>
          <p className="mnt-section-desc">
            Gestión avanzada de copias de seguridad cumpliendo criterios de Fiabilidad, Portabilidad y Recuperabilidad (ISO 25010).
          </p>

          <form onSubmit={handleSaveConfig} className="mnt-config-row">
            <div className="mnt-field">
              <label className="mnt-label" htmlFor="hora_automatica">
                Hora de Respaldo Automático Diario
              </label>
              <input
                id="hora_automatica"
                type="time"
                name="hora_automatica"
                className="mnt-input-time"
                value={config.hora_automatica}
                onChange={handleConfigChange}
              />
            </div>

            <div className="mnt-toggle-wrap">
              <span className="mnt-label">Estado de Automatización</span>
              <label className="mnt-toggle" htmlFor="activo_toggle">
                <input
                  id="activo_toggle"
                  type="checkbox"
                  name="activo"
                  checked={config.activo}
                  onChange={handleConfigChange}
                />
                <div className="mnt-toggle-track" />
                <span className="mnt-toggle-label">
                  {config.activo ? "Activado" : "Desactivado"}
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="mnt-btn-save"
              disabled={loadingConfig}
            >
              <Clock size={16} />
              {loadingConfig ? "Guardando..." : "Guardar Horario"}
            </button>
          </form>
        </section>

        <section className="mnt-section" style={{ padding: "20px 32px" }}>
          <button
            type="button"
            className="mnt-btn-manual"
            onClick={handleGenerateManual}
            disabled={loadingManual || restoringBackup}
          >
            {loadingManual ? (
              <>
                <span className="mnt-spinner" /> Generando copia de seguridad...
              </>
            ) : (
              <>⚡ Generar Copia Manual Ahora</>
            )}
          </button>
        </section>

        <section className="mnt-section">
          <h2 className="mnt-section-title" style={{ fontSize: "15px", marginBottom: "16px" }}>
            Historial de Copias Disponibles
          </h2>

          <div className="mnt-table-wrap">
            <table className="mnt-table">
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Tipo</th>
                  <th>Fecha de Creación</th>
                  <th>Tamaño</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="mnt-empty">
                        No hay copias de seguridad registradas en el sistema.
                      </div>
                    </td>
                  </tr>
                ) : (
                  backups.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: "500" }}>{b.nombre_archivo}</td>
                      <td>
                        <span
                          className={`mnt-badge mnt-badge--${b.tipo?.toLowerCase()}`}
                        >
                          {b.tipo}
                        </span>
                      </td>
                      <td>{b.fecha_creacion}</td>
                      <td>{b.tamano}</td>
                      <td>
                        <div className="mnt-action-group">
                          <button
                            type="button"
                            className="mnt-btn-download"
                            onClick={() => handleDownload(b)}
                            title="Descargar respaldo"
                          >
                            <Download size={14} /> Descargar
                          </button>
                          <button
                            type="button"
                            className="mnt-btn-restore"
                            onClick={() => setConfirmModal(b)}
                            disabled={restoringBackup !== null}
                            title="Restaurar base de datos"
                          >
                            <RotateCcw size={14} /> Restaurar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ── MODAL DE CONFIRMACIÓN DE RESTAURACIÓN ── */}
      {confirmModal && (
        <div className="mnt-modal-overlay">
          <div className="mnt-modal">
            <div className="mnt-modal-icon">
              <AlertTriangle size={32} color="#dc2626" />
            </div>
            <h3>¿Restaurar Sistema?</h3>
            <p>
              Estás a punto de vaciar y sobrescribir la base de datos actual con la información del archivo de copia:{" "}
              <strong>{confirmModal.nombre_archivo}</strong>.
            </p>
            <div className="mnt-modal-restore-warning">
              ⚠️ Esta acción es destructiva y deshará cualquier cambio realizado posteriormente a la fecha de este respaldo.
            </div>
            <div className="mnt-modal-actions">
              <button
                type="button"
                className="mnt-modal-cancel"
                onClick={() => setConfirmModal(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mnt-modal-confirm"
                onClick={handleConfirmRestore}
              >
                <RotateCcw size={16} /> Sí, Restaurar Ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY BLOQUEANTE DURANTE RESTAURACIÓN ACTIVA ── */}
      {restoringBackup && (
        <div className="mnt-restore-overlay">
          <span className="mnt-spinner" />
          <div className="mnt-restore-text">Restaurando sistema en curso</div>
          <div className="mnt-restore-subtext">
            Por favor, no cierre ni recargue esta ventana mientras se procesan las tablas.
          </div>
        </div>
      )}

      {/* ── TOAST NOTIFICATIONS ── */}
      {toast && (
        <div className={`mnt-toast mnt-toast--${toast.type}`}>
          {toast.type === "ok" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

export default MantenimientoPage;
