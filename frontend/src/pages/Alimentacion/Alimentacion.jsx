import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Wheat, Table, Save, Calendar, Bird, PackageCheck, AlertTriangle, TrendingDown, Edit, Trash2 } from "lucide-react";

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

function calculateAge(entryDate) {
  if (!entryDate) return 0;
  const start = new Date(entryDate);
  const today = new Date();
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [aliSeleccionado, setAliSeleccionado] = useState(null);

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

      // Preparar filas masivas con lotes en curso (Crianza, Crecimiento o Engorde)
      const activos = dataLotes.filter(l => {
        const st = String(l.estado || "").toLowerCase();
        return st === "crianza" || st === "crecimiento" || st === "engorde" || st === "activo";
      });
      setBulkRows(activos.map(l => ({
        id_lote: l.id_lote,
        nombre: `Lote ${l.id_lote}`,
        raza: l.raza_tipo || "S/R",
        aves: l.cantidad_actual || 0,
        edad: calculateAge(l.fecha_ingreso),
        estado: l.estado,
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

    if (form.insumo_id && !showEditModal) {
      const insumo = insumos.find(i => String(i.id_insumo) === String(form.insumo_id));
      if (insumo && cantidad_kg > parseFloat(insumo.stock_actual)) {
        return setFormError(
          `Stock insuficiente para '${insumo.nombre}'. Disponible: ${insumo.stock_actual} ${insumo.unidad_medida}, Solicitado: ${cantidad_kg} ${insumo.unidad_medida}.`
        );
      }
    }

    setSaving(true);
    try {
      if (showEditModal && aliSeleccionado) {
        await api.patch(`/alimentacion/${aliSeleccionado.id_alimentacion}/`, {
          ...form,
          id_lote,
          insumo_id: form.insumo_id ? Number(form.insumo_id) : null,
          cantidad_kg
        });
        setSuccess("Registro actualizado correctamente.");
        setShowEditModal(false);
      } else {
        await api.post("/alimentacion/", {
          ...form,
          id_lote,
          insumo_id: form.insumo_id ? Number(form.insumo_id) : null,
          cantidad_kg
        });
        setSuccess("Alimentación registrada. El stock del almacén fue actualizado automáticamente.");
        setShowModal(false);
      }
      resetForm();
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

  const handleEditClick = (r) => {
    setAliSeleccionado(r);
    setForm({
      id_lote: String(r.id_lote),
      insumo_id: r.insumo_id ? String(r.insumo_id) : "",
      fecha: r.fecha,
      cantidad_kg: String(r.cantidad_kg),
      tipo_alimento: r.tipo_alimento || "",
      observacion: r.observacion || "",
    });
    setFormError("");
    setSuccess("");
    setShowEditModal(true);
  };

  const handleDeleteAli = async () => {
    setSaving(true);
    try {
      await api.delete(`/alimentacion/${aliSeleccionado.id_alimentacion}/`);
      setSuccess("Registro eliminado.");
      setShowDeleteModal(false);
      setAliSeleccionado(null);
      fetchInitial();
    } catch (e) {
      setFormError("Error al eliminar el registro.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ id_lote: "", insumo_id: "", fecha: todayISO(), cantidad_kg: "", tipo_alimento: "", observacion: "" });
    setAliSeleccionado(null);
  };

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
    return lotes.map(l => {
      const edad = calculateAge(l.fecha_ingreso);
      return { 
        value: String(l.id_lote), 
        label: `Lote ${l.id_lote} — ${l.raza_tipo || "S/R"} (${edad} días, ${l.cantidad_actual} aves)` 
      };
    });
  }, [lotes]);

  const alimentosOptions = useMemo(() => {
    return insumos
      .filter(i => i.tipo === "Alimento")
      .map(i => ({
        value: String(i.id_insumo),
        label: `${i.nombre} (${i.stock_actual} ${i.unidad_medida} disp.)`,
      }));
  }, [insumos]);

  const tiposAlimentoUnicos = useMemo(() => {
    const set = new Set();
    rows.forEach(r => {
      if (r.tipo_alimento) set.add(r.tipo_alimento.trim());
    });
    return Array.from(set).sort();
  }, [rows]);

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
             <button className="alim-primaryBtn" onClick={() => { resetForm(); setModoRegistro("individual"); setShowModal(true); }}>
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

          <div className="alim-filters" style={{gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: 20, alignItems: 'end'}}>
            <ComboBox
              label="Lote"
              value={filtroLote}
              onChange={val => setFiltroLote(val)}
              options={lotes.map(l => ({ value: String(l.id_lote), label: `Lote ${l.id_lote}` }))}
              placeholder="Todos"
            />
            <ComboBox
              label="Insumo / Alimento"
              value={filtroInsumo}
              onChange={val => setFiltroInsumo(val)}
              options={insumos.filter(i => i.tipo === "Alimento").map(i => ({ value: String(i.id_insumo), label: i.nombre }))}
              placeholder="Todos"
            />
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
                  <th>Acciones</th>
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
                    <td>
                      <div className="btn-action-group">
                        <button
                          className="btn-action btn-action--edit"
                          onClick={() => handleEditClick(r)}
                          title="Editar"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="btn-action btn-action--delete"
                          onClick={() => {
                            setAliSeleccionado(r);
                            setShowDeleteModal(true);
                          }}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
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
              
              <ComboBox
                label="Tipo / Marca del Alimento"
                value={form.tipo_alimento}
                onChange={val => setForm({...form, tipo_alimento: val})}
                allowCustom={true}
                options={tiposAlimentoUnicos.map(t => ({ value: t, label: t }))}
                placeholder="Escribe o selecciona..."
              />

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
                      <th>Información del Lote</th>
                      <th>Insumo (Alimento)</th>
                      <th>Kilos (kg)</th>
                      <th>Tipo/Marca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, idx) => (
                      <tr key={r.id_lote}>
                        <td>
                          <div style={{display:'flex', flexDirection:'column', gap:2}}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                              <Bird size={14} color="#f59e0b"/> 
                              <strong>{r.nombre}</strong>
                              <span style={{fontSize:10, background:'#f1f5f9', padding:'2px 6px', borderRadius:4, fontWeight:600, color:'#64748b'}}>
                                {r.estado}
                              </span>
                            </div>
                            <div style={{fontSize:11, color:'#94a3b8', marginLeft:22}}>
                              {r.raza} • {r.aves} aves • <span style={{color:'#0f172a', fontWeight:700}}>{r.edad} días de edad</span>
                            </div>
                          </div>
                        </td>
                        <td style={{minWidth: 200}}>
                          <ComboBox
                            value={r.insumo_id}
                            onChange={val => {
                              const newRows = [...bulkRows];
                              newRows[idx].insumo_id = val;
                              setBulkRows(newRows);
                            }}
                            options={insumos.filter(i => i.tipo === 'Alimento').map(i => ({
                              value: String(i.id_insumo),
                              label: `${i.nombre} (${i.stock_actual} ${i.unit_medida || "kg"})`
                            }))}
                            placeholder="Ninguno"
                          />
                        </td>
                        <td>
                          <input type="number" className="rep-input" style={{padding:'10px 12px', fontSize:13, width:90}} placeholder="0.00" value={r.cantidad_kg} onChange={e => {
                              const newRows = [...bulkRows];
                              newRows[idx].cantidad_kg = e.target.value;
                              setBulkRows(newRows);
                            }} />
                        </td>
                        <td style={{minWidth: 180}}>
                          <ComboBox
                            value={r.tipo_alimento}
                            onChange={val => {
                              const newRows = [...bulkRows];
                              newRows[idx].tipo_alimento = val;
                              setBulkRows(newRows);
                            }}
                            allowCustom={true}
                            options={tiposAlimentoUnicos.map(t => ({ value: t, label: t }))}
                            placeholder="Marca..."
                          />
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

      {showEditModal && (
        <Modal titulo="Editar Registro de Alimentación" onClose={() => setShowEditModal(false)} width="450px">
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
              label="Insumo (Solo informativo en edición)"
              value={form.insumo_id}
              onChange={val => setForm({...form, insumo_id: val})}
              options={alimentosOptions}
              placeholder="Sin insumo vinculado"
            />
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <InputField label="Fecha" type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} />
              <InputField label="Cantidad (kg)" type="number" step="0.01" value={form.cantidad_kg} onChange={e => setForm({...form, cantidad_kg: e.target.value})} placeholder="0.00" />
            </div>
            <ComboBox
              label="Tipo / Marca del Alimento"
              value={form.tipo_alimento}
              onChange={val => setForm({...form, tipo_alimento: val})}
              allowCustom={true}
              options={tiposAlimentoUnicos.map(t => ({ value: t, label: t }))}
              placeholder="Escribe o selecciona..."
            />
            <textarea
              className="alim-textarea"
              placeholder="Observaciones..."
              value={form.observacion}
              onChange={e => setForm({...form, observacion: e.target.value})}
              rows={2}
            />
            {formError && <p className="alim-formError">⚠ {formError}</p>}
            <Button text="Guardar Cambios" loading={saving} icon={<Save size={18} />} />
          </form>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal titulo="Eliminar Registro" onClose={() => setShowDeleteModal(false)}>
          <div style={{ padding: "10px 0 20px" }}>
            <p style={{ color: "#4b5563", fontSize: 14 }}>
              ¿Eliminar el registro de alimentación <strong>#{aliSeleccionado?.id_alimentacion}</strong>?
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button className="rep-btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
            <button className="rep-btn-primary" style={{ background: "#dc2626" }} onClick={handleDeleteAli} disabled={saving}>
              {saving ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Alimentacion;
