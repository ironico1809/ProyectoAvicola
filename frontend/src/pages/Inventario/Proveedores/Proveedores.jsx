import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Search, Edit, Trash2, Save } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Modal from "../../../components/Modal";
import InputField from "../../../components/InputField";
import ComboBox from "../../../components/ComboBox";
import Button from "../../../components/Button";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../Inventario.css";

function Proveedores() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
    direccion: "",
  });
  const [qbe, setQbe] = useState({ nombre: "", telefono: "", contacto: "" });

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    setLoading(true);
    try {
      const res = await api.get("/insumos/proveedores/");
      setProveedores(res.data);
    } catch (e) {
      console.error("Error cargando proveedores", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/insumos/proveedores/", form);
      setShowModal(false);
      resetForm();
      fetchProveedores();
    } catch (e) {
      alert("Error al registrar proveedor");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (p) => {
    setProveedorSeleccionado(p);
    setForm({
      nombre: p.nombre,
      contacto: p.contacto || "",
      telefono: p.telefono || "",
      direccion: p.direccion || "",
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/insumos/proveedores/${proveedorSeleccionado.id}/`, form);
      setShowEditModal(false);
      resetForm();
      fetchProveedores();
    } catch (e) {
      alert("Error al actualizar proveedor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/insumos/proveedores/${proveedorSeleccionado.id}/`);
      setShowDeleteModal(false);
      setProveedorSeleccionado(null);
      fetchProveedores();
    } catch (e) {
      alert("Error al eliminar proveedor");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ nombre: "", contacto: "", telefono: "", direccion: "" });
    setProveedorSeleccionado(null);
  };

  const filtered = useMemo(() => {
    const contains = (value, needle) =>
      String(value ?? "")
        .toLowerCase()
        .includes(String(needle ?? "").toLowerCase());

    return proveedores.filter((p) => {
      if (qbe.nombre && !contains(p.nombre, qbe.nombre)) return false;
      if (qbe.telefono && !contains(p.telefono, qbe.telefono)) return false;
      if (qbe.contacto && !contains(p.contacto, qbe.contacto)) return false;
      return true;
    });
  }, [proveedores, qbe]);

  const contactosUnicos = useMemo(() => {
    return Array.from(new Set(proveedores.map(p => p.contacto).filter(Boolean)));
  }, [proveedores]);

  const direccionesUnicas = useMemo(() => {
    return Array.from(new Set(proveedores.map(p => p.direccion).filter(Boolean)));
  }, [proveedores]);

  const formFields = (
    <form className="alim-form" onSubmit={showEditModal ? handleUpdate : handleCreate}>
      <InputField
        label="Razón Social / Nombre"
        placeholder="Ej: Avícola del Sol S.A."
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        required
      />
      
      <ComboBox
        label="Persona de Contacto"
        value={form.contacto}
        onChange={(val) => setForm({ ...form, contacto: val })}
        allowCustom={true}
        options={[
          { value: "Ventas", label: "Ventas" },
          { value: "Atención al Cliente", label: "Atención al Cliente" },
          { value: "Soporte Técnico", label: "Soporte Técnico" },
          ...contactosUnicos.map(c => ({ value: c, label: c }))
        ].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)}
        placeholder="Nombre de quién atiende"
      />

      <InputField
        label="Teléfono de Contacto"
        placeholder="Ej: +591 70000000"
        value={form.telefono}
        onChange={(e) => setForm({ ...form, telefono: e.target.value })}
      />
      
      <ComboBox
        label="Dirección / Ubicación"
        value={form.direccion}
        onChange={(val) => setForm({ ...form, direccion: val })}
        allowCustom={true}
        options={[
          { value: "Calle Principal, Centro", label: "Calle Principal, Centro" },
          { value: "Parque Industrial", label: "Parque Industrial" },
          { value: "Zona Sur", label: "Zona Sur" },
          ...direccionesUnicas.map(d => ({ value: d, label: d }))
        ].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)}
        placeholder="Dirección física o referencia"
      />
      <Button text={showEditModal ? "Actualizar Proveedor" : "Guardar Proveedor"} loading={saving} icon={showEditModal ? <Save size={18} /> : <Plus size={18} />} />
    </form>
  );

  return (
    <div className="inv-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main
        className="inv-main"
        style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}
      >
        <header className="inv-header">
          <div className="inv-title-group">
            <h1 className="inv-title">Directorio de Proveedores</h1>
            <p className="inv-subtitle">
              <Truck size={14} /> Contactos y datos de compra
            </p>
          </div>

          <div className="inv-header-actions">
            <button
              className="inv-btn-primary"
              onClick={() => { resetForm(); setShowModal(true); }}
            >
              <Plus size={16} /> Nuevo Proveedor
            </button>
          </div>
        </header>

        <section className="est-panel">
          <div className="est-panel-header">
            <h3 className="est-panel-title">
              <Truck size={18} /> Lista de Proveedores
            </h3>
          </div>

          <div className="est-table-wrap">
            <table className="est-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Dirección</th>
                  <th>Acciones</th>
                </tr>
                <tr>
                  <th>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Search size={14} />
                      <input
                        value={qbe.nombre}
                        onChange={(e) =>
                          setQbe({ ...qbe, nombre: e.target.value })
                        }
                        placeholder="Filtrar..."
                        className="rep-input"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </th>
                  <th>
                    <input
                      value={qbe.contacto}
                      onChange={(e) =>
                        setQbe({ ...qbe, contacto: e.target.value })
                      }
                      placeholder="Filtrar..."
                      className="rep-input"
                      style={{ width: "100%" }}
                    />
                  </th>
                  <th>
                    <input
                      value={qbe.telefono}
                      onChange={(e) =>
                        setQbe({ ...qbe, telefono: e.target.value })
                      }
                      placeholder="Filtrar..."
                      className="rep-input"
                      style={{ width: "100%" }}
                    />
                  </th>
                  <th />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, color: "#64748b" }}>
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 16, color: "#64748b" }}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nombre}</strong>
                      </td>
                      <td>{p.contacto || "-"}</td>
                      <td>{p.telefono || "-"}</td>
                      <td>{p.direccion || "-"}</td>
                      <td>
                        <div className="btn-action-group">
                          <button
                            className="btn-action btn-action--edit"
                            onClick={() => handleEditClick(p)}
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn-action btn-action--delete"
                            onClick={() => {
                              setProveedorSeleccionado(p);
                              setShowDeleteModal(true);
                            }}
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
        </section>
      </main>

      {showModal && (
        <Modal titulo="Nuevo Proveedor" onClose={() => setShowModal(false)}>
          {formFields}
        </Modal>
      )}

      {showEditModal && (
        <Modal titulo="Editar Proveedor" onClose={() => setShowEditModal(false)}>
          {formFields}
        </Modal>
      )}

      {showDeleteModal && (
        <Modal titulo="Eliminar Proveedor" onClose={() => setShowDeleteModal(false)}>
          <div style={{ padding: "10px 0 20px" }}>
            <p style={{ color: "#4b5563", fontSize: 14 }}>
              ¿Estás seguro de eliminar al proveedor <strong>{proveedorSeleccionado?.nombre}</strong>?
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button className="rep-btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
            <button
              className="rep-btn-primary"
              style={{ background: "#dc2626" }}
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Proveedores;
