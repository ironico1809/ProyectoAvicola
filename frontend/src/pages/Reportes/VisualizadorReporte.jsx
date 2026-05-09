import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, BarChart as BarChartIcon, Table, Layout, Info } from "lucide-react";
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
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

function VisualizadorReporte({
  entidad,
  rows,
  summary,
  series,
  loading,
  error,
}) {
  const [vista, setVista] = useState("grafica");
  const [tipoGrafico, setTipoGrafico] = useState("bar");

  const columns = useMemo(() => {
    const first = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!first) return [];
    return Object.keys(first);
  }, [rows]);

  const [page, setPage] = useState(1);
  const pageSize = 12;

  const paginated = useMemo(() => {
    const all = Array.isArray(rows) ? rows : [];
    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      totalPages,
      page: safePage,
    };
  }, [rows, page]);

  const title =
    entidad === "alimentacion"
      ? "Consumo de Alimento"
      : entidad === "lotes"
        ? "Rendimiento de Lotes"
        : "Auditoría (Bitácora)";

  const dataKey = entidad === "alimentacion"
    ? "total_kg"
    : entidad === "bitacora"
      ? "total_eventos"
      : "aves_actuales";

  // Pie Chart usa 'periodo' o 'galpon' o algun identificador como nameKey
  const nameKey = "periodo"; // Ajustable si agrupamos por galpón luego

  return (
    <div className="rep-viz-card">
      <div className="rep-page-header">
        <div className="rep-title-group">
          <h2 className="rep-page-title">{title}</h2>
          <p className="rep-page-sub">Resultados de la consulta dinámica</p>
        </div>
        
        <div className="rep-tabs">
          <button
            className={vista === "grafica" ? "rep-tab rep-tab-active" : "rep-tab"}
            onClick={() => setVista("grafica")}
          >
            <BarChartIcon size={16} style={{display:'inline', marginRight:6, verticalAlign:-3}} /> Gráfica
          </button>
          <button
            className={vista === "tabla" ? "rep-tab rep-tab-active" : "rep-tab"}
            onClick={() => setVista("tabla")}
          >
            <Table size={16} style={{display:'inline', marginRight:6, verticalAlign:-3}} /> Tabla
          </button>
          <button
            className={vista === "resumen" ? "rep-tab rep-tab-active" : "rep-tab"}
            onClick={() => setVista("resumen")}
          >
            <Layout size={16} style={{display:'inline', marginRight:6, verticalAlign:-3}} /> Resumen
          </button>
        </div>
      </div>

      {loading && <div className="rep-empty">Analizando datos...</div>}
      
      {!loading && !error && rows.length === 0 && (
        <div className="rep-empty">
          <Info size={40} color="#cbd5e1" style={{marginBottom:16}} />
          <p>No hay datos. Ajusta los filtros y genera un reporte.</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {vista === "resumen" && (
            <>
              <div className="rep-summary-grid">
                {Object.entries(summary || {}).map(([k, v]) => {
                  if (k === "conversion_por_lote") return null;
                  return (
                    <div key={k} className="rep-summary-card">
                      <div className="rep-summary-label">{k.replace(/_/g, ' ')}</div>
                      <div className="rep-summary-value">{String(v)}</div>
                    </div>
                  );
                })}
              </div>

              {Array.isArray(summary?.conversion_por_lote) && (
                <div className="rep-table-container">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Lote</th>
                        <th>Galpón</th>
                        <th>Total kg</th>
                        <th>Aves</th>
                        <th>Conversión</th>
                        <th>Mortalidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.conversion_por_lote.map((r) => (
                        <tr key={r.lote_id}>
                          <td><strong>#{r.lote_id}</strong></td>
                          <td>{r.galpon}</td>
                          <td>{formatNumber(r.total_kg)}</td>
                          <td>{formatNumber(r.aves_actuales)}</td>
                          <td>{r.conversion_estimada ? formatNumber(r.conversion_estimada) : '-'}</td>
                          <td>{r.mortalidad_pct ? `${formatNumber(r.mortalidad_pct)}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {vista === "grafica" && (
            <div style={{ width: "100%", height: 380, marginTop: 10, display: "flex", flexDirection: "column" }}>
              <div style={{ alignSelf: "flex-end", marginBottom: "16px" }}>
                <select 
                  value={tipoGrafico} 
                  onChange={(e) => setTipoGrafico(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    color: "#475569",
                    fontWeight: "600",
                    background: "white",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="bar">Gráfica de Barras</option>
                  <option value="line">Gráfica de Líneas</option>
                  <option value="area">Gráfica de Área</option>
                  <option value="pie">Gráfico Circular</option>
                </select>
              </div>

              {Array.isArray(series) && series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {tipoGrafico === "line" ? (
                    <LineChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey={nameKey} axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                      <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Line type="monotone" dataKey={dataKey} stroke="#f59e0b" strokeWidth={4} dot={{r:4, fill:'#f59e0b', strokeWidth:2, stroke:'#fff'}} activeDot={{r:6}} />
                    </LineChart>
                  ) : tipoGrafico === "area" ? (
                    <AreaChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey={nameKey} axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                      <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Area type="monotone" dataKey={dataKey} stroke="#f59e0b" fillOpacity={0.3} fill="#f59e0b" strokeWidth={3} />
                    </AreaChart>
                  ) : tipoGrafico === "pie" ? (
                    <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: 12, color: '#475569'}} />
                      <Pie
                        data={series}
                        dataKey={dataKey}
                        nameKey={nameKey}
                        cx="50%"
                        cy="45%"
                        outerRadius={100}
                        innerRadius={60}
                        paddingAngle={5}
                        fill="#f59e0b"
                        label
                      >
                        {series.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  ) : (
                    <BarChart data={series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey={nameKey} axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize:11, fill:'#94a3b8'}} />
                      <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} cursor={{fill: '#f8fafc'}} />
                      <Bar dataKey={dataKey} fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="rep-empty">Agrupa por Día o Mes para ver la gráfica.</div>
              )}
            </div>
          )}

          {vista === "tabla" && (
            <>
              <div className="rep-table-container">
                <table className="rep-table">
                  <thead>
                    <tr>
                      {columns.map((c) => <th key={c}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.items.map((r, idx) => (
                      <tr key={idx}>
                        {columns.map((c) => (
                          <td key={c}>{String(r?.[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rep-footer">
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                  Total: {paginated.total} registros
                </span>
                <div className="rep-pagination">
                  <button
                    className="rep-pageBtn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={paginated.page <= 1}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span style={{fontSize:12, fontWeight:700, padding:'0 10px', display:'flex', alignItems:'center'}}>
                    {paginated.page} / {paginated.totalPages}
                  </span>
                  <button
                    className="rep-pageBtn"
                    onClick={() => setPage((p) => Math.min(paginated.totalPages, p + 1))}
                    disabled={paginated.page >= paginated.totalPages}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default VisualizadorReporte;
