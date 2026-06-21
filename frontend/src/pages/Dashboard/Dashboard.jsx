import { useState, useEffect } from "react";
import {
  Bird,
  Package,
  Thermometer,
  Zap,
  AlertCircle,
  Brain,
  TrendingUp,
  ShieldAlert,
  Calendar,
  Scale,
  Activity,
  ArrowRight,
  TrendingDown,
  Warehouse,
  ShoppingBag,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import StatCard from "../../components/StatCard";
import AlertItem from "../../components/AlertItem";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";
import MonitoreoRealTime from "./MonitoreoRealTime";
import RecomendacionesIA from "../../components/RecomendacionesIA";

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAves: 0,
    lotesActivos: 0,
    mortalidadPct: 0,
    consumoMesKg: 0,
    conversionEstimada: 0,
    insumosCriticos: [],
    insumosCriticosCount: 0,
    galponesOcupados: 0,
    alertasGenerales: 0,
    curvaCrecimiento: [],
    bajasRecientes: [],
    mortalidad7d: [],
    consumo7d: [],

    // fields for notifications / backwards compatibility
    alertasInventario: 0,
    galponesActivos: 0,
    predicciones: 0,
    alertasPredictivas: 0,
    alertasSanitarias: 0,
    alertasSanitariasCriticas: 0,
    alertasStockMedicamento: 0,
  });
  const [alertasSanitarias, setAlertasSanitarias] = useState([]);
  const [recomendacionesPendientes, setRecomendacionesPendientes] = useState([]);

  useEffect(() => {
    fetchStats();
    const timer = setInterval(fetchStats, 15000);
    return () => clearInterval(timer);
  }, []);

  const valorResuelto = (result) => (result.status === "fulfilled" ? result.value : null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [dashRes, predRes, sanitariasRes, recsRes] = await Promise.allSettled([
        api.get("/reportes/dashboard/"),
        api.get("/temperatura/prediccion/ultimas/"),
        api.get("/sanitario/alertas/?estado=Pendiente"),
        api.get("/mortandad/prediccion/recomendaciones/pendientes/"),
      ]);

      const dashData = valorResuelto(dashRes)?.data || {};
      const preds = Array.isArray(valorResuelto(predRes)?.data) ? valorResuelto(predRes).data : [];
      const alertasPred = preds.filter((p) => p.umbral_superado).length;

      const alertasSan = Array.isArray(valorResuelto(sanitariasRes)?.data)
        ? valorResuelto(sanitariasRes).data
        : [];
      const criticasSan = alertasSan.filter(
        (a) => a.nivel === "Critico" || a.nivel === "Crítico"
      ).length;
      const stockMed = alertasSan.filter((a) => a.tipo_alerta === "StockMedicamento").length;

      const recsData = Array.isArray(valorResuelto(recsRes)?.data)
        ? valorResuelto(recsRes).data
        : [];
      setRecomendacionesPendientes(recsData);

      setAlertasSanitarias(alertasSan);
      setStats({
        totalAves: dashData.aves_activas || 0,
        lotesActivos: dashData.lotes_activos || 0,
        mortalidadPct: dashData.mortalidad_pct || 0,
        consumoMesKg: dashData.consumo_mes_kg || 0,
        conversionEstimada: dashData.conversion_estimada || 0,
        insumosCriticos: dashData.insumos_criticos || [],
        insumosCriticosCount: dashData.insumos_criticos_count || 0,
        galponesOcupados: dashData.galpones_ocupados_count || 0,
        alertasGenerales: dashData.alertas_generales_count || 0,
        curvaCrecimiento: dashData.curva_crecimiento || [],
        bajasRecientes: dashData.bajas_recientes || [],
        mortalidad7d: dashData.mortalidad_7d || [],
        consumo7d: dashData.consumo_7d || [],

        alertasInventario: dashData.insumos_criticos_count || 0,
        galponesActivos: dashData.galpones_ocupados_count || 0,
        predicciones: preds.length,
        alertasPredictivas: alertasPred,
        alertasSanitarias: alertasSan.length,
        alertasSanitariasCriticas: criticasSan,
        alertasStockMedicamento: stockMed,
      });
    } catch (e) {
      console.error("Error al cargar estadísticas", e);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      label: "Aves Totales",
      value: loading ? "—" : stats.totalAves.toLocaleString(),
      trend: "Población activa",
      trendType: "trend-up",
      icon: <Bird size={24} color="#f59e0b" />,
      iconBg: "#fef3c7",
    },
    {
      label: "Galpones Ocupados",
      value: loading ? "—" : stats.galponesOcupados,
      trend: "Con lote activo",
      trendType: "trend-up",
      icon: <Warehouse size={24} color="#16a34a" />,
      iconBg: "#dcfce7",
    },
    {
      label: "Alertas Generales",
      value: loading ? "—" : stats.alertasGenerales,
      trend: stats.alertasGenerales > 0 ? "Revisión requerida" : "Sin novedades",
      trendType: stats.alertasGenerales > 0 ? "trend-down" : "trend-up",
      icon: <ShieldAlert size={24} color="#ef4444" />,
      iconBg: "#fee2e2",
    },
    {
      label: "Tasa de Mortalidad",
      value: loading ? "—" : `${stats.mortalidadPct}%`,
      trend: "Población histórica",
      trendType: stats.mortalidadPct > 4 ? "trend-down" : "trend-up",
      icon: <TrendingDown size={24} color="#ef4444" />,
      iconBg: "#fee2e2",
    },
    {
      label: "Conversión Alimenticia",
      value: loading ? "—" : stats.conversionEstimada ? stats.conversionEstimada.toFixed(3) : "—",
      trend: "Mes en curso",
      trendType: "trend-up",
      icon: <Activity size={24} color="#7c3aed" />,
      iconBg: "#f3e8ff",
    },
    {
      label: "Consumo Alimento",
      value: loading ? "—" : `${Math.round(stats.consumoMesKg).toLocaleString()} kg`,
      trend: "Consumo del mes",
      trendType: "trend-up",
      icon: <Package size={24} color="#3b82f6" />,
      iconBg: "#dbeafe",
    },
  ];

  const quickNav = [
    { label: "Galpones", desc: "Gestión física y capacidad", path: "/galpones", icon: <Warehouse size={20} color="#b45309" />, bg: "#fef3c7" },
    { label: "Lotes", desc: "Control de ciclo de vida", path: "/lotes", icon: <Bird size={20} color="#047857" />, bg: "#dcfce7" },
    { label: "Control de Calidad", desc: "Pesos y crecimiento", path: "/lotes/control-calidad", icon: <Scale size={20} color="#1d4ed8" />, bg: "#dbeafe" },
    { label: "Mortandad", desc: "Registro y prevención", path: "/mortandad", icon: <AlertCircle size={20} color="#b91c1c" />, bg: "#fee2e2" },
    { label: "Alimentación", desc: "Registro diario de insumo", path: "/alimentacion", icon: <Package size={20} color="#6d28d9" />, bg: "#f3e8ff" },
    { label: "Reportes", desc: "Exportación y analítica", path: "/reportes", icon: <FileText size={20} color="#4f46e5" />, bg: "#e0e7ff" },
  ];

  const textoTipo = (alerta) => {
    const mapa = {
      Afectacion: "Riesgo Sanitario Alto",
      Mortandad: "Complicación Post-Diagnóstico",
      StockMedicamento: "Bajo Stock de Medicamento Crítico",
    };
    return mapa[alerta.tipo_alerta] || alerta.tipo_alerta || "Alerta sanitaria";
  };

  const resumenAlerta = (alerta) => {
    if (alerta.tipo_alerta === "StockMedicamento") {
      return alerta.insumo_info?.nombre
        ? `${alerta.insumo_info.nombre}: ${alerta.mensaje}`
        : alerta.mensaje;
    }
    const lote = alerta.lote_info?.id_lote || alerta.lote || "-";
    return `Lote ${lote}: ${alerta.mensaje}`;
  };

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "260px" : "70px",
          flex: 1,
          padding: isMobile ? "20px" : "32px",
          paddingTop: isMobile ? "80px" : "32px",
          transition: "margin-left 0.3s ease",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}
      >
        <Topbar
          titulo="Dashboard General de Producción"
          subtitulo="Indicadores clave de rendimiento y control del negocio"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* ── KPIs Consolidados ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {cards.map((card, i) => (
            <StatCard key={i} {...card} />
          ))}
        </div>

        {/* ── Navegación Rápida (CU20 Criterio) ── */}
        <div
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            border: "1px solid #f1f5f9",
          }}
        >
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "16px" }}>
            Módulos y Accesos Rápidos
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {quickNav.map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigate(item.path)}
                style={{
                  background: "#f8fafc",
                  borderRadius: "16px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  cursor: "pointer",
                  border: "1px solid #f1f5f9",
                  transition: "all 0.2s ease",
                }}
                className="hover-card"
              >
                <div style={{ background: item.bg, padding: "12px", borderRadius: "12px" }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b" }}>{item.label}</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{item.desc}</div>
                </div>
                <ArrowRight size={16} color="#94a3b8" />
              </div>
            ))}
          </div>
        </div>

        {/* ── Gráficos Interactivos (Crecimiento y Mortalidad) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "24px",
          }}
        >
          {/* Gráfico 1: Control de Crecimiento vs Estándar */}
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              border: "1px solid #f1f5f9",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "8px" }}>
              Desarrollo de Peso Corporal (Crecimiento vs Estándar)
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 20px 0" }}>
              Monitoreo del peso real registrado frente a la curva teórica estándar de la raza.
            </p>
            <div style={{ width: "100%", height: 300 }}>
              {stats.curvaCrecimiento && stats.curvaCrecimiento.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.curvaCrecimiento} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="edad_dias" label={{ value: "Edad (Días)", position: "insideBottom", offset: -5 }} />
                    <YAxis label={{ value: "Peso (kg)", angle: -90, position: "insideLeft", offset: 10 }} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(3)} kg`]} />
                    <Legend />
                    <Line
                      name="Peso Registrado (Real)"
                      type="monotone"
                      dataKey="peso_registrado"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      activeDot={{ r: 8 }}
                    />
                    <Line
                      name="Peso Estándar (Guía)"
                      type="monotone"
                      dataKey="peso_estandar"
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#94a3b8", fontSize: "13px" }}>
                  Sin datos de crecimiento registrados para los lotes activos.
                </div>
              )}
            </div>
          </div>

          {/* Gráfico 2: Mortalidad últimos 7 días */}
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              border: "1px solid #f1f5f9",
            }}
          >
            <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "8px" }}>
              Tendencia Semanal de Mortalidad (Bajas Diarias)
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 20px 0" }}>
              Bajas diarias acumuladas registradas en los galpones en la última semana.
            </p>
            <div style={{ width: "100%", height: 300 }}>
              {stats.mortalidad7d && stats.mortalidad7d.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.mortalidad7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="fecha" tickFormatter={(tick) => tick.substring(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [`${value} bajas`]} />
                    <Legend />
                    <Bar name="Bajas Registradas" dataKey="cantidad" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#94a3b8", fontSize: "13px" }}>
                  Sin bajas registradas en los últimos 7 días.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── CU29: Recomendaciones de IA Pendientes ── */}
        {recomendacionesPendientes.length > 0 && (
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              border: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#334155",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Brain size={18} color="#d97706" /> Recomendaciones de IA Pendientes
                <span
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: "12px",
                  }}
                >
                  {recomendacionesPendientes.reduce(
                    (acc, g) => acc + g.recomendaciones.length,
                    0
                  )}{" "}
                  sin atender
                </span>
              </h3>
              <button
                type="button"
                onClick={() => navigate("/mortandad/prediccion")}
                style={{
                  border: "none",
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "6px 12px",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Ir a Predicción IA
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {recomendacionesPendientes.map((grupo) => (
                <div key={grupo.id_prediccion}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "#1e293b",
                      marginBottom: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    Lote {grupo.lote_codigo}
                    {grupo.galpon_nombre && (
                      <span style={{ fontWeight: 400, color: "#64748b" }}>
                        — {grupo.galpon_nombre}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontWeight: 600,
                        background:
                          grupo.nivel_riesgo === "Alto"
                            ? "#fee2e2"
                            : grupo.nivel_riesgo === "Medio"
                            ? "#fef3c7"
                            : "#dcfce7",
                        color:
                          grupo.nivel_riesgo === "Alto"
                            ? "#dc2626"
                            : grupo.nivel_riesgo === "Medio"
                            ? "#d97706"
                            : "#16a34a",
                      }}
                    >
                      Riesgo {grupo.nivel_riesgo} ({grupo.riesgo_porcentaje}%)
                    </span>
                  </div>
                  <RecomendacionesIA
                    recomendaciones={grupo.recomendaciones}
                    prediccionId={grupo.id_prediccion}
                    compact
                    maxItems={3}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Centro de Notificaciones (Backwards compatible) y Listas Detalladas ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: "24px",
          }}
        >
          {/* Columna Izquierda: Centro de Notificaciones */}
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              border: "1px solid #f1f5f9",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#334155",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={18} color="#ef4444" /> Centro de Alertas y Notificaciones
              </h2>
              <button
                type="button"
                onClick={() => navigate("/sanitario/alertas")}
                style={{
                  border: "none",
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "6px 12px",
                  borderRadius: "10px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Ver todas
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {alertasSanitarias.length > 0 ? (
                alertasSanitarias.slice(0, 3).map((alerta) => (
                  <AlertItem
                    key={alerta.id}
                    type={alerta.nivel === "Critico" || alerta.nivel === "Crítico" ? "danger" : "warn"}
                    title={textoTipo(alerta)}
                    desc={resumenAlerta(alerta)}
                    icon={<ShieldAlert size={18} color="#dc2626" />}
                  />
                ))
              ) : (
                <AlertItem
                  type="info"
                  title="Sin alertas sanitarias pendientes"
                  desc="No existen riesgos sanitarios activos en la granja."
                  icon={<ShieldAlert size={18} color="#16a34a" />}
                />
              )}

              {stats.insumosCriticosCount > 0 ? (
                <AlertItem
                  type="danger"
                  title="Atención: Insumos Críticos"
                  desc={`Hay ${stats.insumosCriticosCount} productos con stock por debajo del mínimo.`}
                  icon={<Package size={18} color="#dc2626" />}
                />
              ) : (
                <AlertItem
                  type="info"
                  title="Inventario Saludable"
                  desc="Todos los insumos tienen stock suficiente."
                  icon={<Package size={18} color="#16a34a" />}
                />
              )}

              {stats.alertasPredictivas > 0 ? (
                <AlertItem
                  type="danger"
                  title="Alerta Predictiva de Temperatura"
                  desc={`${stats.alertasPredictivas} predicción(es) superan el umbral crítico. Revise la sección Predicción IA.`}
                  icon={<Brain size={18} color="#dc2626" />}
                />
              ) : null}
            </div>
          </div>

          {/* Columna Derecha: Bajas Recientes y Productos Críticos */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {/* Registro de Bajas Recientes */}
            <div
              style={{
                background: "white",
                borderRadius: "24px",
                padding: "24px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                border: "1px solid #f1f5f9",
                flex: 1,
              }}
            >
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "12px" }}>
                Historial Reciente de Bajas (Mortalidad)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {stats.bajasRecientes && stats.bajasRecientes.length > 0 ? (
                  stats.bajasRecientes.slice(0, 4).map((b, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: "#fafafa",
                        borderRadius: "12px",
                        fontSize: "13px",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: "700", color: "#dc2626" }}>-{b.cantidad} aves</span>
                        <span style={{ color: "#64748b", marginLeft: "8px" }}>Lote {b.lote_id}</span>
                      </div>
                      <div style={{ color: "#475569", fontWeight: "500" }}>{b.causa || "Causa no especificada"}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>{b.fecha_hora.substring(0, 10)}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", color: "#94a3b8", padding: "12px", fontSize: "13px" }}>
                    No se registran bajas en los lotes activos.
                  </div>
                )}
              </div>
            </div>

            {/* Insumos Críticos list */}
            <div
              style={{
                background: "white",
                borderRadius: "24px",
                padding: "24px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                border: "1px solid #f1f5f9",
                flex: 1,
              }}
            >
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "12px" }}>
                Productos en Stock Crítico
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {stats.insumosCriticos && stats.insumosCriticos.length > 0 ? (
                  stats.insumosCriticos.slice(0, 4).map((i, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 14px",
                        background: "#fef2f2",
                        borderLeft: "4px solid #ef4444",
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    >
                      <div style={{ fontWeight: "700", color: "#991b1b" }}>{i.nombre}</div>
                      <div style={{ color: "#7f1d1d", fontSize: "12px" }}>
                        Stock: <span style={{ fontWeight: "800" }}>{i.stock_actual}</span> / Mín: {i.stock_minimo} {i.unidad_medida}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", color: "#94a3b8", padding: "12px", fontSize: "13px" }}>
                    Todos los insumos se encuentran en niveles saludables.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CU21: Dashboard de Monitoreo Real-Time ── */}
        <MonitoreoRealTime />
      </main>

      {/* Global CSS Hover rules */}
      <style>{`
        .hover-card:hover {
          background: #f1f5f9 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
      `}</style>
    </div>
  );
}

export default Dashboard;
