/**
 * CU21 – Dashboard de Monitoreo Real-Time
 *
 * Muestra debajo del dashboard existente:
 *  1. Filtro por Galpón / Lote
 *  2. KPIs: Mortandad Diaria · Alertas Pendientes · Alimentos Críticos
 *  3. Gráfico de línea: Temperatura y Humedad últimas 24h
 *  4. Tabla de tasa de mortalidad por lote
 *  5. Últimas 5 alertas (climáticas + sanitarias)
 *  6. Indicadores de stock de alimentos vs mínimo
 */

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Thermometer,
  Skull,
  AlertTriangle,
  Package,
  RefreshCw,
  Clock,
  Brain,
} from "lucide-react";
import api from "../../api/axios";
import RecomendacionesIA from "../../components/RecomendacionesIA";

// ─── Paleta de colores ────────────────────────────────────────────────────────
const COLOR = {
  temp: "#ef4444",
  humidity: "#3b82f6",
  ok: "#16a34a",
  warn: "#d97706",
  danger: "#dc2626",
  neutral: "#6b7280",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHora(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function formatFechaHora(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color, bgColor }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "20px 24px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flex: "1 1 180px",
        minWidth: "160px",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{ fontSize: 28, fontWeight: 700, color: color || "#1c1c1c" }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: COLOR.neutral, marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: "#334155",
        marginBottom: 16,
        marginTop: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
    </h3>
  );
}

function AlertRow({ alerta }) {
  const esClimatica = alerta.tipo === "CLIMATICA";
  const bgColor = esClimatica ? "#fef3c7" : "#fee2e2";
  const iconColor = esClimatica ? COLOR.warn : COLOR.danger;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: bgColor,
        marginBottom: 8,
      }}
    >
      <AlertTriangle size={16} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#1c1c1c",
            marginRight: 8,
          }}
        >
          {esClimatica ? "Climática" : "Sanitaria"}
        </span>
        <span style={{ fontSize: 12, color: "#374151" }}>
          {alerta.descripcion}
        </span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: COLOR.neutral,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {formatFechaHora(alerta.fecha_hora)}
      </span>
    </div>
  );
}

