import { useMemo } from "react";
import {
  BarChart as BarChartIcon,
  Table as TableIcon,
  Layout,
  Info,
  TrendingUp,
  Activity,
  PieChart as PieChartIcon,
  Calendar,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "-");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const COLORS = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
];

function pickValueKeyFromData(data) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const sample = data.find(Boolean) || {};

  const isIdKey = (k) => k === "id" || k.startsWith("id_") || k.endsWith("_id");
  const priorityScore = (k) => {
    const kk = String(k).toLowerCase();
    if (kk.includes("promedio") || kk.includes("avg")) return 1;
    if (
      kk.includes("total") ||
      kk.includes("cantidad") ||
      kk.includes("kg") ||
      kk.includes("aves") ||
      kk.includes("bajas") ||
      kk.includes("eventos") ||
      kk.includes("registros") ||
      kk.includes("alert")
    )
      return 2;
    if (kk.includes("min") || kk.includes("max")) return 3;
    return 10;
  };

  const numericKeys = Object.keys(sample)
    .filter(
      (k) =>
        k !== "periodo" && !k.startsWith("_") && typeof sample[k] === "number",
    )
    .filter((k) => !isIdKey(k))
    .sort((a, b) => priorityScore(a) - priorityScore(b));
  if (numericKeys.length) return numericKeys[0];

  const coercibleNumeric = Object.keys(sample)
    .filter((k) => k !== "periodo" && !k.startsWith("_"))
    .filter((k) => !isIdKey(k))
    .filter((k) => {
      const n = Number(sample[k]);
      return Number.isFinite(n);
    })
    .sort((a, b) => priorityScore(a) - priorityScore(b));

  return coercibleNumeric[0] || null;
}

function buildSeriesFromRows(rows, valueKey) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!valueKey) return [];
  if (!Object.prototype.hasOwnProperty.call(rows[0] || {}, "periodo"))
    return [];

  const grouped = new Map();
  for (const r of rows) {
    const periodo = r?.periodo;
    if (!periodo) continue;
    const raw = r?.[valueKey];
    const v = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(v)) continue;
    grouped.set(periodo, (grouped.get(periodo) || 0) + v);
  }

  const data = Array.from(grouped.entries()).map(([periodo, total]) => ({
    periodo,
    [valueKey]: total,
  }));

  data.sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  return data.slice(-90);
}

