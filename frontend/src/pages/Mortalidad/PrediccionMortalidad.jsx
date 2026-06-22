import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Brain, AlertTriangle, TrendingUp, RefreshCw, BarChart3,
  Sparkles, Clock, Activity, Zap, CheckCircle2, AlertOctagon,
  Thermometer, ShieldAlert, Wheat
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import api from "../../api/axios";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import useIsMobile from "../../hooks/useIsMobile";
import "./PrediccionMortalidad.css";

/* ── Color helpers based on risk level ────────────────────────────── */
function getRiskMeta(level) {
  if (level === "Alto")
    return {
      badgeClass: "risk-badge--high",
      cardClass: "risk-card--high",
      color: "#ef4444",
      bg: "#fee2e2",
      icon: <AlertOctagon className="risk-icon" size={24} color="#ef4444" />,
      textClass: "text-risk--high",
      glowColor: "rgba(239, 68, 68, 0.4)"
    };
  if (level === "Medio")
    return {
      badgeClass: "risk-badge--mid",
      cardClass: "risk-card--mid",
      color: "#f59e0b",
      bg: "#fef3c7",
      icon: <AlertTriangle className="risk-icon" size={24} color="#f59e0b" />,
      textClass: "text-risk--mid",
      glowColor: "rgba(245, 158, 11, 0.4)"
    };
  return {
    badgeClass: "risk-badge--low",
    cardClass: "risk-card--low",
    color: "#10b981",
    bg: "#d1fae5",
    icon: <CheckCircle2 className="risk-icon" size={24} color="#10b981" />,
    textClass: "text-risk--low",
    glowColor: "rgba(16, 185, 129, 0.4)"
  };
}

function formatFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ChartTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="risk-chart-tooltip">
        <span className="risk-chart-tooltip-date">{formatFecha(data.fecha_hora)}</span>
        <span className="risk-chart-tooltip-val">Riesgo: {payload[0].value}%</span>
        <span className="risk-chart-tooltip-level">Nivel: {data.nivel_riesgo}</span>
      </div>
    );
  }
  return null;
}

/* ── Loading Skeleton ── */
function LoadingSkeleton() {
  return (
    <>
      <div className="risk-card skeleton-card" style={{ animationDelay: "0s" }}>
        <div className="card-header-icon-title">
          <Brain size={20} color="#78350f" />
          <h3>Lote a Evaluar</h3>
        </div>
        <div className="skeleton-line skeleton-line--text" style={{ width: "70%" }} />
        <div className="skeleton-line skeleton-line--select" />
        <div className="skeleton-line skeleton-line--button" />
      </div>
      <div className="risk-card skeleton-card" style={{ animationDelay: "0.1s" }}>
        <div className="skeleton-circle" />
      </div>
    </>
  );
}

