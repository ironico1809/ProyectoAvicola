import { useMemo } from "react";
import { Download, Filter, RefreshCw, Calendar, Database, Bird, Package, Activity, Wheat, FileText } from "lucide-react";
import ComboBox from "../../components/ComboBox";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function FiltroReportes({
  entidad,
  setEntidad,
  agruparPor,
  setAgruparPor,
  fechaInicio,
  setFechaInicio,
  fechaFin,
  setFechaFin,
  galpones,
  galponIds,
  setGalponIds,
  lotes,
  loteId,
  setLoteId,
  estadoLote,
  setEstadoLote,
  tipoAlimento,
  setTipoAlimento,
  loading,
  onGenerar,
  onLimpiar,
  onDescargarExcel,
  onDescargarPDF,
}) {
  const galponesActivos = useMemo(() => {
    return (Array.isArray(galpones) ? galpones : []).filter((g) => {
      const st = String(g?.estado || "").toLowerCase().trim();
      return st === "activo";
    });
  }, [galpones]);

  const lotesOptions = useMemo(() => {
    return (Array.isArray(lotes) ? lotes : [])
      .slice()
      .sort((a, b) => (toNumber(b?.id_lote) ?? 0) - (toNumber(a?.id_lote) ?? 0))
      .map((l) => ({
        value: String(l?.id_lote ?? ""),
        label: `Lote ${l?.id_lote}`,
      }))
      .filter((o) => o.value);
  }, [lotes]);

  const aplicarPreset = (tipo) => {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split("T")[0];
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
    
    if (tipo === "consumo_mes") {
      setEntidad("alimentacion");
      setAgruparPor("dia");
      setFechaInicio(primerDiaMes);
      setFechaFin(hoyStr);
      setGalponIds([]);
      setLoteId("");
      setEstadoLote("");
      setTipoAlimento("");
    } else if (tipo === "rendimiento_galpon") {
      setEntidad("lotes");
      setAgruparPor("galpon");
      setFechaInicio("");
      setFechaFin("");
      setGalponIds([]);
      setLoteId("");
      setEstadoLote("Crianza");
      setTipoAlimento("");
    } else if (tipo === "auditoria_hoy") {
      setEntidad("bitacora");
      setAgruparPor("");
      setFechaInicio(hoyStr);
      setFechaFin(hoyStr);
      setGalponIds([]);
      setLoteId("");
      setEstadoLote("");
      setTipoAlimento("");
    } else if (tipo === "alimento_raza") {
      setEntidad("alimentacion");
      setAgruparPor("raza_tipo");
      setFechaInicio(primerDiaMes);
      setFechaFin(hoyStr);
      setGalponIds([]);
      setLoteId("");
      setEstadoLote("");
      setTipoAlimento("");
    } else if (tipo === "rendimiento_raza") {
      setEntidad("lotes");
      setAgruparPor("raza_tipo");
      setFechaInicio("");
      setFechaFin("");
      setGalponIds([]);
      setLoteId("");
      setEstadoLote("");
      setTipoAlimento("");
    }
  };

  return (
    <section className="rep-filter-panel">
      <div className="rep-presets">
        <span className="rep-presets-label">Reportes Rápidos:</span>
        <button className="rep-preset-btn" onClick={() => aplicarPreset("consumo_mes")}>Consumo Mensual</button>
        <button className="rep-preset-btn" onClick={() => aplicarPreset("rendimiento_galpon")}>Ocupación Activa</button>
        <button className="rep-preset-btn" onClick={() => aplicarPreset("auditoria_hoy")}>Auditoría del Día</button>
        <button className="rep-preset-btn" onClick={() => aplicarPreset("alimento_raza")}>Alimento vs Raza</button>
        <button className="rep-preset-btn" onClick={() => aplicarPreset("rendimiento_raza")}>Mortalidad por Raza</button>
      </div>

      <div className="rep-filter-grid">
        
        {/* Fuente */}
        <div className="rep-filter-item">
          <label className="rep-filter-label"><Database size={14} /> Fuente</label>
          <div className="rep-input-container">
            <Activity className="rep-input-icon" size={16} />
            <select className="rep-select" value={entidad} onChange={(e) => setEntidad(e.target.value)}>
              <option value="alimentacion">Consumo de Alimento</option>
              <option value="lotes">Rendimiento de Lotes</option>
              <option value="bitacora">Auditoría (Bitácora)</option>
            </select>
          </div>
        </div>

        {/* Fecha Inicio */}
        <div className="rep-filter-item">
          <label className="rep-filter-label"><Calendar size={14} /> Desde</label>
          <div className="rep-input-container">
            <Calendar className="rep-input-icon" size={16} />
            <input type="date" className="rep-input" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
          </div>
        </div>

        {/* Fecha Fin */}
        <div className="rep-filter-item">
          <label className="rep-filter-label"><Calendar size={14} /> Hasta</label>
          <div className="rep-input-container">
            <Calendar className="rep-input-icon" size={16} />
            <input type="date" className="rep-input" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
          </div>
        </div>

        {/* Agrupar */}
        <div className="rep-filter-item">
          <label className="rep-filter-label"><Layers size={14} /> Agrupar</label>
          <div className="rep-input-container">
            <Filter className="rep-input-icon" size={16} />
            <select className="rep-select" value={agruparPor} onChange={(e) => setAgruparPor(e.target.value)}>
              <option value="">Sin agrupar</option>
              <option value="dia">Por Día</option>
              <option value="mes">Por Mes</option>
              <option value="galpon">Por Galpón</option>
              <option value="tipo_alimento">Por Tipo de Alimento</option>
              <option value="raza_tipo">Por Raza/Tipo de Ave</option>
            </select>
          </div>
        </div>

        {/* Galpones */}
        <ComboBox
          label="Galpón"
          value={galponIds[0] || ""}
          onChange={(val) => setGalponIds(val ? [Number(val)] : [])}
          options={galponesActivos.map((g) => ({
            value: String(g.id),
            label: g.nombre,
          }))}
          placeholder="Todos los Galpones"
          icon={<Bird size={16} />}
        />

        {/* Lote */}
        <ComboBox
          label="Lote"
          value={loteId}
          onChange={(val) => setLoteId(val)}
          options={lotesOptions}
          placeholder="Todos los Lotes"
          icon={<Package size={16} />}
        />

        {/* Estado */}
        <div className="rep-filter-item">
          <label className="rep-filter-label"><Activity size={14} /> Estado</label>
          <div className="rep-input-container">
            <Filter className="rep-input-icon" size={16} />
            <input 
              className="rep-input" 
              placeholder="Ej: Crianza" 
              value={estadoLote} 
              onChange={(e) => setEstadoLote(e.target.value)} 
            />
          </div>
        </div>

        {/* Alimento */}
        <div className="rep-filter-item">
          <label className="rep-filter-label"><Wheat size={14} /> Alimento</label>
          <div className="rep-input-container">
            <Wheat className="rep-input-icon" size={16} />
            <input 
              className="rep-input" 
              placeholder="Ej: Inicio" 
              value={tipoAlimento} 
              onChange={(e) => setTipoAlimento(e.target.value)} 
            />
          </div>
        </div>

      </div>

      <div className="rep-actions-bar">
        <button className="rep-btn-secondary" onClick={onLimpiar} disabled={loading}>
          <RefreshCw size={14} /> Limpiar
        </button>
        <button className="rep-btn-secondary" onClick={onDescargarExcel} disabled={loading}>
          <Download size={14} /> Exportar Excel
        </button>
        <button className="rep-btn-secondary" onClick={onDescargarPDF} disabled={loading}>
          <FileText size={14} /> Exportar PDF
        </button>
        <button className="rep-btn-primary" onClick={onGenerar} disabled={loading}>
          <Filter size={16} /> {loading ? "Generando..." : "Generar Reporte"}
        </button>
      </div>
    </section>
  );
}

const Layers = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
);

export default FiltroReportes;
