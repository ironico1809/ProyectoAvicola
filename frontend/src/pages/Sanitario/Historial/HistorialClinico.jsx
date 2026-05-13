import { useEffect, useState } from "react";
import { ClipboardList, Search, Edit, Trash2 } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import Topbar from "../../../components/Topbar";
import ComboBox from "../../../components/ComboBox";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../../Inventario/Inventario.css";

function HistorialClinico() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [lotes, setLotes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loteSelected, setLoteSelected] = useState("");

  useEffect(() => {
    fetchLotes();
  }, []);

  const fetchLotes = async () => {
    try {
      const res = await api.get("/lotes/");
      setLotes(res.data);
    } catch (e) {
      console.error("Error cargando lotes", e);
    }
  };

  const fetchHistorial = async () => {
    if (!loteSelected) return;
    setLoading(true);
    try {
      const res = await api.get("/sanitario/aplicaciones/", {
        params: { lote: loteSelected },
      });
      setHistorial(res.data);
    } catch (e) {
      console.error("Error cargando historial", e);
    } finally {
      setLoading(false);
    }
  };

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
        <Topbar titulo="Historial Clínico por Lote" subtitulo="Consulta de tratamientos aplicados" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div className="inv-header" style={{ marginBottom: '20px' }}>
          {/* Header content moved to Topbar, but keeping space if needed */}
        </div>

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <Search size={18} /> Filtrar por Lote
            </h3>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
              padding: 12,
              flexWrap: "wrap",
            }}
          >
            <ComboBox
              label="Lote"
              value={loteSelected}
              onChange={(val) => setLoteSelected(val)}
              options={lotes.map((l) => ({
                value: String(l.id_lote),
                label: `Lote ${l.id_lote} (${l.estado})`,
              }))}
              placeholder="Buscar lote..."
            />

            <button
              className="inv-btn-primary"
              type="button"
              disabled={!loteSelected}
              onClick={fetchHistorial}
            >
              Buscar
            </button>
          </div>
        </section>

        <section className="inv-panel">
          <div className="inv-panel-header">
            <h3 className="inv-panel-title">
              <ClipboardList size={18} /> Registros encontrados
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
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!loteSelected ? (
                  <tr>
                    <td colSpan={7} className="inv-empty">
                      Selecciona un lote para ver su historial.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={7} className="inv-empty">
                      Cargando registros...
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="inv-empty">
                      No se encontraron aplicaciones para este lote.
                    </td>
                  </tr>
                ) : (
                  historial.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 11 }}>{h.fecha_aplicacion}</td>
                      <td>
                        <strong>{h.lote}</strong>
                      </td>
                      <td>{h.tipo_tratamiento}</td>
                      <td>{h.insumo_nombre || "-"}</td>
                      <td>{h.dosis} {h.unit_dosis || h.unidad_dosis}</td>
                      <td>{h.responsable || "-"}</td>
                      <td>
                        <div className="btn-action-group">
                          <button
                            className="btn-action btn-action--edit"
                            title="Editar"
                            onClick={() => alert('Próximamente: Edición de historial')}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn-action btn-action--delete"
                            title="Eliminar"
                            onClick={() => alert('Próximamente: Eliminación de historial')}
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
    </div>
  );
}

export default HistorialClinico;
