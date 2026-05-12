import { useState, useEffect, useMemo } from "react";
import { Calendar, User, Activity, Search, ChevronDown, RefreshCw, Filter, X } from "lucide-react";
import axios from "axios";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import ComboBox from "../../components/ComboBox";
import InputField from "../../components/InputField";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

import "./Bitacora.css";

function safeParseJson(text) {
  if (typeof text !== "string") return null;
  try {
    const first = JSON.parse(text);
    if (typeof first === "string") {
      const trimmed = first.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          return JSON.parse(trimmed);
        } catch {
          return first;
        }
      }
    }
    return first;
  } catch {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    const normalized = trimmed
      .replace(/\bNone\b/g, "null")
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false")
      .replace(/'/g, '"');
    try {
      return JSON.parse(normalized);
    } catch {
      try {
        return JSON.parse(normalized.replace(/\\"/g, '"'));
      } catch {
        return null;
      }
    }
  }
}

function titleCase(text) {
  if (!text) return "";
  return String(text)
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

function getEntidadLabel(entidad) {
  const e = String(entidad ?? "").toLowerCase();
  if (!e) return null;
  const map = {
    usuario: "Usuario", usuarios: "Usuario",
    rol: "Rol", roles: "Rol",
    permiso: "Permiso", permisos: "Permiso",
    galpon: "Galpón", galpones: "Galpón",
    lote: "Lote", lotes: "Lote",
    bitacora: "Bitácora",
    alimentacion: "Alimentación",
    insumo: "Insumo", insumos: "Insumo",
    proveedor: "Proveedor", proveedores: "Proveedor",
  };
  return map[e] ?? titleCase(e);
}

function buildAccionLegible(accion, parsed) {
  const raw = String(accion ?? "").toLowerCase().trim();
  const entidadLabel = getEntidadLabel(parsed?.entidad);
  if (!raw) return "-";
  if (raw === "login") return "Inició sesión";
  if (raw === "logout") return "Cerró sesión";
  if (raw === "crear") return entidadLabel ? `Registró ${entidadLabel}` : "Registró";
  if (raw === "editar") return entidadLabel ? `Editó ${entidadLabel}` : "Editó";
  if (raw === "eliminar") return entidadLabel ? `Eliminó ${entidadLabel}` : "Eliminó";
  return titleCase(raw);
}

function getEntidadNombre(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed.entidad_nombre ?? parsed.nombre ?? parsed.nom_usuario ?? parsed.detalle?.nom_usuario ?? parsed.detalle?.nombre;
  return value ? String(value) : null;
}

function buildDetallesFrase(log, parsed) {
  const actor = String(log.usuario_nombre ?? log.usuario_id ?? "Sistema");
  const rawAccion = String(log.accion ?? "").toLowerCase().trim();
  const targetName = getEntidadNombre(parsed);
  const entidadLabel = getEntidadLabel(parsed?.entidad);
  const verboMap = { crear: "registró", editar: "editó", eliminar: "eliminó" };
  const verbo = verboMap[rawAccion];

  if (rawAccion === "login") return `${actor} inició sesión`;
  if (rawAccion === "logout") return `${actor} cerró sesión`;
  if (!verbo) return `${actor}: ${log.accion}`;

  if (entidadLabel) {
    if (targetName) return `${actor} ${verbo} ${entidadLabel.toLowerCase()}: ${targetName}`;
    return `${actor} ${verbo} ${entidadLabel.toLowerCase()}`;
  }
  return `${actor} ${verbo}`;
}

function formatFecha(fechaIso) {
  if (!fechaIso) return "-";
  const date = new Date(fechaIso);
  return Number.isNaN(date.getTime()) ? String(fechaIso) : date.toLocaleString();
}

function Bitacora() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(null);
  
  // Catálogos para filtros
  const [usuarios, setUsuarios] = useState([]);

  // Estados de filtros (Servidor)
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  
  // Filtro de búsqueda rápida (Cliente)
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    fetchCatalogos();
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCatalogos = async () => {
    try {
      const res = await api.get("/usuarios/");
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Error cargando catálogos", e);
    }
  };

  const loadInitialData = async (params = {}) => {
    setLoading(true);
    try {
      const queryParams = {
        usuario_id: filtroUsuario || undefined,
        accion: filtroAccion || undefined,
        desde: fechaDesde ? `${fechaDesde}T00:00:00` : undefined,
        hasta: fechaHasta ? `${fechaHasta}T23:59:59` : undefined,
        ...params
      };
      
      const res = await api.get("/bitacora/", { params: queryParams });
      setLogs(res.data.results || []);
      setNextPage(res.data.next);
    } catch (error) {
      console.error("Error al cargar bitácora", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await axios.get(nextPage, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` }
      });
      setLogs(prev => [...prev, ...(res.data.results || [])]);
      setNextPage(res.data.next);
    } catch (error) {
      console.error("Error al cargar más datos", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLimpiarFiltros = () => {
    setFiltroUsuario("");
    setFiltroAccion("");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
    loadInitialData({
      usuario_id: undefined,
      accion: undefined,
      desde: undefined,
      hasta: undefined
    });
  };

  const logsProcesados = useMemo(() => {
    return logs.map((log) => {
      const parsed = safeParseJson(log.descripcion);
      return {
        ...log,
        _accionLegible: buildAccionLegible(log.accion, parsed),
        _detallesFrase: buildDetallesFrase(log, parsed),
        _ip: parsed?.http?.ip ?? "-",
      };
    });
  }, [logs]);

  const logsFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase().trim();
    if (!term) return logsProcesados;
    return logsProcesados.filter((log) => 
      String(log.usuario_nombre ?? "").toLowerCase().includes(term) ||
      String(log._detallesFrase ?? "").toLowerCase().includes(term) ||
      String(log._accionLegible ?? "").toLowerCase().includes(term)
    );
  }, [logsProcesados, busqueda]);

  return (
    <div className="bita-layout">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} showMobileTrigger={false} />

      <main className="bita-main" style={{ marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px" }}>
        <Topbar titulo="Bitácora" subtitulo="Control de auditoría y rastreo" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        {/* Panel de Filtros Avanzados */}
        <section className="est-panel" style={{marginBottom: 20, padding: 20}}>
          <div className="est-panel-header" style={{marginBottom: 16}}>
            <h3 className="est-panel-title"><Filter size={16}/> Filtros de Auditoría</h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 12, alignItems: 'end' }}>
            <ComboBox 
              label="Usuario"
              value={filtroUsuario}
              onChange={val => setFiltroUsuario(val)}
              options={usuarios.map(u => ({ value: String(u.id), label: u.nom_usuario }))}
              placeholder="Todos los usuarios"
            />

            <ComboBox 
              label="Tipo de Acción"
              value={filtroAccion}
              onChange={val => setFiltroAccion(val)}
              options={[
                { value: "crear", label: "Registros (Crear)" },
                { value: "editar", label: "Ediciones" },
                { value: "eliminar", label: "Eliminaciones" },
                { value: "login", label: "Inicios de Sesión" },
                { value: "logout", label: "Cierres de Sesión" },
              ]}
              placeholder="Todas las acciones"
            />

            <InputField label="Desde" type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
            <InputField label="Hasta" type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <button className="alim-secondaryBtn" onClick={handleLimpiarFiltros} style={{gap: 6}}>
              <X size={14}/> Limpiar
            </button>
            <button className="alim-primaryBtn" onClick={() => loadInitialData()} style={{gap: 6}}>
              <Search size={14}/> Aplicar Filtros
            </button>
          </div>
        </section>

        {/* Buscador de Resultados (Cliente) */}
        <div className="bita-search" style={{marginBottom: 16}}>
          <Search size={18} color="#9ca3af" />
          <input type="text" placeholder="Búsqueda rápida en resultados cargados..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        <div className="bita-card">
          {loading ? (
            <div className="bita-empty" style={{padding: 60}}>
              <RefreshCw className="animate-spin" size={32} color="#f59e0b" style={{marginBottom: 12}}/>
              <p style={{fontWeight: 600}}>Cargando historial de auditoría...</p>
            </div>
          ) : (
            <div className="bita-tableWrap">
              <table className="bita-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th><User size={14} className="bita-icon" /> Usuario</th>
                    <th><Activity size={14} className="bita-icon" /> Acción</th>
                    <th>Detalles de la Actividad</th>
                    <th>IP</th>
                    <th><Calendar size={14} className="bita-icon" /> Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {logsFiltrados.length === 0 ? (
                    <tr><td colSpan={6} style={{padding: 40, textAlign: 'center', color: '#94a3b8'}}>No se encontraron registros con los filtros seleccionados.</td></tr>
                  ) : (
                    logsFiltrados.map((log, i) => (
                      <tr key={log.id ?? i}>
                        <td>{log.id}</td>
                        <td><strong>{log.usuario_nombre ?? "Sistema"}</strong></td>
                        <td>
                          <span className="est-badge" style={{background: '#f8fafc', border: '1px solid #e2e8f0', textTransform: 'capitalize'}}>
                            {log._accionLegible}
                          </span>
                        </td>
                        <td style={{fontSize: 13, color: '#334155'}}>{log._detallesFrase}</td>
                        <td style={{color: '#94a3b8', fontSize: 11}}>{log._ip}</td>
                        <td style={{fontSize: 12}}>{formatFecha(log.fecha_hora)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {nextPage && (
                <div style={{ padding: 24, textAlign: 'center', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  <button className="alim-secondaryBtn" onClick={loadMore} disabled={loadingMore} style={{ width: '240px', gap: 8, margin: '0 auto' }}>
                    {loadingMore ? <RefreshCw className="animate-spin" size={14}/> : <ChevronDown size={16}/>}
                    {loadingMore ? "Cargando..." : "Cargar registros anteriores"}
                  </button>
                </div>
              )}

              {!nextPage && logsFiltrados.length > 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  Has llegado al final de la bitácora para estos filtros.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Bitacora;
