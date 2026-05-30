import { useEffect, useState } from "react";
import {
  Brain, AlertTriangle, TrendingUp, RefreshCw, BarChart3,
  Sparkles, Clock, Activity, Zap, CheckCircle, Info,
  Thermometer, ChevronRight
} from "lucide-react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
  BarChart, Bar, Cell
} from "recharts";
import api from "../../api/axios";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import useIsMobile from "../../hooks/useIsMobile";
import "./PrediccionTemperatura.css";

/* ── Color helpers ────────────────────────────────────────────────── */
function getEstadoMeta(estado) {
  if (estado === "FRIO")
    return {
      headerClass: "pred-card-header--frio",
      badgeClass: "pred-estado-badge--FRIO",
      icon: "❄️",
      chartColor: "#3b82f6",
      gradId: "grad-frio",
      gradStart: "#3b82f6",
    };
  if (estado === "CALOR")
    return {
      headerClass: "pred-card-header--calor",
      badgeClass: "pred-estado-badge--CALOR",
      icon: "🔥",
      chartColor: "#ef4444",
      gradId: "grad-calor",
      gradStart: "#ef4444",
    };
  return {
    headerClass: "pred-card-header--normal",
    badgeClass: "pred-estado-badge--NORMAL",
    icon: "✅",
    chartColor: "#10b981",
    gradId: "grad-normal",
    gradStart: "#10b981",
  };
}

function getConfianzaClass(pct) {
  if (pct >= 70) return "pred-confidence-fill--high";
  if (pct >= 40) return "pred-confidence-fill--mid";
  return "pred-confidence-fill--low";
}

function formatFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-BO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/* ── Custom chart tooltip ─────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const isDelta = payload[0].dataKey === "delta";
    
    return (
      <div className="pred-chart-tooltip">
        <span className="pred-chart-tooltip-hour">+{label}h</span>
        <span className="pred-chart-tooltip-temp">
          {isDelta ? (val > 0 ? `+${val}°C/h` : `${val}°C/h`) : `${val}°C`}
        </span>
      </div>
    );
  }
  return null;
}

const getChartDataWithDeltas = (puntos) => {
  if (!puntos) return [];
  return puntos.map((pt, i) => {
    let delta = 0;
    if (i > 0) {
      delta = pt.temperatura - puntos[i - 1].temperatura;
    }
    return { ...pt, delta: parseFloat(delta.toFixed(2)) };
  });
};

/* ── Main component ───────────────────────────────────────────────── */
export default function PrediccionTemperatura() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [predicciones, setPredicciones] = useState([]);
  const [galpones, setGalpones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [generando, setGenerando] = useState(false);
  const [galponSeleccionado, setGalponSeleccionado] = useState("");
  const [horizonteHoras, setHorizonteHoras] = useState(3);
  const [ventanaHoras, setVentanaHoras] = useState(24);

  /* Cargar datos al montar + polling cada 60s */
  useEffect(() => {
    cargarDatosIniciales();
    const intervalo = setInterval(cargarPredicciones, 60000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true);
      setError("");
      await Promise.all([cargarGalpones(), cargarPredicciones()]);
    } catch {
      setError("No se pudieron cargar los datos de predicción.");
    } finally {
      setCargando(false);
    }
  };

  const cargarGalpones = async () => {
    const res = await api.get("/galpones/");
    const lista = Array.isArray(res.data) ? res.data : [];
    setGalpones(lista.filter((g) => g.estado === "activo"));
  };

  const cargarPredicciones = async () => {
    try {
      const res = await api.get("/temperatura/prediccion/ultimas/");
      setPredicciones(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* silencioso */
    }
  };

  const generarPrediccion = async (e) => {
    e.preventDefault();
    if (!galponSeleccionado) {
      setError("Debe seleccionar un galpón.");
      return;
    }
    setGenerando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/temperatura/prediccion/generar/", {
        galpon_id: parseInt(galponSeleccionado, 10),
        horizonte_horas: parseInt(horizonteHoras, 10),
        ventana_horas: parseInt(ventanaHoras, 10),
      });
      setMensaje("✓ Predicción generada exitosamente para el galpón seleccionado.");
      setGalponSeleccionado("");
      await cargarPredicciones();
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "No se pudo generar la predicción. Verifique que haya suficientes datos históricos (mínimo 8 registros en las últimas 24h)."
      );
    } finally {
      setGenerando(false);
    }
  };

  /* ── Estadísticas de resumen ──────────────────────────────────── */
  const totalAlertas = predicciones.filter((p) => p.umbral_superado).length;
  const promedioConfianza =
    predicciones.length > 0
      ? Math.round(
          predicciones.reduce((acc, p) => acc + p.confianza * 100, 0) /
            predicciones.length
        )
      : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f1f5f9" }}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px",
          flex: 1,
          padding: isMobile ? "16px" : "32px",
          paddingTop: isMobile ? "80px" : "32px",
          transition: "margin-left 0.3s ease",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}
      >
        <Topbar
          titulo="Predicción IA de Temperatura"
          subtitulo="Modelo predictivo con regresión lineal — Horizonte 3h"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* ── Stats Row ──────────────────────────────────────── */}
        <div className="pred-stats-row">
          <div className="pred-stat-mini">
            <span className="pred-stat-mini-val">{predicciones.length}</span>
            <span className="pred-stat-mini-label">Galpones monitoreados</span>
          </div>
          <div className="pred-stat-mini">
            <span className="pred-stat-mini-val" style={{ color: totalAlertas > 0 ? "#dc2626" : "inherit" }}>
              {totalAlertas}
            </span>
            <span className="pred-stat-mini-label">Alertas predictivas</span>
          </div>
          <div className="pred-stat-mini">
            <span className="pred-stat-mini-val">{promedioConfianza}%</span>
            <span className="pred-stat-mini-label">Confianza media</span>
          </div>
        </div>

        {/* ── Mensajes ─────────────────────────────────────────── */}
        {error && (
          <div className="pred-msg pred-msg-error">
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}
        {mensaje && (
          <div className="pred-msg pred-msg-success">
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            {mensaje}
          </div>
        )}

        {/* ── Content Layout ────────────────────────────────────── */}
        <div className="pred-content-layout">
          {/* Left Column: Cards */}
          <div className="pred-cards-col">
            {cargando ? (
              <div className="pred-loading">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="pred-skeleton" style={{ background: "white" }} />
                ))}
              </div>
            ) : predicciones.length === 0 ? (
              <div className="pred-empty">
                <div className="pred-empty-icon">
                  <Brain size={32} />
                </div>
                <h3>Sin predicciones todavía</h3>
                <p>
                  No se han generado predicciones. Seleccione un galpón en el panel
                  lateral y ejecute el modelo, o espere al scheduler automático.
                </p>
              </div>
            ) : (
              <div className="pred-grid">
                {predicciones.map((pred) => {
                  const meta = getEstadoMeta(pred.estado_predicho);
                  const confianzaPct = Math.round((pred.confianza ?? 0) * 100);

                  return (
                    <div key={pred.id} className={`pred-card ${meta.headerClass}`}>
                      {/* Header */}
                      <div className="pred-card-header">
                        <div className="pred-card-header-top">
                          <div>
                            <p className="pred-card-galpon">{pred.galpon_nombre}</p>
                            <span className="pred-card-source">
                              <Thermometer size={11} />
                              Predicción a {pred.horizonte_horas}h
                            </span>
                          </div>
                          <div
                            className={`pred-estado-badge ${meta.badgeClass}`}
                          >
                            {meta.icon} {pred.estado_predicho}
                          </div>
                        </div>

                        <div className="pred-temp-display">
                          <span className="pred-temp-value">
                            {pred.temperatura_predicha}
                          </span>
                          <span className="pred-temp-unit">°C</span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="pred-card-body">
                        {/* Meta chips */}
                        <div className="pred-meta-row">
                          <div className="pred-meta-chip">
                            <Clock size={12} />
                            Horizonte: {pred.horizonte_horas}h
                          </div>
                          <div className="pred-meta-chip">
                            <Activity size={12} />
                            Ventana: {pred.ventana_horas}h
                          </div>
                        </div>

                        {/* Confidence */}
                        <div className="pred-confidence">
                          <div className="pred-confidence-header">
                            <span className="pred-confidence-label">Confianza del modelo</span>
                            <span className="pred-confidence-pct">{confianzaPct}%</span>
                          </div>
                          <div className="pred-confidence-track">
                            <div
                              className={`pred-confidence-fill ${getConfianzaClass(confianzaPct)}`}
                              style={{ width: `${confianzaPct}%` }}
                            />
                          </div>
                          {/* Charts grid */}
                          {pred.puntos?.length > 0 && (
                            <div className="pred-charts-container">
                              {/* Main Chart */}
                              <div className="pred-chart-wrap">
                                <div className="pred-chart-label">
                                  <BarChart3 size={12} />
                                  Evolución Térmica (Próximas {pred.puntos.length}h)
                                </div>
                                <ResponsiveContainer width="100%" height={160}>
                                  <ComposedChart data={getChartDataWithDeltas(pred.puntos)} margin={{ top: 15, right: 10, bottom: 0, left: -20 }}>
                                    <defs>
                                      <linearGradient id={`${meta.gradId}-${pred.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={meta.chartColor} stopOpacity={0.25} />
                                        <stop offset="100%" stopColor={meta.chartColor} stopOpacity={0} />
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="h" tickFormatter={(v) => `+${v}h`} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <ReferenceLine y={34} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'MAX 34°', fill: '#ef4444', fontSize: 10 }} />
                                    <ReferenceLine y={24} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: 'MIN 24°', fill: '#3b82f6', fontSize: 10 }} />
                                    <Area type="monotone" dataKey="temperatura" stroke="none" fill={`url(#${meta.gradId}-${pred.id})`} />
                                    <Line type="monotone" dataKey="temperatura" stroke={meta.chartColor} strokeWidth={3} dot={{ r: 4, fill: "white", stroke: meta.chartColor, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0, fill: meta.chartColor }} />
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Delta BarChart */}
                              <div className="pred-chart-wrap" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                <div className="pred-chart-label" style={{ color: '#64748b' }}>
                                  <Activity size={12} />
                                  Tasa de Variación (°C / hora)
                                </div>
                                <ResponsiveContainer width="100%" height={100}>
                                  <BarChart data={getChartDataWithDeltas(pred.puntos)} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="h" tickFormatter={(v) => `+${v}h`} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={32} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <ReferenceLine y={0} stroke="#cbd5e1" />
                                    <Bar dataKey="delta" radius={[4, 4, 0, 0]}>
                                      {getChartDataWithDeltas(pred.puntos).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.delta > 0 ? '#ef4444' : entry.delta < 0 ? '#3b82f6' : '#94a3b8'} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Alert / ok banner */}
                        {pred.umbral_superado ? (
                          <div className="pred-alert pred-alert--danger">
                            <AlertTriangle size={15} />
                            <span>{pred.mensaje}</span>
                          </div>
                        ) : pred.mensaje ? (
                          <div className="pred-alert pred-alert--ok">
                            <TrendingUp size={15} />
                            <span>{pred.mensaje}</span>
                          </div>
                        ) : null}

                      </div>

                      {/* Card footer */}
                      <div className="pred-card-footer">
                        <span className="pred-card-time">
                          <Clock size={11} />
                          Generado {formatFecha(pred.fecha_hora)}
                        </span>
                        {pred.umbral_superado && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#dc2626",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}>
                            <Zap size={11} /> Alerta activa
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Sidebar (Forms & Info) */}
          <div className="pred-sidebar-col">
            <div className="pred-panel-header">
              <div className="pred-panel-icon pred-panel-icon--amber">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="pred-panel-title">Generar predicción</p>
                <p className="pred-panel-subtitle">Ejecutar modelo de IA manualmente</p>
              </div>
            </div>
            <div className="pred-panel-body">
              <form className="pred-form" onSubmit={generarPrediccion}>
                <div>
                  <label className="pred-form-label">Galpón a analizar</label>
                  <select
                    className="pred-form-select"
                    value={galponSeleccionado}
                    onChange={(e) => setGalponSeleccionado(e.target.value)}
                    id="galpon-prediccion-select"
                  >
                    <option value="">— Seleccione un galpón activo —</option>
                    {galpones.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nombre}
                        {g.ubicacion_nombre ? ` · ${g.ubicacion_nombre}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label className="pred-form-label">Horizonte de predicción</label>
                    <select
                      className="pred-form-select"
                      value={horizonteHoras}
                      onChange={(e) => setHorizonteHoras(e.target.value)}
                    >
                      <option value="1">1 hora</option>
                      <option value="3">3 horas (Recomendado)</option>
                      <option value="6">6 horas</option>
                      <option value="12">12 horas</option>
                      <option value="24">24 horas</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="pred-form-label">Historial a usar (Ventana)</label>
                    <select
                      className="pred-form-select"
                      value={ventanaHoras}
                      onChange={(e) => setVentanaHoras(e.target.value)}
                    >
                      <option value="12">Últimas 12 horas</option>
                      <option value="24">Últimas 24 horas</option>
                      <option value="72">Últimos 3 días (72h)</option>
                      <option value="168">Última semana</option>
                      <option value="2160">Últimos 3 meses</option>
                      <option value="4320">Últimos 6 meses</option>
                      <option value="8760">Último año</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="pred-btn-generate"
                  disabled={generando}
                  id="btn-generar-prediccion"
                  style={{ marginTop: "12px" }}
                >
                  {generando ? (
                    <>
                      <span className="pred-btn-generate-spinner" />
                      Procesando…
                    </>
                  ) : (
                    <>
                      <Brain size={16} />
                      Ejecutar IA
                      <ChevronRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Model info panel (Minimalist) */}
          <div className="pred-panel" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
            <div className="pred-panel-body" style={{ padding: "0 8px" }}>
              <p style={{ fontSize: "12px", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                <strong>Acerca del modelo:</strong> Regresión lineal simple (OLS). 
                Analiza el historial seleccionado y ajusta una recta para extrapolar la tendencia. 
                Si la proyección supera los umbrales (24°C - 34°C), se emite alerta preventiva.
                <br /><br />
                <em>Nota: Para plazos largos (ej. 1 año), el análisis puede demorar unos segundos.</em>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
