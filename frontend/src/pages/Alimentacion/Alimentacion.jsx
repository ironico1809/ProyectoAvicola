import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Wheat, Table, Save, Calendar, Bird, PackageCheck, AlertTriangle, TrendingDown } from "lucide-react";

import Sidebar from "../../components/Sidebar";
import Modal from "../../components/Modal";
import InputField from "../../components/InputField";
import Button from "../../components/Button";
import AlertItem from "../../components/AlertItem";
import ComboBox from "../../components/ComboBox";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

import "./Alimentacion.css";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function todayISO() {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function Alimentacion() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lotes, setLotes] = useState([]);
  const [rows, setRows] = useState([]);
  const [insumos, setInsumos] = useState([]);

  const [modoRegistro, setModoRegistro] = useState("individual");
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroInsumo, setFiltroInsumo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    id_lote: "",
    insumo_id: "",
    fecha: todayISO(),
    cantidad_kg: "",
    tipo_alimento: "",
    observacion: "",
  });

  const [bulkRows, setBulkRows] = useState([]);
  const [bulkFecha, setBulkFecha] = useState(todayISO());

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    setLoading(true);
    setFormError("");
    try {
      const [lotesRes, alimentRes, insumosRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/alimentacion/"),
        api.get("/insumos/catalogo/"),
      ]);

      const dataLotes = Array.isArray(lotesRes.data) ? lotesRes.data : [];
      setLotes(dataLotes);
      setRows(Array.isArray(alimentRes.data) ? alimentRes.data : []);
      setInsumos(Array.isArray(insumosRes.data) ? insumosRes.data : []);

      const activos = dataLotes.filter(l => String(l.estado).toLowerCase() === "crianza");
      setBulkRows(activos.map(l => ({
        id_lote: l.id_lote,
        nombre: `Lote ${l.id_lote}`,
        cantidad_kg: "",
        tipo_alimento: "",
        insumo_id: "",
      })));
    } catch (e) {
      console.error("Error al cargar alimentación", e);
      setFormError("No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroLote) params.id_lote = filtroLote;
      if (filtroInsumo) params.insumo_id = filtroInsumo;
      if (fechaInicio) params.fecha_inicio = fechaInicio;
      if (fechaFin) params.fecha_fin = fechaFin;
      const res = await api.get("/alimentacion/", { params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setFormError("Error al consultar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrarIndividual = async (e) => {
    e.preventDefault();
    setFormError("");
    const id_lote = toNumber(form.id_lote);
    const cantidad_kg = toNumber(form.cantidad_kg);

    if (!id_lote) return setFormError("Selecciona un lote.");
    if (!cantidad_kg || cantidad_kg <= 0) return setFormError("Cantidad inválida.");

    // Verificación previa en el frontend
    if (form.insumo_id) {
      const insumo = insumos.find(i => String(i.id_insumo) === String(form.insumo_id));
      if (insumo && cantidad_kg > parseFloat(insumo.stock_actual)) {
        return setFormError(
          `Stock insuficiente para '${insumo.nombre}'. Disponible: ${insumo.stock_actual} ${insumo.unidad_medida}, Solicitado: ${cantidad_kg} ${insumo.unidad_medida}.`
        );
      }
    }

    setSaving(true);
    try {
      await api.post("/alimentacion/", {
        ...form,
        id_lote,
        insumo_id: form.insumo_id ? Number(form.insumo_id) : null,
        cantidad_kg
      });
      setSuccess("Alimentación registrada. El stock del almacén fue actualizado automáticamente.");
      setShowModal(false);
      setForm({ id_lote: "", insumo_id: "", fecha: todayISO(), cantidad_kg: "", tipo_alimento: "", observacion: "" });
      fetchInitial();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Error al guardar.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarMasivo = async () => {
    setFormError("");
    const validos = bulkRows.filter(r => toNumber(r.cantidad_kg) > 0);
    if (validos.length === 0) return setFormError("Ingresa al menos una cantidad válida.");

    setSaving(true);
    try {
      const registros = validos.map(r => ({
        id_lote: r.id_lote,
        insumo_id: r.insumo_id ? Number(r.insumo_id) : null,
        fecha: bulkFecha,
        cantidad_kg: toNumber(r.cantidad_kg),
        tipo_alimento: String(r.tipo_alimento || "").trim() || null,
      }));
      await api.post("/alimentacion/bulk/", { registros });
      setSuccess(`Se registraron ${registros.length} alimentaciones. El inventario fue actualizado.`);
      setShowModal(false);
      fetchInitial();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Error en el registro masivo.";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Insumo seleccionado para el preview de stock
  const insumoSeleccionado = useMemo(() => {
    if (!form.insumo_id) return null;
    return insumos.find(i => String(i.id_insumo) === String(form.insumo_id)) || null;
  }, [form.insumo_id, insumos]);

  const stockTras = useMemo(() => {
    if (!insumoSeleccionado) return null;
    const cant = toNumber(form.cantidad_kg) || 0;
    return parseFloat(insumoSeleccionado.stock_actual) - cant;
  }, [insumoSeleccionado, form.cantidad_kg]);

  const lotesOptions = useMemo(() => {
    return lotes.map(l => ({ value: String(l.id_lote), label: `Lote ${l.id_lote} — ${l.raza || ""}` }));
  }, [lotes]);

  const alimentosOptions = useMemo(() => {
    return insumos
      .filter(i => i.tipo === "Alimento")
      .map(i => ({
        value: String(i.id_insumo),
        label: `${i.nombre} (${i.stock_actual} ${i.unidad_medida} disp.)`,
      }));
  }, [insumos]);

  return (
    <div className="alim-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />
      <main className="alim-main" style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}>
        <header className="est-header" style={{marginBottom: 20}}>
          <div className="est-title-group">
            <h1 className="est-title">Gestión de Alimentación</h1>
            <p className="est-subtitle"><Wheat size={14} /> Control de nutrición y consumo · Inventario integrado</p>
          </div>
          <div className="est-header-right">
             <button className="alim-primaryBtn" onClick={() => { setModoRegistro("individual"); setShowModal(true); }}>
              <Plus size={16} /> Registro Individual
            </button>
             <button className="alim-primaryBtn" style={{background:'#3b82f6'}} onClick={() => { setModoRegistro("masivo"); setShowModal(true); }}>
              <Table size={16} /> Registro Masivo
            </button>
          </div>
        </header>

        {(success || formError) && (
          <div style={{marginBottom:16}}>
            {success && <AlertItem type="info" title="Éxito" desc={success} icon={<PackageCheck size={18}/>} />}
            {formError && <AlertItem type="danger" title="Error" desc={formError} icon={<AlertTriangle size={18}/>} />}
          </div>
        )}

        <div className="alim-card">
          <div className="alim-cardHeader">
            <h2 className="alim-title">Historial de Consumo</h2>
            <div className="alim-actions">
               <button className="alim-secondaryBtn" onClick={() => { setFiltroLote(""); setFiltroInsumo(""); setFechaInicio(""); setFechaFin(""); fetchInitial(); }}>
                Limpiar
              </button>
              <button className="alim-primaryBtn" onClick={fetchHistorial}><Search size={16} /> Buscar</button>
            </div>
          </div>

          <div className="alim-filters" style={{gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: 20}}>
            <div>
              <label className="alim-label">Lote</label>
              <select className="alim-select" value={filtroLote} onChange={(e) => setFiltroLote(e.target.value)}>
                <option value="">Todos los lotes</option>
                {lotes.map(l => <option key={l.id_lote} value={l.id_lote}>Lote {l.id_lote}</option>)}
              </select>
            </div>
            <div>
              <label className="alim-label">Insumo / Alimento</label>
              <select className="alim-select" value={filtroInsumo} onChange={(e) => setFiltroInsumo(e.target.value)}>
                <option value="">Todos</option>
                {insumos.filter(i => i.tipo === "Alimento").map(i => (
                  <option key={i.id_insumo} value={i.id_insumo}>{i.nombre}</option>
                ))}
              </select>
            </div>
            <InputField label="Desde" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            <InputField label="Hasta" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>

          <div className="alim-tableWrap">
            <table className="alim-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lote</th>
                  <th>Fecha</th>
                  <th>Insumo / Alimento</th>
                  <th>Cantidad</th>
                  <th>Tipo / Marca</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="alim-empty">Cargando...</td></tr> :
                 rows.length === 0 ? <tr><td colSpan={7} className="alim-empty">Sin registros.</td></tr> :
                 rows.map(r => (
                  <tr key={r.id_alimentacion}>
                    <td><strong>#{r.id_alimentacion}</strong></td>
                    <td>Lote {r.id_lote}</td>
                    <td>{r.fecha}</td>
                    <td>
                      {r.insumo_nombre
                        ? <span style={{display:'flex', alignItems:'center', gap:6}}><Wheat size={14} color="#f59e0b"/>{r.insumo_nombre}</span>
                        : <span className="alim-muted">—</span>
                      }
                    </td>
                    <td style={{fontWeight:700, color:'#b45309'}}>{r.cantidad_kg} kg</td>
                    <td className="alim-muted">{r.tipo_alimento || "—"}</td>
                    <td className="alim-muted">{r.observacion || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showModal && (
        <Modal titulo={modoRegistro === "individual" ? "Nuevo Registro de Alimentación" : "Registro Masivo"} onClose={() => setShowModal(false)} width={modoRegistro === "masivo" ? "850px" : "450px"}>
          {modoRegistro === "individual" ? (
            <form className="alim-form" onSubmit={handleRegistrarIndividual}>
              <ComboBox
                label="Lote de Aves"
                value={form.id_lote}
                onChange={val => setForm({...form, id_lote: val})}
                options={lotesOptions}
                placeholder="Seleccionar lote..."
                required
              />
              <ComboBox
                label="Descontar de Almacén (Alimento)"
                value={form.insumo_id}
                onChange={val => setForm({...form, insumo_id: val})}
                options={alimentosOptions}
                placeholder="No descontar inventario"
              />

              {/* Preview de stock en tiempo real */}
              {insumoSeleccionado && (
                <div className={`alim-stock-preview ${stockTras !== null && stockTras < parseFloat(insumoSeleccionado.stock_minimo) ? "alim-stock-preview--warn" : ""}`}>
                  <div className="alim-stock-preview__row">
                    <span className="alim-stock-preview__label"><PackageCheck size={14}/> Stock actual</span>
                    <span className="alim-stock-preview__value">{insumoSeleccionado.stock_actual} {insumoSeleccionado.unidad_medida}</span>
                  </div>
                  <div className="alim-stock-preview__row">
                    <span className="alim-stock-preview__label"><TrendingDown size={14}/> Quedaría tras consumo</span>
                    <span className={`alim-stock-preview__value ${stockTras !== null && stockTras < 0 ? "alim-stock-preview__value--danger" : ""}`}>
                      {stockTras !== null ? `${stockTras.toFixed(2)} ${insumoSeleccionado.unidad_medida}` : "—"}
                    </span>
                  </div>
                  {stockTras !== null && stockTras < parseFloat(insumoSeleccionado.stock_minimo) && stockTras >= 0 && (
                    <div className="alim-stock-preview__alert">
                      <AlertTriangle size={13}/> Quedará por debajo del stock mínimo ({insumoSeleccionado.stock_minimo} {insumoSeleccionado.unidad_medida}).
                    </div>
                  )}
                  {stockTras !== null && stockTras < 0 && (
                    <div className="alim-stock-preview__alert alim-stock-preview__alert--danger">
                      <AlertTriangle size={13}/> No hay stock suficiente. El registro será rechazado.
                    </div>
                  )}
                </div>
              )}

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <InputField label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
                <InputField label="Cantidad (kg)" type="number" step="0.01" value={form.cantidad_kg} onChange={e => setForm({...form, cantidad_kg: e.target.value})} placeholder="0.00" />
              </div>
              <InputField label="Tipo / Marca del Alimento" value={form.tipo_alimento} onChange={e => setForm({...form, tipo_alimento: e.target.value})} placeholder="Ej: Balanceado Iniciador" />
              <textarea
                className="alim-textarea"
                placeholder="Observaciones opcionales..."
                value={form.observacion}
                onChange={e => setForm({...form, observacion: e.target.value})}
                rows={2}
              />
              {formError && <p className="alim-formError">⚠ {formError}</p>}
              <Button text="Guardar Registro" loading={saving} icon={<Save size={18} />} />
            </form>
          ) : (
            <div className="alim-bulk-container" style={{display:'flex', flexDirection:'column', gap:16}}>
              <div style={{display:'flex', alignItems:'center', gap:12, background:'#f8fafc', padding:12, borderRadius:12, border:'1px solid #e2e8f0'}}>
                <Calendar size={18} color="#64748b" />
                <span style={{fontSize:13, fontWeight:600, color:'#475569'}}>Fecha Global:</span>
                <input type="date" className="rep-input" value={bulkFecha} onChange={e => setBulkFecha(e.target.value)} style={{width:'auto', padding:'6px 12px'}} />
              </div>
              <div className="rep-table-container" style={{maxHeight: 400, overflowY:'auto'}}>
                <table className="rep-table">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Insumo (Alimento)</th>
                      <th>Kilos (kg)</th>
                      <th>Tipo/Marca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, idx) => (
                      <tr key={r.id_lote}>
                        <td><div style={{display:'flex', alignItems:'center', gap:8}}><Bird size={14}/> <strong>{r.nombre}</strong></div></td>
                        <td>
                          <select className="rep-select" style={{padding:'6px 10px', fontSize:12}} value={r.insumo_id} onChange={e => {
                              const newRows = [...bulkRows];
                              newRows[idx].insumo_id = e.target.value;
                              setBulkRows(newRows);
                            }}>
                            <option value="">Ninguno</option>
                            {insumos.filter(i => i.tipo === 'Alimento').map(i => <option key={i.id_insumo} value={i.id_insumo}>{i.nombre} ({i.stock_actual} {i.unidad_medida})</option>)}
     </select>
                        </td>
                        <td>
                          <input type="number" className="rep-input" style={{padding:'6px 10px', fontSize:12, width:90}} placeholder="0.00" value={r.cantidad_kg} onChange={e => {
                              const newRows = [...bulkRows];
                              newRows[idx].cantidad_kg = e.target.value;
                              setBulkRows(newRows);
                            }} />
                        </td>
                        <td>
                          <input type="text" className="rep-input" style={{padding:'6px 10px', fontSize:12}} placeholder="Marca..." value={r.tipo_alimento} onChange={e => {
                              const newRows = [...bulkRows];
                              newRows[idx].tipo_alimento = e.target.value;
                              setBulkRows(newRows);
                            }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {formError && <p className="alim-formError">⚠ {formError}</p>}
              <div style={{display:'flex', justifyContent:'flex-end', gap:12}}>
                <button className="rep-btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="rep-btn-primary" onClick={handleRegistrarMasivo} disabled={saving}><Save size={16} /> {saving ? "Guardando..." : "Guardar Todos"}</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export default Alimentacion;
