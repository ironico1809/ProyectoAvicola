import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import html2pdf from "html2pdf.js";

import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
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
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Reportes() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [galpones, setGalpones] = useState([]);
  const [lotes, setLotes] = useState([]);

  const [entidad, setEntidad] = useState("alimentacion");
  const [agruparPor, setAgruparPor] = useState("dia");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [galponIds, setGalponIds] = useState([]);
  const [loteId, setLoteId] = useState("");
  const [estadoLote, setEstadoLote] = useState("");
  const [tipoAlimento, setTipoAlimento] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [series, setSeries] = useState([]);

  useEffect(() => {
    fetchBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBase = async () => {
    setError("");
    try {
      const [galRes, lotRes] = await Promise.all([
        api.get("/galpones/"),
        api.get("/lotes/"),
      ]);
      setGalpones(Array.isArray(galRes.data) ? galRes.data : []);
      setLotes(Array.isArray(lotRes.data) ? lotRes.data : []);
    } catch (e) {
      console.error("Error cargando base", e);
      setError("No se pudieron cargar galpones/lotes.");
    }
  };

  const payload = useMemo(() => {
    const p = {
      entidad,
      formato: "json",
    };

    if (agruparPor) p.agrupar_por = agruparPor;

    if (fechaInicio) p.fecha_inicio = fechaInicio;
    if (fechaFin) p.fecha_fin = fechaFin;

    if (Array.isArray(galponIds) && galponIds.length > 0)
      p.galpon_ids = galponIds;

    const lid = toNumber(loteId);
    if (lid) p.lote_id = lid;

    if (estadoLote && String(estadoLote).trim()) p.estado_lote = estadoLote;
    if (tipoAlimento && String(tipoAlimento).trim())
      p.tipo_alimento = tipoAlimento;

    return p;
  }, [
    entidad,
    agruparPor,
    fechaInicio,
    fechaFin,
    galponIds,
    loteId,
    estadoLote,
    tipoAlimento,
  ]);

  const handleGenerar = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/reportes/generar/", payload);
      const data = res?.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary(
        data.summary && typeof data.summary === "object" ? data.summary : {},
      );
      setSeries(Array.isArray(data.series) ? data.series : []);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(String(detail || "No se pudo generar el reporte."));
    } finally {
      setLoading(false);
    }
  };

  const handleLimpiar = () => {
    setEntidad("alimentacion");
    setAgruparPor("dia");
    setFechaInicio("");
    setFechaFin("");
    setGalponIds([]);
    setLoteId("");
    setEstadoLote("");
    setTipoAlimento("");
    setError("");
    setRows([]);
    setSummary({});
    setSeries([]);
  };

  const handleDescargarExcel = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post(
        "/reportes/generar/",
        { ...payload, formato: "excel" },
        { responseType: "blob" },
      );

      const contentType = String(res?.headers?.["content-type"] || "");
      const ext = contentType.includes("spreadsheetml") ? "xlsx" : "csv";
      downloadBlob(res.data, `reporte.${ext}`);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError(String(detail || "No se pudo descargar el reporte."));
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = () => {
    const element = document.getElementById("reporte-imprimible");
    if (!element) return;
    const opt = {
      margin: 10,
      filename: `reporte_avigranja_${new Date().getTime()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    };
    html2pdf().from(element).set(opt).save();
  };

  return (
    <div className="rep-layout">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        showMobileTrigger={false}
      />

      <main
        className="rep-main"
        style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}
      >
        <header className="est-header">
          <div className="est-title-group">
            <h1 className="est-title">Reportes Dinámicos</h1>
            <div className="est-subtitle">
              Analítica y exportación de datos
            </div>
          </div>
          <div className="est-header-right">
             <button 
              className="rep-tab rep-tabActive" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{padding: '8px 16px', fontSize: '12px'}}
            >
              {sidebarOpen ? 'Expandir Vista' : 'Menú'}
            </button>
          </div>
        </header>

        {error && (
          <div style={{ marginBottom: 14 }}>
            <AlertItem
              type="danger"
              icon={<AlertTriangle size={18} color="#dc2626" />}
              title="Atención"
              desc={error}
            />
          </div>
        )}

        <div className="rep-grid">
          <FiltroReportes
            entidad={entidad}
            setEntidad={setEntidad}
            agruparPor={agruparPor}
            setAgruparPor={setAgruparPor}
            fechaInicio={fechaInicio}
            setFechaInicio={setFechaInicio}
            fechaFin={fechaFin}
            setFechaFin={setFechaFin}
            galpones={galpones}
            galponIds={galponIds}
            setGalponIds={setGalponIds}
            lotes={lotes}
            loteId={loteId}
            setLoteId={setLoteId}
            estadoLote={estadoLote}
            setEstadoLote={setEstadoLote}
            tipoAlimento={tipoAlimento}
            setTipoAlimento={setTipoAlimento}
            loading={loading}
            onGenerar={handleGenerar}
            onLimpiar={handleLimpiar}
            onDescargarExcel={handleDescargarExcel}
            onDescargarPDF={handleDescargarPDF}
          />

          <div id="reporte-imprimible" style={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <VisualizadorReporte
              entidad={entidad}
              rows={rows}
              summary={summary}
              series={series}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default Reportes;
