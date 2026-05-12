import { useEffect, useMemo, useState } from "react";
import { Warehouse, Thermometer, RefreshCw, Layers, Calendar, AlertCircle, CheckCircle2, Bird } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import StatCard from "../../components/StatCard";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";
import "./Estado.css";

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isActivo(estado) {
  return String(estado || "").toLowerCase() === "activo";
}

function Estado() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [galpones, setGalpones] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [galRes, lotRes] = await Promise.all([
          api.get("/galpones/"),
          api.get("/lotes/"),
        ]);
        if (!alive) return;
        setGalpones(Array.isArray(galRes.data) ? galRes.data : []);
        setLotes(Array.isArray(lotRes.data) ? lotRes.data : []);
        setLastUpdated(new Date());
      } catch (e) {
        console.error("Error al cargar estado", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const galponesActivos = useMemo(
    () => galpones.filter((g) => isActivo(g?.estado)),
    [galpones],
  );

  const avesPorGalpon = useMemo(() => {
    const map = new Map();
    for (const l of lotes) {
      const gid = toNumber(l?.id_galpon);
      const aves = toNumber(l?.cantidad_actual) ?? 0;
      if (gid === null) continue;
      map.set(gid, (map.get(gid) || 0) + aves);
    }
    return map;
  }, [lotes]);

  const totalLotes = lotes.length;
  const totalAves = useMemo(() => {
    return lotes.reduce((acc, l) => acc + (toNumber(l?.cantidad_actual) ?? 0), 0);
  }, [lotes]);

  const rowsGalpones = useMemo(() => {
    return galponesActivos.map((g) => {
      const gid = Number(g.id);
      const usado = avesPorGalpon.get(gid) || 0;
      const cap = toNumber(g.capacidad) ?? 0;
      const pct = cap > 0 ? usado / cap : 0;
      const tipo = pct >= 0.9 ? "riesgo" : "normal";
      return { ...g, _aves: usado, _cap: cap, _pct: pct, _tipo: tipo };
    });
  }, [galponesActivos, avesPorGalpon]);

  const lotesEnriquecidos = useMemo(() => {
    const galponMap = new Map(galpones.map((g) => [Number(g.id), g]));
    return lotes
      .slice()
      .sort((a, b) => (toNumber(b?.id_lote) ?? 0) - (toNumber(a?.id_lote) ?? 0))
      .map((l) => {
        const gid = toNumber(l?.id_galpon);
        const g = gid !== null ? galponMap.get(gid) : null;
        return {
          ...l,
          _galponNombre: g?.nombre || (gid !== null ? `Galpón ${gid}` : "-"),
        };
      });
  }, [lotes, galpones]);

  return (
    <div className="est-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <main className="est-main" style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}>
        
        <header className="est-header">
          <div className="est-title-group">
            <h1 className="est-title">Estado General</h1>
            <p className="est-subtitle">
              <span className="est-live-indicator" />
              Monitoreo en tiempo real de la granja
            </p>
          </div>
          <div className="est-header-right">
            <span className="est-refresh-badge">
              <RefreshCw size={12} /> Sincronizado cada 10s
            </span>
            <span className="est-updated-text">
              {lastUpdated ? `Última actualización: ${lastUpdated.toLocaleTimeString()}` : "Cargando..."}
            </span>
          </div>
        </header>

        <section className="est-stats-grid">
          <StatCard
            label="Galpones Activos"
            value={loading ? "—" : String(galponesActivos.length)}
            trend={loading ? "..." : "En línea"}
            trendType={loading ? "trend-warn" : "trend-up"}
            icon={<Warehouse size={22} color="#92400e" />}
            iconBg="#fef3c7"
          />
          <StatCard
            label="Lotes en Crianza"
            value={loading ? "—" : String(totalLotes)}
            trend={loading ? "..." : "Activos"}
            trendType={loading ? "trend-warn" : "trend-up"}
            icon={<Layers size={22} color="#1e40af" />}
            iconBg="#dbeafe"
          />
          <StatCard
            label="Total de Aves"
            value={loading ? "—" : totalAves.toLocaleString()}
            trend={loading ? "..." : "Población"}
            trendType={loading ? "trend-warn" : "trend-up"}
            icon={<Bird size={22} color="#166534" />}
            iconBg="#dcfce7"
          />
        </section>

        <div className="est-cards-grid">
          <div className="est-panel">
            <div className="est-panel-header">
              <h3 className="est-panel-title"><Warehouse size={20} color="#f59e0b" /> Capacidad de Galpones</h3>
            </div>
            <div className="est-table-wrap">
              <table className="est-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Capacidad</th>
                    <th>Ocupado</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="est-empty">Cargando...</td></tr>
                  ) : rowsGalpones.length === 0 ? (
                    <tr><td colSpan={4} className="est-empty">No hay datos.</td></tr>
                  ) : (
                    rowsGalpones.map((g) => (
                      <tr key={g.id}>
                        <td><strong>{g.nombre}</strong></td>
                        <td>{g._cap.toLocaleString()}</td>
                        <td>{g._aves.toLocaleString()}</td>
                        <td>
                          <span className={`est-badge ${g._tipo === "riesgo" ? "est-badge-danger" : "est-badge-success"}`}>
                            {g._tipo === "riesgo" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                            {g._tipo === "riesgo" ? "Límite" : "Óptimo"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="est-panel">
            <div className="est-panel-header">
              <h3 className="est-panel-title"><Thermometer size={20} color="#f59e0b" /> Últimos Lotes</h3>
            </div>
            <div className="est-table-wrap">
              <table className="est-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Galpón</th>
                    <th>Aves</th>
                    <th>Ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="est-empty">Cargando...</td></tr>
                  ) : lotesEnriquecidos.length === 0 ? (
                    <tr><td colSpan={4} className="est-empty">No hay lotes.</td></tr>
                  ) : (
                    lotesEnriquecidos.map((l) => (
                      <tr key={l.id_lote}>
                        <td><strong>#{l.id_lote}</strong></td>
                        <td>{l._galponNombre}</td>
                        <td>{toNumber(l.cantidad_actual)?.toLocaleString() ?? 0}</td>
                        <td style={{fontSize:12, color:'#94a3b8'}}><Calendar size={12} style={{display:'inline', marginRight:4, verticalAlign:-2}}/> {l.fecha_ingreso}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Estado;
