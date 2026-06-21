import { useState, useEffect, useMemo } from "react";
import {
  Bird,
  Package,
  Activity,
  Calendar,
  AlertTriangle,
  Warehouse,
  TrendingUp,
  FileText,
  Download,
  Filter,
  ArrowRight,
  TrendingDown,
  Scale,
  Award,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import html2pdf from "html2pdf.js";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import StatCard from "../../components/StatCard";
import ComboBox from "../../components/ComboBox";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ReporteProduccionDetallado() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  
  const [galpones, setGalpones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterGalpon, setFilterGalpon] = useState("");
  const [filterFechaInicio, setFilterFechaInicio] = useState("");
  const [filterFechaFin, setFilterFechaFin] = useState("");
  
  const [data, setData] = useState({ lotes: [], kpis: {} });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    try {
      const res = await api.get("/galpones/");
      setGalpones(Array.isArray(res.data) ? res.data : []);
      fetchReport();
    } catch (e) {
      console.error("Error al cargar galpones", e);
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filterGalpon) params.galpon_id = filterGalpon;
      if (filterFechaInicio) params.fecha_inicio = filterFechaInicio;
      if (filterFechaFin) params.fecha_fin = filterFechaFin;

      const res = await api.get("/reportes/produccion-avanzada/", { params });
      setData(res.data);
    } catch (e) {
      setError("No se pudieron cargar los datos del reporte de producción.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = { entidad: "lotes", formato: "excel" };
      if (filterGalpon) params.galpon_ids = [Number(filterGalpon)];
      if (filterFechaInicio) params.fecha_inicio = filterFechaInicio;
      if (filterFechaFin) params.fecha_fin = filterFechaFin;

      const res = await api.post("/reportes/generar/", params, { responseType: "blob" });
      downloadBlob(res.data, `reporte_produccion_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error("Error al exportar Excel", e);
    }
  };

  const handleExportPDF = () => {
    const element = document.getElementById("reporte-produccion-pdf");
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `reporte_produccion_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };

    html2pdf().set(opt).from(element).save();
  };

  const kpis = data.kpis || {};
  const lotes = data.lotes || [];

  const cards = [
    {
      label: "Aves Activas",
      value: loading ? "—" : (kpis.total_aves || 0).toLocaleString(),
      trend: `${kpis.lotes_activos || 0} lotes en curso`,
      trendType: "trend-up",
      icon: <Bird size={24} color="#f59e0b" />,
      iconBg: "#fef3c7",
    },
    {
      label: "Alimento Consumido",
      value: loading ? "—" : `${Math.round(kpis.total_alimento_consumido_kg || 0).toLocaleString()} kg`,
      trend: "Total acumulado",
      trendType: "trend-up",
      icon: <Package size={24} color="#3b82f6" />,
      iconBg: "#dbeafe",
    },
    {
      label: "Conversión Alimenticia Promedio",
      value: loading ? "—" : kpis.promedio_fca_eficiencia ? kpis.promedio_fca_eficiencia.toFixed(3) : "—",
      trend: "Menor es más eficiente",
      trendType: kpis.promedio_fca_eficiencia > 1.8 ? "trend-down" : "trend-up",
      icon: <Activity size={24} color="#7c3aed" />,
      iconBg: "#f3e8ff",
    },
    {
      label: "Galpón más Eficiente",
      value: loading ? "—" : kpis.galpon_mas_eficiente || "—",
      trend: "Mejor índice FCR",
      trendType: "trend-up",
      icon: <Award size={24} color="#16a34a" />,
      iconBg: "#dcfce7",
    },
  ];

  const chartData = useMemo(() => {
    return lotes
      .filter((l) => l.fca_eficiencia > 0)
      .slice(0, 15)
      .map((l) => ({
        lote: `Lote ${l.id_lote}`,
        fca: l.fca_eficiencia,
        mortalidad: l.tasa_mortalidad_pct,
      }));
  }, [lotes]);

  const getFcaColor = (val) => {
    if (val < 1.6) return "#10b981"; // Emerald
    if (val <= 1.8) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const getLoteEstadoStyle = (est) => {
    const e = String(est || "").toLowerCase().trim();
    if (e === "listo para venta" || e === "listo") {
      return { background: "#eff6ff", color: "#2563eb" };
    }
    if (e === "vendido") {
      return { background: "#f1f5f9", color: "#475569" };
    }
    return { background: "#fef3c7", color: "#d97706" };
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
          gap: "24px",
        }}
      >
        <Topbar
          titulo="Reporte Gerencial de Producción"
          subtitulo="Análisis de conversión, crecimiento y eficiencia biológica"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* ── PANEL DE FILTROS ── */}
        <div
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            border: "1px solid #f1f5f9",
            display: "flex",
            flexWrap: "wrap",
            gap: "20px",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <ComboBox
              label="Filtrar por Galpón"
              value={filterGalpon}
              onChange={(val) => setFilterGalpon(val)}
              options={[
                { value: "", label: "Todos los galpones" },
                ...galpones.map((g) => ({ value: String(g.id), label: g.nombre })),
              ]}
            />
          </div>
          <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Fecha Inicio</label>
            <input
              type="date"
              value={filterFechaInicio}
              onChange={(e) => setFilterFechaInicio(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1.5px solid #e5e7eb",
                fontSize: "13px",
                color: "#1e293b",
                outline: "none",
              }}
            />
          </div>
          <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Fecha Fin</label>
            <input
              type="date"
              value={filterFechaFin}
              onChange={(e) => setFilterFechaFin(e.target.value)}
              style={{
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1.5px solid #e5e7eb",
                fontSize: "13px",
                color: "#1e293b",
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={fetchReport}
              style={{
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "11px 20px",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Filter size={16} /> Consultar
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading || lotes.length === 0}
              style={{
                background: "#16a34a",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "11px 20px",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(22, 163, 74, 0.25)",
              }}
            >
              <Download size={16} /> Excel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={loading || lotes.length === 0}
              style={{
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "11px 20px",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
              }}
            >
              <FileText size={16} /> Exportar PDF
            </button>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL DEL REPORTE IMPRIMIBLE */}
        <div id="reporte-produccion-pdf" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Cabecera del PDF (solo visible en PDF) */}
          <div className="only-pdf" style={{ display: "none", padding: "10px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: 0 }}>AviGranja MS</h1>
                <h2 style={{ fontSize: "14px", fontWeight: "700", color: "#7c3aed", margin: "4px 0 0 0" }}>Reporte Avanzado de Rendimiento de Producción</h2>
              </div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "#64748b" }}>
                <div>Generado: {new Date().toLocaleString()}</div>
                <div>Filtros: Galpón ID {filterGalpon || "Todos"} | Rango {filterFechaInicio || "Inicio"} a {filterFechaFin || "Fin"}</div>
              </div>
            </div>
          </div>

          {/* ── KPIs DE RENDIMIENTO ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
            {cards.map((card, i) => (
              <StatCard key={i} {...card} />
            ))}
          </div>

          {/* ── ANÁLISIS GRÁFICO ── */}
          {chartData.length > 0 && (
            <div
              style={{
                background: "white",
                borderRadius: "24px",
                padding: "24px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                border: "1px solid #f1f5f9",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "8px" }}>
                Comparativo de Conversión Alimenticia (FCA) por Lote
              </h3>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 20px 0" }}>
                Verde: Excelente ( conversión &lt; 1.60 ) | Amarillo: Normal ( 1.60 - 1.80 ) | Rojo: Alerta ( &gt; 1.80 ).
              </p>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="lote" />
                    <YAxis label={{ value: "Índice FCA", angle: -90, position: "insideLeft", offset: 10 }} />
                    <Tooltip formatter={(value) => [`FCR: ${Number(value).toFixed(3)}`]} />
                    <Legend />
                    <Bar name="Conversión Alimenticia" dataKey="fca">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getFcaColor(entry.fca)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── TABLA DE DATOS DETALLADOS ── */}
          <div
            style={{
              background: "white",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
              border: "1px solid #f1f5f9",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#334155", marginTop: 0, marginBottom: "20px" }}>
              Desglose Operativo de Lotes
            </h3>

            {error && (
              <p style={{ color: "#dc2626", fontSize: "13px", margin: "0 0 16px 0" }}>
                ⚠️ {error}
              </p>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9", textAlign: "left" }}>
                    <th style={thStyle}>Lote</th>
                    <th style={thStyle}>Galpón</th>
                    <th style={thStyle}>Raza</th>
                    <th style={thStyle}>Días de Edad</th>
                    <th style={thStyle}>Aves Iniciales</th>
                    <th style={thStyle}>Aves Actuales</th>
                    <th style={thStyle}>Bajas</th>
                    <th style={thStyle}>Mortalidad</th>
                    <th style={thStyle}>Peso Promedio</th>
                    <th style={thStyle}>Alimento Consumido</th>
                    <th style={thStyle}>FCR (Conversión)</th>
                    <th style={thStyle}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.length > 0 ? (
                    lotes.map((l) => (
                      <tr key={l.id_lote} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ ...tdStyle, fontWeight: "700", color: "#334155" }}>#{l.id_lote}</td>
                        <td style={tdStyle}>{l.galpon_nombre}</td>
                        <td style={tdStyle}>{l.raza_tipo}</td>
                        <td style={tdStyle}>{l.dias_crianza} días</td>
                        <td style={tdStyle}>{l.cantidad_inicial.toLocaleString()}</td>
                        <td style={tdStyle}>{l.cantidad_actual.toLocaleString()}</td>
                        <td style={{ ...tdStyle, color: "#ef4444", fontWeight: "600" }}>{l.bajas_totales}</td>
                        <td style={{ ...tdStyle, color: l.tasa_mortalidad_pct > 5 ? "#ef4444" : "#475569", fontWeight: "600" }}>
                          {l.tasa_mortalidad_pct}%
                        </td>
                        <td style={{ ...tdStyle, fontWeight: "600" }}>{l.peso_promedio_kg ? `${l.peso_promedio_kg.toFixed(3)} kg` : "—"}</td>
                        <td style={tdStyle}>{Math.round(l.alimento_consumido_kg).toLocaleString()} kg</td>
                        <td style={{ ...tdStyle, color: getFcaColor(l.fca_eficiencia), fontWeight: "700" }}>
                          {l.fca_eficiencia > 0 ? l.fca_eficiencia.toFixed(3) : "—"}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "20px",
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "capitalize",
                              ...getLoteEstadoStyle(l.estado),
                            }}
                          >
                            {l.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="12" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                        No se encontraron registros para los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Estilos locales para inyección de impresión PDF */}
      <style>{`
        @media print {
          .only-pdf {
            display: block !important;
          }
          body {
            background: white !important;
          }
          main {
            margin-left: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

const thStyle = {
  padding: "12px 14px",
  fontSize: "11px",
  fontWeight: "800",
  textTransform: "uppercase",
  color: "#64748b",
  borderBottom: "1.5px solid #f1f5f9",
};

const tdStyle = {
  padding: "14px 14px",
  fontSize: "13px",
  color: "#475569",
};

export default ReporteProduccionDetallado;
