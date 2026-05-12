import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Activity } from "lucide-react";
import html2pdf from "html2pdf.js";

import Sidebar from "../../components/Sidebar";
import AlertItem from "../../components/AlertItem";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

import FiltroReportes from "./FiltroReportes";
import VisualizadorReporte from "./VisualizadorReporte";

import "./Reportes.css";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Reportes() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [galpones, setGalpones] = useState([]);
  const [lotes, setLotes]       = useState([]);

  const [entidad,      setEntidad]      = useState("alimentacion");
  const [agruparPor,   setAgruparPor]   = useState("dia");
  const [fechaInicio,  setFechaInicio]  = useState("");
  const [fechaFin,     setFechaFin]     = useState("");
  const [galponIds,    setGalponIds]    = useState([]);
  const [loteId,       setLoteId]       = useState("");
  const [estadoLote,   setEstadoLote]   = useState("");
  const [tipoAlimento, setTipoAlimento] = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [rows,    setRows]    = useState([]);
  const [summary, setSummary] = useState({});
  const [series,  setSeries]  = useState([]);

  useEffect(() => { fetchBase(); }, []);

  const fetchBase = async () => {
    try {
      const [galRes, lotRes] = await Promise.all([api.get("/galpones/"), api.get("/lotes/")]);
      setGalpones(Array.isArray(galRes.data) ? galRes.data : []);
      setLotes(Array.isArray(lotRes.data) ? lotRes.data : []);
    } catch (e) { console.error(e); }
  };

  const payload = useMemo(() => {
    const p = { entidad, formato: "json" };
    if (agruparPor) p.agrupar_por = agruparPor;
    if (fechaInicio) p.fecha_inicio = fechaInicio;
    if (fechaFin) p.fecha_fin = fechaFin;
    if (galponIds?.length) p.galpon_ids = galponIds;
    const lid = toNumber(loteId); if (lid) p.lote_id = lid;
    if (estadoLote?.trim()) p.estado_lote = estadoLote;
    if (tipoAlimento?.trim()) p.tipo_alimento = tipoAlimento;
    return p;
  }, [entidad, agruparPor, fechaInicio, fechaFin, galponIds, loteId, estadoLote, tipoAlimento]);

  const handleGenerar = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/reportes/generar/", payload);
      const d = res?.data || {};
      setRows(Array.isArray(d.rows) ? d.rows : []);
      setSummary(d.summary && typeof d.summary === "object" ? d.summary : {});
      setSeries(Array.isArray(d.series) ? d.series : []);
    } catch (e) { setError(String(e?.response?.data?.detail || "No se pudo generar el reporte.")); }
    finally { setLoading(false); }
  };

  const handleLimpiar = () => {
    setEntidad("alimentacion"); setAgruparPor("dia");
    setFechaInicio(""); setFechaFin("");
    setGalponIds([]); setLoteId(""); setEstadoLote(""); setTipoAlimento("");
    setError(""); setRows([]); setSummary({}); setSeries([]);
  };

  const handleDescargarExcel = async () => {
    setLoading(true); setError("");
    try {
      const res = await api.post("/reportes/generar/", { ...payload, formato: "excel" }, { responseType: "blob" });
      const ext = String(res?.headers?.["content-type"] || "").includes("spreadsheetml") ? "xlsx" : "csv";
      downloadBlob(res.data, `reporte.${ext}`);
    } catch (e) { setError("No se pudo descargar el reporte."); }
    finally { setLoading(false); }
  };

  const handleDescargarPDF = () => {
    const el = document.getElementById("reporte-imprimible");
    if (!el) return;
    html2pdf().from(el).set({
      margin: 10, filename: `reporte_avigranja_${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    }).save();
  };

  return (
    <div className="rep-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />
      <main className="rep-main" style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}>

        <header className="est-header" style={{ marginBottom: 4 }}>
          <div className="est-title-group">
            <h1 className="est-title">Reportes Dinámicos</h1>
            <p className="est-subtitle"><Activity size={14} /> Analítica, métricas y exportación de datos</p>
          </div>
        </header>

        {error && (
          <div style={{ marginBottom: 14 }}>
            <AlertItem type="danger" icon={<AlertTriangle size={18} color="#dc2626" />} title="Atención" desc={error} />
          </div>
        )}

        <div className="rep-grid">
          <FiltroReportes
            entidad={entidad}           setEntidad={setEntidad}
            agruparPor={agruparPor}     setAgruparPor={setAgruparPor}
            fechaInicio={fechaInicio}   setFechaInicio={setFechaInicio}
            fechaFin={fechaFin}         setFechaFin={setFechaFin}
            galpones={galpones}         galponIds={galponIds}   setGalponIds={setGalponIds}
            lotes={lotes}               loteId={loteId}         setLoteId={setLoteId}
            estadoLote={estadoLote}     setEstadoLote={setEstadoLote}
            tipoAlimento={tipoAlimento} setTipoAlimento={setTipoAlimento}
            rows={rows}
            loading={loading}
            onGenerar={handleGenerar}
            onLimpiar={handleLimpiar}
            onDescargarExcel={handleDescargarExcel}
            onDescargarPDF={handleDescargarPDF}
          />
          <div id="reporte-imprimible" style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <VisualizadorReporte
              entidad={entidad} rows={rows} summary={summary}
              series={series} loading={loading} error={error} filters={payload}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default Reportes;
