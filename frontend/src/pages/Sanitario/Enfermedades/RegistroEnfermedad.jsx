import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, CheckCircle, XCircle, ChevronDown } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import Modal from "../../../components/Modal";
import InputField from "../../../components/InputField";
import ComboBox from "../../../components/ComboBox";
import Button from "../../../components/Button";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../../Inventario/Inventario.css";

const FORM_INICIAL = {
  lote: "",
  enfermedad_sintoma: "",
  cantidad_aves_afectadas: "",
  porcentaje_afectacion: "",
  observacion: "",
};

const ENFERMEDADES_COMUNES = [
  "Coccidiosis",
  "Coriza Infecciosa",
  "Newcastle",
  "Gumboro",
  "Marek",
  "Bronquitis Infecciosa",
  "Salmonelosis",
  "Diarrea",
  "Aerosaculitis",
  "Micoplasmosis",
];

const BADGE_ESTADO = {
  activo: { label: "Activo", color: "#dc3545", bg: "#f8d7da" },
  en_tratamiento: { label: "En tratamiento", color: "#fd7e14", bg: "#ffe5d0" },
  resuelto: { label: "Resuelto", color: "#198754", bg: "#d1e7dd" },
};

function RegistroEnfermedad() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [lotes, setLotes] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [errors, setErrors] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

  const [filtroLote, setFiltroLote] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!form.lote || !form.cantidad_aves_afectadas) {
      setForm((prev) => ({ ...prev, porcentaje_afectacion: "" }));
      return;
    }
    const loteSeleccionado = lotes.find((l) => String(l.id_lote) === String(form.lote));
    if (!loteSeleccionado || !loteSeleccionado.cantidad_actual) return;
    const porcentaje = (
      (Number(form.cantidad_aves_afectadas) / loteSeleccionado.cantidad_actual) * 100
    ).toFixed(2);
    setForm((prev) => ({ ...prev, porcentaje_afectacion: porcentaje }));
  }, [form.cantidad_aves_afectadas, form.lote]);

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [lotesRes, enfermedadesRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/sanitario/enfermedades/"),
      ]);
      setLotes(lotesRes.data || []);
      setRegistros(enfermedadesRes.data || []);
    } catch (e) {
      console.error("Error cargando datos", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const validar = () => {
    const errs = {};
    if (!form.lote) errs.lote = "Debe seleccionar un lote para continuar.";
    if (!form.enfermedad_sintoma.trim())
      errs.enfermedad_sintoma = "El campo de enfermedad es obligatorio.";
    const tieneCantidad = form.cantidad_aves_afectadas !== "";
    const tienePorcentaje = form.porcentaje_afectacion !== "";
    
    if (!tieneCantidad && !tienePorcentaje) {
      errs.cantidad_aves_afectadas = "Ingresa la cantidad de aves afectadas o el porcentaje.";
    }
    if (tieneCantidad && Number(form.cantidad_aves_afectadas) < 0) {
      errs.cantidad_aves_afectadas = "La cantidad no puede ser negativa.";
    }
    if (tienePorcentaje && (Number(form.porcentaje_afectacion) < 0 || Number(form.porcentaje_afectacion) > 100)) {
      errs.porcentaje_afectacion = "El porcentaje debe estar entre 0 y 100.";
    }
    return errs;
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const errs = validar();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setGuardando(true);

    const payload = {
      lote: Number(form.lote),
      enfermedad_sintoma: form.enfermedad_sintoma.trim(),
      ...(form.cantidad_aves_afectadas !== "" && {
        cantidad_aves_afectadas: Number(form.cantidad_aves_afectadas),
      }),
      ...(form.porcentaje_afectacion !== "" && {
        porcentaje_afectacion: Number(form.porcentaje_afectacion),
      }),
      ...(form.observacion.trim() && {
        observacion: form.observacion.trim(),
      }),
    };

    try {
      const res = await api.post("/sanitario/enfermedades/", payload);

      const alertasGeneradas = res?.data?.alertas_generadas || [];

      setShowModal(false);
      setForm(FORM_INICIAL);

      if (alertasGeneradas.length > 0) {
        mostrarToast(
          "error",
          `Registro guardado. Se generó ${alertasGeneradas.length} alerta sanitaria por riesgo.`
        );
      } else {
        mostrarToast("ok", "Registro sanitario guardado exitosamente");
      }

      fetchData({ silent: true });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.lote?.[0] ||
        err?.response?.data?.enfermedad_sintoma?.[0] ||
        "Error al guardar el registro.";
      mostrarToast("error", msg);
    } finally {
      setGuardando(false);
    }
  };

  const mostrarToast = (tipo, texto) => {
    setToast({ tipo, texto });
    setTimeout(() => setToast(null), 4000);
  };

  const registrosFiltrados = useMemo(() => {
    let list = registros;
    if (filtroLote) list = list.filter((r) => String(r.lote) === filtroLote);
    if (filtroEstado) list = list.filter((r) => r.estado_enfermedad === filtroEstado);
    return list;
  }, [registros, filtroLote, filtroEstado]);

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
          titulo="Registro de Enfermedades por Lote"
          subtitulo="Detección y seguimiento de problemas sanitarios"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Toast Notificación Flotante */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: isMobile ? "80px" : "32px",
              right: isMobile ? "16px" : "32px",
              zIndex: 9999,
              padding: "12px 20px",
              borderRadius: "8px",
              background: toast.tipo === "ok" ? "#d1fae5" : "#fee2e2",
              color: toast.tipo === "ok" ? "#065f46" : "#991b1b",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontWeight: 500,
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              animation: "fadeIn 0.3s ease-in-out",
            }}
          >
            {toast.tipo === "ok" ? <CheckCircle size={18} /> : <XCircle size={18} />} 
            {toast.texto}
          </div>
        )}

        {/* Header Actions */}
        <div 
          className="inv-header" 
          style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "12px", 
            justifyContent: "flex-end" 
          }}
        >
          <button
            className="inv-btn-secondary"
            style={{ 
              display: "flex", alignItems: "center", gap: "6px", 
              padding: "8px 16px", borderRadius: "6px", flex: isMobile ? "1" : "none", justifyContent: "center"
            }}
            onClick={() => fetchData()}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
          <button
            className="inv-btn-primary"
            style={{ 
              display: "flex", alignItems: "center", gap: "6px", 
              padding: "8px 16px", borderRadius: "6px", flex: isMobile ? "1" : "none", justifyContent: "center"
            }}
            onClick={() => {
              setForm(FORM_INICIAL);
              setErrors({});
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Registrar enfermedad
          </button>
        </div>

        {/* Panel de Filtros con Selects Nativos y Modernos */}
        <section 
          className="inv-panel" 
          style={{ 
            borderRadius: "8px", 
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)", 
            background: "#fff",
          }}
        >
          <div className="inv-panel-header" style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h3 className="inv-panel-title" style={{ fontSize: "15px", fontWeight: 600, color: "#374151" }}>
              Filtros
            </h3>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
              padding: "20px",
              alignItems: "flex-end",
            }}
          >
            {/* Selector de Lote */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#4b5563" }}>Lote</label>
              <div style={{ position: "relative" }}>
                <select
                  value={filtroLote}
                  onChange={(e) => setFiltroLote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#f9fafb",
                    color: "#111827",
                    fontSize: "14px",
                    appearance: "none", 
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="">Todos los lotes</option>
                  {lotes.map((l) => (
                    <option key={l.id_lote} value={String(l.id_lote)}>
                      Lote {l.id_lote} — {l.raza_tipo || "Sin raza"} ({l.estado})
                    </option>
                  ))}
                </select>
                <ChevronDown 
                  size={16} 
                  color="#6b7280" 
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} 
                />
              </div>
            </div>

            {/* Selector de Estado */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 500, color: "#4b5563" }}>Estado</label>
              <div style={{ position: "relative" }}>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 36px 10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    backgroundColor: "#f9fafb",
                    color: "#111827",
                    fontSize: "14px",
                    appearance: "none",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="">Todos los estados</option>
                  <option value="activo">Activo</option>
                  <option value="en_tratamiento">En tratamiento</option>
                  <option value="resuelto">Resuelto</option>
                </select>
                <ChevronDown 
                  size={16} 
                  color="#6b7280" 
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Tabla de Registros */}
        <section 
          className="inv-panel" 
          style={{ borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", background: "#fff" }}
        >
          <div className="inv-panel-header" style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="inv-panel-title" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "16px", color: "#111827" }}>
              <AlertTriangle size={18} color="#f59e0b" /> Enfermedades registradas
            </h3>
            <span style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500, background: "#f3f4f6", padding: "4px 10px", borderRadius: "20px" }}>
              {registrosFiltrados.length} {registrosFiltrados.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>
          
          <div className="inv-table-wrap" style={{ overflowX: "auto", width: "100%" }}>
            <table className="inv-table" style={{ width: "100%", minWidth: "800px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>Fecha</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>Lote</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>Enfermedad / Síntoma</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>Aves afect.</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>% Afect.</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>Estado</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "13px", color: "#6b7280" }}>Observación</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="inv-empty" style={{ padding: "30px", textAlign: "center", color: "#6b7280" }}>Cargando datos sanitarios...</td></tr>
                ) : registrosFiltrados.length === 0 ? (
                  <tr><td colSpan={7} className="inv-empty" style={{ padding: "30px", textAlign: "center", color: "#6b7280" }}>No hay registros de enfermedades que coincidan con los filtros.</td></tr>
                ) : (
                  registrosFiltrados.map((r) => {
                    const badge = BADGE_ESTADO[r.estado_enfermedad] || {
                      label: r.estado_enfermedad,
                      color: "#4b5563",
                      bg: "#f3f4f6"
                    };
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#4b5563" }}>
                          {r.fecha_registro ? new Date(r.fecha_registro).toLocaleString("es-BO") : "-"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827" }}>
                          <strong>Lote {r.lote}</strong>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#111827", fontWeight: 500 }}>
                          {r.enfermedad_sintoma || "-"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#4b5563" }}>
                          {r.cantidad_aves_afectadas ?? "-"}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "14px", color: "#4b5563" }}>
                          {r.porcentaje_afectacion != null ? `${r.porcentaje_afectacion}%` : "-"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              display: "inline-block",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6b7280", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.observacion}>
                          {r.observacion || "-"}
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

      {/* Modal */}
      {showModal && (
        <Modal
          titulo="Registrar problema sanitario"
          onClose={() => setShowModal(false)}
          width={isMobile ? "95%" : "550px"} 
        >
          <form className="inv-form" onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <ComboBox
                label="Lote afectado *"
                value={form.lote}
                onChange={(val) => {
                  setForm({ ...form, lote: val });
                  setErrors({ ...errors, lote: undefined });
                }}
                options={lotes
                  .filter((l) => l.estado !== "Finalizado")
                  .map((l) => ({
                    value: String(l.id_lote),
                    label: `Lote ${l.id_lote} — ${l.raza_tipo || "Sin raza"} (${l.estado}) — ${l.cantidad_actual} aves`,
                  }))}
                placeholder="Seleccionar lote activo..."
                required
              />
              {errors.lote && <span style={{ color: "#dc2626", fontSize: "12px" }}>{errors.lote}</span>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <ComboBox
                label="Enfermedad o síntoma detectado *"
                value={form.enfermedad_sintoma}
                onChange={(val) => {
                  setForm({ ...form, enfermedad_sintoma: val });
                  setErrors({ ...errors, enfermedad_sintoma: undefined });
                }}
                allowCustom
                options={ENFERMEDADES_COMUNES.map((e) => ({ value: e, label: e }))}
                placeholder="Escribe o selecciona (ej: Coccidiosis)"
                required
              />
              {errors.enfermedad_sintoma && <span style={{ color: "#dc2626", fontSize: "12px" }}>{errors.enfermedad_sintoma}</span>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <InputField
                  label="Aves afectadas (cantidad)"
                  type="number"
                  min="0"
                  placeholder="ej: 50"
                  value={form.cantidad_aves_afectadas}
                  onChange={(e) => {
                    setForm({ ...form, cantidad_aves_afectadas: e.target.value });
                    setErrors({ ...errors, cantidad_aves_afectadas: undefined });
                  }}
                  required={false}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <InputField
                  label="% de afectación (opcional)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="ej: 12.5"
                  value={form.porcentaje_afectacion}
                  onChange={(e) => {
                    setForm({ ...form, porcentaje_afectacion: e.target.value });
                    setErrors({ ...errors, porcentaje_afectacion: undefined });
                  }}
                  required={false}
                />
              </div>
            </div>
            {errors.cantidad_aves_afectadas && <span style={{ color: "#dc2626", fontSize: "12px", marginTop: "-12px" }}>{errors.cantidad_aves_afectadas}</span>}
            {errors.porcentaje_afectacion && <span style={{ color: "#dc2626", fontSize: "12px", marginTop: "-12px" }}>{errors.porcentaje_afectacion}</span>}

            <InputField
              label="Observaciones adicionales"
              placeholder="Detalles sobre los síntomas observados..."
              value={form.observacion}
              onChange={(e) => setForm({ ...form, observacion: e.target.value })}
              required={false}
            />

            <p style={{ fontSize: "12px", color: "#9ca3af", fontStyle: "italic" }}>
              * La fecha y hora se registran automáticamente al guardar.
            </p>

            <div style={{ marginTop: "8px" }}>
              <Button
                text={guardando ? "Guardando..." : "Guardar Registro Sanitario"}
                icon={<Plus size={18} />}
                disabled={guardando}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", fontWeight: 600 }}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default RegistroEnfermedad;