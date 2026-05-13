import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Plus,
  Search,
} from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import Modal from "../../../components/Modal";
import InputField from "../../../components/InputField";
import Button from "../../../components/Button";
import ComboBox from "../../../components/ComboBox";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../Inventario.css";

function Movimientos() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [showModalMov, setShowModalMov] = useState(false);

  const [loading, setLoading] = useState(true);
  const [insumos, setInsumos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movimientos, setMovimientos] = useState([]);

  const [tipoMov, setTipoMov] = useState("Entrada");
  const [formMov, setFormMov] = useState({
    insumo: "",
    cantidad: "",
    motivo: "",
    proveedor: "",
  });

  const [filters, setFilters] = useState({
    insumo: "",
    tipo_movimiento: "",
    fecha_inicio: "",
    fecha_fin: "",
    motivo: "",
  });

  useEffect(() => {
    fetchCatalogos();
    fetchMovimientos();
  }, []);

  const fetchCatalogos = async () => {
    try {
      const [insRes, provRes] = await Promise.all([
        api.get("/insumos/catalogo/"),
        api.get("/insumos/proveedores/"),
      ]);
      setInsumos(insRes.data);
      setProveedores(provRes.data);
    } catch (e) {
      console.error("Error cargando catálogos", e);
    }
  };

  const fetchMovimientos = async (nextFilters = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (nextFilters.insumo) params.insumo = nextFilters.insumo;
      if (nextFilters.tipo_movimiento)
        params.tipo_movimiento = nextFilters.tipo_movimiento;
      if (nextFilters.fecha_inicio)
        params.fecha_inicio = nextFilters.fecha_inicio;
      if (nextFilters.fecha_fin) params.fecha_fin = nextFilters.fecha_fin;
      if (nextFilters.motivo) params.motivo = nextFilters.motivo;

      const res = await api.get("/insumos/movimientos/", { params });
      setMovimientos(res.data);
    } catch (e) {
      console.error("Error cargando movimientos", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMov = async (e) => {
    e.preventDefault();
    if (!formMov.insumo) {
      alert("Selecciona un insumo.");
      return;
    }
    try {
      await api.post("/insumos/movimientos/", {
        ...formMov,
        tipo_movimiento: tipoMov,
        insumo: Number(formMov.insumo),
        proveedor: formMov.proveedor ? Number(formMov.proveedor) : null,
        cantidad: Number(formMov.cantidad),
      });
      setFormMov({ insumo: "", cantidad: "", motivo: "", proveedor: "" });
      setShowModalMov(false);
      fetchMovimientos();
    } catch (e) {
      alert("Error al registrar movimiento");
    }
  };

  const insumoNameById = useMemo(() => {
    const map = new Map();
    insumos.forEach((i) => map.set(String(i.id_insumo), i.nombre));
    return map;
  }, [insumos]);

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
        <Topbar titulo="Movimientos de Almacén" subtitulo="Entradas y salidas con trazabilidad" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="inv-header" style={{ marginBottom: '20px' }}>
          <div style={{ flex: 1 }} />
          <div className="inv-header-actions">
            <button
              className="inv-btn-success"
              onClick={() => {
                setTipoMov("Entrada");
                setShowModalMov(true);
              }}
            >
              <ArrowUpCircle size={16} /> Entrada
            </button>
            <button
              className="inv-btn-danger"
              onClick={() => {
                setTipoMov("Salida");
                setShowModalMov(true);
              }}
            >
              <ArrowDownCircle size={16} /> Salida
            </button>
          </div>
        </div>

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <Search size={18} /> Filtros
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
              padding: 12,
              alignItems: "end"
            }}
          >
            <ComboBox
              label="Insumo"
              value={filters.insumo}
              onChange={(val) => setFilters({ ...filters, insumo: val })}
              options={insumos.map((i) => ({
                value: String(i.id_insumo),
                label: i.nombre,
              }))}
              placeholder="Todos"
            />

            <ComboBox
              label="Tipo"
              value={filters.tipo_movimiento}
              onChange={(val) => setFilters({ ...filters, tipo_movimiento: val })}
              options={[
                { value: "Entrada", label: "Entrada" },
                { value: "Salida", label: "Salida" },
              ]}
              placeholder="Todos"
            />

            <div className="inv-filter-group">
              <label>Fecha inicio</label>
              <input
                className="inv-input"
                type="date"
                value={filters.fecha_inicio}
                onChange={(e) =>
                  setFilters({ ...filters, fecha_inicio: e.target.value })
                }
              />
            </div>

            <div className="inv-filter-group">
              <label>Fecha fin</label>
              <input
                className="inv-input"
                type="date"
                value={filters.fecha_fin}
                onChange={(e) =>
                  setFilters({ ...filters, fecha_fin: e.target.value })
                }
              />
            </div>

            <div className="inv-filter-group">
              <label>Motivo</label>
              <input
                className="inv-input"
                value={filters.motivo}
                onChange={(e) =>
                  setFilters({ ...filters, motivo: e.target.value })
                }
                placeholder="Compra, ajuste, consumo..."
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "0 12px 12px" }}>
            <button
              className="inv-btn-ghost"
              type="button"
              onClick={() => {
                const cleared = {
                  insumo: "",
                  tipo_movimiento: "",
                  fecha_inicio: "",
                  fecha_fin: "",
                  motivo: "",
                };
                setFilters(cleared);
                fetchMovimientos(cleared);
              }}
            >
              Limpiar
            </button>
            <button
              className="inv-btn-primary"
              type="button"
              onClick={() => fetchMovimientos(filters)}
            >
              <Plus size={16} /> Aplicar
            </button>
          </div>
        </section>

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <History size={18} /> Historial
            </h3>
          </div>

          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Mov.</th>
                  <th>Insumo</th>
                  <th>Cantidad</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="inv-empty">
                      Cargando...
                    </td>
                  </tr>
                ) : movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="inv-empty">
                      No hay movimientos.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 11 }}>
                        {new Date(m.fecha_hora).toLocaleDateString()}
                      </td>
                      <td>
                        <span
                          className={`inv-badge ${m.tipo_movimiento === "Entrada" ? "inv-badge-entrada" : "inv-badge-salida"}`}
                        >
                          {m.tipo_movimiento === "Entrada" ? (
                            <ArrowUpCircle size={10} />
                          ) : (
                            <ArrowDownCircle size={10} />
                          )}
                          {m.tipo_movimiento}
                        </span>
                      </td>
                      <td>
                        {m.insumo_nombre ||
                          insumoNameById.get(String(m.insumo)) ||
                          "-"}
                      </td>
                      <td>
                        <strong>{m.cantidad}</strong>
                      </td>
                      <td
                        style={{
                          maxWidth: 320,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.motivo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {showModalMov && (
        <Modal
          titulo={`Registrar movimiento (${tipoMov})`}
          onClose={() => setShowModalMov(false)}
        >
          <form className="inv-form" onSubmit={handleCreateMov}>
            <ComboBox
              label="Insumo"
              value={formMov.insumo}
              onChange={(val) => setFormMov({ ...formMov, insumo: val })}
              options={insumos.map((i) => ({
                value: String(i.id_insumo),
                label: `${i.nombre} (${i.stock_actual} disp.)`,
              }))}
              placeholder="Buscar insumo..."
              required
            />

            {tipoMov === "Entrada" && (
              <ComboBox
                label="Proveedor (Opcional)"
                value={formMov.proveedor}
                onChange={(val) => setFormMov({ ...formMov, proveedor: val })}
                options={proveedores.map((p) => ({
                  value: String(p.id),
                  label: p.nombre,
                }))}
                placeholder="Buscar proveedor..."
              />
            )}

            <InputField
              label="Cantidad"
              type="number"
              step="0.01"
              value={formMov.cantidad}
              onChange={(e) =>
                setFormMov({ ...formMov, cantidad: e.target.value })
              }
              required
            />
            <InputField
              label="Motivo / Referencia"
              placeholder="Ej: Compra Factura #123"
              value={formMov.motivo}
              onChange={(e) =>
                setFormMov({ ...formMov, motivo: e.target.value })
              }
              required
            />

            <Button text="Guardar Movimiento" icon={<Save size={18} />} />
          </form>
        </Modal>
      )}
    </div>
  );
}

const Save = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export default Movimientos;
