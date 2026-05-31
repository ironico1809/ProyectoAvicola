import { useEffect, useMemo, useState } from "react";
import { Plus, Stethoscope } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import Modal from "../../../components/Modal";
import InputField from "../../../components/InputField";
import ComboBox from "../../../components/ComboBox";
import Button from "../../../components/Button";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../../Inventario/Inventario.css";

function RegistroSanitario() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [showModal, setShowModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [aplicaciones, setAplicaciones] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [form, setForm] = useState({
    lote: "",
    insumo: "",
    tipo_tratamiento: "Vacuna",
    dosis: "",
    unidad_dosis: "ml",
    fecha_aplicacion: new Date().toISOString().split("T")[0],
    responsable: "",
    observacion: "",
  });

  useEffect(() => {
    try {
      const uStr = localStorage.getItem("usuario");
      if (uStr) {
        const u = JSON.parse(uStr);
        setForm((prev) => ({
          ...prev,
          responsable: u.nom_usuario || u.email || "",
        }));
      }
    } catch {
      // Si el localStorage está corrupto/no es JSON válido, seguimos sin bloquear.
    }
    fetchData();

    // Polling: refresca datos sin interrumpir al usuario
    const id = setInterval(() => fetchData({ silent: true }), 15000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [lotesRes, insRes, appsRes, usuariosRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/insumos/catalogo/"),
        api.get("/sanitario/aplicaciones/"),
        api.get("/usuarios/"),
      ]);

      setLotes(lotesRes.data);

      const sanitarios = (insRes.data || []).filter((i) =>
        ["Vacuna", "Medicamento", "Suministro"].includes(i.tipo),
      );
      setInsumos(sanitarios);

      setAplicaciones(appsRes.data);
      setUsuarios(Array.isArray(usuariosRes.data) ? usuariosRes.data : []);
    } catch (e) {
      console.error("Error cargando datos sanitarios", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/sanitario/aplicaciones/", {
        lote: Number(form.lote),
        insumo: form.insumo ? Number(form.insumo) : null,
        tipo_tratamiento: form.tipo_tratamiento,
        dosis: Number(form.dosis),
        unidad_dosis: form.unidad_dosis,
        fecha_aplicacion: form.fecha_aplicacion,
        responsable: form.responsable,
        observacion: form.observacion,
      });
      setShowModal(false);
      setForm({
        lote: "",
        insumo: "",
        tipo_tratamiento: "Vacuna",
        dosis: "",
        unidad_dosis: "ml",
        fecha_aplicacion: new Date().toISOString().split("T")[0],
        responsable: "",
        observacion: "",
      });
      fetchData();
    } catch (e) {
      console.error("Error al registrar aplicación sanitaria", e);
    }
  };

  const last10 = useMemo(
    () => (aplicaciones || []).slice(0, 10),
    [aplicaciones],
  );

  const responsablesUnicos = useMemo(() => {
    return Array.from(
      new Set((aplicaciones || []).map((a) => a.responsable).filter(Boolean)),
    );
  }, [aplicaciones]);

  const unidadesUnicas = useMemo(() => {
    return Array.from(
      new Set((aplicaciones || []).map((a) => a.unidad_dosis).filter(Boolean)),
    );
  }, [aplicaciones]);

  return (
    <div className="inv-layout">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        showMobileTrigger={false}
      />

      <main
        className="inv-main"
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px",
          padding: isMobile ? "16px" : "32px",
          paddingTop: isMobile ? "80px" : "32px",
          transition: "margin-left 0.3s ease",
          flex: 1,
        }}
      >
        <Topbar
          titulo="Registro de Aplicaciones Sanitarias"
          subtitulo="Vacunas, medicamentos y tratamientos por lote"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="inv-header" style={{ marginBottom: "20px" }}>
          <div style={{ flex: 1 }} />
          <div className="inv-header-actions">
            <button
              className="inv-btn-primary"
              onClick={() => setShowModal(true)}
            >
              <Plus size={16} /> Registrar aplicación
            </button>
          </div>
        </div>

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <Stethoscope size={18} /> Últimas aplicaciones
            </h3>
          </div>

          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Lote</th>
                  <th>Tipo</th>
                  <th>Insumo</th>
                  <th>Dosis</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="inv-empty">
                      Cargando...
                    </td>
                  </tr>
                ) : last10.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="inv-empty">
                      No hay registros.
                    </td>
                  </tr>
                ) : (
                  last10.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontSize: 11 }}>{a.fecha_aplicacion}</td>
                      <td>
                        <strong>{a.lote}</strong>
                      </td>
                      <td>{a.tipo_tratamiento}</td>
                      <td>{a.insumo_nombre || "-"}</td>
                      <td>
                        <strong>{a.dosis}</strong> {a.unidad_dosis}
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
        <Modal
          titulo="Registrar aplicación"
          onClose={() => setShowModal(false)}
        >
          <form className="inv-form" onSubmit={handleCreate}>
            <ComboBox
              label="Lote de Aves"
              value={form.lote}
              onChange={(val) => setForm({ ...form, lote: val })}
              options={lotes
                .filter((l) => l.estado !== "Finalizado")
                .map((l) => ({
                  value: l.id_lote,
                  label: `Lote ${l.id_lote} - ${l.raza_tipo || "Sin raza"} (${l.estado})`,
              }))}
              placeholder="Seleccionar lote..."
              required
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <ComboBox
                label="Insumo Utilizado"
                value={form.insumo}
                onChange={(val) => setForm({ ...form, insumo: val })}
                options={insumos.map((i) => ({
                  value: i.id_insumo,
                  label: i.nombre,
                }))}
                placeholder="Ninguno / Genérico"
              />

              <ComboBox
                label="Tipo de Tratamiento"
                value={form.tipo_tratamiento}
                onChange={(val) => setForm({ ...form, tipo_tratamiento: val })}
                options={[
                  { value: "Vacuna", label: "Vacuna" },
                  { value: "Medicamento", label: "Medicamento" },
                  { value: "Vitamina", label: "Vitamina" },
                  { value: "Antibiotico", label: "Antibiótico" },
                  { value: "Desinfectante", label: "Desinfectante" },
                  { value: "Otro", label: "Otro" },
                ]}
                placeholder="Seleccionar tipo..."
                required
              />
            </div>

            <InputField
              label="Fecha de Aplicación"
              type="date"
              value={form.fecha_aplicacion}
              onChange={(e) =>
                setForm({ ...form, fecha_aplicacion: e.target.value })
              }
              required
            />

            <InputField
              label="Cantidad / Dosis"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.dosis}
              onChange={(e) => setForm({ ...form, dosis: e.target.value })}
              required
            />

            <ComboBox
              label="Unidad (ej: ml, gr, dosis)"
              value={form.unidad_dosis}
              onChange={(val) => setForm({ ...form, unidad_dosis: val })}
              allowCustom={true}
              options={[
                { value: "ml", label: "ml" },
                { value: "gr", label: "gr" },
                { value: "mg", label: "mg" },
                { value: "dosis", label: "dosis" },
                { value: "gotas", label: "gotas" },
                ...unidadesUnicas.map((u) => ({ value: u, label: u })),
              ].filter(
                (v, i, a) => a.findIndex((t) => t.value === v.value) === i,
              )}
              placeholder="Escribe o selecciona..."
              required
            />

            <ComboBox
              label="Personal Responsable"
              value={form.responsable}
              onChange={(val) => setForm({ ...form, responsable: val })}
              allowCustom={true}
              options={[
                ...usuarios.map((u) => ({
                  value: u.nom_usuario,
                  label: u.nom_usuario,
                })),
                ...responsablesUnicos.map((r) => ({ value: r, label: r })),
              ].filter(
                (v, i, a) => a.findIndex((t) => t.value === v.value) === i,
              )}
              placeholder="Nombre del encargado"
            />

            <InputField
              label="Observaciones Adicionales"
              placeholder="Detalles sobre la aplicación..."
              value={form.observacion}
              onChange={(e) =>
                setForm({ ...form, observacion: e.target.value })
              }
            />

            <Button text="Guardar" icon={<Plus size={18} />} />
          </form>
        </Modal>
      )}
    </div>
  );
}

export default RegistroSanitario;
