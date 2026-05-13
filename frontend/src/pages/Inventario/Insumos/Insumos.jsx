import { useEffect, useMemo, useState } from "react";
import { Package, Plus, AlertTriangle, Search, Edit, Trash2, Save } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import Modal from "../../../components/Modal";
import InputField from "../../../components/InputField";
import ComboBox from "../../../components/ComboBox";
import Button from "../../../components/Button";
import AlertItem from "../../../components/AlertItem";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../Inventario.css";

function Insumos() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [insumos, setInsumos] = useState([]);

  const [showModalInsumo, setShowModalInsumo] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formInsumo, setFormInsumo] = useState({
    nombre: "",
    tipo: "Alimento",
    unidad_medida: "Kg",
    stock_minimo: 0,
    stock_actual: 0,
  });

  // QBE: filtros por columna
  const [qbe, setQbe] = useState({
    nombre: "",
    tipo: "",
    stock_actual: "",
    stock_minimo: "",
  });

  useEffect(() => {
    fetchInsumos();
  }, []);

  const fetchInsumos = async () => {
    setLoading(true);
    try {
      const res = await api.get("/insumos/catalogo/");
      setInsumos(res.data);
    } catch (e) {
      console.error("Error cargando insumos", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInsumo = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/insumos/catalogo/", {
        ...formInsumo,
        stock_minimo: Number(formInsumo.stock_minimo),
        stock_actual: Number(formInsumo.stock_actual),
      });
      setShowModalInsumo(false);
      resetForm();
      fetchInsumos();
    } catch (e) {
      alert("Error al crear insumo");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (i) => {
    setInsumoSeleccionado(i);
    setFormInsumo({
      nombre: i.nombre,
      tipo: i.tipo,
      unidad_medida: i.unidad_medida,
      stock_minimo: i.stock_minimo,
      stock_actual: i.stock_actual,
    });
    setShowEditModal(true);
  };

  const handleUpdateInsumo = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/insumos/catalogo/${insumoSeleccionado.id_insumo}/`, {
        ...formInsumo,
        stock_minimo: Number(formInsumo.stock_minimo),
        stock_actual: Number(formInsumo.stock_actual),
      });
      setShowEditModal(false);
      resetForm();
      fetchInsumos();
    } catch (e) {
      alert("Error al actualizar insumo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInsumo = async () => {
    setSaving(true);
    try {
      await api.delete(`/insumos/catalogo/${insumoSeleccionado.id_insumo}/`);
      setShowDeleteModal(false);
      setInsumoSeleccionado(null);
      fetchInsumos();
    } catch (e) {
      alert("Error al eliminar insumo");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormInsumo({
      nombre: "",
      tipo: "Alimento",
      unidad_medida: "Kg",
      stock_minimo: 0,
      stock_actual: 0,
    });
    setInsumoSeleccionado(null);
  };

  const filtered = useMemo(() => {
    const contains = (value, needle) =>
      String(value ?? "")
        .toLowerCase()
        .includes(String(needle ?? "").toLowerCase());

    return insumos.filter((i) => {
      if (qbe.nombre && !contains(i.nombre, qbe.nombre)) return false;
      if (qbe.tipo && !contains(i.tipo, qbe.tipo)) return false;
      if (qbe.stock_actual && !contains(i.stock_actual, qbe.stock_actual))
        return false;
      if (qbe.stock_minimo && !contains(i.stock_minimo, qbe.stock_minimo))
        return false;
      return true;
    });
  }, [insumos, qbe]);

  const alertas = useMemo(
    () =>
      insumos.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo)),
    [insumos],
  );

  const unidadesUnicas = useMemo(() => {
    return Array.from(new Set(insumos.map(i => i.unidad_medida).filter(Boolean)));
  }, [insumos]);

  const formFields = (
    <form className="inv-form" onSubmit={showEditModal ? handleUpdateInsumo : handleCreateInsumo}>
      <InputField
        label="Nombre del Insumo"
        placeholder="Ej: Maíz Amarillo, Vacuna Newcastle..."
        value={formInsumo.nombre}
        onChange={(e) =>
          setFormInsumo({ ...formInsumo, nombre: e.target.value })
        }
        required
      />

      <ComboBox
        label="Categoría de Insumo"
        value={formInsumo.tipo}
        onChange={(val) => setFormInsumo({ ...formInsumo, tipo: val })}
        options={[
          { value: "Alimento", label: "Alimento (Balanceado, Maíz, etc)" },
          { value: "Medicamento", label: "Medicamento (Antibióticos, Vitaminas)" },
          { value: "Vacuna", label: "Vacuna" },
          { value: "Suministro", label: "Suministro (Viruta, Gas, etc)" }
        ]}
        placeholder="Selecciona categoría..."
        required
      />

      <div className="inv-form-row">
        <ComboBox
          label="Unidad de Medida"
          value={formInsumo.unidad_medida}
          onChange={(val) => setFormInsumo({ ...formInsumo, unidad_medida: val })}
          allowCustom={true}
          options={[
            { value: "Kg", label: "Kg" },
            { value: "Lt", label: "Lt" },
            { value: "Unidades", label: "Unidades" },
            { value: "Sacos", label: "Sacos" },
            { value: "Cajas", label: "Cajas" },
            ...unidadesUnicas.map(u => ({ value: u, label: u }))
          ].filter((v, i, a) => a.findIndex(t => t.value === v.value) === i)}
          placeholder="Ej: Kg, Lt, Unid..."
          required
        />

        <InputField
          label={showEditModal ? "Stock Actual" : "Stock Inicial"}
          type="number"
          placeholder="0"
          value={formInsumo.stock_actual}
          onChange={(e) =>
            setFormInsumo({ ...formInsumo, stock_actual: e.target.value })
          }
          required
        />
      </div>

      <InputField
        label="Stock Mínimo (Alerta)"
        type="number"
        placeholder="Ej: 10"
        value={formInsumo.stock_minimo}
        onChange={(e) =>
          setFormInsumo({ ...formInsumo, stock_minimo: e.target.value })
        }
        required
      />
      <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "-8px", marginLeft: "4px" }}>
        <AlertTriangle size={10} style={{display:'inline', marginRight:4}} /> Recibirás una alerta cuando el stock sea igual o menor a este valor.
      </p>

      <Button text={showEditModal ? "Guardar Cambios" : "Crear Insumo"} loading={saving} icon={showEditModal ? <Save size={18} /> : <Plus size={18} />} />
    </form>
  );

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
          flex: 1
        }}
      >
        <Topbar titulo="Catálogo de Insumos" subtitulo="Gestión maestro de productos e insumos" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="inv-header" style={{ marginBottom: '20px' }}>
          <div style={{ flex: 1 }} />
          <div className="inv-header-actions">
            <button
              className="inv-btn-primary"
              onClick={() => {
                resetForm();
                setShowModalInsumo(true);
              }}
            >
              <Plus size={16} /> Nuevo Insumo
            </button>
          </div>
        </div>

        {alertas.length > 0 && (
          <div className="inv-alerts-section">
            {alertas.map((i) => (
              <AlertItem
                key={i.id_insumo}
                type="danger"
                title="Bajo Stock"
                desc={`El insumo "${i.nombre}" está por debajo del mínimo (${i.stock_actual} ${i.unidad_medida} actuales).`}
                icon={<AlertTriangle size={18} />}
              />
            ))}
          </div>
        )}

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <Package size={18} /> Lista de Insumos
            </h3>
          </div>

          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Stock Actual</th>
                  <th>Mínimo</th>
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
                        className="inv-input"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </th>
                  <th>
                    <input
                      value={qbe.tipo}
                      onChange={(e) => setQbe({ ...qbe, tipo: e.target.value })}
                      placeholder="Filtrar..."
                      className="inv-input"
                      style={{ width: "100%" }}
                    />
                  </th>
                  <th>
                    <input
                      value={qbe.stock_actual}
                      onChange={(e) =>
                        setQbe({ ...qbe, stock_actual: e.target.value })
                      }
                      placeholder="Filtrar..."
                      className="inv-input"
                      style={{ width: "100%" }}
                    />
                  </th>
                  <th>
                    <input
                      value={qbe.stock_minimo}
                      onChange={(e) =>
                        setQbe({ ...qbe, stock_minimo: e.target.value })
                      }
                      placeholder="Filtrar..."
                      className="inv-input"
                      style={{ width: "100%" }}
                    />
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="inv-empty">
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="inv-empty">
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((i) => (
                    <tr key={i.id_insumo}>
                      <td>
                        <strong>{i.nombre}</strong>
                      </td>
                      <td>
                        <span className="inv-badge inv-badge-gray">
                          {i.tipo}
                        </span>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color:
                            Number(i.stock_actual) <= Number(i.stock_minimo)
                              ? "#dc2626"
                              : "#1e293b",
                        }}
                      >
                        {i.stock_actual} {i.unidad_medida}
                      </td>
                      <td style={{ color: '#94a3b8' }}>{i.stock_minimo}</td>
                      <td>
                        <div className="btn-action-group">
                          <button
                            className="btn-action btn-action--edit"
                            onClick={() => handleEditClick(i)}
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn-action btn-action--delete"
                            onClick={() => {
                              setInsumoSeleccionado(i);
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

      {showModalInsumo && (
        <Modal titulo="Nuevo Insumo" onClose={() => setShowModalInsumo(false)}>
          {formFields}
        </Modal>
      )}

      {showEditModal && (
        <Modal titulo="Editar Insumo" onClose={() => setShowEditModal(false)}>
          {formFields}
        </Modal>
      )}

      {showDeleteModal && (
        <Modal titulo="Eliminar Insumo" onClose={() => setShowDeleteModal(false)}>
          <div style={{ padding: "10px 0 20px" }}>
            <p style={{ color: "#4b5563", fontSize: 14 }}>
              ¿Estás seguro de eliminar el insumo <strong>{insumoSeleccionado?.nombre}</strong>?
            </p>
            <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8, fontWeight: 600 }}>
              Esta acción no se puede deshacer y puede afectar registros de alimentación o movimientos existentes.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button className="inv-btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
            <button
              className="inv-btn-danger"
              onClick={handleDeleteInsumo}
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

export default Insumos;