export default function PrediccionMortalidad() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loteUrl = searchParams.get("lote");

  const [lotes, setLotes] = useState([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState("");
  const [prediccionActual, setPrediccionActual] = useState(null);
  const [historialPredicciones, setHistorialPredicciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [displayPct, setDisplayPct] = useState(0);
  const animRef = useRef(null);
  const [registrosMortandad, setRegistrosMortandad] = useState([]);

  useEffect(() => {
    cargarLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarLotes = async () => {
    try {
      setCargando(true);
      setError("");
      const res = await api.get("/lotes/");
      const lista = Array.isArray(res.data) ? res.data : [];
      // Filtrar lotes activos (en crianza o listos)
      const lotesActivos = lista.filter((l) => l.estado === "Crianza" || l.estado === "Listo");
      setLotes(lotesActivos);
      
      if (lotesActivos.length > 0) {
        // Usar el lote de la URL si existe y es válido, si no, el primero
        let loteInicial = lotesActivos[0].id_lote.toString();
        if (loteUrl && lotesActivos.some(l => l.id_lote.toString() === loteUrl)) {
          loteInicial = loteUrl;
        }
        setLoteSeleccionado(loteInicial);
        cargarHistorialYPrediccion(loteInicial);
      } else {
        setCargando(false);
      }
    } catch {
      setError("No se pudieron cargar los lotes activos de la empresa.");
      setCargando(false);
    }
  };

  const cargarHistorialYPrediccion = async (idLote) => {
    try {
      setCargando(true);
      setError("");
      setMensaje("");
      const [resPred, resReg] = await Promise.all([
        api.get(`/mortandad/prediccion/historial/?lote_id=${idLote}`),
        api.get(`/mortandad/?lote=${idLote}`),
      ]);
      const hist = Array.isArray(resPred.data) ? resPred.data : [];
      setHistorialPredicciones(hist);
      const regList = Array.isArray(resReg.data) ? resReg.data : [];
      setRegistrosMortandad(regList.slice(0, 10));

      if (hist.length > 0) {
        setPrediccionActual(hist[hist.length - 1]);
      } else {
        await calcularPrediccion(idLote, true);
      }
    } catch {
      setError("Error al cargar la predicción y el historial.");
    } finally {
      setCargando(false);
    }
  };

  const calcularPrediccion = async (idLote, esInicial = false) => {
    if (!idLote) return;
    setGenerando(true);
    setError("");
    setMensaje("");
    try {
      const res = await api.post("/mortandad/prediccion/generar/", { lote_id: parseInt(idLote, 10) });
      setPrediccionActual(res.data);
      
      // Volver a consultar el historial para incluir la nueva
      const resHist = await api.get(`/mortandad/prediccion/historial/?lote_id=${idLote}`);
      setHistorialPredicciones(Array.isArray(resHist.data) ? resHist.data : []);
      
      if (!esInicial) {
        setMensaje("✓ Análisis de IA completado. Predicción actualizada en tiempo real.");
      }
    } catch {
      setError("No se pudo calcular la predicción del lote seleccionado.");
    } finally {
      setGenerando(false);
    }
  };

  const handleLoteChange = (e) => {
    const id = e.target.value;
    setLoteSeleccionado(id);
    navigate(`/mortandad/prediccion?lote=${id}`, { replace: true });
    if (id) {
      cargarHistorialYPrediccion(id);
    } else {
      setPrediccionActual(null);
      setHistorialPredicciones([]);
    }
  };

  const irAAnalisisMortalidad = () => {
    if (loteSeleccionado) {
      navigate(`/mortandad?lote=${loteSeleccionado}&tab=analisis`);
    }
  };

  const handleRecalcular = () => {
    calcularPrediccion(loteSeleccionado);
  };

  const handleActualizarRecomendacion = async (recId, nuevoEstado) => {
    const predId = prediccionActual?.id_prediccion;
    if (!predId) return;

    try {
      const res = await api.patch(`/mortandad/prediccion/${predId}/recomendacion/`, {
        recomendacion_id: recId,
        estado: nuevoEstado,
      });
      setPrediccionActual(res.data);
      setHistorialPredicciones(prev =>
        prev.map(p => (p.id_prediccion === predId ? res.data : p))
      );
    } catch (e) {
      console.error("Error al actualizar estado de recomendación", e);
    }
  };

  /* ── Count-up animation ── */
  useEffect(() => {
    if (!prediccionActual) { setDisplayPct(0); return; }
    const target = prediccionActual.riesgo_porcentaje;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startTime) / 1000, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(Math.round(eased * target));
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [prediccionActual]);

  const meta = prediccionActual ? getRiskMeta(prediccionActual.nivel_riesgo) : getRiskMeta("Bajo");

  const loteActual = lotes.find(l => l.id_lote.toString() === loteSeleccionado) || null;

  let edadDias = 0;
  if (loteActual && loteActual.fecha_ingreso) {
    edadDias = Math.floor((new Date() - new Date(loteActual.fecha_ingreso)) / (1000 * 60 * 60 * 24));
  }

  const bajasTotales = loteActual ? (loteActual.cantidad_inicial - loteActual.cantidad_actual) : 0;
  const tasaMortalidad = loteActual && loteActual.cantidad_inicial > 0
    ? ((bajasTotales / loteActual.cantidad_inicial) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="risk-container">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />



      <main
        className="risk-main-content"
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "260px" : "70px",
          transition: "margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          minWidth: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <Topbar
          titulo="Predicción IA de Riesgo de Mortalidad"
          subtitulo="Machine Learning para detección temprana de patologías y estrés"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="risk-content-grid">
          
          {/* COLUMNA IZQUIERDA: Selector e Indicador de Riesgo */}
          <div className="risk-column">
            
            {/* CARD SELECTOR */}
            <div className="risk-card selector-card" style={{ animationDelay: "0s" }}>
              <div className="card-header-icon-title">
                <Brain size={20} color="#78350f" />
                <h3>Lote a Evaluar</h3>
              </div>
              <p className="card-description">
                Seleccione un lote activo de su empresa para cargar el modelo de IA.
              </p>
              
              <div className="form-group">
                <label htmlFor="lote-select">Lote Activo:</label>
                <select
                  id="lote-select"
                  value={loteSeleccionado}
                  onChange={handleLoteChange}
                  disabled={cargando || generando}
                  className="risk-select"
                >
                  {lotes.length === 0 && <option value="">No hay lotes activos</option>}
                  {lotes.map((l) => (
                    <option key={l.id_lote} value={l.id_lote}>
                      Lote #{l.id_lote} - Galpón: {l.galpon_nombre || `ID: ${l.galpon}`} ({l.raza_tipo || 'Raza estándar'})
                    </option>
                  ))}
                </select>
              </div>

              {loteSeleccionado && (
                <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                  <button
                    type="button"
                    onClick={handleRecalcular}
                    disabled={cargando || generando}
                    className="btn-recalculate"
                    style={{ flex: 1 }}
                  >
                    <RefreshCw size={16} className={generando ? "spin" : ""} />
                    {generando ? "Procesando..." : "Analizar Estado"}
                  </button>
                  <button
                    type="button"
                    onClick={irAAnalisisMortalidad}
                    className="btn-recalculate"
                    style={{ flex: 1, backgroundColor: "#1e293b", color: "#fff", borderColor: "#1e293b" }}
                    title="Ver reportes y tasas de mortalidad del lote"
                  >
                    <BarChart3 size={16} />
                    Reportes y Análisis
                  </button>
                </div>
              )}

              {error && <div className="risk-error-msg">{error}</div>}
              {mensaje && <div className="risk-success-msg">{mensaje}</div>}
            </div>

            {/* CARD DETALLES DEL LOTE */}
            {loteActual && (
              <div className="risk-card lot-info-card" style={{ animationDelay: "0.05s" }}>
                <div className="card-header-icon-title">
                  <BarChart3 size={20} color="#78350f" />
                  <h3>Detalles del Lote</h3>
                </div>
                <div className="lot-info-grid">
                  <div className="lot-info-item">
                    <span className="lot-info-label">Lote</span>
                    <span className="lot-info-value">#{loteActual.id_lote}</span>
                  </div>
                  <div className="lot-info-item">
                    <span className="lot-info-label">Galpón</span>
                    <span className="lot-info-value">{loteActual.galpon_nombre || `ID: ${loteActual.id_galpon}`}</span>
                  </div>
                  <div className="lot-info-item">
                    <span className="lot-info-label">Raza</span>
                    <span className="lot-info-value">{loteActual.raza_tipo || "Estándar"}</span>
                  </div>
                  <div className="lot-info-item">
                    <span className="lot-info-label">Edad</span>
                    <span className="lot-info-value">{edadDias} días</span>
                  </div>
                  <div className="lot-info-item">
                    <span className="lot-info-label">Ingreso</span>
                    <span className="lot-info-value">{new Date(loteActual.fecha_ingreso).toLocaleDateString("es-BO")}</span>
                  </div>
                  <div className="lot-info-item">
                    <span className="lot-info-label">Estado</span>
                    <span className="lot-info-value lot-status">{loteActual.estado}</span>
                  </div>
                </div>
              </div>
            )}

            {/* CARD MEDIDOR DE RIESGO */}
            {cargando && !prediccionActual ? (
              <div className="risk-card skeleton-card" style={{ animationDelay: "0.1s" }}>
                <div className="skeleton-circle" />
              </div>
            ) : prediccionActual && (
              <div className={`risk-card gauge-card ${meta.cardClass}`} style={{ animationDelay: "0.1s" }}>
                <div className="gauge-header">
                  <span className="gauge-badge">Riesgo Predicho</span>
                  <span className={`risk-level-tag ${meta.badgeClass}`}>{prediccionActual.nivel_riesgo}</span>
                </div>

                <div className="gauge-visual-container">
                  <svg width="200" height="200" viewBox="0 0 200 200" className="gauge-svg">
                    <circle cx="100" cy="100" r="82" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                    <circle
                      cx="100" cy="100" r="82"
                      fill="none"
                      stroke={meta.color}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 82}
                      strokeDashoffset={2 * Math.PI * 82 * (1 - displayPct / 100)}
                      transform="rotate(-90 100 100)"
                      className="gauge-arc-glow"
                      style={{ filter: `drop-shadow(0 0 6px ${meta.color})`, opacity: 0.25 }}
                    />
                    <circle
                      cx="100" cy="100" r="82"
                      fill="none"
                      stroke={meta.color}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 82}
                      strokeDashoffset={2 * Math.PI * 82 * (1 - displayPct / 100)}
                      transform="rotate(-90 100 100)"
                      className="gauge-arc"
                    />
                    <text x="100" y="96" fill="#1e293b" dominantBaseline="middle" textAnchor="middle" className="gauge-svg-number">{displayPct}%</text>
                    <text x="100" y="125" fill="#64748b" textAnchor="middle" className="gauge-svg-label">Riesgo de Mortalidad</text>
                  </svg>
                </div>

                <div className="gauge-footer-info">
                  <Clock size={14} color="#6b7280" />
                  <span>Última ejecución: {formatFecha(prediccionActual.fecha_hora)}</span>
                </div>
              </div>
            )}

            {/* CARD FACTORES ANALIZADOS */}
            {prediccionActual && (
              <div className="risk-card stats-card" style={{ animationDelay: "0.12s", borderTop: "4px solid #3b82f6" }}>
                <div className="card-header-icon-title">
                  <Brain size={20} color="#3b82f6" />
                  <h3>Factores de Riesgo Analizados (IA)</h3>
                </div>
                <p className="card-description">
                  Valores procesados por el modelo predictivo de IA en el galpón.
                </p>
                <div className="stats-kpi-grid">
                  <div className="stats-kpi">
                    <span className="stats-kpi-value">{prediccionActual.temperatura_promedio ? `${prediccionActual.temperatura_promedio}°C` : "—"}</span>
                    <span className="stats-kpi-label">Temp. Prom. (24h)</span>
                  </div>
                  <div className="stats-kpi">
                    <span className="stats-kpi-value">{prediccionActual.humedad_promedio ? `${prediccionActual.humedad_promedio}%` : "—"}</span>
                    <span className="stats-kpi-label">Humedad Prom. (24h)</span>
                  </div>
                  <div className="stats-kpi">
                    <span className="stats-kpi-value">{prediccionActual.edad_dias ? `${prediccionActual.edad_dias} d` : "—"}</span>
                    <span className="stats-kpi-label">Edad del Lote</span>
                  </div>
                  <div className="stats-kpi">
                    <span className={`stats-kpi-value ${prediccionActual.desviacion_alimento < -5 ? "stats-kpi-value--danger" : "stats-kpi-value--success"}`}>
                      {prediccionActual.desviacion_alimento ? `${prediccionActual.desviacion_alimento}%` : "—"}
                    </span>
                    <span className="stats-kpi-label">Desviación Consumo</span>
                  </div>
                </div>
              </div>
            )}

            {/* CARD ESTADÍSTICAS DE MORTALIDAD (SINERGIA CU23) */}
            {loteActual && (
              <div className="risk-card stats-card" style={{ animationDelay: "0.15s", borderTop: "4px solid #b45309" }}>
                <div className="card-header-icon-title">
                  <Activity size={20} color="#b45309" />
                  <h3>Reporte Histórico del Lote (CU23)</h3>
                </div>
                <p className="card-description">
                  Datos reales de mortandad acumulada y población. Acceso directo a reportes consolidados.
                </p>
                <div className="stats-kpi-grid">
                  <div className="stats-kpi">
                    <span className="stats-kpi-value stats-kpi-value--danger">{bajasTotales}</span>
                    <span className="stats-kpi-label">Bajas Totales</span>
                  </div>
                  <div className="stats-kpi">
                    <span className="stats-kpi-value stats-kpi-value--warning">{tasaMortalidad}%</span>
                    <span className="stats-kpi-label">Tasa Mortalidad</span>
                  </div>
                  <div className="stats-kpi">
                    <span className={`stats-kpi-value ${prediccionActual && prediccionActual.bajas_recientes > 0 ? "stats-kpi-value--danger" : "stats-kpi-value--success"}`}>
                      {prediccionActual ? prediccionActual.bajas_recientes : "—"}
                    </span>
                    <span className="stats-kpi-label">Bajas 3 días</span>
                  </div>
                  <div className="stats-kpi">
                    <span className="stats-kpi-value">{loteActual.cantidad_actual}</span>
                    <span className="stats-kpi-label">Aves Actuales</span>
                  </div>
                </div>
                <div className="stats-population-bar" style={{ marginBottom: "16px" }}>
                  <div className="stats-pop-bar-track">
                    <div
                      className="stats-pop-bar-fill"
                      style={{ width: `${Math.min((loteActual.cantidad_actual / loteActual.cantidad_inicial) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="stats-pop-bar-labels">
                    <span>Población: {loteActual.cantidad_actual} / {loteActual.cantidad_inicial}</span>
                  </div>
                </div>
                
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: Factores Clave y Recomendaciones */}
          <div className="risk-column risk-column--double">
            
            {prediccionActual ? (
              <>
                {/* CARD FACTORES CLAVE */}
                <div className="risk-card factors-card" style={{ animationDelay: "0.15s" }}>
                  <div className="card-header-icon-title">
                    <Activity size={20} color="#78350f" />
                    <h3>Factores Determinantes del Riesgo</h3>
                  </div>
                  <p className="card-description">
                    Variables ambientales y biológicas analizadas por el clasificador de IA en el galpón.
                  </p>

                  <div className="factors-grid">
                    
                    {/* FACTOR 1: TEMPERATURA */}
                    <div className="factor-tile">
                      <div className="factor-tile-header">
                        <Thermometer size={18} color="#f59e0b" />
                        <span>Temperatura Galpón</span>
                      </div>
                      <span className="factor-value">
                        {prediccionActual.temperatura_promedio ? `${parseFloat(prediccionActual.temperatura_promedio).toFixed(1)} °C` : "N/D"}
                      </span>
                      <span className="factor-label-info">Promedio últimas 24h</span>
                    </div>

                    {/* FACTOR 2: ALIMENTO */}
                    <div className="factor-tile">
                      <div className="factor-tile-header">
                        <Wheat size={18} color="#10b981" />
                        <span>Consumo de Alimento</span>
                      </div>
                      <span className={`factor-value ${parseFloat(prediccionActual.desviacion_alimento) < -10 ? "text-danger" : ""}`}>
                        {prediccionActual.desviacion_alimento ? `${parseFloat(prediccionActual.desviacion_alimento).toFixed(1)}%` : "N/D"}
                      </span>
                      <span className="factor-label-info">Desviación vs Estándar</span>
                    </div>

                    {/* FACTOR 3: BAJAS RECIENTES */}
                    <div className="factor-tile">
                      <div className="factor-tile-header">
                        <AlertTriangle size={18} color="#ef4444" />
                        <span>Bajas Recientes</span>
                      </div>
                      <span className="factor-value">
                        {prediccionActual.bajas_recientes} bajas
                      </span>
                      <span className="factor-label-info">Acumulado 3 días</span>
                    </div>

                    {/* FACTOR 4: ALERTA SANITARIA */}
                    <div className="factor-tile">
                      <div className="factor-tile-header">
                        <ShieldAlert size={18} color="#3b82f6" />
                        <span>Alerta Sanitaria</span>
                      </div>
                      <span className={`factor-value ${prediccionActual.alerta_sanitaria ? "text-danger" : "text-success"}`}>
                        {prediccionActual.alerta_sanitaria ? "Activa" : "Ninguna"}
                      </span>
                      <span className="factor-label-info">Estado del galpón</span>
                    </div>

                  </div>

                  <div className="ai-factors-bullet-list">
                    <h4>Interpretación del Modelo:</h4>
                    <ul>
                      {prediccionActual.factores_clave && prediccionActual.factores_clave.map((f, idx) => (
                        <li key={idx}>
                          <Sparkles size={14} className="sparkle-icon" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CARD RECOMENDACIONES */}
                <div className="risk-card recommendations-card" style={{ animationDelay: "0.2s" }}>
                  <div className="card-header-icon-title">
                    <Zap size={20} color="#78350f" />
                    <h3>Recomendaciones del Asistente IA</h3>
                  </div>
                  <p className="card-description">
                    Acciones veterinarias y operativas sugeridas para contrarrestar los factores de riesgo identificados.
                  </p>

                  <div className="recommendations-list">
                    {prediccionActual.recomendaciones && prediccionActual.recomendaciones.map((rec, idx) => {
                      const isObj = typeof rec === 'object' && rec !== null;
                      const texto = isObj ? rec.texto : rec;
                      const estado = isObj ? rec.estado : 'Pendiente';
                      const recId = isObj ? rec.id : idx + 1;

                      return (
                        <div key={idx} className="recommendation-item" style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          padding: "16px",
                          background: "#fafafa",
                          borderRadius: "12px",
                          marginBottom: "10px",
                          borderLeft: estado === 'Aplicada' ? "4px solid #10b981" : estado === 'Ignorada' ? "4px solid #9ca3af" : "4px solid #f59e0b"
                        }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                            <div className="rec-bullet" style={{
                              background: estado === 'Aplicada' ? "#dcfce7" : estado === 'Ignorada' ? "#f3f4f6" : "#fef3c7",
                              color: estado === 'Aplicada' ? "#15803d" : estado === 'Ignorada' ? "#4b5563" : "#d97706",
                              fontWeight: "700",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              fontSize: "12px"
                            }}>{idx + 1}</div>
                            <div className="rec-text" style={{ flex: 1, fontSize: "14px", color: "#374151" }}>{texto}</div>
                          </div>
                          
                          {/* Botones de acción / estado */}
                          {isObj && (
                            <div style={{ display: "flex", gap: "12px", alignSelf: "flex-end", marginTop: "4px" }}>
                              {estado === 'Pendiente' ? (
                                <>
                                  <button
                                    onClick={() => handleActualizarRecomendacion(recId, 'Aplicada')}
                                    style={{
                                      border: "none",
                                      background: "#dcfce7",
                                      color: "#15803d",
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✓ Aplicar sugerencia
                                  </button>
                                  <button
                                    onClick={() => handleActualizarRecomendacion(recId, 'Ignorada')}
                                    style={{
                                      border: "none",
                                      background: "#f3f4f6",
                                      color: "#4b5563",
                                      padding: "6px 12px",
                                      borderRadius: "8px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✕ Ignorar
                                  </button>
                                </>
                              ) : (
                                <span style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  textTransform: "uppercase",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  background: estado === 'Aplicada' ? "#dcfce7" : "#e5e7eb",
                                  color: estado === 'Aplicada' ? "#16a34a" : "#4b5563",
                                }}>
                                  Estado: {estado}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : cargando ? (
              <div className="risk-card skeleton-card" style={{ animationDelay: "0.15s" }}>
                <div className="card-header-icon-title">
                  <Activity size={20} color="#78350f" />
                  <h3>Factores Determinantes del Riesgo</h3>
                </div>
                <div className="skeleton-line skeleton-line--text" style={{ width: "60%" }} />
                <div className="factors-grid">
                  <div className="factor-tile"><div className="skeleton-line" style={{ width: "70%", height: "14px" }} /><div className="skeleton-line" style={{ width: "40%", height: "24px" }} /></div>
                  <div className="factor-tile"><div className="skeleton-line" style={{ width: "70%", height: "14px" }} /><div className="skeleton-line" style={{ width: "40%", height: "24px" }} /></div>
                  <div className="factor-tile"><div className="skeleton-line" style={{ width: "70%", height: "14px" }} /><div className="skeleton-line" style={{ width: "40%", height: "24px" }} /></div>
                  <div className="factor-tile"><div className="skeleton-line" style={{ width: "70%", height: "14px" }} /><div className="skeleton-line" style={{ width: "40%", height: "24px" }} /></div>
                </div>
              </div>
            ) : (
              <div className="risk-card empty-state-card">
                <Brain size={48} color="#d1d5db" className="empty-icon" />
                <h3>No hay datos para evaluar</h3>
                <p>
                  Por favor, registre al menos un lote activo e ingrese registros ambientales en el sistema para habilitar la predicción de IA.
                </p>
              </div>
            )}

          </div>

        </div>

        {/* SECCIÓN INFERIOR: Historial de Tendencias e Historial Real */}
        {(historialPredicciones.length > 0 || registrosMortandad.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "28px", marginTop: "8px" }}>
            
            {/* GRÁFICO 1: TENDENCIA RIESGO IA */}
            {historialPredicciones.length > 0 && (
              <div className="risk-card trend-chart-card" style={{ animationDelay: "0.25s", marginTop: 0, height: "100%" }}>
                <div className="card-header-icon-title">
                  <TrendingUp size={20} color="#3b82f6" />
                  <h3>Tendencia del Riesgo de Mortalidad (IA)</h3>
                </div>
                <p className="card-description">
                  Historial del riesgo calculado en las últimas evaluaciones. Permite analizar la efectividad de las medidas preventivas.
                </p>

                <div className="risk-chart-container">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart
                      data={historialPredicciones}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={meta.color} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={meta.color} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="fecha_hora" 
                        tickFormatter={(tick) => {
                          const d = new Date(tick);
                          return `${d.getDate()}/${d.getMonth()+1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
                        }} 
                        stroke="#94a3b8"
                        fontSize={11}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        stroke="#94a3b8" 
                        fontSize={11}
                        unit="%"
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="riesgo_porcentaje"
                        stroke={meta.color}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorRisk)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* SECCIÓN: Registro de Bajas Recientes */}
            {registrosMortandad.length > 0 && (
              <div className="risk-card death-log-card" style={{ animationDelay: "0.3s", marginTop: 0, height: "100%" }}>
                <div className="card-header-icon-title">
                  <AlertTriangle size={20} color="#78350f" />
                  <h3>Últimas Bajas Registradas</h3>
                </div>
                <p className="card-description">
                  Registros de mortalidad recientes para el lote seleccionado.
                </p>
                <div className="death-log-table-wrapper" style={{ overflowY: "auto", maxHeight: "280px" }}>
                  <table className="death-log-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Cantidad</th>
                        <th>Causa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosMortandad.map((r) => (
                        <tr key={r.id_muerte}>
                          <td className="death-log-date">{formatFecha(r.fecha_hora)}</td>
                          <td className="death-log-qty">{r.cantidad}</td>
                          <td className="death-log-cause">{r.causa || "Sin especificar"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