function StockRow({ item }) {
  const critico = item.bajo_stock;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 10,
        background: critico ? "#fee2e2" : "#f0fdf4",
        marginBottom: 8,
        border: critico ? "1px solid #fca5a5" : "1px solid #bbf7d0",
      }}
    >
      <Package
        size={16}
        color={critico ? COLOR.danger : COLOR.ok}
        style={{ flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1c1c" }}>
          {item.nombre}
        </span>
        <span style={{ fontSize: 11, color: COLOR.neutral, marginLeft: 6 }}>
          ({item.unidad_medida})
        </span>
      </div>
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: critico ? COLOR.danger : COLOR.ok,
          }}
        >
          {item.stock_actual.toFixed(1)}
        </span>
        <span style={{ fontSize: 11, color: COLOR.neutral }}>
          {" "}/ mín {item.stock_minimo.toFixed(1)}
        </span>
        {critico && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: COLOR.danger,
              marginTop: 2,
            }}
          >
            ⚠ STOCK BAJO
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function MonitoreoRealTime() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  // Alertas sanitarias pendientes reales (de AlertaSanitaria)
  const [alertasSanitariasPendientes, setAlertasSanitariasPendientes] = useState(0);
  const [recomendacionesPendientes, setRecomendacionesPendientes] = useState([]);

  // Filtros
  const [galpones, setGalpones] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [selectedGalpon, setSelectedGalpon] = useState("");
  const [selectedLote, setSelectedLote] = useState("");

  // Cargar galpones y lotes para los filtros
  useEffect(() => {
    Promise.all([api.get("/galpones/"), api.get("/lotes/")]).then(
      ([galRes, lotRes]) => {
        setGalpones(Array.isArray(galRes.data) ? galRes.data : []);
        setLotes(Array.isArray(lotRes.data) ? lotRes.data : []);
      }
    );
  }, []);

  const fetchMonitoreo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedGalpon) params.galpon_id = selectedGalpon;
      if (selectedLote) params.lote_id = selectedLote;

      // Llamadas en paralelo: datos de monitoreo + alertas + recomendaciones IA
      const [monRes, sanRes, recsRes] = await Promise.allSettled([
        api.get("/reportes/monitoreo/", { params }),
        api.get("/sanitario/alertas/", { params: { estado: "Pendiente" } }),
        api.get("/mortandad/prediccion/recomendaciones/pendientes/"),
      ]);

      if (monRes.status === "fulfilled") {
        setData(monRes.value.data);
      } else {
        setError("No se pudo cargar el panel de monitoreo.");
      }

      if (sanRes.status === "fulfilled") {
        const alertas = Array.isArray(sanRes.value.data) ? sanRes.value.data : [];
        setAlertasSanitariasPendientes(alertas.length);
      }

      if (recsRes.status === "fulfilled") {
        const recs = Array.isArray(recsRes.value.data) ? recsRes.value.data : [];
        setRecomendacionesPendientes(recs);
      }

      setLastUpdate(new Date());
    } catch (e) {
      console.error("Error al cargar monitoreo:", e);
      setError("No se pudo cargar el panel de monitoreo.");
    } finally {
      setLoading(false);
    }
  }, [selectedGalpon, selectedLote]);

  // Carga inicial y polling cada 30s
  useEffect(() => {
    fetchMonitoreo();
    const interval = setInterval(fetchMonitoreo, 30_000);
    return () => clearInterval(interval);
  }, [fetchMonitoreo]);

  // Preparar datos del gráfico de clima
  const climaChartData = (() => {
    if (!data?.clima_24h?.length) return [];
    // Agrupar en bloques de 15 min para no saturar el gráfico
    const bySlot = {};
    for (const punto of data.clima_24h) {
      const d = new Date(punto.fecha_hora);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = (Math.floor(d.getMinutes() / 15) * 15).toString().padStart(2, "0");
      const key = `${hh}:${mm}`;
      if (!bySlot[key]) {
        bySlot[key] = { hora: key, temps: [], humeds: [] };
      }
      bySlot[key].temps.push(punto.temperatura);
      if (punto.humedad !== null && punto.humedad !== undefined) {
        bySlot[key].humeds.push(punto.humedad);
      }
    }
    return Object.values(bySlot)
      .sort((a, b) => a.hora.localeCompare(b.hora))
      .map((g) => ({
        hora: g.hora,
        temperatura: parseFloat(
          (g.temps.reduce((s, v) => s + v, 0) / g.temps.length).toFixed(1)
        ),
        humedad:
          g.humeds.length > 0
            ? parseFloat(
                (g.humeds.reduce((s, v) => s + v, 0) / g.humeds.length).toFixed(1)
              )
            : null,
      }));
  })();

  // Filtrar lotes según galpón seleccionado
  // La API de lotes devuelve el campo como `id_galpon` (ver LoteSerializer)
  const lotesFiltrados = selectedGalpon
    ? lotes.filter((l) => String(l.id_galpon) === String(selectedGalpon))
    : lotes;

  const activeStates = ["crianza", "crecimiento", "engorde", "activo"];
  const lotesActivos = lotesFiltrados.filter((l) =>
    activeStates.includes((l.estado || "").toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      {/* ── Encabezado de sección ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1e293b",
              margin: 0,
            }}
          >
            📡 Monitoreo en Tiempo Real
          </h2>
          <p style={{ fontSize: 12, color: COLOR.neutral, margin: "4px 0 0" }}>
            Clima · Mortandad · Alertas · Inventario de Alimentos
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {lastUpdate && (
            <span
              style={{
                fontSize: 11,
                color: COLOR.neutral,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Clock size={12} />
              Actualizado: {lastUpdate.toLocaleTimeString("es-BO")}
            </span>
          )}
          <button
            onClick={fetchMonitoreo}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "white",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
            }}
          >
            <RefreshCw
              size={13}
              style={{
                animation: loading ? "spin 1s linear infinite" : "none",
              }}
            />
            Actualizar
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px 20px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          Filtrar por:
        </span>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            value={selectedGalpon}
            onChange={(e) => {
              setSelectedGalpon(e.target.value);
              setSelectedLote("");
            }}
            style={selectStyle}
          >
            <option value="">Todos los Galpones</option>
            {galpones.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </select>

          <select
            value={selectedLote}
            onChange={(e) => setSelectedLote(e.target.value)}
            style={selectStyle}
          >
            <option value="">Todos los Lotes</option>
            {lotesActivos.map((l) => (
              <option key={l.id_lote} value={l.id_lote}>
                Lote {l.id_lote}
                {l.raza_tipo ? ` – ${l.raza_tipo}` : ""}
              </option>
            ))}
          </select>
        </div>
        {(selectedGalpon || selectedLote) && (
          <button
            onClick={() => {
              setSelectedGalpon("");
              setSelectedLote("");
            }}
            style={{
              fontSize: 12,
              color: COLOR.danger,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            borderRadius: 12,
            padding: "14px 18px",
            color: COLOR.danger,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* ── KPIs ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KpiCard
          icon={<Skull size={22} color="#dc2626" />}
          label="Mortandad Diaria"
          value={loading ? "—" : (data?.mortandad_diaria ?? 0)}
          sub="Bajas registradas hoy"
          color={
            !loading && (data?.mortandad_diaria ?? 0) > 0
              ? COLOR.danger
              : "#1c1c1c"
          }
          bgColor={
            !loading && (data?.mortandad_diaria ?? 0) > 0
              ? "#fee2e2"
              : "#f0fdf4"
          }
        />
        <KpiCard
          icon={<AlertTriangle size={22} color="#d97706" />}
          label="Alertas Sanitarias Pendientes"
          value={loading ? "—" : alertasSanitariasPendientes}
          sub="Estado: Pendiente en BD"
          color={
            !loading && alertasSanitariasPendientes > 0
              ? COLOR.warn
              : "#1c1c1c"
          }
          bgColor={
            !loading && alertasSanitariasPendientes > 0
              ? "#fef3c7"
              : "#f0fdf4"
          }
        />
        <KpiCard
          icon={<Package size={22} color="#7c3aed" />}
          label="Alimentos Críticos"
          value={loading ? "—" : (data?.alimentos_criticos_count ?? 0)}
          sub="Insumos bajo stock mínimo"
          color={
            !loading && (data?.alimentos_criticos_count ?? 0) > 0
              ? COLOR.danger
              : "#1c1c1c"
          }
          bgColor={
            !loading && (data?.alimentos_criticos_count ?? 0) > 0
              ? "#fee2e2"
              : "#f3e8ff"
          }
        />
        <KpiCard
          icon={<Thermometer size={22} color="#ef4444" />}
          label="Alertas Climáticas"
          value={loading ? "—" : (data?.alertas_climaticas?.length ?? 0)}
          sub="Galpones con FRÍO o CALOR"
          color={
            !loading && (data?.alertas_climaticas?.length ?? 0) > 0
              ? COLOR.danger
              : "#1c1c1c"
          }
          bgColor={
            !loading && (data?.alertas_climaticas?.length ?? 0) > 0
              ? "#fee2e2"
              : "#fef3c7"
          }
        />
      </div>

      {/* ── Gráfico de Clima 24h ── */}
      <div
        style={{
          background: "white",
          borderRadius: 20,
          padding: "24px 28px",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
          border: "1px solid #f1f5f9",
        }}
      >
        <SectionTitle>
          <Thermometer size={16} color={COLOR.temp} />
          Temperatura y Humedad — Últimas 24 horas
          {selectedGalpon &&
            galpones.find((g) => String(g.id) === String(selectedGalpon)) && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: COLOR.neutral,
                  marginLeft: 4,
                }}
              >
                (
                {
                  galpones.find((g) => String(g.id) === String(selectedGalpon))
                    ?.nombre
                }
                )
              </span>
            )}
        </SectionTitle>

        {loading ? (
          <div style={skeletonStyle} />
        ) : climaChartData.length === 0 ? (
          <EmptyState mensaje="Sin registros de temperatura en las últimas 24 horas." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={climaChartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="hora"
                tick={{ fontSize: 11, fill: COLOR.neutral }}
                tickLine={false}
              />
              <YAxis
                yAxisId="temp"
                orientation="left"
                tick={{ fontSize: 11, fill: COLOR.neutral }}
                tickLine={false}
                axisLine={false}
                unit="°C"
                domain={["auto", "auto"]}
              />
              <YAxis
                yAxisId="hum"
                orientation="right"
                tick={{ fontSize: 11, fill: COLOR.neutral }}
                tickLine={false}
                axisLine={false}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
                formatter={(value, name) =>
                  name === "temperatura"
                    ? [`${value}°C`, "Temperatura"]
                    : [`${value}%`, "Humedad"]
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) =>
                  value === "temperatura" ? "Temperatura (°C)" : "Humedad (%)"
                }
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperatura"
                stroke={COLOR.temp}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="hum"
                type="monotone"
                dataKey="humedad"
                stroke={COLOR.humidity}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Zonas de referencia */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "FRÍO", range: "< 24°C", color: "#3b82f6", bg: "#dbeafe" },
            {
              label: "NORMAL",
              range: "24–34°C",
              color: COLOR.ok,
              bg: "#dcfce7",
            },
            {
              label: "CALOR",
              range: "> 34°C",
              color: COLOR.danger,
              bg: "#fee2e2",
            },
          ].map((z) => (
            <span
              key={z.label}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 20,
                background: z.bg,
                color: z.color,
              }}
            >
              {z.label}: {z.range}
            </span>
          ))}
        </div>
      </div>

      {/* ── Fila: Mortandad por Lote + Últimas Alertas ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {/* Tasa de mortalidad por lote */}
        <div style={cardStyle}>
          <SectionTitle>
            <Skull size={16} color={COLOR.danger} />
            Tasa de Mortalidad por Lote
          </SectionTitle>

          {loading ? (
            <div style={skeletonStyle} />
          ) : !data?.tasa_mortalidad?.length ? (
            <EmptyState mensaje="Sin lotes activos para mostrar." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {["Lote", "Galpón", "Inicial", "Actual", "Bajas", "Tasa %"].map(
                      (h) => (
                        <th key={h} style={thStyle}>
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.tasa_mortalidad.map((row) => (
                    <tr key={row.lote_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={tdStyle}>{row.lote_id}</td>
                      <td style={tdStyle}>{row.galpon_nombre || "—"}</td>
                      <td style={tdStyle}>{row.cantidad_inicial.toLocaleString()}</td>
                      <td style={tdStyle}>{row.cantidad_actual.toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: row.bajas_totales > 0 ? COLOR.danger : COLOR.ok, fontWeight: 600 }}>
                        {row.bajas_totales}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              row.tasa_mortalidad_pct > 5
                                ? "#fee2e2"
                                : row.tasa_mortalidad_pct > 2
                                ? "#fef3c7"
                                : "#dcfce7",
                            color:
                              row.tasa_mortalidad_pct > 5
                                ? COLOR.danger
                                : row.tasa_mortalidad_pct > 2
                                ? COLOR.warn
                                : COLOR.ok,
                          }}
                        >
                          {row.tasa_mortalidad_pct.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Últimas 5 alertas */}
        <div style={cardStyle}>
          <SectionTitle>
            <AlertTriangle size={16} color={COLOR.warn} />
            Últimas 5 Alertas
          </SectionTitle>

          {loading ? (
            <div style={skeletonStyle} />
          ) : !data?.ultimas_alertas?.length ? (
            <EmptyState mensaje="Sin alertas recientes en las últimas 24 horas." />
          ) : (
            <div>
              {data.ultimas_alertas.map((alerta, i) => (
                <AlertRow key={i} alerta={alerta} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stock de Alimentos ── */}
      <div style={cardStyle}>
        <SectionTitle>
          <Package size={16} color="#7c3aed" />
          Inventario de Alimentos — Stock Actual vs Mínimo
        </SectionTitle>

        {loading ? (
          <div style={skeletonStyle} />
        ) : !data?.stock_alimentos?.length ? (
          <EmptyState mensaje="No hay insumos de tipo Alimento registrados." />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 10,
            }}
          >
            {data.stock_alimentos.map((item) => (
              <StockRow key={item.id_insumo} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* ── CU29: Recomendaciones de IA Pendientes ── */}
      {(() => {
        const recsFiltradas = selectedLote
          ? recomendacionesPendientes.filter(
              (g) => String(g.lote_id) === String(selectedLote)
            )
          : recomendacionesPendientes;

        if (recsFiltradas.length === 0) return null;

        return (
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#334155",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Brain size={16} color="#d97706" />
                Recomendaciones de IA
                {selectedLote && (
                  <span style={{ fontWeight: 400, color: "#64748b", fontSize: 13 }}>
                    para Lote {selectedLote}
                  </span>
                )}
              </h3>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: "#fef3c7",
                  color: "#92400e",
                }}
              >
                {recsFiltradas.reduce(
                  (acc, g) => acc + g.recomendaciones.length,
                  0
                )}{" "}
                pendientes
              </span>
            </div>
            {recsFiltradas.map((grupo) => (
              <div key={grupo.id_prediccion} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Lote {grupo.lote_codigo}
                  {grupo.galpon_nombre && (
                    <span style={{ fontWeight: 400, color: "#64748b" }}>
                      — {grupo.galpon_nombre}
                    </span>
                  )}
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
        );
      })()}

      {/* Animación de spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const cardStyle = {
  background: "white",
  borderRadius: 20,
  padding: "24px 28px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
  border: "1px solid #f1f5f9",
};

const selectStyle = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#374151",
  background: "white",
  cursor: "pointer",
  outline: "none",
  minWidth: 160,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "2px solid #f1f5f9",
};

const tdStyle = {
  padding: "10px 10px",
  color: "#374151",
  fontSize: 13,
};

const skeletonStyle = {
  height: 120,
  borderRadius: 12,
  background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
};

function EmptyState({ mensaje }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "32px 16px",
        color: "#9ca3af",
        fontSize: 13,
      }}
    >
      {mensaje}
    </div>
  );
}

export default MonitoreoRealTime;