function VisualizadorReporte({
  entidad,
  rows,
  summary,
  series,
  loading,
  error,
  filters,
}) {
  // Columnas filtrando metadatos internos
  const columns = useMemo(() => {
    if (!rows?.length) return [];
    return Object.keys(rows[0]).filter(
      (c) => !c.startsWith("_") && c !== "periodo",
    );
  }, [rows]);

  const reportTitle = useMemo(() => {
    const titles = {
      alimentacion: "Reporte de Nutrición y Alimentación",
      lotes: "Reporte de Rendimiento y Producción",
      bitacora: "Reporte de Auditoría de Operaciones",
      insumos: "Reporte de Inventario y Almacén",
      sanitario: "Reporte de Salud Animal",
      mortalidad: "Reporte de Mortalidad y Bajas",
      usuarios: "Reporte de Personal y Usuarios",
      temperatura: "Reporte de Temperatura por Galpón",
    };
    return titles[entidad] || "Informe General de Granja";
  }, [entidad]);

  const seriesValueKey = useMemo(() => {
    return pickValueKeyFromData(series);
  }, [series]);

  const chartValueKey = useMemo(() => {
    return seriesValueKey || pickValueKeyFromData(rows);
  }, [rows, seriesValueKey]);

  const chartData = useMemo(() => {
    if (Array.isArray(series) && series.length > 0) return series;
    return buildSeriesFromRows(rows, chartValueKey);
  }, [rows, series, chartValueKey]);

  if (loading)
    return (
      <div className="rep-empty">
        <div className="rep-spinner" />
        <p>Generando análisis inteligente...</p>
      </div>
    );
  if (error)
    return (
      <div className="rep-empty">
        <Info size={40} color="#ef4444" />
        <p>{error}</p>
      </div>
    );
  if (!rows?.length)
    return (
      <div className="rep-empty">
        <Layout size={44} color="#cbd5e1" strokeWidth={1.5} />
        <div style={{ maxWidth: 300 }}>
          <h3 style={{ color: "#64748b", marginBottom: 8 }}>
            Sin datos para mostrar
          </h3>
          <p style={{ fontSize: 12 }}>
            Selecciona una tarjeta de acceso rápido o configura los filtros para
            iniciar la consulta.
          </p>
        </div>
      </div>
    );

  return (
    <div className="rep-dashboard">
      {/* ── CABECERA PROFESIONAL PARA PDF ── */}
      <div className="pdf-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: "#1e293b",
                margin: 0,
              }}
            >
              AviGranja MS
            </h1>
            <h2
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#f59e0b",
                marginTop: 4,
              }}
            >
              {reportTitle}
            </h2>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
              GENERADO: {new Date().toLocaleString()}
            </p>
            <p style={{ fontSize: 10, color: "#94a3b8" }}>
              ID DE RECURSO: REP-
              {Math.random().toString(36).substr(2, 9).toUpperCase()}
            </p>
          </div>
        </div>
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 8,
            borderLeft: "4px solid #f59e0b",
          }}
        >
          <p style={{ fontSize: 11, color: "#475569", margin: 0 }}>
            <strong>FILTROS APLICADOS:</strong> Fuente:{" "}
            <span style={{ textTransform: "capitalize" }}>{entidad}</span> |
            Agrupado por:{" "}
            <span style={{ textTransform: "capitalize" }}>
              {filters?.agrupar_por || "Registro Detallado"}
            </span>{" "}
            | Periodo: {filters?.fecha_inicio || "Inicio"} al{" "}
            {filters?.fecha_fin || "Hoy"}
          </p>
        </div>
      </div>

      {/* ── SECCIÓN 1: KPI TILES (RESUMEN EJECUTIVO) ── */}
      <div className="rep-summary-grid">
        {Object.entries(summary || {}).map(([k, v]) => {
          if (typeof v === "object") return null;
          return (
            <div key={k} className="rep-summary-card">
              <div className="rep-summary-label">{k.replace(/_/g, " ")}</div>
              <div className="rep-summary-value">{formatNumber(v)}</div>
            </div>
          );
        })}
      </div>

      {/* ── SECCIÓN 2: VISUALIZACIÓN DE GRÁFICAS (DASHBOARD) ── */}
      {Array.isArray(chartData) && chartData.length > 0 && chartValueKey && (
        <div className="rep-chart-grid">
          {/* Gráfica Primaria: Barras o Áreas (Tendencia) */}
          <div className="rep-chart-box">
            <h4 className="rep-chart-title">
              <TrendingUp size={16} color="#f59e0b" /> Tendencias y Volúmenes
            </h4>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                {chartData.length > 10 ? (
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="periodo"
                      fontSize={10}
                      tickMargin={10}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={18}
                      interval="preserveStartEnd"
                    />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={chartValueKey}
                      stroke="#f59e0b"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorVal)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="periodo"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={18}
                      interval="preserveStartEnd"
                    />
                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                    <Tooltip cursor={{ fill: "#f8fafc" }} />
                    <Bar
                      dataKey={chartValueKey}
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      barSize={24}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfica Secundaria: Distribución (Pie) */}
          <div className="rep-chart-box">
            <h4 className="rep-chart-title">
              <PieChartIcon size={16} color="#3b82f6" /> Composición Porcentual
            </h4>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData.slice(0, 10)}
                    dataKey={chartValueKey}
                    nameKey="periodo"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {chartData.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none" }}
                  />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── SECCIÓN 3: TABLA DE DATOS DETALLADA (EL "REPORTE" NUMÉRICO) ── */}
      <div className="rep-viz-container">
        <div className="rep-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TableIcon size={20} color="#475569" />
            <h3 className="rep-page-title">Datos Tabulares Detallados</h3>
          </div>
          <span className="rep-page-sub">
            {rows.length} registros procesados
          </span>
        </div>

        <div className="rep-table-container" style={{ border: "none" }}>
          <table className="rep-table">
            <thead>
              <tr>
                {columns.map((c) => {
                  const isNum = typeof rows[0][c] === "number";
                  return (
                    <th key={c} className={isNum ? "num" : ""}>
                      {c.replace(/_/g, " ")}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const val = r[c];
                    const isNum = typeof val === "number";
                    return (
                      <td key={c} className={isNum ? "num" : ""}>
                        {isNum ? formatNumber(val) : String(val ?? "-")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer del reporte para el PDF */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
            © 2026 AviGranja Management System - Reporte de Uso Interno
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 100,
                  borderBottom: "1px solid #cbd5e1",
                  marginBottom: 4,
                }}
              ></div>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>
                Firma Responsable
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VisualizadorReporte;
