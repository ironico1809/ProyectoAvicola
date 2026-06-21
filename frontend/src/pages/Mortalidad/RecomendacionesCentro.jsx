import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, Filter, ChevronRight, CheckCircle2,
  AlertTriangle, HelpCircle, Activity, Thermometer,
  Wheat, Info, Check, X, ShieldAlert, FileText, Skull
} from "lucide-react";
import api from "../../api/axios";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import useIsMobile from "../../hooks/useIsMobile";
import "./RecomendacionesCentro.css";

const ESTADO_BADGES = {
  Pendiente: { text: "Pendiente", className: "recs-risk-badge mid" },
  Aplicada: { text: "Aplicada", className: "recs-risk-badge low" },
  Ignorada: { text: "Ignorada", className: "recs-risk-badge high" },
};

export default function RecomendacionesCentro() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [datosPredicciones, setDatosPredicciones] = useState([]);
  const [galpones, setGalpones] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState("Todas"); // Todas, Pendiente, Aplicada, Ignorada
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroGalpon, setFiltroGalpon] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setError("");
    try {
      const [recsRes, galRes, lotRes] = await Promise.all([
        api.get("/mortandad/prediccion/recomendaciones/centro/"),
        api.get("/galpones/"),
        api.get("/lotes/"),
      ]);

      setDatosPredicciones(Array.isArray(recsRes.data) ? recsRes.data : []);
      setGalpones(Array.isArray(galRes.data) ? galRes.data : []);
      setLotes(Array.isArray(lotRes.data) ? lotRes.data : []);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las recomendaciones del Asistente IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleActualizarEstado = async (prediccionId, recId, nuevoEstado) => {
    try {
      await api.patch(`/mortandad/prediccion/${prediccionId}/recomendacion/`, {
        recomendacion_id: recId,
        estado: nuevoEstado,
      });

      // Actualizar localmente el estado de la recomendación en el lote respectivo
      setDatosPredicciones((prev) =>
        prev.map((pred) => {
          if (pred.id_prediccion === prediccionId) {
            return {
              ...pred,
              recomendaciones: pred.recomendaciones.map((rec) =>
                rec.id === recId ? { ...rec, estado: nuevoEstado } : rec
              ),
            };
          }
          return pred;
        })
      );
      setMensaje(`✓ Recomendación marcada como ${nuevoEstado.toLowerCase()} exitosamente.`);
      setTimeout(() => setMensaje(""), 4000);
    } catch (e) {
      console.error(e);
      setError("No se pudo actualizar el estado de la recomendación.");
    }
  };

  // Función para determinar el botón de navegación contextual e ícono correcto
  const obtenerAccionContextual = (texto) => {
    const txt = (texto || "").toLowerCase();

    if (
      txt.includes("temperatura") ||
      txt.includes("ventilación") ||
      txt.includes("nebulización") ||
      txt.includes("extractores") ||
      txt.includes("frío") ||
      txt.includes("calor") ||
      txt.includes("cortina") ||
      txt.includes("clima")
    ) {
      return {
        label: "Ver Temperatura",
        path: "/temperatura",
        icon: <Thermometer size={14} />,
      };
    }

    if (
      txt.includes("alimento") ||
      txt.includes("pienso") ||
      txt.includes("comederos") ||
      txt.includes("ración")
    ) {
      return {
        label: "Ir a Alimentación",
        path: "/alimentacion",
        icon: <Wheat size={14} />,
      };
    }

    if (
      txt.includes("baja") ||
      txt.includes("muertes") ||
      txt.includes("mortalidad") ||
      txt.includes("registro de bajas")
    ) {
      return {
        label: "Registrar Bajas",
        path: "/mortandad",
        icon: <Skull size={14} />,
      };
    }

    if (
      txt.includes("veterinario") ||
      txt.includes("médico") ||
      txt.includes("clínico") ||
      txt.includes("sanitario") ||
      txt.includes("aislar") ||
      txt.includes("enfermedad") ||
      txt.includes("síntomas")
    ) {
      return {
        label: "Ver Alertas Sanitarias",
        path: "/sanitario/alertas",
        icon: <ShieldAlert size={14} />,
      };
    }

    return {
      label: "Ir a Lotes",
      path: "/lotes",
      icon: <FileText size={14} />,
    };
  };

  // Aplanar todas las recomendaciones individuales asociándolas con su información de lote/predicción
  const todasRecomendaciones = useMemo(() => {
    const list = [];
    datosPredicciones.forEach((pred) => {
      pred.recomendaciones.forEach((rec) => {
        list.push({
          ...rec,
          id_prediccion: pred.id_prediccion,
          lote_id: pred.lote_id,
          lote_codigo: pred.lote_codigo,
          galpon_nombre: pred.galpon_nombre,
          riesgo_porcentaje: pred.riesgo_porcentaje,
          nivel_riesgo: pred.nivel_riesgo,
          fecha_hora: pred.fecha_hora,
          factores_clave: pred.factores_clave,
        });
      });
    });
    return list;
  }, [datosPredicciones]);

  // Filtrar
  const recomendacionesFiltradas = todasRecomendaciones.filter((rec) => {
    if (filtroEstado !== "Todas" && rec.estado !== filtroEstado) return false;
    if (filtroLote && rec.lote_id.toString() !== filtroLote) return false;
    if (filtroGalpon && rec.galpon_nombre !== filtroGalpon) return false;
    return true;
  });

  // Estadísticas para KPIs
  const stats = useMemo(() => {
    const total = todasRecomendaciones.length;
    const pendientes = todasRecomendaciones.filter((r) => r.estado === "Pendiente").length;
    const aplicadas = todasRecomendaciones.filter((r) => r.estado === "Aplicada").length;
    const ignoradas = todasRecomendaciones.filter((r) => r.estado === "Ignorada").length;
    const tasaAplicacion =
      aplicadas + ignoradas > 0 ? Math.round((aplicadas / (aplicadas + ignoradas)) * 100) : 0;

    return { total, pendientes, aplicadas, ignoradas, tasaAplicacion };
  }, [todasRecomendaciones]);

  const uniqueGalpones = Array.from(
    new Set(datosPredicciones.map((p) => p.galpon_nombre).filter(Boolean))
  );

  return (
    <div className="recs-centro-container">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        className="recs-centro-main"
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "260px" : "70px",
        }}
      >
        <Topbar
          titulo="Centro de Recomendaciones y Asistente IA"
          subtitulo="Plan de acción correctiva y mitigación de mortalidad automatizado"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Alertas informativas rápidas */}
        {mensaje && (
          <div
            style={{
              background: "#dcfce7",
              color: "#15803d",
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {mensaje}
          </div>
        )}
        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#dc2626",
              padding: "12px 18px",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* KPIs Cards */}
        <div className="recs-stats-grid">
          <div className="recs-stat-card">
            <span className="recs-stat-card-title">Sugerencias Totales</span>
            <span className="recs-stat-card-value">{loading ? "—" : stats.total}</span>
            <div className="recs-stat-card-icon">
              <Brain size={24} />
            </div>
          </div>
          <div className="recs-stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
            <span className="recs-stat-card-title" style={{ color: "#d97706" }}>
              Pendientes de Acción
            </span>
            <span className="recs-stat-card-value" style={{ color: "#b45309" }}>
              {loading ? "—" : stats.pendientes}
            </span>
            <div className="recs-stat-card-icon">
              <AlertTriangle size={24} color="#f59e0b" />
            </div>
          </div>
          <div className="recs-stat-card" style={{ borderLeft: "4px solid #10b981" }}>
            <span className="recs-stat-card-title" style={{ color: "#059669" }}>
              Aplicadas con Éxito
            </span>
            <span className="recs-stat-card-value" style={{ color: "#047857" }}>
              {loading ? "—" : stats.aplicadas}
            </span>
            <div className="recs-stat-card-icon">
              <CheckCircle2 size={24} color="#10b981" />
            </div>
          </div>
          <div className="recs-stat-card">
            <span className="recs-stat-card-title">Tasa de Aplicación</span>
            <span className="recs-stat-card-value">{loading ? "—" : `${stats.tasaAplicacion}%`}</span>
            <div className="recs-stat-card-icon">
              <Activity size={24} />
            </div>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="recs-filter-bar">
          <div className="recs-tabs">
            {["Todas", "Pendiente", "Aplicada", "Ignorada"].map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltroEstado(estado)}
                className={`recs-tab-btn ${filtroEstado === estado ? "active" : ""}`}
                type="button"
              >
                {estado === "Todas" ? "Todas" : estado === "Pendiente" ? "Pendientes" : estado === "Aplicada" ? "Aplicadas" : "Ignoradas"}
              </button>
            ))}
          </div>

          <div className="recs-dropdowns">
            {/* Filtro Lote */}
            <select
              value={filtroLote}
              onChange={(e) => setFiltroLote(e.target.value)}
              className="recs-select"
            >
              <option value="">Todos los Lotes</option>
              {lotes.map((l) => (
                <option key={l.id_lote} value={l.id_lote}>
                  Lote {l.id_lote} ({l.raza_tipo || "S/R"})
                </option>
              ))}
            </select>

            {/* Filtro Galpón */}
            <select
              value={filtroGalpon}
              onChange={(e) => setFiltroGalpon(e.target.value)}
              className="recs-select"
            >
              <option value="">Todos los Galpones</option>
              {uniqueGalpones.map((gn) => (
                <option key={gn} value={gn}>
                  {gn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista/Grid de Recomendaciones */}
        {loading ? (
          <div className="recs-skeleton">
            <div className="recs-skeleton-circle" />
            <div className="recs-skeleton-line" />
            <div className="recs-skeleton-line" style={{ width: "180px" }} />
          </div>
        ) : recomendacionesFiltradas.length > 0 ? (
          <div className="recs-grid">
            {recomendacionesFiltradas.map((rec, index) => {
              const action = obtenerAccionContextual(rec.texto);
              const estMeta = ESTADO_BADGES[rec.estado] || { text: rec.estado, className: "recs-risk-badge" };
              const colorClave = rec.nivel_riesgo === "Alto" ? "high" : rec.nivel_riesgo === "Medio" ? "mid" : "low";

              return (
                <div key={`${rec.id_prediccion}-${rec.id}-${index}`} className="recs-card">
                  {/* Header de la tarjeta */}
                  <div className="recs-card-header">
                    <div className="recs-card-title-group">
                      <span className="recs-card-lote">Lote {rec.lote_codigo}</span>
                      <span className="recs-card-galpon">Galpón: {rec.galpon_nombre || "S/N"}</span>
                    </div>
                    <span className={`recs-risk-badge ${colorClave}`}>
                      Riesgo {rec.nivel_riesgo} ({rec.riesgo_porcentaje}%)
                    </span>
                  </div>

                  {/* Cuerpo de la tarjeta */}
                  <div className="recs-card-body">
                    {/* Recomendación Texto */}
                    <div className="recs-text-box">
                      <div className="recs-icon-indicator" style={{
                        background: rec.estado === "Aplicada" ? "#e8f5e9" : rec.estado === "Ignorada" ? "#f1f3f4" : "#fffde7",
                        color: rec.estado === "Aplicada" ? "#2e7d32" : rec.estado === "Ignorada" ? "#5f6368" : "#f57f17"
                      }}>
                        <Brain size={18} />
                      </div>
                      <div className="recs-text-content">{rec.texto}</div>
                    </div>

                    {/* Sección ¿Por qué se generó? (Causas explicativas) */}
                    <div className="recs-why-box">
                      <div className="recs-why-title">
                        <Info size={14} color="#3b82f6" />
                        ¿Por qué la IA sugiere esto?
                      </div>
                      <ul className="recs-why-list">
                        {rec.factores_clave && rec.factores_clave.length > 0 ? (
                          rec.factores_clave.map((f, i) => <li key={i}>{f}</li>)
                        ) : (
                          <li>Parámetros generales de salud en estado preventivo de alerta.</li>
                        )}
                      </ul>
                    </div>

                    {/* Acciones y Redirección Contextual */}
                    <div className="recs-actions">
                      {/* Botón contextual inteligente */}
                      <button
                        onClick={() => navigate(action.path)}
                        className="recs-btn-redirect"
                        type="button"
                        title={`Navegar a ${action.label}`}
                      >
                        {action.icon}
                        <span>{action.label}</span>
                        <ChevronRight size={14} />
                      </button>

                      {/* Botones de cambio de estado */}
                      <div className="recs-btn-action-group">
                        {rec.estado === "Pendiente" ? (
                          <>
                            <button
                              onClick={() => handleActualizarEstado(rec.id_prediccion, rec.id, "Aplicada")}
                              className="recs-btn-status apply"
                              type="button"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleActualizarEstado(rec.id_prediccion, rec.id, "Ignorada")}
                              className="recs-btn-status ignore"
                              type="button"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <span className={estMeta.className}>{estMeta.text}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="recs-empty-state">
            <Info size={40} color="#94a3b8" />
            <h3>No se encontraron sugerencias</h3>
            <p>
              No hay recomendaciones registradas que coincidan con los filtros seleccionados (Estado:{" "}
              {filtroEstado}, Lote: {filtroLote || "Todos"}).
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
