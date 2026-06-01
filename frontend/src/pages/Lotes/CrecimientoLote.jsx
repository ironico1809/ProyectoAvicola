import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Plus,
  Bird,
  Calendar,
  Scale,
  FileText,
  TrendingUp,
  TrendingDown,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import Button from "../../components/Button";
import ComboBox from "../../components/ComboBox";
import api from "../../api/axios";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Convierte un timestamp ISO a formato datetime-local (yyyy-MM-ddTHH:mm)
function isoToDatetimeLocal(isoString) {
  if (!isoString) return new Date().toISOString().substring(0, 16);
  const d = new Date(isoString);
  // Ajuste de zona local
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().substring(0, 16);
}

export default function CrecimientoLote() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const [lotes, setLotes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  // ─── Estado del Modal ──────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ─── Estado de Edición ────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [form, setForm] = useState({
    id_lote: "",
    fecha_registro: new Date().toISOString().substring(0, 16),
    peso_registrado: "",
    observacion: "",
  });

  const [filtroLote, setFiltroLote] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isNarrow = viewportWidth < 1000;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [loteRes, histRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/lotes/control-calidad/"),
      ]);
      setLotes(Array.isArray(loteRes.data) ? loteRes.data : []);
      setHistorial(Array.isArray(histRes.data) ? histRes.data : []);
    } catch (e) {
      console.error("Error al cargar datos", e);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      id_lote: "",
      fecha_registro: new Date().toISOString().substring(0, 16),
      peso_registrado: "",
      observacion: "",
    });
    setFormError("");
    setSuccess("");
  };

  // ── Abrir en modo CREAR ────────────────────────────────────────────────────
  const handleOpenModal = () => {
    resetForm();
    setIsEditing(false);
    setSelectedId(null);
    setIsModalOpen(true);
  };

  // ── Abrir en modo EDITAR ───────────────────────────────────────────────────
  const handleEditarClick = (h) => {
    setIsEditing(true);
    setSelectedId(h.id);
    setFormError("");
    setSuccess("");
    setForm({
      id_lote: String(h.id_lote),
      fecha_registro: isoToDatetimeLocal(h.fecha_registro),
      peso_registrado: String(h.peso_registrado ?? ""),
      observacion: String(h.observacion ?? ""),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setIsEditing(false);
    setSelectedId(null);
    setIsModalOpen(false);
  };

  const lotesActivos = useMemo(() => {
    return lotes.filter(
      (l) =>
        String(l.estado).toLowerCase() !== "finalizado" &&
        String(l.estado).toLowerCase() !== "inactivo"
    );
  }, [lotes]);

  const loteSeleccionadoInfo = useMemo(() => {
    const lid = toNumber(form.id_lote);
    if (!lid) return null;
    return lotes.find((l) => Number(l.id_lote) === lid) || null;
  }, [form.id_lote, lotes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError("");
    setSuccess("");
  };

  // ── SUBMIT (POST o PATCH según modo) ──────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess("");

    const id_lote = toNumber(form.id_lote);
    const peso_registrado = toNumber(form.peso_registrado);
    const fecha_registro = form.fecha_registro;
    const observacion = String(form.observacion || "").trim();

    if (!id_lote) return setFormError("Selecciona un lote activo.");
    if (!peso_registrado || peso_registrado <= 0)
      return setFormError("El peso registrado debe ser un número positivo.");
    if (!fecha_registro)
      return setFormError("Selecciona la fecha y hora de registro.");

    const payload = {
      id_lote,
      peso_registrado,
      fecha_registro: new Date(fecha_registro).toISOString(),
      observacion,
    };

    setSaving(true);
    try {
      if (isEditing) {
        // ── PATCH (actualizar) ──────────────────────────────────────────────
        await api.patch(`/lotes/control-calidad/${selectedId}/`, payload);
        setSuccess("Registro actualizado correctamente.");
      } else {
        // ── POST (crear) ────────────────────────────────────────────────────
        await api.post("/lotes/control-calidad/", payload);
        setSuccess("Pesaje y control de crecimiento registrado con éxito.");
      }

      fetchData();
      setTimeout(() => {
        setIsModalOpen(false);
        resetForm();
        setIsEditing(false);
        setSelectedId(null);
      }, 1200);
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.peso_registrado?.[0] ||
        err?.response?.data?.fecha_registro?.[0] ||
        err?.response?.data?.id_lote?.[0] ||
        (isEditing
          ? "Error al actualizar el registro."
          : "Error al registrar el control de crecimiento.");
      setFormError(String(detail));
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const handleEliminar = async (h) => {
    const confirmado = window.confirm(
      "¿Está seguro de que desea eliminar este registro de pesaje? Este cambio alterará las gráficas del lote."
    );
    if (!confirmado) return;

    try {
      await api.delete(`/lotes/control-calidad/${h.id}/`);
      // Actualización optimista: remover de la lista local
      setHistorial((prev) => prev.filter((r) => r.id !== h.id));
    } catch (err) {
      alert(
        err?.response?.data?.detail ||
        "No se pudo eliminar el registro. Intenta de nuevo."
      );
    }
  };

  const historialFiltrado = useMemo(() => {
    if (!filtroLote) return historial;
    return historial.filter((h) => String(h.id_lote) === String(filtroLote));
  }, [historial, filtroLote]);

  const getDiferenciaBadge = (porcentaje, estado) => {
    const p = parseFloat(porcentaje || 0);
    const isBajo = estado === "Bajo Peso";
    const isSobre = estado === "Sobrepeso";

    let color = "#16a34a";
    let bg = "#dcfce7";
    let icon = <TrendingUp size={14} style={{ marginRight: "4px" }} />;

    if (isBajo) {
      color = "#dc2626";
      bg = "#fee2e2";
      icon = <TrendingDown size={14} style={{ marginRight: "4px" }} />;
    } else if (isSobre) {
      color = "#d97706";
      bg = "#fef3c7";
      icon = <TrendingUp size={14} style={{ marginRight: "4px" }} />;
    }

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 10px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: "600",
          backgroundColor: bg,
          color: color,
        }}
      >
        {icon}
        {p > 0 ? `+${p.toFixed(2)}` : p.toFixed(2)}% ({estado})
      </span>
    );
  };

  return (
    <div style={layoutStyle}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        style={{
          ...mainContentStyle,
          marginLeft: isNarrow ? "0px" : sidebarOpen ? "240px" : "70px",
          padding: isNarrow ? "16px" : "32px",
          paddingTop: isNarrow ? "16px" : "32px",
        }}
      >
        <Topbar
          titulo="Control de Crecimiento"
          subtitulo="Audita el historial de pesajes y el desarrollo de tus lotes respecto a la curva de crecimiento estándar"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* ── Tabla de Historial Ancho Completo ──────────────────────────── */}
        <div style={{ marginTop: "24px" }}>
          <div style={containerStyle}>
            {/* Encabezado con botón de acción */}
            <div style={tableHeaderStyle}>
              <div>
                <h3 style={cardTitleStyle}>Historial de Controles de Calidad</h3>
                <p style={cardSubtitleStyle}>
                  Registros históricos y desvíos calculados por el sistema.
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                {/* Filtro por lote */}
                <div style={selectGroupStyle}>
                  <select
                    value={filtroLote}
                    onChange={(e) => setFiltroLote(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Todos los lotes</option>
                    {lotes.map((l) => (
                      <option key={l.id_lote} value={l.id_lote}>
                        Lote #{l.id_lote} ({l.raza_tipo || "Sin Raza"})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} color="#9ca3af" />
                </div>

                {/* Botón premium para abrir modal modo CREAR */}
                <button onClick={handleOpenModal} style={btnRegistrarStyle}>
                  <Plus size={18} style={{ marginRight: "6px" }} />
                  Registrar Control
                </button>
              </div>
            </div>

            <div style={tableWrapperStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Lote</th>
                    <th style={thStyle}>Edad (Días)</th>
                    <th style={thStyle}>Peso Registrado</th>
                    <th style={thStyle}>Peso Estándar</th>
                    <th style={thStyle}>Diferencia y Estado</th>
                    <th style={thStyle}>Observación</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={emptyTdStyle}>
                        Cargando historial de crecimiento...
                      </td>
                    </tr>
                  ) : historialFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={emptyTdStyle}>
                        No hay registros de crecimiento en el historial.
                      </td>
                    </tr>
                  ) : (
                    historialFiltrado.map((h) => {
                      const formattedDate = new Date(h.fecha_registro).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <tr key={h.id} style={trStyle}>
                          <td style={tdStyle}>
                            <strong>{formattedDate}</strong>
                          </td>
                          <td style={tdGrayStyle}>Lote #{h.id_lote}</td>
                          <td style={tdStyle}>{h.edad_dias} días</td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: "700", color: "#111827" }}>
                              {parseFloat(h.peso_registrado).toFixed(3)} kg
                            </span>
                          </td>
                          <td style={tdStyle}>
                            {parseFloat(h.peso_estandar) > 0 ? (
                              `${parseFloat(h.peso_estandar).toFixed(3)} kg`
                            ) : (
                              <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Sin Std</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {getDiferenciaBadge(h.porcentaje_diferencia, h.estado_desarrollo)}
                          </td>
                          <td style={tdGrayStyle}>{h.observacion || "—"}</td>

                          {/* ── Columna Acciones ── */}
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <div style={actionGroupStyle}>
                              {/* Botón Editar */}
                              <button
                                onClick={() => handleEditarClick(h)}
                                style={btnEditStyle}
                                title="Editar registro"
                              >
                                <Pencil size={15} />
                              </button>
                              {/* Botón Eliminar */}
                              <button
                                onClick={() => handleEliminar(h)}
                                style={btnDeleteStyle}
                                title="Eliminar registro"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div style={tableFooterStyle}>
              <span style={footerTextStyle}>
                Mostrando {loading ? "—" : historialFiltrado.length} registros
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Modal del Formulario (CREAR / EDITAR) ───────────────────────────── */}
      {isModalOpen && (
        <div style={modalOverlayStyle} onClick={handleCloseModal}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            {/* Cabecera del modal con título dinámico */}
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={cardTitleStyle}>
                  {isEditing ? "Editar Registro de Crecimiento" : "Nuevo Registro de Pesaje"}
                </h3>
                <p style={cardSubtitleStyle}>
                  {isEditing
                    ? "Modifica los datos del pesaje seleccionado."
                    : "Ingresa los datos físicos de pesaje biológico de las aves."}
                </p>
              </div>
              <button onClick={handleCloseModal} style={closeButtonStyle} title="Cerrar">
                <X size={20} color="#64748b" />
              </button>
            </div>

            {/* Formulario unificado */}
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}
            >
              <ComboBox
                label="Lote Activo"
                value={form.id_lote}
                onChange={(val) => setForm({ ...form, id_lote: val })}
                options={lotesActivos.map((l) => ({
                  value: String(l.id_lote),
                  label: `Lote #${l.id_lote} - ${l.raza_tipo || "Raza no especificada"} (Galpón ${l.galpon_id ?? "-"})`,
                }))}
                placeholder="Buscar lote activo..."
                icon={<Bird size={16} color="#78350f" />}
                required
              />

              {loteSeleccionadoInfo && (
                <div style={loteDetailBoxStyle}>
                  <div style={loteDetailRowStyle}>
                    <span style={loteDetailLabelStyle}>Raza:</span>
                    <span style={loteDetailValueStyle}>{loteSeleccionadoInfo.raza_tipo || "-"}</span>
                  </div>
                  <div style={loteDetailRowStyle}>
                    <span style={loteDetailLabelStyle}>Fecha Ingreso:</span>
                    <span style={loteDetailValueStyle}>{loteSeleccionadoInfo.fecha_ingreso}</span>
                  </div>
                  <div style={loteDetailRowStyle}>
                    <span style={loteDetailLabelStyle}>Aves Iniciales:</span>
                    <span style={loteDetailValueStyle}>{loteSeleccionadoInfo.cantidad_inicial}</span>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={labelStyle}>Fecha y Hora de Pesaje</label>
                <div style={inputIconWrapperStyle}>
                  <Calendar size={18} color="#9ca3af" />
                  <input
                    name="fecha_registro"
                    type="datetime-local"
                    value={form.fecha_registro}
                    onChange={handleChange}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={labelStyle}>Peso Promedio Registrado (Kg)</label>
                <div style={inputIconWrapperStyle}>
                  <Scale size={18} color="#9ca3af" />
                  <input
                    name="peso_registrado"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="Ej: 1.450"
                    value={form.peso_registrado}
                    onChange={handleChange}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={labelStyle}>Observación / Notas</label>
                <div style={inputIconWrapperStyle}>
                  <FileText
                    size={18}
                    color="#9ca3af"
                    style={{ alignSelf: "flex-start", marginTop: "12px" }}
                  />
                  <textarea
                    name="observacion"
                    placeholder="Ej: Aves en perfecto estado sanitario..."
                    value={form.observacion}
                    onChange={handleChange}
                    style={{ ...inputStyle, minHeight: "80px", resize: "vertical", padding: "12px 0" }}
                  />
                </div>
              </div>

              {formError && <p style={messageErrorStyle}>⚠️ {formError}</p>}
              {success && <p style={messageSuccessStyle}>✓ {success}</p>}

              <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                <button type="button" onClick={handleCloseModal} style={btnCancelarStyle}>
                  Cancelar
                </button>
                <Button
                  text={isEditing ? "Guardar Cambios" : "Registrar Crecimiento"}
                  loadingText={isEditing ? "Guardando..." : "Registrando..."}
                  loading={saving}
                  icon={<Plus size={18} />}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estilos Premium ──────────────────────────────────────────────────────────

const layoutStyle = {
  display: "flex",
  minHeight: "100vh",
  backgroundColor: "#f8fafc",
};

const mainContentStyle = {
  flex: 1,
  padding: "clamp(16px, 3vw, 32px)",
  transition: "margin-left 0.3s",
  width: "100%",
  boxSizing: "border-box",
};

const cardTitleStyle = {
  fontSize: "18px",
  fontWeight: "700",
  color: "#1e293b",
  margin: 0,
};

const cardSubtitleStyle = {
  fontSize: "13px",
  color: "#64748b",
  margin: "4px 0 0 0",
};

const labelStyle = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#475569",
  marginLeft: "4px",
};

const inputIconWrapperStyle = {
  display: "flex",
  alignItems: "center",
  background: "#f8fafc",
  border: "1.5px solid #e2e8f0",
  borderRadius: "12px",
  padding: "0 16px",
  gap: "10px",
  boxSizing: "border-box",
  width: "100%",
};

const inputStyle = {
  flex: 1,
  border: "none",
  background: "transparent",
  padding: "14px 0",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  fontFamily: "inherit",
  minWidth: 0,
};

const loteDetailBoxStyle = {
  backgroundColor: "#fffbeb",
  border: "1px solid #fef3c7",
  borderRadius: "12px",
  padding: "12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const loteDetailRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "12px",
};

const loteDetailLabelStyle = {
  color: "#b45309",
  fontWeight: "500",
};

const loteDetailValueStyle = {
  color: "#78350f",
  fontWeight: "600",
};

const messageErrorStyle = {
  color: "#dc2626",
  background: "#fee2e2",
  padding: "10px 14px",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: "500",
  margin: 0,
};

const messageSuccessStyle = {
  color: "#16a34a",
  background: "#dcfce7",
  padding: "10px 14px",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: "500",
  margin: 0,
};

const containerStyle = {
  background: "white",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
  border: "1px solid #f1f5f9",
  boxSizing: "border-box",
};

const tableHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const btnRegistrarStyle = {
  display: "inline-flex",
  alignItems: "center",
  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "11px 20px",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
};

const selectGroupStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#f8fafc",
  border: "1.5px solid #e2e8f0",
  borderRadius: "12px",
  padding: "0 12px",
  gap: "8px",
  minWidth: "180px",
  height: "44px",
  boxSizing: "border-box",
  position: "relative",
};

const selectStyle = {
  border: "none",
  background: "transparent",
  outline: "none",
  fontSize: "13px",
  color: "#334155",
  width: "100%",
  cursor: "pointer",
  fontWeight: "600",
  appearance: "none",
};

const tableWrapperStyle = {
  overflowX: "auto",
  border: "1px solid #f1f5f9",
  borderRadius: "12px",
  boxSizing: "border-box",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: "14px",
};

const theadRowStyle = {
  backgroundColor: "#f8fafc",
  borderBottom: "1px solid #f1f5f9",
};

const thStyle = {
  padding: "14px 18px",
  fontWeight: "600",
  color: "#475569",
  fontSize: "13px",
};

const trStyle = {
  borderBottom: "1px solid #f1f5f9",
  transition: "background-color 0.2s",
};

const tdStyle = {
  padding: "16px 18px",
  color: "#1e293b",
};

const tdGrayStyle = {
  padding: "16px 18px",
  color: "#64748b",
};

const emptyTdStyle = {
  padding: "36px",
  textAlign: "center",
  color: "#64748b",
  fontSize: "14px",
};

const tableFooterStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "16px",
  flexWrap: "wrap",
  gap: "12px",
};

const footerTextStyle = {
  fontSize: "13px",
  color: "#64748b",
};

// ─── Estilos de Acciones de Fila ─────────────────────────────────────────────

const actionGroupStyle = {
  display: "inline-flex",
  gap: "8px",
  alignItems: "center",
};

const btnEditStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  border: "1.5px solid #e2e8f0",
  background: "#f0f9ff",
  color: "#3b82f6",
  cursor: "pointer",
  transition: "all 0.2s",
};

const btnDeleteStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  border: "1.5px solid #fecaca",
  background: "#fff1f2",
  color: "#ef4444",
  cursor: "pointer",
  transition: "all 0.2s",
};

// ─── Estilos del Modal ────────────────────────────────────────────────────────

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "rgba(0, 0, 0, 0.50)",
  backdropFilter: "blur(4px)",
  padding: "16px",
};

const modalContentStyle = {
  backgroundColor: "white",
  borderRadius: "24px",
  padding: "28px",
  width: "100%",
  maxWidth: "500px",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.20)",
  border: "1px solid #f1f5f9",
  position: "relative",
};

const modalHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
};

const closeButtonStyle = {
  background: "#f1f5f9",
  border: "none",
  borderRadius: "10px",
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.2s",
};

const btnCancelarStyle = {
  flex: 1,
  background: "#f1f5f9",
  color: "#64748b",
  border: "none",
  borderRadius: "12px",
  padding: "12px 20px",
  fontWeight: "600",
  fontSize: "14px",
  cursor: "pointer",
  transition: "background 0.2s",
};
