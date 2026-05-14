import { useEffect, useState, useRef } from "react";
import api from "../../api/axios";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import useIsMobile from "../../hooks/useIsMobile";
import "./Temperatura.css";

function Temperatura() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();

  const [temperaturas, setTemperaturas] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [galpones, setGalpones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensajeManual, setMensajeManual] = useState("");

  const [formManual, setFormManual] = useState({ id_galpon: "", temperatura: "" });

  const simulacionIniciadaRef = useRef(new Set());

  useEffect(() => {
    cargarDatosIniciales();

    const intervalo = setInterval(() => {
      Promise.all([cargarTemperaturasTiempoReal(), cargarHistorial()]);
    }, 15000);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      setCargando(true);
      setError("");
      await Promise.all([
        cargarGalpones(),
        cargarTemperaturasTiempoReal(),
        cargarHistorial(),
      ]);
    } catch (err) {
      console.error("Error cargando temperaturas:", err);
      setError("No se pudieron cargar los datos de temperatura.");
    } finally {
      setCargando(false);
    }
  };

  const cargarGalpones = async () => {
    const res = await api.get("/galpones/");
    const lista = res.data;
    setGalpones(lista);

    for (const g of lista) {
      // Intentar iniciar simulación para cualquier galpón activo con coordenadas
      // que aún no tenga base en el WeatherManager (incluye galpones recién activados)
      if (g.estado === "activo" && g.latitud && g.longitud && !simulacionIniciadaRef.current.has(g.id)) {
        simulacionIniciadaRef.current.add(g.id);
        try {
          await api.post("/temperatura/simulacion/iniciar/", {
            galpon_id: g.id,
            lat: parseFloat(g.latitud),
            lon: parseFloat(g.longitud),
          });
        } catch {
          // fallback a simulación por hora
        }
      }
      // Si el galpón pasó a inactivo, removerlo del set para que si vuelve a activo
      // se reinicie la simulación correctamente
      if (g.estado === "inactivo") {
        simulacionIniciadaRef.current.delete(g.id);
      }
    }
  };

  const cargarTemperaturasTiempoReal = async () => {
    const res = await api.get("/temperatura/tiempo-real/");
    setTemperaturas(res.data);
  };

  const cargarHistorial = async () => {
    const res = await api.get("/temperatura/historial/");
    setHistorial(res.data);
  };

  // ── Registro manual ───────────────────────────────────────────────────────

  const handleChangeManual = (e) => {
    const { name, value } = e.target;
    setFormManual({ ...formManual, [name]: value });
  };

  const registrarTemperaturaManual = async (e) => {
    e.preventDefault();
    setMensajeManual("");
    setError("");

    if (!formManual.id_galpon || formManual.temperatura === "") {
      setError("Debe seleccionar un galpón e ingresar una temperatura.");
      return;
    }

    const tempNum = parseFloat(formManual.temperatura);
    if (isNaN(tempNum)) { setError("La temperatura debe ser un número válido."); return; }
    if (tempNum < 0) { setError("La temperatura no puede ser menor a 0°C."); return; }
    if (tempNum > 60) { setError("La temperatura ingresada supera los 60°C. Verifique el valor."); return; }

    try {
      await Promise.all([
        api.post("/temperatura/manual/", {
          id_galpon: formManual.id_galpon,
          temperatura: tempNum,
        }),
        api.post("/temperatura/clima/manual/", {
          galpon_id: formManual.id_galpon,
          temp: tempNum,
          humidity: 60,
        }),
      ]);

      setMensajeManual("Temperatura registrada exitosamente.");
      setFormManual({ id_galpon: "", temperatura: "" });
      await Promise.all([cargarTemperaturasTiempoReal(), cargarHistorial()]);
    } catch (err) {
      const detalle =
        err?.response?.data?.temperatura?.[0] ||
        err?.response?.data?.non_field_errors?.[0] ||
        "No se pudo registrar la temperatura. Intente nuevamente.";
      setError(detalle);
    }
  };

  // ── Helpers de UI ─────────────────────────────────────────────────────────

  const obtenerClaseEstado = (estado) => {
    if (estado === "FRIO") return "estado-frio";
    if (estado === "CALOR") return "estado-calor";
    if (estado === "NORMAL") return "estado-normal";
    return "estado-sin-datos";
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "Sin fecha";
    return new Date(fecha).toLocaleString("es-BO", {
      dateStyle: "short",
      timeStyle: "medium",
    });
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px",
          flex: 1,
          padding: isMobile ? "16px" : "32px",
          paddingTop: isMobile ? "80px" : "32px",
          transition: "margin-left 0.3s ease",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <Topbar
          titulo="Monitoreo de Temperatura"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        <div className="temperatura-page" style={{ margin: 0, width: "100%", padding: 0 }}>
          <div className="temperatura-header">
            <div>
              <h1>Monitoreo de Temperatura en tiempo real</h1>
            </div>
            <button
              className="btn-actualizar"
              onClick={async () => {
                // Limpia cualquier override manual del WeatherManager
                // para que el siguiente poll use la base real de OpenWeather
                try {
                  const ids = galpones.map((g) => g.id);
                  await Promise.all(
                    ids.map((id) =>
                      api.post("/temperatura/clima/manual/", {
                        galpon_id: id,
                        desactivar: true,
                      })
                    )
                  );
                } catch {
                  // Si falla no bloqueamos la actualización
                }
                cargarTemperaturasTiempoReal();
                cargarHistorial();
              }}
            >
              Actualizar ahora
            </button>
          </div>

          {error && <div className="alerta-error">{error}</div>}
          {mensajeManual && <div className="alerta-ok">{mensajeManual}</div>}

          {cargando ? (
            <div className="cargando">Cargando temperaturas...</div>
          ) : (
            <>
              <section className="temperatura-grid">
                {temperaturas.map((item) => (
                  <div
                    key={item.id_galpon}
                    className={`temperatura-card ${obtenerClaseEstado(item.estado)}`}
                  >
                    <div className="temperatura-card-header">
                      <h2>{item.galpon_nombre}</h2>
                    </div>

                    <div className="temperatura-valor">{item.temperatura}°C</div>

                    <div className="temperatura-estado">
                      Estado: <strong>{item.estado}</strong>
                    </div>

                    <p className="temperatura-mensaje">{item.mensaje}</p>

                    <small>Última actualización: {formatearFecha(item.fecha_hora)}</small>
                  </div>
                ))}

                {temperaturas.length === 0 && (
                  <p style={{ color: "#6b7280" }}>
                    No hay galpones activos con temperatura registrada.
                  </p>
                )}
              </section>

              <section className="temperatura-secciones">
                <div className="temperatura-formulario">
                  <h2>Registrar temperatura manual</h2>
                  <p>
                    Use esta opción para registrar una temperatura de contingencia
                    cuando el sensor no esté disponible.
                  </p>

                  <form onSubmit={registrarTemperaturaManual}>
                    <label>Galpón</label>
                    <select
                      name="id_galpon"
                      value={formManual.id_galpon}
                      onChange={handleChangeManual}
                    >
                      <option value="">Seleccione un galpón</option>
                      {galpones.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nombre}
                          {g.ubicacion_nombre ? ` — ${g.ubicacion_nombre}` : ""}
                        </option>
                      ))}
                    </select>

                    <label>Temperatura °C</label>
                    <input
                      type="number"
                      name="temperatura"
                      value={formManual.temperatura}
                      onChange={handleChangeManual}
                      placeholder="Ejemplo: 28.5"
                      step="0.01"
                      min="0"
                      max="60"
                    />
                    <small style={{ color: "#6b7280", marginTop: "-6px" }}>
                      Rango válido: 0°C – 60°C
                    </small>

                    <button type="submit">Guardar temperatura</button>
                  </form>
                </div>

                <div className="temperatura-historial">
                  <h2>Historial reciente</h2>

                  <table>
                    <thead>
                      <tr>
                        <th>Galpón</th>
                        <th>Temperatura</th>
                        <th>Estado</th>
                        <th>Registrado por</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((item) => (
                        <tr key={item.id}>
                          <td>{item.galpon_nombre}</td>
                          <td>{item.temperatura}°C</td>
                          <td>
                            <span className={`badge ${obtenerClaseEstado(item.estado)}`}>
                              {item.estado}
                            </span>
                          </td>
                          <td>{item.usuario_nombre ?? "—"}</td>
                          <td>{formatearFecha(item.fecha_hora)}</td>
                        </tr>
                      ))}
                      {historial.length === 0 && (
                        <tr>
                          <td colSpan="5">No hay registros de temperatura todavía.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Temperatura;
