import { useEffect, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import Sidebar from "../../../components/Sidebar";
import api from "../../../api/axios";
import useIsMobile from "../../../hooks/useIsMobile";
import "../../Inventario/Inventario.css";

function HistorialClinico() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [lotes, setLotes] = useState([]);
  const [loteSelected, setLoteSelected] = useState("");
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    fetchLotes();
  }, []);

  const fetchLotes = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lotes/");
      setLotes(res.data);
    } catch (e) {
      console.error("Error cargando lotes", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistorial = async () => {
    if (!loteSelected) return;
    setLoading(true);
    try {
      const res = await api.get("/sanitario/historial/", {
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
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <main
        className="inv-main"
        style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}
      >
        <header className="inv-header">
          <div className="inv-title-group">
            <h1 className="inv-title">Historial Clínico de Lotes</h1>
            <p className="inv-subtitle">
              <ClipboardList size={14} /> Cronología de tratamientos por lote
            </p>
          </div>
        </header>

        <section className="est-panel">
          <div className="est-panel-header">
            <h3 className="est-panel-title">
              <Search size={18} /> Seleccionar lote
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
            <div className="rep-filter-item" style={{ minWidth: 260 }}>
              <label className="rep-filter-label">Lote</label>
              <select
                className="rep-select"
                value={loteSelected}
                onChange={(e) => setLoteSelected(e.target.value)}
                style={{ paddingLeft: 12 }}
              >
                <option value="">Seleccionar...</option>
                {lotes.map((l) => (
                  <option key={l.id_lote} value={l.id_lote}>
                    Lote {l.id_lote} ({l.estado})
                  </option>
                ))}
              </select>
            </div>

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

        <section className="est-panel">
          <div className="est-panel-header">
            <h3 className="est-panel-title">
              <ClipboardList size={18} /> Historial
            </h3>
          </div>

          <div className="est-table-wrap">
            <table className="est-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Insumo</th>
                  <th>Dosis</th>
                  <th>Responsable</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, color: "#64748b" }}>
                      Cargando...
                    </td>
                  </tr>
                ) : !loteSelected ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, color: "#64748b" }}>
                      Selecciona un lote para ver el historial.
                    </td>
                  </tr>
                ) : historial.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, color: "#64748b" }}>
                      Sin tratamientos registrados para este lote.
                    </td>
                  </tr>
                ) : (
                  historial.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 11 }}>{h.fecha_aplicacion}</td>
                      <td>{h.tipo_tratamiento}</td>
                      <td>{h.insumo_nombre || "-"}</td>
                      <td>
                        <strong>{h.dosis}</strong> {h.unidad_dosis}
                      </td>
                      <td>{h.responsable || "-"}</td>
                      <td
                        style={{
                          maxWidth: 320,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {h.observacion || "-"}
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
