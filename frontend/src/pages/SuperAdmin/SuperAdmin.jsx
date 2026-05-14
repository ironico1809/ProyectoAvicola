import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Globe, Building2, Users, DollarSign, TrendingUp, AlertCircle,
  CheckCircle2, Clock, XCircle, RefreshCw, LogOut, Plus, Server,
  Shield, Database, Brain, BookOpen, ChevronDown, Save, Eye, EyeOff,
  Activity, HardDrive, Cpu, MemoryStick,
} from "lucide-react";
import api from "../../api/axios";

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  brand: "#78350f",
  brandLight: "#92400e",
  gold: "#fbbf24",
  goldLight: "#fef3c7",
  bg: "#f8fafc",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray400: "#9ca3af",
  gray500: "#6b7280",
  gray700: "#374151",
  gray900: "#111827",
  blue: "#1d4ed8",
  green: "#16a34a",
  red: "#dc2626",
  yellow: "#ca8a04",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function estadoBadge(estado) {
  const map = {
    activa:     { bg: "#dcfce7", color: C.green,  icon: <CheckCircle2 size={12} />, label: "Activa" },
    trial:      { bg: "#fef9c3", color: C.yellow, icon: <Clock size={12} />,        label: "Trial" },
    suspendida: { bg: "#fee2e2", color: C.red,    icon: <XCircle size={12} />,      label: "Suspendida" },
  };
  const s = map[estado] ?? { bg: C.gray100, color: C.gray500, icon: null, label: estado };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:s.bg, color:s.color, padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:600 }}>
      {s.icon} {s.label}
    </span>
  );
}

function accionBadge(accion) {
  const map = {
    login:         { bg:"#dbeafe", color:"#1d4ed8" },
    login_fallido: { bg:"#fee2e2", color:C.red },
    logout:        { bg:C.gray100, color:C.gray500 },
    crear:         { bg:"#dcfce7", color:C.green },
    editar:        { bg:"#fef9c3", color:C.yellow },
    eliminar:      { bg:"#fee2e2", color:C.red },
  };
  const s = map[accion] ?? { bg:C.gray100, color:C.gray500 };
  return (
    <span style={{ background:s.bg, color:s.color, padding:"2px 8px", borderRadius:12, fontSize:11, fontWeight:600 }}>
      {accion}
    </span>
  );
}

