import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import Modal from "../../components/Modal";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import ComboBox from "../../components/ComboBox";
import MapPicker from "../../components/MapPicker";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

import "./Galpones.css";

// Fuera del componente para que la referencia sea estable entre renders
const ESTADO_OPTIONS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const FORM_INICIAL = {
  nombre: "",
  capacidad: "",
  descripcion: "",
  estado: "activo",
  latitud: null,
  longitud: null,
  ubicacion_nombre: "",
};

// ─── Formulario como componente propio ───────────────────────────────────────
// Esto evita el problema de closures stale que ocurría cuando formFields era
// una variable JSX calculada en el cuerpo del componente padre.
function GalponForm({ form, setForm, onSubmit, saving, formError, esEdicion }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <InputField
        name="nombre"
        placeholder="Nombre del galpón"
        onChange={handleChange}
        value={form.nombre}
      />
      <InputField
        name="capacidad"
        type="number"
        placeholder="Capacidad (aves)"
        onChange={handleChange}
        value={form.capacidad}
      />
      <InputField
        name="descripcion"
        placeholder="Descripción (opcional)"
        onChange={handleChange}
        value={form.descripcion}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label style={{ fontSize: "13px", fontWeight: "600", color: "#4b5563", marginLeft: "4px" }}>
          Estado
        </label>
        <div style={{ display: "flex", gap: "10px" }}>
          {ESTADO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, estado: opt.value }))}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: "12px",
                border: form.estado === opt.value ? "2px solid #2563eb" : "1.5px solid #e5e7eb",
                background: form.estado === opt.value
                  ? (opt.value === "activo" ? "#dcfce7" : "#fee2e2")
                  : "#f9fafb",
                color: form.estado === opt.value
                  ? (opt.value === "activo" ? "#16a34a" : "#dc2626")
                  : "#6b7280",
                fontWeight: form.estado === opt.value ? "700" : "500",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "6px" }}>
          Ubicación del galpón (opcional)
        </label>
        <MapPicker
          lat={form.latitud}
          lon={form.longitud}
          ubicacion={form.ubicacion_nombre}
          onChange={({ lat, lon, ubicacion }) =>
            setForm((prev) => ({ ...prev, latitud: lat, longitud: lon, ubicacion_nombre: ubicacion }))
          }
        />
      </div>

      {formError && <p className="galp-dangerText">⚠️ {formError}</p>}
      <Button
        text={esEdicion ? "Guardar Cambios" : "Crear Galpón"}
        loadingText="Guardando..."
        loading={saving}
        icon={<Plus size={18} />}
      />
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
function Galpones() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [galpones, setGalpones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showVerModal, setShowVerModal] = useState(false);
  const [galponSeleccionado, setGalponSeleccionado] = useState(null);
  const [form, setForm] = useState({ ...FORM_INICIAL });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const extraerError = (err) => {
    const data = err?.response?.data;
    if (!data) return "Error de conexión. Intente nuevamente.";
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    const primerCampo = Object.keys(data)[0];
    const valor = data[primerCampo];
    const mensaje = Array.isArray(valor) ? valor[0] : valor;
    return `${primerCampo}: ${mensaje}`;
  };

  useEffect(() => {
    fetchGalpones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGalpones = async () => {
    try {
      const res = await api.get("/galpones/");
      setGalpones(res.data);
    } catch {
      console.error("Error al cargar galpones");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ ...FORM_INICIAL });
    setFormError("");
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    setFormError("");

    const capacidadNum = parseInt(form.capacidad, 10);
    if (!form.nombre.trim()) { setFormError("El nombre del galpón es obligatorio."); return; }
    if (!form.capacidad || isNaN(capacidadNum) || capacidadNum <= 0) { setFormError("La capacidad debe ser un número mayor a 0."); return; }

    setSaving(true);
    try {
      await api.post("/galpones/", {
        nombre: form.nombre.trim(),
        capacidad: capacidadNum,
        descripcion: form.descripcion || null,
        estado: form.estado,
        latitud: form.latitud ?? null,
        longitud: form.longitud ?? null,
        ubicacion_nombre: form.ubicacion_nombre || null,
      });
      setShowModal(false);
      resetForm();
      fetchGalpones();
    } catch (err) {
      setFormError(extraerError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEditarClick = (g) => {
    setGalponSeleccionado(g);
    setForm({
      nombre: g.nombre,
      capacidad: String(g.capacidad),
      descripcion: g.descripcion || "",
      estado: g.estado,
      latitud: g.latitud ? parseFloat(g.latitud) : null,
      longitud: g.longitud ? parseFloat(g.longitud) : null,
      ubicacion_nombre: g.ubicacion_nombre || "",
    });
    setFormError("");
    setShowEditModal(true);
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    setFormError("");

    const capacidadNum = parseInt(form.capacidad, 10);
    if (!form.nombre.trim()) { setFormError("El nombre del galpón es obligatorio."); return; }
    if (!form.capacidad || isNaN(capacidadNum) || capacidadNum <= 0) { setFormError("La capacidad debe ser un número mayor a 0."); return; }

    setSaving(true);
    try {
      await api.put(`/galpones/${galponSeleccionado.id}/`, {
        nombre: form.nombre.trim(),
        capacidad: capacidadNum,
        descripcion: form.descripcion || null,
        estado: form.estado,
        latitud: form.latitud ?? null,
        longitud: form.longitud ?? null,
        ubicacion_nombre: form.ubicacion_nombre || null,
      });
      setShowEditModal(false);
      fetchGalpones();
    } catch (err) {
      setFormError(extraerError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    setSaving(true);
    try {
      await api.delete(`/galpones/${galponSeleccionado.id}/`);
      setShowDeleteModal(false);
      fetchGalpones();
    } finally {
      setSaving(false);
    }
  };

  const galponesFiltrados = galpones.filter(
    (g) =>
      g.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      (g.descripcion || "").toLowerCase().includes(filtro.toLowerCase()),
  );

  const estadoBadge = (estado) => ({
    background: estado === "activo" ? "#dcfce7" : "#fee2e2",
    color: estado === "activo" ? "#16a34a" : "#dc2626",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  });

  return (
    <div className="galp-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        className="galp-main"
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px",
          padding: isMobile ? "16px" : "32px",
          paddingTop: isMobile ? "16px" : "32px",
          transition: "margin-left 0.3s ease",
          flex: 1,
        }}
      >
        <Topbar
          titulo="Gestión de Galpones"
          subtitulo="Administrar los galpones de la granja"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="galp-header" style={{ marginBottom: "20px" }}>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="galp-addBtn"
          >
            <Plus size={18} /> Nuevo Galpón
          </button>
        </div>

        <div className="galp-card">
          <div className="galp-search">
            <Search size={18} color="#9ca3af" />
            <input
              type="text"
              placeholder="Buscar galpón..."
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>

          <div className="galp-tableWrap">
            <table className="galp-table">
              <thead>
                <tr style={theadRowStyle}>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Capacidad</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="galp-muted" style={{ padding: "24px" }}>Cargando...</td></tr>
                ) : galponesFiltrados.length === 0 ? (
                  <tr><td colSpan={6} className="galp-muted" style={{ padding: "24px" }}>No hay galpones registrados.</td></tr>
                ) : (
                  galponesFiltrados.map((g) => (
                    <tr key={g.id}>
                      <td><strong>{g.nombre}</strong></td>
                      <td className="galp-muted">{g.descripcion || "Sin descripción"}</td>
                      <td>{g.capacidad} aves</td>
                      <td>
                        {g.ubicacion_nombre ? (
                          <span title={`Lat: ${g.latitud}, Lon: ${g.longitud}`} style={{ color: "#3b82f6", fontSize: "13px" }}>
                            📍 {g.ubicacion_nombre}
                          </span>
                        ) : (
                          <span className="galp-muted" style={{ fontSize: "13px" }}>No registrada</span>
                        )}
                      </td>
                      <td><span style={estadoBadge(g.estado)}>{g.estado}</span></td>
                      <td>
                        <div className="btn-action-group">
                          <button
                            onClick={() => { setGalponSeleccionado(g); setShowVerModal(true); }}
                            className="btn-action btn-action--view"
                            title="Ver"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEditarClick(g)}
                            className="btn-action btn-action--edit"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => { setGalponSeleccionado(g); setShowDeleteModal(true); }}
                            className="btn-action btn-action--delete"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="galp-footer">
            <span className="galp-footerText">
              Mostrando {galponesFiltrados.length} galpones
            </span>
            <div className="galp-pagination">
              <button className="galp-pageBtn" type="button"><ChevronLeft size={16} /> Anterior</button>
              <button className="galp-pageBtn galp-pageBtn--active" type="button">1</button>
              <button className="galp-pageBtn" type="button">Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Crear */}
      {showModal && (
        <Modal titulo="Nuevo Galpón" onClose={() => { setShowModal(false); resetForm(); }}>
          <GalponForm
            form={form}
            setForm={setForm}
            onSubmit={handleCrear}
            saving={saving}
            formError={formError}
            esEdicion={false}
          />
        </Modal>
      )}

      {/* Modal Editar */}
      {showEditModal && (
        <Modal titulo="Editar Galpón" onClose={() => { setShowEditModal(false); resetForm(); }}>
          <GalponForm
            form={form}
            setForm={setForm}
            onSubmit={handleEditar}
            saving={saving}
            formError={formError}
            esEdicion={true}
          />
        </Modal>
      )}

      {/* Modal Eliminar */}
      {showDeleteModal && (
        <Modal titulo="Eliminar Galpón" onClose={() => setShowDeleteModal(false)}>
          <p style={{ color: "#4b5563", marginBottom: "20px" }}>
            ¿Eliminar <strong>{galponSeleccionado?.nombre}</strong>?
          </p>
          <div className="galp-deleteActions">
            <button onClick={() => setShowDeleteModal(false)} className="galp-cancelBtn" type="button">
              Cancelar
            </button>
            <button onClick={handleEliminar} className="galp-deleteBtn" disabled={saving} type="button">
              {saving ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Ver */}
      {showVerModal && galponSeleccionado && (
        <Modal titulo="Detalle Galpón" onClose={() => setShowVerModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {[
              { label: "Nombre", value: galponSeleccionado.nombre },
              { label: "Capacidad", value: `${galponSeleccionado.capacidad} aves` },
              { label: "Descripción", value: galponSeleccionado.descripcion || "Sin descripción" },
              { label: "Estado", value: galponSeleccionado.estado },
              { label: "Ubicación", value: galponSeleccionado.ubicacion_nombre || "No registrada" },
              {
                label: "Coordenadas",
                value: galponSeleccionado.latitud && galponSeleccionado.longitud
                  ? `${parseFloat(galponSeleccionado.latitud).toFixed(6)}, ${parseFloat(galponSeleccionado.longitud).toFixed(6)}`
                  : "No registradas",
              },
            ].map((item, i) => (
              <div key={i} className="galp-detailRow">
                <span className="galp-detailLabel">{item.label}</span>
                <span className="galp-detailValue">{item.value}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

const theadRowStyle = { borderBottom: "1px solid #f3f4f6" };

export default Galpones;
