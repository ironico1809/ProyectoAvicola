import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Trash2,
  Edit,
  Truck,
  User,
  Layers,
  DollarSign,
  ChevronDown,
  TrendingUp,
  Users as UsersIcon,
  ShoppingCart,
  Bird,
} from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import Modal from "../../components/Modal";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import ComboBox from "../../components/ComboBox";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function Ventas() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState("ventas");
  const [tabTransition, setTabTransition] = useState(false);

  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showVentaModal, setShowVentaModal] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showEditClienteModal, setShowEditClienteModal] = useState(false);
  const [showDeleteClienteModal, setShowDeleteClienteModal] = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [formVenta, setFormVenta] = useState({
    id_cliente: "",
    id_lote: "",
    cantidad: "",
    precio_unitario: "",
    tipo_venta: "Por unidad",
    peso_total_vendido: "",
    observacion: "",
  });

  const [formCliente, setFormCliente] = useState({
    nombre: "",
    telefono: "",
    email: "",
  });

  const tablaRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isNarrow = viewportWidth < 900;

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ventasRes, clientesRes, lotesRes] = await Promise.all([
        api.get("/ventas/"),
        api.get("/ventas/clientes/"),
        api.get("/lotes/"),
      ]);
      setVentas(Array.isArray(ventasRes.data) ? ventasRes.data : []);
      setClientes(Array.isArray(clientesRes.data) ? clientesRes.data : []);
      setLotes(Array.isArray(lotesRes.data) ? lotesRes.data : []);
    } catch (e) {
      console.error("Error al cargar datos de comercialización", e);
    } finally {
      setLoading(false);
    }
  };

  const lotesDisponibles = useMemo(() => {
    return lotes.filter(
      (l) =>
        (l.estado === "Listo" || l.estado === "Crianza") &&
        (toNumber(l.cantidad_actual) ?? 0) > 0
    );
  }, [lotes]);

  const selectedLoteObj = useMemo(() => {
    const lid = toNumber(formVenta.id_lote);
    if (lid === null) return null;
    return lotes.find((l) => Number(l.id_lote) === lid) || null;
  }, [formVenta.id_lote, lotes]);

  const calculatedTotal = useMemo(() => {
    const qty = Number(formVenta.cantidad || 0);
    const unitPrice = Number(formVenta.precio_unitario || 0);
    const weight = Number(formVenta.peso_total_vendido || 0);
    if (formVenta.tipo_venta === "Por peso") {
      return (weight * unitPrice).toFixed(2);
    }
    return (qty * unitPrice).toFixed(2);
  }, [formVenta.cantidad, formVenta.precio_unitario, formVenta.peso_total_vendido, formVenta.tipo_venta]);

  const ventasFiltradas = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return ventas;
    return ventas.filter(
      (v) =>
        String(v.cliente_nombre || "").toLowerCase().includes(q) ||
        String(v.lote_raza || "").toLowerCase().includes(q) ||
        String(v.id_lote || "").toLowerCase().includes(q) ||
        String(v.tipo_venta || "").toLowerCase().includes(q)
    );
  }, [ventas, filtro]);

  const clientesFiltrados = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        String(c.nombre || "").toLowerCase().includes(q) ||
        String(c.telefono || "").toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q)
    );
  }, [clientes, filtro]);

  // Mini dashboard stats
  const stats = useMemo(() => {
    const totalVentas = ventas.length;
    const totalClientes = clientes.length;
    const avesVendidas = ventas.reduce((sum, v) => sum + (Number(v.cantidad) || 0), 0);
    const ingresos = ventas.reduce((sum, v) => sum + (Number(v.precio_total) || 0), 0);
    return { totalVentas, totalClientes, avesVendidas, ingresos };
  }, [ventas, clientes]);

  const handleVentaChange = (e) => {
    const { name, value } = e.target;
    setFormVenta((prev) => ({ ...prev, [name]: value }));
    setFormError("");
    setSuccess("");
  };

  const handleClienteChange = (e) => {
    const { name, value } = e.target;
    setFormCliente((prev) => ({ ...prev, [name]: value }));
    setFormError("");
    setSuccess("");
  };

  const resetFormVenta = () => {
    setFormVenta({
      id_cliente: "",
      id_lote: "",
      cantidad: "",
      precio_unitario: "",
      tipo_venta: "Por unidad",
      peso_total_vendido: "",
      observacion: "",
    });
    setFormError("");
    setSuccess("");
  };

  const resetFormCliente = () => {
    setFormCliente({
      nombre: "",
      telefono: "",
      email: "",
    });
    setFormError("");
    setSuccess("");
  };

  const handleRegistrarVenta = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess("");

    if (!formVenta.id_cliente) return setFormError("Selecciona un cliente.");
    if (!formVenta.id_lote) return setFormError("Selecciona un lote.");

    const qty = toNumber(formVenta.cantidad);
    if (qty === null || qty <= 0) return setFormError("Cantidad inválida.");

    if (selectedLoteObj && qty > (toNumber(selectedLoteObj.cantidad_actual) ?? 0)) {
      return setFormError(
        `La cantidad supera el stock disponible en el lote (${selectedLoteObj.cantidad_actual} aves).`
      );
    }

    const unitPrice = toNumber(formVenta.precio_unitario);
    if (unitPrice === null || unitPrice <= 0) return setFormError("Precio unitario inválido.");

    if (formVenta.tipo_venta === "Por peso") {
      const weight = toNumber(formVenta.peso_total_vendido);
      if (weight === null || weight <= 0) {
        return setFormError("Debe ingresar un peso total válido.");
      }
    }

    setSaving(true);
    try {
      const payload = {
        id_cliente: Number(formVenta.id_cliente),
        id_lote: Number(formVenta.id_lote),
        cantidad: qty,
        precio_unitario: unitPrice,
        tipo_venta: formVenta.tipo_venta,
        peso_total_vendido:
          formVenta.tipo_venta === "Por peso" ? Number(formVenta.peso_total_vendido) : null,
        observacion: formVenta.observacion || "",
      };

      await api.post("/ventas/", payload);
      setSuccess("Venta registrada con éxito.");
      resetFormVenta();
      setTimeout(() => {
        setShowVentaModal(false);
        fetchData();
      }, 1000);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        "Error al registrar la venta.";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarCliente = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccess("");

    if (!formCliente.nombre.trim()) return setFormError("El nombre es requerido.");

    setSaving(true);
    try {
      const payload = {
        nombre: formCliente.nombre.trim(),
        telefono: formCliente.telefono.trim() || null,
        email: formCliente.email.trim() || null,
      };

      if (showEditClienteModal && clienteSeleccionado) {
        await api.put(`/ventas/clientes/${clienteSeleccionado.id_cliente}/`, payload);
        setSuccess("Cliente actualizado con éxito.");
      } else {
        await api.post("/ventas/clientes/", payload);
        setSuccess("Cliente registrado con éxito.");
      }

      resetFormCliente();
      setTimeout(() => {
        setShowClienteModal(false);
        setShowEditClienteModal(false);
        setClienteSeleccionado(null);
        fetchData();
      }, 1000);
    } catch (err) {
      const msg = err?.response?.data?.detail || "Error al guardar cliente.";
      setFormError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleEditClienteClick = (c) => {
    setClienteSeleccionado(c);
    setFormCliente({
      nombre: c.nombre || "",
      telefono: c.telefono || "",
      email: c.email || "",
    });
    setFormError("");
    setSuccess("");
    setShowEditClienteModal(true);
  };

  const handleDeleteCliente = async () => {
    if (!clienteSeleccionado) return;
    setSaving(true);
    try {
      await api.delete(`/ventas/clientes/${clienteSeleccionado.id_cliente}/`);
      setShowDeleteClienteModal(false);
      setClienteSeleccionado(null);
      fetchData();
    } catch (err) {
      setFormError(
        err?.response?.data?.detail ||
          "No se puede eliminar el cliente porque tiene ventas asociadas."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (tab) => {
    if (tab === activeTab) return;
    setTabTransition(true);
    setTimeout(() => {
      setActiveTab(tab);
      setFiltro("");
      setTimeout(() => setTabTransition(false), 50);
    }, 200);
  };

  const clienteOptions = useMemo(() => {
    return clientes.map((c) => ({
      value: c.id_cliente,
      label: c.nombre + (c.telefono ? ` (${c.telefono})` : ""),
    }));
  }, [clientes]);

  const loteOptions = useMemo(() => {
    return lotesDisponibles.map((l) => ({
      value: l.id_lote,
      label: `Lote #${l.id_lote} - ${l.raza_tipo || "S/R"} (${l.cantidad_actual} aves, estado: ${l.estado})`,
    }));
  }, [lotesDisponibles]);

  const ventaFormFields = (
    <form onSubmit={handleRegistrarVenta} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <ComboBox
        label="Lote Disponible"
        placeholder="Selecciona un lote listo o en crianza..."
        options={loteOptions}
        value={formVenta.id_lote}
        onChange={(val) => setFormVenta((prev) => ({ ...prev, id_lote: val }))}
        required
        icon={<Layers size={18} color="#f59e0b" />}
      />

      {selectedLoteObj && (
        <div style={infoBoxStyle}>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Aves Disponibles:</span>
            <span style={infoValueStyle}>{selectedLoteObj.cantidad_actual}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Galpón de Crianza:</span>
            <span style={infoValueStyle}>{selectedLoteObj._galponNombre || `Galpón ID ${selectedLoteObj.id_galpon}`}</span>
          </div>
          <div style={{ ...infoRowStyle, borderBottom: "none" }}>
            <span style={infoLabelStyle}>Estado del Lote:</span>
            <span style={infoValueStyle}>{selectedLoteObj.estado}</span>
          </div>
        </div>
      )}

      <ComboBox
        label="Cliente"
        placeholder="Selecciona un cliente..."
        options={clienteOptions}
        value={formVenta.id_cliente}
        onChange={(val) => setFormVenta((prev) => ({ ...prev, id_cliente: val }))}
        required
        icon={<User size={18} color="#f59e0b" />}
      />

      <InputField
        label="Cantidad de Aves a Vender"
        name="cantidad"
        type="number"
        placeholder="Ej: 500"
        value={formVenta.cantidad}
        onChange={handleVentaChange}
        required
      />

      <div style={selectGroupStyle}>
        <select
          name="tipo_venta"
          onChange={handleVentaChange}
          value={formVenta.tipo_venta}
          style={selectStyle}
          required
        >
          <option value="Por unidad">Por unidad (Cabeza)</option>
          <option value="Por peso">Por peso (Kilogramos)</option>
        </select>
        <ChevronDown size={18} color="#9ca3af" />
      </div>

      {formVenta.tipo_venta === "Por peso" && (
        <InputField
          label="Peso Total Vendido (Kg)"
          name="peso_total_vendido"
          type="number"
          step="0.01"
          placeholder="Ej: 1250.5"
          value={formVenta.peso_total_vendido}
          onChange={handleVentaChange}
          required
        />
      )}

      <InputField
        label={formVenta.tipo_venta === "Por peso" ? "Precio por Kg (Bs.)" : "Precio por Ave (Bs.)"}
        name="precio_unitario"
        type="number"
        step="0.01"
        placeholder="Ej: 3.50"
        value={formVenta.precio_unitario}
        onChange={handleVentaChange}
        required
      />

      <div style={{ ...infoBoxStyle, background: "#ecfdf5", borderColor: "rgba(16,185,129,0.2)" }}>
        <div style={{ ...infoRowStyle, borderBottom: "none" }}>
          <span style={{ ...infoLabelStyle, color: "#047857" }}>TOTAL CALCULADO:</span>
          <span style={{ ...infoValueStyle, color: "#047857", fontSize: "16px", fontWeight: "700" }}>
            Bs. {calculatedTotal}
          </span>
        </div>
      </div>

      <InputField
        label="Observación"
        name="observacion"
        placeholder="Información adicional sobre la venta..."
        value={formVenta.observacion}
        onChange={handleVentaChange}
        required={false}
      />

      {formError && <p style={messageErrorStyle}>⚠️ {formError}</p>}
      {success && <p style={messageSuccessStyle}>✓ {success}</p>}

      <Button
        text="Confirmar Registro de Venta"
        loadingText="Guardando..."
        loading={saving}
        icon={<DollarSign size={18} />}
      />
    </form>
  );

  const clienteFormFields = (
    <form onSubmit={handleRegistrarCliente} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <InputField
        label="Nombre Completo / Razón Social"
        name="nombre"
        placeholder="Ej: Distribuidora Avícola"
        value={formCliente.nombre}
        onChange={handleClienteChange}
        required
      />
      <InputField
        label="Teléfono"
        name="telefono"
        placeholder="Ej: 78912345"
        value={formCliente.telefono}
        onChange={handleClienteChange}
        required={false}
      />
      <InputField
        label="Correo Electrónico"
        name="email"
        type="email"
        placeholder="Ej: cliente@correo.com"
        value={formCliente.email}
        onChange={handleClienteChange}
        required={false}
      />

      {formError && <p style={messageErrorStyle}>⚠️ {formError}</p>}
      {success && <p style={messageSuccessStyle}>✓ {success}</p>}

      <Button
        text={showEditClienteModal ? "Actualizar Cliente" : "Registrar Cliente"}
        loadingText="Guardando..."
        loading={saving}
        icon={<Plus size={18} />}
      />
    </form>
  );

  return (
    <div style={layoutStyle}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        style={{
          ...mainContentStyle,
          marginLeft: isNarrow ? "0px" : sidebarOpen ? "260px" : "70px",
          padding: isNarrow ? "16px" : "32px",
          paddingTop: isNarrow ? "80px" : "32px",
        }}
      >
        <Topbar
          titulo="Comercialización y Ventas"
          subtitulo="Registro de ventas de lotes listos y cartera de clientes"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Mini Dashboard Stats */}
        <div style={{
          ...statsRowStyle,
          flexDirection: isNarrow ? "column" : "row",
        }}>
          <div style={statCardStyle("#fef3c7", "#f59e0b")}>
            <div style={statIconStyle("#f59e0b")}>
              <ShoppingCart size={20} />
            </div>
            <div>
              <p style={statNumberStyle}>{stats.totalVentas}</p>
              <p style={statLabelStyle}>Ventas Registradas</p>
            </div>
          </div>
          <div style={statCardStyle("#dbeafe", "#3b82f6")}>
            <div style={statIconStyle("#3b82f6")}>
              <UsersIcon size={20} />
            </div>
            <div>
              <p style={statNumberStyle}>{stats.totalClientes}</p>
              <p style={statLabelStyle}>Clientes Activos</p>
            </div>
          </div>
          <div style={statCardStyle("#fce7f3", "#ec4899")}>
            <div style={statIconStyle("#ec4899")}>
              <Bird size={20} />
            </div>
            <div>
              <p style={statNumberStyle}>{stats.avesVendidas.toLocaleString()}</p>
              <p style={statLabelStyle}>Aves Vendidas</p>
            </div>
          </div>
          <div style={statCardStyle("#ecfdf5", "#10b981")}>
            <div style={statIconStyle("#10b981")}>
              <TrendingUp size={20} />
            </div>
            <div>
              <p style={statNumberStyle}>Bs. {stats.ingresos.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p style={statLabelStyle}>Ingresos Totales</p>
            </div>
          </div>
        </div>

        <div
          style={{
            ...headerStyle,
            marginBottom: "20px",
            flexDirection: isNarrow ? "column" : "row",
            alignItems: isNarrow ? "stretch" : "center",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => handleTabChange("ventas")}
              style={activeTab === "ventas" ? activeTabBtnStyle : inactiveTabBtnStyle}
            >
              Ventas
            </button>
            <button
              onClick={() => handleTabChange("clientes")}
              style={activeTab === "clientes" ? activeTabBtnStyle : inactiveTabBtnStyle}
            >
              Clientes
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {activeTab === "ventas" ? (
            <button
              onClick={() => {
                resetFormVenta();
                setShowVentaModal(true);
              }}
              style={{
                ...btnAgregarStyle,
                width: isNarrow ? "100%" : "auto",
                justifyContent: "center",
              }}
            >
              <DollarSign size={18} style={{ marginRight: "8px" }} /> Registrar Venta
            </button>
          ) : (
            <button
              onClick={() => {
                resetFormCliente();
                setClienteSeleccionado(null);
                setShowClienteModal(true);
              }}
              style={{
                ...btnAgregarStyle,
                width: isNarrow ? "100%" : "auto",
                justifyContent: "center",
              }}
            >
              <Plus size={18} style={{ marginRight: "8px" }} /> Registrar Cliente
            </button>
          )}
        </div>

        <div style={{
          ...containerStyle,
          opacity: tabTransition ? 0 : 1,
          transform: tabTransition ? "translateY(8px)" : "translateY(0)",
          transition: "opacity 0.25s ease, transform 0.25s ease",
        }}>
          <div
            style={{
              ...filtersRowStyle,
              flexDirection: isNarrow ? "column" : "row",
              alignItems: isNarrow ? "stretch" : "center",
            }}
          >
            <div style={searchWrapperStyle}>
              <Search size={18} color="#9ca3af" />
              <input
                type="text"
                placeholder={
                  activeTab === "ventas"
                    ? "Buscar por cliente, raza, lote o tipo..."
                    : "Buscar por nombre, teléfono o correo..."
                }
                style={searchInputStyle}
                onChange={(e) => setFiltro(e.target.value)}
                value={filtro}
              />
            </div>
          </div>

          <div style={tableWrapStyle} ref={tablaRef}>
            {activeTab === "ventas" ? (
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Fecha</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>Lote / Raza</th>
                    <th style={thStyle}>Galpón</th>
                    <th style={thStyle}>Tipo Venta</th>
                    <th style={thStyle}>Aves</th>
                    <th style={thStyle}>Precio Unitario</th>
                    <th style={thStyle}>Total (Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={emptyTdStyle}>
                        <div style={loadingStyle}>
                          <div style={spinnerStyle} />
                          Cargando registros...
                        </div>
                      </td>
                    </tr>
                  ) : ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={emptyTdStyle}>
                        No se encontraron registros de ventas.
                      </td>
                    </tr>
                  ) : (
                    ventasFiltradas.map((v, idx) => (
                      <tr
                        key={v.id_venta}
                        style={{
                          ...trStyle,
                          animation: `fadeInRow 0.3s ease ${idx * 0.03}s both`,
                        }}
                        className="table-row-hover"
                      >
                        <td style={tdStyle}><strong>#{v.id_venta}</strong></td>
                        <td style={tdStyle}>
                          {v.fecha_venta ? new Date(v.fecha_venta).toLocaleDateString() : "-"}
                        </td>
                        <td style={tdStyle}>{v.cliente_nombre || "Desconocido"}</td>
                        <td style={tdStyle}>
                          Lote #{v.id_lote} ({v.lote_raza || "S/R"})
                        </td>
                        <td style={tdStyle}>{v.lote_galpon_nombre || "-"}</td>
                        <td style={tdStyle}>
                          <span style={tipoVentaBadgeStyle(v.tipo_venta)}>
                            {v.tipo_venta}
                          </span>
                        </td>
                        <td style={tdStyle}>{v.cantidad}</td>
                        <td style={tdStyle}>Bs. {Number(v.precio_unitario).toFixed(2)}</td>
                        <td style={{ ...tdStyle, color: "#10b981", fontWeight: "700" }}>
                          Bs. {Number(v.precio_total).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr style={theadRowStyle}>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Nombre Razón Social</th>
                    <th style={thStyle}>Teléfono</th>
                    <th style={thStyle}>Correo Electrónico</th>
                    <th style={{ ...thStyle, width: "120px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} style={emptyTdStyle}>
                        <div style={loadingStyle}>
                          <div style={spinnerStyle} />
                          Cargando clientes...
                        </div>
                      </td>
                    </tr>
                  ) : clientesFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={emptyTdStyle}>
                        No hay clientes registrados.
                      </td>
                    </tr>
                  ) : (
                    clientesFiltrados.map((c, idx) => (
                      <tr
                        key={c.id_cliente}
                        style={{
                          ...trStyle,
                          animation: `fadeInRow 0.3s ease ${idx * 0.03}s both`,
                        }}
                        className="table-row-hover"
                      >
                        <td style={tdStyle}><strong>#{c.id_cliente}</strong></td>
                        <td style={tdStyle}><strong>{c.nombre}</strong></td>
                        <td style={tdStyle}>{c.telefono || "-"}</td>
                        <td style={tdStyle}>{c.email || "-"}</td>
                        <td style={tdStyle}>
                          <div style={actionGroupStyle}>
                            <button
                              onClick={() => handleEditClienteClick(c)}
                              style={actionBtnStyle("edit")}
                              title="Editar"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => {
                                setClienteSeleccionado(c);
                                setFormError("");
                                setShowDeleteClienteModal(true);
                              }}
                              style={actionBtnStyle("delete")}
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div style={tableFooterStyle}>
            <span style={footerTextStyle}>
              Mostrando {loading ? "—" : activeTab === "ventas" ? ventasFiltradas.length : clientesFiltrados.length} registros
            </span>
          </div>
        </div>
      </main>

      {showVentaModal && (
        <Modal titulo="Registrar Venta" onClose={() => setShowVentaModal(false)}>
          {loteOptions.length === 0 && !loading ? (
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
              No hay lotes con estado 'Listo' o 'Crianza' con stock para vender.
            </p>
          ) : (
            ventaFormFields
          )}
        </Modal>
      )}

      {showClienteModal && (
        <Modal titulo="Registrar Cliente" onClose={() => setShowClienteModal(false)}>
          {clienteFormFields}
        </Modal>
      )}

      {showEditClienteModal && (
        <Modal titulo="Editar Cliente" onClose={() => setShowEditClienteModal(false)}>
          {clienteFormFields}
        </Modal>
      )}

      {showDeleteClienteModal && (
        <Modal
          titulo="Eliminar Cliente"
          onClose={() => {
            setShowDeleteClienteModal(false);
            setClienteSeleccionado(null);
          }}
        >
          <p style={{ color: "#4b5563", marginBottom: "20px" }}>
            ¿Eliminar el cliente <strong>{clienteSeleccionado?.nombre}</strong>?
          </p>
          {formError && (
            <p style={{ color: "#dc2626", fontSize: "12px", margin: "0 0 12px 0" }}>
              ⚠️ {formError}
            </p>
          )}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => {
                setShowDeleteClienteModal(false);
                setClienteSeleccionado(null);
              }}
              style={btnCancelarStyle}
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteCliente}
              style={btnEliminarStyle}
              disabled={saving}
            >
              {saving ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .table-row-hover:hover {
          background: #fefce8 !important;
          transition: background 0.15s ease;
        }
        .table-row-hover {
          transition: background 0.15s ease;
        }
      `}</style>
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const statsRowStyle = {
  display: "flex",
  gap: "16px",
  marginBottom: "28px",
};

const statCardStyle = (bg, accent) => ({
  flex: 1,
  background: bg,
  borderRadius: "16px",
  padding: "18px 20px",
  display: "flex",
  alignItems: "center",
  gap: "16px",
  border: `1px solid ${accent}20`,
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
});

const statIconStyle = (color) => ({
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  background: `${color}18`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color,
  flexShrink: 0,
});

const statNumberStyle = {
  fontSize: "20px",
  fontWeight: "800",
  color: "#1c1c1c",
  margin: 0,
  lineHeight: 1.2,
};

const statLabelStyle = {
  fontSize: "12px",
  color: "#6b7280",
  fontWeight: "500",
  margin: "2px 0 0 0",
};

const tipoVentaBadgeStyle = (tipo) => {
  const isPeso = tipo === "Por peso";
  return {
    background: isPeso ? "#fef3c7" : "#e0f2fe",
    color: isPeso ? "#d97706" : "#0369a1",
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
    display: "inline-block",
  };
};

const layoutStyle = {
  display: "flex",
  minHeight: "100vh",
  background: "#f9fafb",
  fontFamily: "'Poppins', sans-serif",
};

const mainContentStyle = {
  flex: 1,
  background: "#f9fafb",
  transition: "margin-left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
};

const containerStyle = {
  background: "#fff",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
  border: "1px solid #f1f5f9",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const activeTabBtnStyle = {
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 4px 10px rgba(245,158,11,0.25)",
  transition: "all 0.2s ease",
};

const inactiveTabBtnStyle = {
  background: "#f3f4f6",
  color: "#4b5563",
  border: "none",
  borderRadius: "10px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const btnAgregarStyle = {
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "12px 24px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(245,158,11,0.3)",
  display: "inline-flex",
  alignItems: "center",
  transition: "all 0.2s ease",
};

const filtersRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginBottom: "24px",
};

const searchWrapperStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  borderRadius: "12px",
  padding: "0 16px",
  flex: 1,
  maxWidth: "400px",
  transition: "border-color 0.2s ease",
};

const searchInputStyle = {
  flex: 1,
  border: "none",
  background: "transparent",
  padding: "10px 0",
  fontSize: "14px",
  color: "#1c1c1c",
  outline: "none",
  fontFamily: "inherit",
};

const selectGroupStyle = {
  display: "flex",
  alignItems: "center",
  background: "#f9fafb",
  border: "1.5px solid #e5e7eb",
  borderRadius: "12px",
  padding: "0 16px",
  position: "relative",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  padding: "14px 0",
  fontSize: "14px",
  color: "#111827",
  outline: "none",
  appearance: "none",
  cursor: "pointer",
  fontFamily: "inherit",
};

const tableWrapStyle = {
  width: "100%",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
};

const theadRowStyle = { borderBottom: "1px solid #f3f4f6" };

const thStyle = {
  padding: "14px",
  color: "#6b7280",
  fontSize: "13px",
  fontWeight: "600",
};

const trStyle = { borderBottom: "1px solid #f8fafc" };

const tdStyle = { padding: "14px", fontSize: "14px", color: "#1c1c1c" };

const emptyTdStyle = { padding: "24px", color: "#9ca3af", textAlign: "center" };

const loadingStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};

const spinnerStyle = {
  width: "18px",
  height: "18px",
  border: "2px solid #e5e7eb",
  borderTopColor: "#f59e0b",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
};

const tableFooterStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "24px",
};

const footerTextStyle = { fontSize: "13px", color: "#6b7280" };

const infoBoxStyle = {
  background: "#fff7ed",
  border: "1px solid rgba(245,158,11,0.18)",
  borderRadius: "14px",
  padding: "14px",
  width: "100%",
  boxSizing: "border-box",
};

const infoRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid rgba(245,158,11,0.18)",
};

const infoLabelStyle = {
  fontSize: "13px",
  color: "#92400e",
  fontWeight: "600",
};

const infoValueStyle = {
  fontSize: "13px",
  color: "#78350f",
  fontWeight: "700",
};

const messageErrorStyle = {
  color: "#dc2626",
  fontSize: "13px",
  fontWeight: "500",
  margin: 0,
};

const messageSuccessStyle = {
  color: "#10b981",
  fontSize: "13px",
  fontWeight: "500",
  margin: 0,
};

const btnCancelarStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: "12px",
  border: "1.5px solid #e5e7eb",
  background: "transparent",
  cursor: "pointer",
  color: "#6b7280",
  fontWeight: "600",
  fontSize: "14px",
  transition: "all 0.2s ease",
};

const btnEliminarStyle = {
  flex: 1,
  padding: "12px",
  borderRadius: "12px",
  border: "none",
  background: "#dc2626",
  color: "white",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "14px",
  transition: "all 0.2s ease",
};

const actionGroupStyle = {
  display: "flex",
  gap: "6px",
};

const actionBtnStyle = (type) => ({
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease",
  background: type === "edit" ? "#fef3c7" : "#fee2e2",
  color: type === "edit" ? "#d97706" : "#dc2626",
});
