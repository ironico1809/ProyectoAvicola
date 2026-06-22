import { useEffect, useMemo, useState } from "react";
import { Plus, Search, AlertTriangle, Activity, List, BarChart2, PieChart, Download, Brain } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import html2canvas from "html2canvas"; // NUEVO IMPORT

import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import Modal from "../../components/Modal";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import AlertItem from "../../components/AlertItem";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

import { generarPDFMortandad } from "./ReporteMortandad";
import "./Mortandad.css";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function Mortandad() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lotes, setLotes] = useState([]);
  const [rows, setRows] = useState([]);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loteUrl = searchParams.get("lote");
  const tabUrl = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tabUrl || "historial");
  const [mostrarCausas, setMostrarCausas] = useState(false);
  
  const [filtroTiempo, setFiltroTiempo] = useState("dia"); 

  const [filtroLote, setFiltroLote] = useState(loteUrl || "");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    id_lote: "",
    cantidad: "",
    causa: "",
  });

  useEffect(() => {
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loteUrl) setFiltroLote(loteUrl);
    if (tabUrl) setActiveTab(tabUrl);
  }, [loteUrl, tabUrl]);

  const fetchInitial = async () => {
    setLoading(true);
    setFormError("");
    try {
      const [lotesRes, mortRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/mortandad/"),
      ]);
      const dataLotes = Array.isArray(lotesRes.data) ? lotesRes.data : lotesRes.data?.results || [];
      const lotesActivosFiltrados = dataLotes.filter(l =>
        ["crianza", "crecimiento", "engorde", "activo"].includes(String(l.estado || "").toLowerCase().trim())
      );
      setLotes(lotesActivosFiltrados);
      setRows(Array.isArray(mortRes.data) ? mortRes.data : mortRes.data?.results || []);
    } catch (e) {
      setFormError("No se pudo cargar la información de mortandad.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async () => {
    setLoading(true);
    setFormError("");
    setSuccess("");
    try {
      const params = {};
      if (filtroLote) params.lote = filtroLote;
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;

      const res = await api.get("/mortandad/", { params });
      setRows(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (e) {
      setFormError("Error al consultar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const lotesOptions = useMemo(() => {
    return lotes
      .slice()
      .sort((a, b) => (toNumber(b?.id_lote) ?? 0) - (toNumber(a?.id_lote) ?? 0))
      .map((l) => {
        const esFinalizado = String(l?.estado).toLowerCase() === "finalizado";
        const etiquetaEstado = esFinalizado ? " - FINALIZADO" : ` (${l?.cantidad_actual || 0} vivas)`;
        
        return {
          value: String(l?.id_lote ?? ""),
          label: `Lote ${l?.id_lote}${etiquetaEstado}`,
          inicial: l?.cantidad_inicial || 0,
          actual: l?.cantidad_actual || 0,
          estado: l?.estado || "",
          esFinalizado: esFinalizado
        };
      })
      .filter((o) => o.value);
  }, [lotes]);

  const lotesActivosOptions = lotesOptions.filter((o) => !o.esFinalizado);

  const loteSeleccionadoParaAnalisis = lotesOptions.find((l) => l.value === filtroLote);
  
  const calcularTasa = (inicial, actual) => {
    if (!inicial || inicial === 0) return 0;
    const bajas = inicial - actual;
    return ((bajas / inicial) * 100).toFixed(2); 
  };

  const getKPI = () => {
    if (!loteSeleccionadoParaAnalisis) return null;
    const { inicial, actual } = loteSeleccionadoParaAnalisis;
    const bajas = inicial - actual;
    const porcentaje = calcularTasa(inicial, actual);
    
    return { inicial, actual, bajas, porcentaje };
  };

  const kpiData = getKPI();

  // CORRECCIÓN: Trae TODO el historial del lote ignorando las fechas previas del buscador
  const handleAnalizarCausas = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mortandad/", { params: { lote: filtroLote } });
      setRows(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    setMostrarCausas(true);
  };

  // NUEVO: Exportador con captura de gráfico
  const handleExportarPDF = async () => {
    let chartImage = null;
    
    // Si el gráfico está visible en pantalla, le sacamos foto
    if (mostrarCausas) {
      const chartElement = document.getElementById("grafico-tendencia-container");
      if (chartElement) {
        const canvas = await html2canvas(chartElement, { scale: 2, backgroundColor: "#ffffff" });
        chartImage = canvas.toDataURL("image/png");
      }
    }

    // Filtramos localmente para garantizar que el PDF no mezcle datos de otros lotes
    const historialFiltrado = rows.filter(r => String(r.lote) === String(filtroLote));
    
    const causasLote = historialFiltrado.reduce((acc, curr) => {
      const causa = curr.causa || "No especificada";
      acc[causa] = (acc[causa] || 0) + curr.cantidad;
      return acc;
    }, {});

    generarPDFMortandad(filtroLote, kpiData, causasLote, historialFiltrado, chartImage);
  };

  const causasAgrupadas = useMemo(() => {
    const filtrado = rows.filter(r => String(r.lote) === String(filtroLote));
    return filtrado.reduce((acc, curr) => {
      const causa = curr.causa || "No especificada";
      acc[causa] = (acc[causa] || 0) + curr.cantidad;
      return acc;
    }, {});
  }, [rows, filtroLote]);

  const datosGraficoTendencia = useMemo(() => {
    const filtrado = rows.filter(r => String(r.lote) === String(filtroLote));
    const agrupado = filtrado.reduce((acc, curr) => {
      if (!curr.fecha_hora) return acc;
      
      const fecha = new Date(curr.fecha_hora);
      let clave = "";

      if (filtroTiempo === "dia") {
        clave = fecha.toLocaleDateString();
      } else if (filtroTiempo === "mes") {
        clave = fecha.toLocaleString('es-ES', { month: 'short', year: 'numeric' });
      } else if (filtroTiempo === "semana") {
        const diaSemana = fecha.getDay();
        const diferencia = fecha.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
        const inicioSemana = new Date(fecha.setDate(diferencia));
        clave = `Sem. ${inicioSemana.toLocaleDateString()}`;
      }

      acc[clave] = (acc[clave] || 0) + curr.cantidad;
      return acc;
    }, {});

    return Object.keys(agrupado).map(key => ({
      fecha: key,
      bajas: agrupado[key]
    })).reverse(); 
  }, [rows, filtroTiempo, filtroLote]);

  const resetForm = () => {
    setForm({ id_lote: "", cantidad: "", causa: "" });
    setFormError(""); setSuccess("");
  };

  const handleOpenModal = () => {
    resetForm(); setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegistrar = async (e) => {
    e.preventDefault();
    setFormError(""); setSuccess("");

    const lote_id = toNumber(form.id_lote);
    const cantidad = toNumber(form.cantidad);

    if (!lote_id) return setFormError("Selecciona un lote.");
    if (!cantidad || cantidad <= 0) return setFormError("La cantidad debe ser mayor a 0.");

    const loteSeleccionado = lotesActivosOptions.find(o => o.value === String(lote_id));
    if (loteSeleccionado && cantidad > loteSeleccionado.actual) {
      return setFormError(
        `Imposible registrar ${cantidad} bajas. El lote solo tiene ${loteSeleccionado.actual} aves vivas.`
      );
    }

    setSaving(true);
    try {
      await api.post("/mortandad/", {
        lote: lote_id,
        cantidad: cantidad,
        causa: String(form.causa || "").trim() || null,
      });

      setSuccess("Bajas registradas correctamente. El lote ha sido actualizado.");
      setShowModal(false);
      await fetchInitial(); 
      if (activeTab === "analisis") {
        setMostrarCausas(false); 
      }
    } catch (err) {
      setFormError("Error al registrar la mortandad.");
    } finally {
      setSaving(false);
    }
  };

  const formatFecha = (fechaString) => {
    if (!fechaString) return "-";
    return new Date(fechaString).toLocaleString();
  };

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: "14px",
    borderRadius: "12px",
    border: isActive ? "2px solid #f59e0b" : "1px solid #e5e7eb",
    background: isActive ? "#fef3c7" : "white",
    color: isActive ? "#b45309" : "#6b7280",
    fontWeight: "bold",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.2s ease"
  });

  return (
    <div className="mort-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main className="mort-main" style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}>
        <Topbar
          titulo="Mortalidad y Análisis"
          subtitulo="Gestión de Bajas y Estadísticas de la Granja"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div style={{ display: "flex", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button style={tabStyle(activeTab === "historial")} onClick={() => setActiveTab("historial")}>
            <List size={20} />
            Registro e Historial
          </button>
          <button style={tabStyle(activeTab === "analisis")} onClick={() => setActiveTab("analisis")}>
            <BarChart2 size={20} />
            Panel de Análisis
          </button>
        </div>

        {(formError || success) && (
          <div className="mort-alerts" style={{ marginBottom: "20px" }}>
            {formError && <AlertItem type="danger" icon={<AlertTriangle size={18} />} title="Error" desc={formError} />}
            {success && <AlertItem type="info" icon={<AlertTriangle size={18} />} title="Éxito" desc={success} />}
          </div>
        )}

        {/* PESTAÑA 1: HISTORIAL */}
        {activeTab === "historial" && (
          <>
            <div className="mort-card" style={{ marginBottom: "24px" }}>
              <div className="mort-cardHeader">
                <div>
                  <h2 className="mort-title">Gestión de Bajas</h2>
                  <p className="mort-subtitle">Filtra por fechas o busca el historial de un lote</p>
                </div>
                <button className="mort-primaryBtn" onClick={handleOpenModal}>
                  <Plus size={18} />
                  Registrar Baja
                </button>
              </div>

              <div className="mort-filters">
                <div className="mort-filter">
                  <label className="mort-label">Filtrar por Lote</label>
                  <div className="mort-selectWrap">
                    <select className="mort-select" value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)}>
                      <option value="">Todos los lotes...</option>
                      {lotesOptions.map((o) => (
                        <option 
                          key={o.value} 
                          value={o.value} 
                          style={o.esFinalizado ? {color: '#6b7280', fontWeight: 'bold'} : {}}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mort-filter">
                  <label className="mort-label">Desde</label>
                  <InputField type="date" name="fecha_inicio" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div className="mort-filter">
                  <label className="mort-label">Hasta</label>
                  <InputField type="date" name="fecha_fin" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
                <div className="mort-actions">
                  <button className="mort-primaryBtn" onClick={fetchHistorial} type="button">
                    <Search size={18} /> Buscar
                  </button>
                </div>
              </div>
            </div>

            <div className="mort-card">
              <h2 className="mort-title" style={{ marginBottom: "16px" }}>Historial de Bajas</h2>
              <div className="mort-tableWrap">
                <table className="mort-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Lote</th>
                      <th>Fecha y Hora</th>
                      <th>Bajas</th>
                      <th>Causa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="mort-empty">Cargando...</td></tr>
                    ) : rows.length === 0 ? (
                      <tr><td colSpan={5} className="mort-empty">No hay registros de bajas.</td></tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id_muerte}>
                          <td><strong>{r.id_muerte}</strong></td>
                          <td>Lote {r.lote}</td>
                          <td>{formatFecha(r.fecha_hora)}</td>
                          <td><span style={{ color: "red", fontWeight: "bold" }}>-{r.cantidad}</span></td>
                          <td className="mort-muted">{r.causa || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* PESTAÑA 2: ANÁLISIS */}
        {activeTab === "analisis" && (
          <>
            <div className="mort-card" style={{ marginBottom: "24px" }}>
               <h2 className="mort-title" style={{ marginBottom: "16px" }}>Selecciona un Lote para Analizar</h2>
               <div className="mort-selectWrap" style={{ maxWidth: "400px" }}>
                  <select className="mort-select" value={filtroLote} onChange={(e) => {
                    setFiltroLote(e.target.value);
                    setMostrarCausas(false);
                  }}>
                    <option value="">Selecciona un lote...</option>
                    {lotesOptions.map((o) => (
                      <option 
                        key={o.value} 
                        value={o.value} 
                        style={o.esFinalizado ? {color: '#6b7280', fontWeight: 'bold'} : {}}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
            </div>

            {kpiData ? (
              <div className="mort-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Activity color="#f59e0b" />
                    <h2 className="mort-title">Panel de Analisis: Tasa de Mortalidad (Lote {filtroLote})</h2>
                  </div>
                  
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button 
                      className="mort-secondaryBtn" 
                      onClick={() => navigate(`/mortandad/prediccion?lote=${filtroLote}`)} 
                      type="button"
                      style={{ background: "#fef3c7", color: "#b45309", borderColor: "#f59e0b" }}
                    >
                      <Brain size={18} />
                      Predicción IA
                    </button>
                    <button 
                      className="mort-secondaryBtn" 
                      onClick={handleExportarPDF} 
                      type="button"
                    >
                      <Download size={18} />
                      Exportar PDF
                    </button>
                  </div>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                  <div><strong>Población Inicial:</strong> {kpiData.inicial} aves</div>
                  <div><strong style={{color: '#dc2626'}}>Total Bajas:</strong> {kpiData.bajas} aves</div>
                  <div><strong>Población Actual:</strong> {kpiData.actual} aves</div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: kpiData.porcentaje > 5 ? "#dc2626" : "#059669" }}>
                    Tasa: {kpiData.porcentaje}%
                  </div>
                </div>

                <div style={{ width: "100%", height: "24px", background: "#d1d5db", borderRadius: "12px", overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${100 - kpiData.porcentaje}%`, background: "#10b981", height: "100%", display: "flex", alignItems: "center", paddingLeft: "10px", color: "white", fontSize: "12px", fontWeight: "bold" }}>Vivos</div>
                  <div style={{ width: `${kpiData.porcentaje}%`, background: "#ef4444", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "12px", fontWeight: "bold", overflow: "hidden" }}>{kpiData.porcentaje > 0 ? `${kpiData.porcentaje}%` : ''}</div>
                </div>
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px", textAlign: "right", marginBottom: "20px" }}>
                  * Una tasa superior al 5% se considera crítica.
                </p>

                {!mostrarCausas ? (
                  <div style={{ textAlign: "center", marginTop: "10px", borderTop: "1px dashed #e5e7eb", paddingTop: "20px", paddingBottom: "10px" }}>
                    <button className="mort-primaryBtn" onClick={handleAnalizarCausas}>
                      <PieChart size={18} />
                      Analizar Causas y Tendencias
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    
                    {/* AQUI AGREGAMOS EL ID PARA QUE HTML2CANVAS LO PUEDA FOTOGRAFIAR */}
                    <div id="grafico-tendencia-container" style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                        <h3 style={{ fontSize: "15px", color: "#1c1c1c" }}>Tendencia de Bajas en el Tiempo</h3>
                        <div className="mort-selectWrap" style={{ minWidth: "150px" }}>
                          <select className="mort-select" value={filtroTiempo} onChange={(e) => setFiltroTiempo(e.target.value)} style={{ padding: "8px 0", background: "transparent" }}>
                            <option value="dia">Agrupar por Día</option>
                            <option value="semana">Agrupar por Semana</option>
                            <option value="mes">Agrupar por Mes</option>
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                          <BarChart data={datosGraficoTendencia}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="fecha" tick={{fontSize: 12, fill: '#6b7280'}} />
                            <YAxis tick={{fontSize: 12, fill: '#6b7280'}} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="bajas" name="Aves muertas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                      <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                        <h3 style={{ fontSize: "15px", color: "#1c1c1c", marginBottom: "12px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px" }}>
                          Distribución por Causas
                        </h3>
                        {Object.keys(causasAgrupadas).length === 0 ? (
                          <p style={{ fontSize: "13px", color: "#6b7280" }}>No hay causas registradas.</p>
                        ) : (
                          Object.entries(causasAgrupadas).map(([causa, cantidad]) => (
                            <div key={causa} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "14px" }}>
                              <span style={{ color: "#4b5563" }}>{causa}</span>
                              <strong style={{ color: "#dc2626" }}>{cantidad} aves</strong>
                            </div>
                          ))
                        )}
                      </div>

                      <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e5e7eb", maxHeight: "250px", overflowY: "auto" }}>
                        <h3 style={{ fontSize: "15px", color: "#1c1c1c", marginBottom: "12px", borderBottom: "1px solid #e5e7eb", paddingBottom: "8px" }}>
                          Registro Detallado
                        </h3>
                        {rows.filter(r => String(r.lote) === String(filtroLote)).length === 0 ? (
                          <p style={{ fontSize: "13px", color: "#6b7280" }}>Sin historial reciente.</p>
                        ) : (
                          rows.filter(r => String(r.lote) === String(filtroLote)).map(r => (
                            <div key={r.id_muerte} style={{ padding: "8px 0", fontSize: "13px", borderBottom: "1px dashed #e5e7eb" }}>
                              <div style={{ fontWeight: "bold", color: "#dc2626" }}>-{r.cantidad} aves</div>
                              <div style={{ color: "#6b7280", marginTop: "2px" }}>
                                {formatFecha(r.fecha_hora)} • <span style={{ fontWeight: "500", color: "#374151" }}>{r.causa || "Sin causa"}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <div className="mort-card" style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                <BarChart2 size={48} color="#d1d5db" style={{ margin: "0 auto 16px" }} />
                <p style={{ fontSize: "15px" }}>Selecciona un lote en el menú superior para calcular la tasa de mortalidad y analizar las tendencias.</p>
              </div>
            )}
          </>
        )}

      </main>

      {/* Modal de Registro */}
      {showModal && (
        <Modal titulo="Registrar bajas" onClose={() => setShowModal(false)}>
          <form className="mort-form" onSubmit={handleRegistrar}>
            <div>
              <label className="mort-label">Lote Activo</label>
              <div className="mort-selectWrap">
                <select className="mort-select" name="id_lote" value={form.id_lote} onChange={handleFormChange} required>
                  <option value="">Seleccionar lote activo...</option>
                  {lotesActivosOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mort-label">Cantidad de Aves Muertas</label>
              <InputField type="number" name="cantidad" placeholder="Ej: 5" value={form.cantidad} onChange={handleFormChange} min="1" required />
            </div>
            <div>
              <label className="mort-label">Causa probable</label>
              <InputField type="text" name="causa" placeholder="Ej: Estrés calórico" value={form.causa} onChange={handleFormChange} />
            </div>
            {formError && <p className="mort-formError">{formError}</p>}
            <Button text="Guardar" loadingText="Guardando..." loading={saving} icon={<Plus size={18} />} />
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Mortandad;