function GaugeBar({ pct, color }) {
  const col = pct > 80 ? C.red : pct > 60 ? C.yellow : color;
  return (
    <div style={{ background:C.gray100, borderRadius:99, height:8, overflow:"hidden", flex:1 }}>
      <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:col, borderRadius:99, transition:"width .4s" }} />
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color = C.brand }) {
  return (
    <div style={{ background:C.white, borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.07)", display:"flex", alignItems:"center", gap:16, flex:"1 1 200px" }}>
      <div style={{ background:color+"18", borderRadius:12, padding:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p style={{ margin:0, fontSize:13, color:C.gray500, fontWeight:500 }}>{label}</p>
        <p style={{ margin:0, fontSize:26, fontWeight:800, color:C.gray900 }}>{value}</p>
        {sub && <p style={{ margin:0, fontSize:12, color:C.gray400 }}>{sub}</p>}
      </div>
    </div>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background:C.white, borderRadius:16, boxShadow:"0 2px 12px rgba(0,0,0,0.07)", overflow:"hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, right }) {
  return (
    <div style={{ padding:"18px 24px", borderBottom:`1px solid ${C.gray100}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <span style={{ color:C.brand }}>{icon}</span>
        <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:C.gray900 }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

function Input({ label, error, ...props }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:C.gray700 }}>{label}</label>}
      <input {...props} style={{ border:`1px solid ${error ? C.red : C.gray200}`, borderRadius:8, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, ...props.style }} />
      {error && <span style={{ fontSize:11, color:C.red }}>{error}</span>}
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <label style={{ fontSize:12, fontWeight:600, color:C.gray700 }}>{label}</label>}
      <select {...props} style={{ border:`1px solid ${C.gray200}`, borderRadius:8, padding:"9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", background:C.white, cursor:"pointer" }}>
        {children}
      </select>
    </div>
  );
}

function Spinner() {
  return <RefreshCw size={22} color={C.brand} style={{ animation:"spin 1s linear infinite" }} />;
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background:"#fee2e2", border:`1px solid #fca5a5`, borderRadius:12, padding:"14px 18px", display:"flex", gap:10, alignItems:"center", color:C.red, fontSize:13 }}>
      <AlertCircle size={18} /> {msg}
    </div>
  );
}

// ─── Tab Clientes ─────────────────────────────────────────────────────────────
function TabClientes({ data, planes, onRefresh }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ nombre:"", email_contacto:"", plan_id:"", estado:"trial", admin_usuario:"", admin_email:"", admin_password:"" });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [verPass, setVerPass] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async () => {
    setGuardando(true);
    setErrores({});
    setExito("");
    try {
      await api.post("/empresas/superadmin/clientes/", form);
      setExito("Empresa y administrador creados correctamente.");
      setForm({ nombre:"", email_contacto:"", plan_id:"", estado:"trial", admin_usuario:"", admin_email:"", admin_password:"" });
      setMostrarForm(false);
      onRefresh();
    } catch (err) {
      if (err.response?.data && typeof err.response.data === "object") {
        setErrores(err.response.data);
      } else {
        setErrores({ general: "Error al crear la empresa." });
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
      {/* Resumen */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
        <MetricCard icon={<Building2 size={24}/>} label="Total Empresas" value={data.resumen.total_empresas} sub={`${data.resumen.empresas_activas} activas · ${data.resumen.empresas_trial} en trial`} color={C.brand} />
        <MetricCard icon={<Users size={24}/>} label="Total Usuarios" value={data.resumen.total_usuarios} sub="Excluye SuperAdmin" color={C.blue} />
        <MetricCard icon={<DollarSign size={24}/>} label="Ingreso Mensual Est." value={`$${Number(data.resumen.ingreso_mensual_estimado ?? 0).toFixed(2)}`} sub="Empresas activas con plan" color={C.green} />
        <MetricCard icon={<TrendingUp size={24}/>} label="Suspendidas" value={data.resumen.empresas_suspendidas} sub="Requieren atención" color={C.red} />
      </div>

      {/* Botón alta */}
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button onClick={() => { setMostrarForm(v => !v); setErrores({}); setExito(""); }} style={btnPrimStyle}>
          <Plus size={16} /> {mostrarForm ? "Cancelar" : "Alta de nuevo cliente"}
        </button>
      </div>

      {/* Formulario alta */}
      {mostrarForm && (
        <Card>
          <CardHeader icon={<Plus size={18}/>} title="Registrar nueva empresa" />
          <div style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
            {errores.general && <ErrorBox msg={errores.general} />}
            {exito && <div style={{ background:"#dcfce7", border:`1px solid #86efac`, borderRadius:10, padding:"12px 16px", color:C.green, fontSize:13 }}>{exito}</div>}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <Input label="Nombre de la empresa *" value={form.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Ej: Avícola del Norte S.A." error={errores.nombre} />
              <Input label="Email de contacto *" type="email" value={form.email_contacto} onChange={e=>set("email_contacto",e.target.value)} placeholder="contacto@empresa.com" error={errores.email_contacto} />
              <Select label="Plan" value={form.plan_id} onChange={e=>set("plan_id",e.target.value)}>
                <option value="">Sin plan</option>
                {planes.map(p => <option key={p.id} value={p.id}>{p.nombre} — ${p.precio_mensual}/mes</option>)}
              </Select>
              <Select label="Estado inicial" value={form.estado} onChange={e=>set("estado",e.target.value)}>
                <option value="trial">Trial</option>
                <option value="activa">Activa</option>
                <option value="suspendida">Suspendida</option>
              </Select>
            </div>

            <div style={{ borderTop:`1px solid ${C.gray100}`, paddingTop:16 }}>
              <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:600, color:C.gray700 }}>Primer administrador</p>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
                <Input label="Usuario *" value={form.admin_usuario} onChange={e=>set("admin_usuario",e.target.value)} placeholder="admin_empresa" error={errores.admin_usuario} />
                <Input label="Email *" type="email" value={form.admin_email} onChange={e=>set("admin_email",e.target.value)} placeholder="admin@empresa.com" error={errores.admin_email} />
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <label style={{ fontSize:12, fontWeight:600, color:C.gray700 }}>Contraseña *</label>
                  <div style={{ position:"relative" }}>
                    <input type={verPass?"text":"password"} value={form.admin_password} onChange={e=>set("admin_password",e.target.value)} placeholder="Mín. 6 caracteres" style={{ width:"100%", border:`1px solid ${errores.admin_password?C.red:C.gray200}`, borderRadius:8, padding:"9px 36px 9px 12px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                    <button onClick={()=>setVerPass(v=>!v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.gray400, padding:0 }}>
                      {verPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                  {errores.admin_password && <span style={{ fontSize:11, color:C.red }}>{errores.admin_password}</span>}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <button onClick={guardar} disabled={guardando} style={{ ...btnPrimStyle, opacity:guardando?0.7:1 }}>
                {guardando ? <Spinner/> : <Save size={16}/>}
                {guardando ? "Guardando…" : "Crear empresa"}
              </button>
            </div>
          </div>
        </Card>
      )}

      {exito && !mostrarForm && (
        <div style={{ background:"#dcfce7", border:`1px solid #86efac`, borderRadius:10, padding:"12px 16px", color:C.green, fontSize:13 }}>{exito}</div>
      )}

      {/* Tabla empresas */}
      <Card>
        <CardHeader icon={<Building2 size={18}/>} title={`Directorio de empresas (${data.empresas.length})`} />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead>
              <tr style={{ background:C.gray50 }}>
                {["Empresa","Email","Plan","Estado","Usuarios","Próximo cobro","Suscripción"].map(h=>(
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.empresas.map((e,i)=>(
                <tr key={e.id} style={{ background:i%2===0?C.white:C.gray50, borderBottom:`1px solid ${C.gray100}` }}>
                  <td style={tdStyle}><span style={{ fontWeight:600, color:C.gray900 }}>{e.nombre}</span></td>
                  <td style={{ ...tdStyle, color:C.gray500 }}>{e.email_contacto}</td>
                  <td style={tdStyle}>
                    <span style={{ background:C.goldLight, color:C.brand, padding:"3px 10px", borderRadius:20, fontWeight:600, fontSize:12 }}>{e.plan}</span>
                  </td>
                  <td style={tdStyle}>{estadoBadge(e.estado)}</td>
                  <td style={{ ...tdStyle, textAlign:"center", fontWeight:600 }}>{e.usuarios_count}</td>
                  <td style={{ ...tdStyle, color:C.gray500 }}>{e.proximo_cobro ? new Date(e.proximo_cobro).toLocaleDateString("es-ES") : "—"}</td>
                  <td style={tdStyle}>{e.suscripcion_estado ? estadoBadge(e.suscripcion_estado) : <span style={{ color:C.gray400 }}>Sin suscripción</span>}</td>
                </tr>
              ))}
              {data.empresas.length===0 && (
                <tr><td colSpan={7} style={{ textAlign:"center", padding:32, color:C.gray400 }}>No hay empresas registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab Infraestructura ──────────────────────────────────────────────────────
function TabInfra() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await api.get("/empresas/superadmin/infraestructura/");
      setData(res.data);
    } catch { setError("Error al cargar métricas de infraestructura."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <div style={centeredStyle}><Spinner/><p style={{ color:C.gray500, marginTop:12 }}>Cargando infraestructura…</p></div>;
  if (error) return <ErrorBox msg={error}/>;
  if (!data) return null;

  const { servidor, base_datos, seguridad } = data;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }}>

      {/* Estado del servidor */}
      <Card>
        <CardHeader icon={<Server size={18}/>} title="Estado del servidor"
          right={
            <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#dcfce7", color:C.green, padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 }}>
              <Activity size={12}/> {servidor.estado} · Uptime {servidor.uptime_dias}d
            </span>
          }
        />
        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
          {/* CPU */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:C.gray700 }}><Cpu size={15}/> CPU</span>
              <span style={{ fontSize:13, fontWeight:700, color: servidor.cpu_pct>80?C.red:servidor.cpu_pct>60?C.yellow:C.green }}>{servidor.cpu_pct}%</span>
            </div>
            <GaugeBar pct={servidor.cpu_pct} color={C.blue}/>
          </div>
          {/* RAM */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:C.gray700 }}><MemoryStick size={15}/> RAM</span>
              <span style={{ fontSize:13, fontWeight:700, color: servidor.ram_pct>80?C.red:servidor.ram_pct>60?C.yellow:C.green }}>{servidor.ram_pct}% — {(servidor.ram_usado_mb/1024).toFixed(1)} GB / {(servidor.ram_total_mb/1024).toFixed(0)} GB</span>
            </div>
            <GaugeBar pct={servidor.ram_pct} color={C.brand}/>
          </div>
          {/* Disco */}
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
              <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:600, color:C.gray700 }}><HardDrive size={15}/> Disco</span>
              <span style={{ fontSize:13, fontWeight:700, color: servidor.disco_pct>80?C.red:servidor.disco_pct>60?C.yellow:C.green }}>{servidor.disco_pct}% — {servidor.disco_usado_gb} GB / {servidor.disco_total_gb} GB</span>
            </div>
            <GaugeBar pct={servidor.disco_pct} color={C.green}/>
          </div>
        </div>
      </Card>

      {/* Base de datos */}
      <Card>
        <CardHeader icon={<Database size={18}/>} title="Estado de la base de datos"
          right={base_datos.alerta_volumen && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#fee2e2", color:C.red, padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 }}>
              <AlertCircle size={12}/> Volumen alto — optimizar
            </span>
          )}
        />
        <div style={{ padding:24 }}>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap", marginBottom:24 }}>
            <div style={{ textAlign:"center" }}>
              <p style={{ margin:0, fontSize:28, fontWeight:800, color:C.brand }}>{base_datos.total_registros_temperatura.toLocaleString()}</p>
              <p style={{ margin:0, fontSize:12, color:C.gray500 }}>Total registros temperatura</p>
            </div>
            <div style={{ textAlign:"center" }}>
              <p style={{ margin:0, fontSize:28, fontWeight:800, color:C.blue }}>{base_datos.registros_ultima_semana.toLocaleString()}</p>
              <p style={{ margin:0, fontSize:12, color:C.gray500 }}>Últimos 7 días</p>
            </div>
          </div>
          {/* Gráfico de barras simple */}
          <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:600, color:C.gray500, textTransform:"uppercase", letterSpacing:"0.05em" }}>Crecimiento diario</p>
          <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80 }}>
            {base_datos.crecimiento_diario.map((d,i) => {
              const max = Math.max(...base_datos.crecimiento_diario.map(x=>x.registros), 1);
              const h = Math.max((d.registros/max)*72, 4);
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <span style={{ fontSize:10, color:C.gray400 }}>{d.registros}</span>
                  <div style={{ width:"100%", height:h, background:C.brand+"cc", borderRadius:"4px 4px 0 0" }}/>
                  <span style={{ fontSize:10, color:C.gray500 }}>{d.fecha}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Logs de seguridad */}
      <Card>
        <CardHeader icon={<Shield size={18}/>} title="Logs de seguridad"
          right={
            <span style={{ display:"inline-flex", alignItems:"center", gap:6, background: seguridad.fallidos_24h>0?"#fee2e2":"#dcfce7", color:seguridad.fallidos_24h>0?C.red:C.green, padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 }}>
              {seguridad.fallidos_24h} intentos fallidos (24h)
            </span>
          }
        />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:C.gray50 }}>
                {["Fecha/Hora","Acción","Usuario","IP","User-Agent"].map(h=>(
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seguridad.logs.map((l,i)=>(
                <tr key={l.id} style={{ background:l.sospechoso?"#fff5f5":i%2===0?C.white:C.gray50, borderBottom:`1px solid ${C.gray100}` }}>
                  <td style={tdStyle}>{new Date(l.fecha_hora).toLocaleString("es-ES")}</td>
                  <td style={tdStyle}>{accionBadge(l.accion)}</td>
                  <td style={{ ...tdStyle, fontWeight:600 }}>{l.usuario}</td>
                  <td style={{ ...tdStyle, fontFamily:"monospace", color:C.gray500 }}>{l.ip}</td>
                  <td style={{ ...tdStyle, color:C.gray400, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.user_agent}</td>
                </tr>
              ))}
              {seguridad.logs.length===0 && (
                <tr><td colSpan={5} style={{ textAlign:"center", padding:24, color:C.gray400 }}>Sin registros de seguridad.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab Config IA ────────────────────────────────────────────────────────────
function TabConfigIA() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ frio_max:"", calor_min:"" });
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState({});
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await api.get("/empresas/superadmin/config-ia/");
      setConfig(res.data);
      setForm({ frio_max: String(res.data.frio_max), calor_min: String(res.data.calor_min) });
    } catch { setError("Error al cargar configuración IA."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setGuardando(true); setErrores({}); setExito("");
    try {
      const res = await api.post("/empresas/superadmin/config-ia/", {
        frio_max: parseFloat(form.frio_max),
        calor_min: parseFloat(form.calor_min),
      });
      setConfig(res.data);
      setExito("Configuración actualizada correctamente.");
    } catch (err) {
      if (err.response?.data && typeof err.response.data === "object") {
        setErrores(err.response.data);
      } else {
        setErrores({ general: "Error al guardar." });
      }
    } finally { setGuardando(false); }
  };

  if (loading) return <div style={centeredStyle}><Spinner/><p style={{ color:C.gray500, marginTop:12 }}>Cargando configuración…</p></div>;
  if (error) return <ErrorBox msg={error}/>;

  const fMax = parseFloat(form.frio_max) || 0;
  const cMin = parseFloat(form.calor_min) || 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24, maxWidth:700 }}>
      <Card>
        <CardHeader icon={<Brain size={18}/>} title="Diccionario de estados de temperatura (IA/ML)" />
        <div style={{ padding:24, display:"flex", flexDirection:"column", gap:20 }}>
          <p style={{ margin:0, fontSize:13, color:C.gray500 }}>
            Define los umbrales globales que el sistema usa para clasificar la temperatura de los galpones.
            Cada empresa puede ajustar sus propios umbrales, pero estos son los valores maestros por defecto.
          </p>

          {errores.general && <ErrorBox msg={errores.general}/>}
          {exito && <div style={{ background:"#dcfce7", border:`1px solid #86efac`, borderRadius:10, padding:"12px 16px", color:C.green, fontSize:13 }}>{exito}</div>}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Input
              label="Temperatura máxima FRÍO (°C)"
              type="number" step="0.5"
              value={form.frio_max}
              onChange={e=>setForm(f=>({...f, frio_max:e.target.value}))}
              error={errores.frio_max}
            />
            <Input
              label="Temperatura mínima CALOR (°C)"
              type="number" step="0.5"
              value={form.calor_min}
              onChange={e=>setForm(f=>({...f, calor_min:e.target.value}))}
              error={errores.calor_min}
            />
          </div>

          {/* Vista previa */}
          <div style={{ background:C.gray50, borderRadius:12, padding:16, display:"flex", gap:12, flexWrap:"wrap" }}>
            <div style={{ flex:1, background:"#dbeafe", borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
              <p style={{ margin:0, fontSize:20, fontWeight:800, color:"#1d4ed8" }}>❄️ FRÍO</p>
              <p style={{ margin:"4px 0 0", fontSize:12, color:"#1d4ed8" }}>Temperatura &lt; {fMax}°C</p>
            </div>
            <div style={{ flex:1, background:"#dcfce7", borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
              <p style={{ margin:0, fontSize:20, fontWeight:800, color:C.green }}>✅ NORMAL</p>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.green }}>{fMax}°C — {cMin}°C</p>
            </div>
            <div style={{ flex:1, background:"#fee2e2", borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
              <p style={{ margin:0, fontSize:20, fontWeight:800, color:C.red }}>🔥 CALOR</p>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.red }}>Temperatura &gt; {cMin}°C</p>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button onClick={guardar} disabled={guardando} style={{ ...btnPrimStyle, opacity:guardando?0.7:1 }}>
              {guardando ? <Spinner/> : <Save size={16}/>}
              {guardando ? "Guardando…" : "Guardar configuración"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab Auditoría ────────────────────────────────────────────────────────────
function TabAuditoria({ empresas }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [limit, setLimit] = useState(100);

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (filtroEmpresa) params.set("empresa_id", filtroEmpresa);
      params.set("limit", limit);
      const res = await api.get(`/empresas/superadmin/bitacora/?${params}`);
      setEventos(res.data);
    } catch { setError("Error al cargar la bitácora."); }
    finally { setLoading(false); }
  }, [filtroEmpresa, limit]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* Filtros */}
      <Card>
        <div style={{ padding:"16px 24px", display:"flex", gap:16, alignItems:"flex-end", flexWrap:"wrap" }}>
          <Select label="Filtrar por empresa" value={filtroEmpresa} onChange={e=>setFiltroEmpresa(e.target.value)} style={{ minWidth:220 }}>
            <option value="">Todas las empresas</option>
            {empresas.map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Select>
          <Select label="Límite de registros" value={limit} onChange={e=>setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </Select>
          <button onClick={cargar} style={btnSecondaryStyle}>
            <RefreshCw size={14}/> Actualizar
          </button>
        </div>
      </Card>

      {loading && <div style={centeredStyle}><Spinner/><p style={{ color:C.gray500, marginTop:12 }}>Cargando bitácora…</p></div>}
      {error && <ErrorBox msg={error}/>}

      {!loading && !error && (
        <Card>
          <CardHeader icon={<BookOpen size={18}/>} title={`Bitácora global (${eventos.length} registros)`} />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:C.gray50 }}>
                  {["Fecha/Hora","Acción","Usuario","Empresa","Módulo","Entidad","IP"].map(h=>(
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev,i)=>(
                  <tr key={ev.id} style={{ background:i%2===0?C.white:C.gray50, borderBottom:`1px solid ${C.gray100}` }}>
                    <td style={{ ...tdStyle, whiteSpace:"nowrap" }}>{new Date(ev.fecha_hora).toLocaleString("es-ES")}</td>
                    <td style={tdStyle}>{accionBadge(ev.accion)}</td>
                    <td style={{ ...tdStyle, fontWeight:600 }}>{ev.usuario}</td>
                    <td style={{ ...tdStyle, color:C.gray500 }}>{ev.empresa}</td>
                    <td style={{ ...tdStyle, color:C.gray500 }}>{ev.modulo}</td>
                    <td style={{ ...tdStyle, color:C.gray500 }}>{ev.entidad}</td>
                    <td style={{ ...tdStyle, fontFamily:"monospace", color:C.gray400 }}>{ev.ip}</td>
                  </tr>
                ))}
                {eventos.length===0 && (
                  <tr><td colSpan={7} style={{ textAlign:"center", padding:32, color:C.gray400 }}>Sin registros en la bitácora.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const TABS = [
  { id:"clientes",       label:"Clientes",          icon:<Building2 size={16}/> },
  { id:"infraestructura",label:"Infraestructura",    icon:<Server size={16}/> },
  { id:"config-ia",      label:"Config IA",          icon:<Brain size={16}/> },
  { id:"auditoria",      label:"Auditoría",          icon:<BookOpen size={16}/> },
  // Pestaña externa — navega a /mantenimiento
  { id:"mantenimiento",  label:"Mantenimiento",      icon:<Database size={16}/>, href:"/mantenimiento" },
];

export default function SuperAdmin() {
  const navigate = useNavigate();
  const location = useLocation();
  const tabActivo = location.pathname === "/mantenimiento" ? "mantenimiento" : "";
  const [tab, setTab] = useState(tabActivo || "clientes");
  const [metricas, setMetricas] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const cargarMetricas = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [mRes, pRes] = await Promise.all([
        api.get("/empresas/superadmin/metricas/"),
        api.get("/empresas/planes/"),
      ]);
      setMetricas(mRes.data);
      setPlanes(pRes.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("Acceso denegado. Solo el SuperAdmin puede ver esta página.");
      } else {
        setError("Error al cargar las métricas. Intenta de nuevo.");
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargarMetricas(); }, [cargarMetricas]);

  const cerrarSesion = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("usuario");
    navigate("/login");
  };

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:"'Poppins', sans-serif" }}>

      {/* Header — responsive */}
      <header style={{
        background:`linear-gradient(135deg, ${C.brand} 0%, ${C.brandLight} 100%)`,
        padding: isMobile ? "0 16px" : "0 32px",
        height: 64,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        boxShadow:"0 2px 12px rgba(0,0,0,0.15)",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 12 }}>
          <img src="/logo.png" alt="logo" style={{ width:36, height:36, borderRadius:"50%", border:`2px solid ${C.gold}` }} />
          <span style={{ color:"#fef3c7", fontWeight:800, fontSize: isMobile ? 15 : 18 }}>AviGranja</span>
          {!isMobile && (
            <>
              <span style={{ color:"rgba(255,255,255,0.35)", margin:"0 8px" }}>|</span>
              <Globe size={17} color={C.gold}/>
              <span style={{ color:"#fef3c7", fontWeight:600, fontSize:15 }}>Panel SuperAdmin</span>
            </>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 6 : 10 }}>
          <button onClick={cargarMetricas} style={btnSecStyle} title="Actualizar">
            <RefreshCw size={15}/>
            {!isMobile && <span>Actualizar</span>}
          </button>
          <button onClick={cerrarSesion} style={btnSecStyle}>
            <LogOut size={15}/>
            {!isMobile && <span>Salir</span>}
          </button>
        </div>
      </header>

      {/* Tabs — scroll horizontal en móvil */}
      <div style={{
        background:C.white,
        borderBottom:`1px solid ${C.gray200}`,
        padding: isMobile ? "0 8px" : "0 32px",
        display:"flex", gap:0,
        overflowX:"auto",
        scrollbarWidth:"none",
        WebkitOverflowScrolling:"touch",
      }}>
        {TABS.map(t=>(
          <button
            key={t.id}
            onClick={() => {
              if (t.href) { navigate(t.href); }
              else { setTab(t.id); }
            }}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding: isMobile ? "12px 10px" : "14px 18px",
              border:"none", background:"none",
              fontSize: isMobile ? 11 : 13,
              fontWeight:600, cursor:"pointer", fontFamily:"inherit",
              color: tab===t.id ? C.brand : C.gray500,
              borderBottom: tab===t.id ? `2px solid ${C.brand}` : "2px solid transparent",
              transition:"all .15s",
              whiteSpace:"nowrap",
            }}
          >
            {t.icon} {isMobile ? t.label.split(" ")[0] : t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <main style={{ maxWidth:1280, margin:"0 auto", padding: isMobile ? "16px 12px" : "28px 24px" }}>

        {loading && (
          <div style={centeredStyle}>
            <Spinner/>
            <p style={{ color:C.gray500, marginTop:12 }}>Cargando panel…</p>
          </div>
        )}

        {error && !loading && <ErrorBox msg={error}/>}

        {!loading && !error && metricas && (
          <>
            {tab === "clientes" && (
              <TabClientes data={metricas} planes={planes} onRefresh={cargarMetricas}/>
            )}
            {tab === "infraestructura" && <TabInfra/>}
            {tab === "config-ia" && <TabConfigIA/>}
            {tab === "auditoria" && <TabAuditoria empresas={metricas.empresas}/>}
          </>
        )}
      </main>

      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        button:hover { filter: brightness(0.95); }
      `}</style>
    </div>
  );
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const btnSecStyle = {
  display:"flex", alignItems:"center", gap:6,
  background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)",
  borderRadius:8, padding:"7px 14px", color:"#fef3c7",
  fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
};

const btnPrimStyle = {
  display:"flex", alignItems:"center", gap:7,
  background:C.brand, border:"none", borderRadius:8,
  padding:"9px 18px", color:C.white,
  fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
};

const btnSecondaryStyle = {
  display:"flex", alignItems:"center", gap:6,
  background:C.white, border:`1px solid ${C.gray200}`, borderRadius:8,
  padding:"9px 14px", color:C.gray700,
  fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit",
};

const centeredStyle = {
  display:"flex", flexDirection:"column", alignItems:"center",
  justifyContent:"center", padding:"60px 0",
};

const thStyle = {
  padding:"11px 14px", textAlign:"left",
  fontWeight:600, color:C.gray500, fontSize:11,
  textTransform:"uppercase", letterSpacing:"0.05em",
  borderBottom:`1px solid ${C.gray200}`,
};

const tdStyle = {
  padding:"11px 14px", verticalAlign:"middle",
};
