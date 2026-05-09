import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Search, User, Phone, MapPin } from "lucide-react";
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
    try {
      await api.post("/insumos/proveedores/", form);
      setShowModal(false);
      setForm({ nombre: "", contacto: "", telefono: "", direccion: "" });
      fetchProveedores();
    } catch (e) {
      alert("Error al registrar proveedor");
    }
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
              onClick={() => setShowModal(true)}
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
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: "#64748b" }}>
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: 16, color: "#64748b" }}>
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
          <form className="alim-form" onSubmit={handleCreate}>
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
            <Button text="Guardar Proveedor" icon={<Plus size={18} />} />
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Proveedores;
