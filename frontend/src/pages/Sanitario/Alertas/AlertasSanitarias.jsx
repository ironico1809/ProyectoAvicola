import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../../Inventario/Inventario.css";

const ESTADO_BADGE = {
  Pendiente: { label: "Pendiente", bg: "#fee2e2", color: "#991b1b" },
  Atendida: { label: "Atendida", bg: "#fef3c7", color: "#92400e" },
  Resuelta: { label: "Resuelta", bg: "#dcfce7", color: "#166534" },
};

const NIVEL_BADGE = {
  Medio: { label: "Medio", bg: "#fef3c7", color: "#92400e" },
  Alto: { label: "Alto", bg: "#fed7aa", color: "#9a3412" },
  Critico: { label: "Crítico", bg: "#fee2e2", color: "#991b1b" },
  Crítico: { label: "Crítico", bg: "#fee2e2", color: "#991b1b" },
};

const TIPO_ALERTA = {
  Afectacion: "Riesgo Sanitario Alto",
  Mortandad: "Complicación Post-Diagnóstico",
  StockMedicamento: "Bajo stock de medicamento crítico",
};

function AlertasSanitarias() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [alertas, setAlertas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accionId, setAccionId] = useState(null);
  const [toast, setToast] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroLote, setFiltroLote] = useState("");

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData({ silent: true }), 10000);
    return () => clearInterval(timer);
  }, []);

  const mostrarToast = (tipo, texto) => {
    setToast({ tipo, texto });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const alertasRes = await api.get("/sanitario/alertas/");
      setAlertas(Array.isArray(alertasRes.data) ? alertasRes.data : []);

      try {
        const lotesRes = await api.get("/lotes/");
        setLotes(Array.isArray(lotesRes.data) ? lotesRes.data : []);
      } catch (lotesError) {
        console.warn("No se pudieron cargar los lotes para el filtro", lotesError);
        setLotes([]);
      }
    } catch (error) {
      console.error("Error cargando alertas sanitarias", error);
      const status = error?.response?.status;
      const url = error?.config?.url;
      mostrarToast(
        "error",
        `No se pudieron cargar las alertas sanitarias. Error ${status || ""} en ${url || "API"}.`
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const cambiarEstado = async (alerta, nuevoEstado) => {
    setAccionId(alerta.id);

    try {
      const res = await api.patch(`/sanitario/alertas/${alerta.id}/`, {
        estado: nuevoEstado,
      });

      setAlertas((prev) => prev.map((item) => (item.id === alerta.id ? res.data : item)));

      mostrarToast("ok", `La alerta fue marcada como ${nuevoEstado}.`);
    } catch (error) {
      console.error("Error actualizando alerta sanitaria", error);
      mostrarToast("error", "No se pudo actualizar el estado de la alerta.");
    } finally {
      setAccionId(null);
    }
  };

  const alertasFiltradas = useMemo(() => {
    let lista = alertas;

    if (filtroEstado) lista = lista.filter((a) => a.estado === filtroEstado);
    if (filtroNivel) lista = lista.filter((a) => a.nivel === filtroNivel);
    if (filtroTipo) lista = lista.filter((a) => a.tipo_alerta === filtroTipo);
    if (filtroLote) lista = lista.filter((a) => String(a.lote) === String(filtroLote));

    return lista;
  }, [alertas, filtroEstado, filtroNivel, filtroTipo, filtroLote]);

  const estadisticas = useMemo(() => {
    return {
      total: alertas.length,
      pendientes: alertas.filter((a) => a.estado === "Pendiente").length,
      atendidas: alertas.filter((a) => a.estado === "Atendida").length,
      resueltas: alertas.filter((a) => a.estado === "Resuelta").length,
      criticas: alertas.filter((a) => a.nivel === "Critico" || a.nivel === "Crítico").length,
      stock: alertas.filter((a) => a.tipo_alerta === "StockMedicamento").length,
    };
  }, [alertas]);

  const limpiarFiltros = () => {
    setFiltroEstado("");
    setFiltroNivel("");
    setFiltroTipo("");
    setFiltroLote("");
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    try {
      return new Date(fecha).toLocaleString("es-BO", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return fecha;
    }
  };

  const obtenerBadge = (mapa, valor, fallbackColor = "#475569") => {
    return mapa[valor] || { label: valor || "-", bg: "#f1f5f9", color: fallbackColor };
  };

  const obtenerReferencia = (alerta) => {
    if (alerta.tipo_alerta === "StockMedicamento") {
      return alerta.insumo_info?.nombre || `Insumo ${alerta.insumo || "-"}`;
    }

    if (alerta.lote_info?.id_lote) return `Lote ${alerta.lote_info.id_lote}`;
    return alerta.lote ? `Lote ${alerta.lote}` : "Sin lote";
  };

  const obtenerDatoDetectado = (alerta) => {
    if (alerta.tipo_alerta === "StockMedicamento") {
      const insumo = alerta.insumo_info;
      if (!insumo) return "Stock crítico";
      return `${insumo.stock_actual} / mínimo ${insumo.stock_minimo} ${insumo.unidad_medida}`;
    }

    if (alerta.porcentaje_detectado !== null && alerta.porcentaje_detectado !== undefined) {
      return `${Number(alerta.porcentaje_detectado).toFixed(2)}%`;
    }

    return "-";
  };

  return (
    <div className="inv-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        className="inv-main"
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px",
          padding: isMobile ? "16px" : "32px",
          paddingTop: isMobile ? "80px" : "32px",
          transition: "margin-left 0.3s ease",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <Topbar
          titulo="Alertas Sanitarias"
          subtitulo="CU17: riesgos por enfermedad, mortandad y stock crítico"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {toast && (
          <div
            style={{
              position: "fixed",
              top: isMobile ? "80px" : "32px",
              right: isMobile ? "16px" : "32px",
              zIndex: 9999,
              padding: "12px 20px",
              borderRadius: "10px",
              background: toast.tipo === "ok" ? "#d1fae5" : "#fee2e2",
              color: toast.tipo === "ok" ? "#065f46" : "#991b1b",
              boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
              fontWeight: 600,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {toast.tipo === "ok" ? <CheckCircle size={18} /> : <XCircle size={18} />}
            {toast.texto}
          </div>
        )}

        <section className="inv-stats-grid">
          <div className="inv-stat-card">
            <div className="inv-stat-top">
              <div className="inv-stat-icon" style={{ background: "#fef3c7", color: "#92400e" }}>
                <ShieldAlert size={24} />
              </div>
              <span className="inv-stat-badge" style={{ background: "#fef3c7", color: "#92400e" }}>
                Total
              </span>
            </div>
            <div className="inv-stat-value">{estadisticas.total}</div>
            <div className="inv-stat-label">Alertas registradas</div>
          </div>

          <div className="inv-stat-card">
            <div className="inv-stat-top">
              <div className="inv-stat-icon" style={{ background: "#fee2e2", color: "#991b1b" }}>
                <AlertTriangle size={24} />
              </div>
              <span className="inv-stat-badge" style={{ background: "#fee2e2", color: "#991b1b" }}>
                Pendientes
              </span>
            </div>
            <div className="inv-stat-value">{estadisticas.pendientes}</div>
            <div className="inv-stat-label">Requieren atención</div>
          </div>

          <div className="inv-stat-card">
            <div className="inv-stat-top">
              <div className="inv-stat-icon" style={{ background: "#fed7aa", color: "#9a3412" }}>
                <ShieldAlert size={24} />
              </div>
              <span className="inv-stat-badge" style={{ background: "#fed7aa", color: "#9a3412" }}>
                Críticas
              </span>
            </div>
            <div className="inv-stat-value">{estadisticas.criticas}</div>
            <div className="inv-stat-label">Nivel crítico sanitario</div>
          </div>

          <div className="inv-stat-card">
            <div className="inv-stat-top">
              <div className="inv-stat-icon" style={{ background: "#dcfce7", color: "#166534" }}>
                <ClipboardCheck size={24} />
              </div>
              <span className="inv-stat-badge" style={{ background: "#dcfce7", color: "#166534" }}>
                Resueltas
              </span>
            </div>
            <div className="inv-stat-value">{estadisticas.resueltas}</div>
            <div className="inv-stat-label">Alertas finalizadas</div>
          </div>
        </section>

        {estadisticas.pendientes > 0 && (
          <section className="inv-alerts-section">
            <div className="inv-alert-banner">
              <AlertTriangle className="inv-alert-icon" size={22} />
              <div>
                <strong>Existen alertas sanitarias pendientes</strong>
                <span>
                  Revisa enfermedades, mortandad y medicamentos críticos. Marca la alerta como atendida o resuelta.
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <ShieldAlert size={18} color="#f59e0b" />
              Filtros de búsqueda
            </h3>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button className="inv-btn-ghost" type="button" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>

              <button className="inv-btn-primary" type="button" onClick={() => fetchData()}>
                <RefreshCw size={16} />
                Actualizar
              </button>
            </div>
          </div>

          <div className="inv-filters">
            <div className="inv-filter-group">
              <label>Estado</label>
              <select className="inv-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Atendida">Atendida</option>
                <option value="Resuelta">Resuelta</option>
              </select>
            </div>

            <div className="inv-filter-group">
              <label>Nivel</label>
              <select className="inv-select" value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)}>
                <option value="">Todos</option>
                <option value="Medio">Medio</option>
                <option value="Alto">Alto</option>
                <option value="Critico">Crítico</option>
              </select>
            </div>

            <div className="inv-filter-group">
              <label>Tipo de alerta</label>
              <select className="inv-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                <option value="">Todas</option>
                <option value="Afectacion">Riesgo Sanitario Alto</option>
                <option value="Mortandad">Complicación Post-Diagnóstico</option>
                <option value="StockMedicamento">Bajo stock medicamento</option>
              </select>
            </div>

            <div className="inv-filter-group">
              <label>Lote</label>
              <select className="inv-select" value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)}>
                <option value="">Todos los lotes</option>
                {lotes.map((lote) => (
                  <option key={lote.id_lote} value={String(lote.id_lote)}>
                    Lote {lote.id_lote} — {lote.raza_tipo || "Sin raza"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <AlertTriangle size={18} color="#f59e0b" />
              Alertas generadas por riesgo sanitario
            </h3>

            <span
              style={{
                fontSize: "13px",
                color: "#64748b",
                background: "#f1f5f9",
                padding: "6px 12px",
                borderRadius: "20px",
                fontWeight: 600,
              }}
            >
              {alertasFiltradas.length} {alertasFiltradas.length === 1 ? "alerta" : "alertas"}
            </span>
          </div>

          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th>Nivel</th>
                  <th>Estado</th>
                  <th>Enfermedad/Insumo</th>
                  <th>Dato detectado</th>
                  <th>Causa</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="inv-empty">Cargando alertas sanitarias...</td>
                  </tr>
                ) : alertasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="inv-empty">No hay alertas sanitarias con los filtros seleccionados.</td>
                  </tr>
                ) : (
                  alertasFiltradas.map((alerta) => {
                    const estadoBadge = obtenerBadge(ESTADO_BADGE, alerta.estado);
                    const nivelBadge = obtenerBadge(NIVEL_BADGE, alerta.nivel);

                    return (
                      <tr key={alerta.id}>
                        <td>{formatearFecha(alerta.fecha_hora)}</td>

                        <td>
                          <strong>{obtenerReferencia(alerta)}</strong>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {alerta.lote_info?.cantidad_actual
                              ? `${alerta.lote_info.cantidad_actual} aves actuales`
                              : alerta.insumo_info?.tipo || "Sin lote"}
                          </div>
                        </td>

                        <td>{TIPO_ALERTA[alerta.tipo_alerta] || alerta.tipo_alerta || "-"}</td>

                        <td>
                          <span className="inv-badge" style={{ background: nivelBadge.bg, color: nivelBadge.color }}>
                            {nivelBadge.label}
                          </span>
                        </td>

                        <td>
                          <span className="inv-badge" style={{ background: estadoBadge.bg, color: estadoBadge.color }}>
                            {estadoBadge.label}
                          </span>
                        </td>

                        <td>
                          {alerta.tipo_alerta === "StockMedicamento"
                            ? alerta.insumo_info?.nombre || "-"
                            : alerta.enfermedad_info?.enfermedad_sintoma || "-"}
                        </td>

                        <td>
                          <strong>{obtenerDatoDetectado(alerta)}</strong>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Cantidad: {alerta.cantidad_detectada ?? "-"}
                          </div>
                        </td>

                        <td style={{ maxWidth: "260px", whiteSpace: "normal", lineHeight: "1.4" }}>
                          <strong>{alerta.causa || "-"}</strong>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>{alerta.mensaje || "-"}</div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {alerta.estado !== "Atendida" && (
                              <button
                                className="inv-btn-ghost inv-btn-sm"
                                type="button"
                                disabled={accionId === alerta.id}
                                onClick={() => cambiarEstado(alerta, "Atendida")}
                              >
                                Atender
                              </button>
                            )}

                            {alerta.estado !== "Resuelta" && (
                              <button
                                className="inv-btn-success inv-btn-sm"
                                type="button"
                                disabled={accionId === alerta.id}
                                onClick={() => cambiarEstado(alerta, "Resuelta")}
                              >
                                Resolver
                              </button>
                            )}

                            {alerta.estado === "Resuelta" && (
                              <button
                                className="inv-btn-ghost inv-btn-sm"
                                type="button"
                                disabled={accionId === alerta.id}
                                onClick={() => cambiarEstado(alerta, "Pendiente")}
                              >
                                Reabrir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AlertasSanitarias;
