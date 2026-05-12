import { useMemo } from "react";
import {
  Download, Filter, RefreshCw, Calendar, Database,
  Package, FileText, LayoutList, Clock,
  Target, TrendingUp, Skull, Warehouse, Bird
} from "lucide-react";
import ComboBox from "../../components/ComboBox";

function iso(d) { return d.toISOString().split("T")[0]; }

const PRESETS = [
  {
    id: "ciclo_lote",
    name: "Eficiencia por Lote",
    desc: "Calcula FCA, mortalidad y kg totales por cada lote.",
    icon: <Target size={22} color="#b45309" />,
    bg: "#fffbeb",
    entidad: "alimentacion", agrupar: "lote",
  },
  {
    id: "alimento_raza",
    name: "Alimento vs Raza",
    desc: "Compara el consumo según la línea genética de las aves.",
    icon: <Bird size={22} color="#166534" />,
    bg: "#dcfce7",
    entidad: "alimentacion", agrupar: "raza_tipo",
  },
  {
    id: "mortalidad_estado",
    name: "Mortalidad por Etapa",
    desc: "Detecta pérdidas críticas en Crianza o Engorde.",
    icon: <Skull size={22} color="#dc2626" />,
    bg: "#fef2f2",
    entidad: "lotes", agrupar: "estado",
  },
  {
    id: "rendimiento_galpon",
    name: "Ocupación Real",
    desc: "Análisis de capacidad y población por galpón.",
    icon: <Warehouse size={22} color="#1e40af" />,
    bg: "#dbeafe",
    entidad: "lotes", agrupar: "galpon",
  },
  {
    id: "consumo_mes",
    name: "Consumo Mensual",
    desc: "Tendencia diaria de consumo del mes actual.",
    icon: <TrendingUp size={22} color="#f59e0b" />,
    bg: "#fff7ed",
    entidad: "alimentacion", agrupar: "dia",
  },
];

function FiltroReportes({
  entidad, setEntidad,
  agruparPor, setAgruparPor,
  fechaInicio, setFechaInicio,
  fechaFin, setFechaFin,
  galpones, galponIds, setGalponIds,
  lotes, loteId, setLoteId,
  estadoLote, setEstadoLote,
  tipoAlimento, setTipoAlimento,
  rows,
  loading,
  onGenerar, onLimpiar, onDescargarExcel, onDescargarPDF,
}) {
  const galponesOpts = useMemo(() =>
    (Array.isArray(galpones) ? galpones : []).map(g => ({
      value: String(g.id ?? g.id_galpon ?? ""), label: g.nombre,
    })), [galpones]);

  const lotesOptions = useMemo(() =>
    (Array.isArray(lotes) ? lotes : [])
      .map(l => ({ value: String(l?.id_lote ?? ""), label: `Lote ${l?.id_lote}` }))
      .filter(o => o.value),
    [lotes]);

  const aplicarPreset = (p) => {
    setEntidad(p.entidad);
    setAgruparPor(p.agrupar);
    if (p.id === "consumo_mes") {
      const hoy = new Date();
      setFechaInicio(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
      setFechaFin(iso(hoy));
    }
  };

  const opcionesAgrupar = useMemo(() => {
    const base = [
      { value: "",             label: "Sin agrupar (Detalle)" },
      { value: "dia",          label: "Por Día" },
      { value: "mes",          label: "Por Mes" },
    ];
    if (entidad === "alimentacion" || entidad === "lotes") {
      base.push({ value: "galpon",    label: "Por Galpón" });
      base.push({ value: "raza_tipo", label: "Por Raza/Tipo de Ave" });
    }
    if (entidad === "alimentacion") {
      base.push({ value: "lote",          label: "Por Lote (KPIs)" });
      base.push({ value: "tipo_alimento", label: "Por Marca de Alimento" });
    }
    if (entidad === "lotes") {
      base.push({ value: "estado", label: "Por Etapa (Estado)" });
    }
    return base;
  }, [entidad]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Preset cards */}
      <div className="rep-quick-grid">
        {PRESETS.map(p => (
          <button key={p.id} className="rep-quick-card" onClick={() => aplicarPreset(p)}>
            <div className="rep-quick-icon" style={{ background: p.bg }}>{p.icon}</div>
            <div className="rep-quick-info">
              <span className="rep-quick-name">{p.name}</span>
              <span className="rep-quick-desc">{p.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Filter card */}
      <section className="rep-filter-card">

        {/* Sección 1 */}
        <div className="rep-filter-section">
          <span className="rep-section-title"><LayoutList size={14} /> 1. Origen y Organización</span>
          <div className="rep-filter-grid">
            <div className="rep-filter-item">
              <label className="rep-filter-label">Fuente de Datos</label>
              <div className="rep-input-container">
                <Database className="rep-input-icon" size={16} />
                <select className="rep-select" value={entidad} onChange={e => setEntidad(e.target.value)}>
                  <option value="alimentacion">Alimentación</option>
                  <option value="lotes">Producción (Lotes)</option>
                  <option value="bitacora">Auditoría (Bitácora)</option>
                </select>
              </div>
            </div>
            <div className="rep-filter-item">
              <label className="rep-filter-label">Agrupar por</label>
              <div className="rep-input-container">
                <Filter className="rep-input-icon" size={16} />
                <select className="rep-select" value={agruparPor} onChange={e => setAgruparPor(e.target.value)}>
                  {opcionesAgrupar.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Sección 2 */}
        <div className="rep-filter-section">
          <span className="rep-section-title"><Clock size={14} /> 2. Rango de Tiempo</span>
          <div className="rep-filter-grid">
            <div className="rep-filter-item">
              <label className="rep-filter-label">Desde</label>
              <div className="rep-input-container">
                <Calendar className="rep-input-icon" size={16} />
                <input type="date" className="rep-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              </div>
            </div>
            <div className="rep-filter-item">
              <label className="rep-filter-label">Hasta</label>
              <div className="rep-input-container">
                <Calendar className="rep-input-icon" size={16} />
                <input type="date" className="rep-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Sección 3 condicional */}
        {(entidad === "alimentacion" || entidad === "lotes") && (
          <div className="rep-filter-section">
            <span className="rep-section-title"><Target size={14} /> 3. Filtros Avanzados</span>
            <div className="rep-filter-grid">
              <ComboBox
                label="Galpón"
                value={galponIds[0] || ""}
                onChange={val => setGalponIds(val ? [Number(val)] : [])}
                options={galponesOpts}
                placeholder="Todos"
                icon={<Warehouse size={16} />}
              />
              <ComboBox
                label="Lote"
                value={loteId}
                onChange={val => setLoteId(val)}
                options={lotesOptions}
                placeholder="Todos"
                icon={<Package size={16} />}
              />
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="rep-actions-bar">
          <button className="rep-btn-secondary" onClick={onLimpiar} disabled={loading}>
            <RefreshCw size={14} /> Resetear
          </button>
          <div style={{ flex: 1 }} />
          <button className="rep-btn-secondary" onClick={onDescargarExcel} disabled={loading || !rows?.length}>
            <Download size={14} /> Excel
          </button>
          <button className="rep-btn-secondary" onClick={onDescargarPDF} disabled={loading || !rows?.length}>
            <FileText size={14} /> PDF
          </button>
          <button className="rep-btn-primary" onClick={onGenerar} disabled={loading}>
            <Filter size={16} />
            {loading ? "Analizando..." : "Generar Reporte"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default FiltroReportes;
