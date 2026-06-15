import {
  LayoutDashboard,
  Bird,
  Package,
  Thermometer,
  Wheat,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Users,
  ShieldCheck,
  ClipboardList,
  BarChart3,
  Truck,
  History,
  Stethoscope,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Globe,
  CreditCard,
  Database,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUsuario } from "../hooks/useUsuario";

// ─── Menús por rol ────────────────────────────────────────────────────────────

const MENU_SUPERADMIN = [
  {
    type: "single",
    icon: <Globe size={20} />,
    label: "Panel Global",
    path: "/superadmin",
  },
  {
    type: "single",
    icon: <Database size={20} />,
    label: "Mantenimiento Técnico",
    path: "/mantenimiento",
  },
];

const MENU_ADMIN_OPERADOR = [
  {
    type: "single",
    icon: <LayoutDashboard size={20} />,
    label: "Dashboard",
    path: "/dashboard",
  },
  {
    type: "group",
    label: "Gestión de Producción",
    icon: <Bird size={20} />,
    items: [
      { icon: <Bird size={18} />, label: "Galpones", path: "/galpones" },
      { icon: <Package size={18} />, label: "Lotes", path: "/lotes" },
      { icon: <Truck size={18} />, label: "Ventas", path: "/ventas" },
      { icon: <ClipboardList size={18} />, label: "Control de Calidad", path: "/lotes/control-calidad" },
      { icon: <AlertTriangle size={18} />, label: "Mortandad", path: "/mortandad" },
      { icon: <Stethoscope size={18} />, label: "Registro Sanitario", path: "/sanitario/registro" },
      { icon: <ClipboardList size={18} />, label: "Historial Clínico", path: "/sanitario/historial" },
      { icon: <AlertTriangle size={18} />, label: "Enfermedades", path: "/sanitario/enfermedades" },
      { icon: <ShieldCheck size={18} />, label: "Alertas Sanitarias", path: "/sanitario/alertas" },
    ],
  },
  {
    type: "group",
    label: "Control Operativo",
    icon: <Thermometer size={20} />,
    items: [
      { icon: <Wheat size={18} />, label: "Alimentación", path: "/alimentacion" },
      { icon: <Thermometer size={18} />, label: "Temperatura", path: "/temperatura" },
      { icon: <BarChart3 size={18} />, label: "Predicción IA", path: "/prediccion" },
      { icon: <ClipboardList size={18} />, label: "Estado", path: "/estado" },
    ],
  },
  {
    type: "group",
    label: "Inventario",
    icon: <Package size={20} />,
    items: [
      { icon: <Package size={18} />, label: "Insumos", path: "/inventario/insumos" },
      { icon: <Truck size={18} />, label: "Proveedores", path: "/inventario/proveedores" },
      { icon: <History size={18} />, label: "Movimientos", path: "/inventario/movimientos" },
    ],
  },
  {
    type: "group",
    label: "Seguridad y Admin",
    icon: <ShieldCheck size={20} />,
    soloAdmin: true,
    items: [
      { icon: <Users size={18} />, label: "Usuarios", path: "/usuarios" },
      { icon: <ShieldCheck size={18} />, label: "Roles", path: "/roles" },
      { icon: <ShieldCheck size={18} />, label: "Permisos", path: "/permisos" },
      { icon: <History size={18} />, label: "Bitácora", path: "/bitacora" },
    ],
  },
  {
    type: "single",
    icon: <BarChart3 size={20} />,
    label: "Reportes",
    path: "/reportes",
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

function Sidebar({ open, setOpen, showMobileTrigger = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  const [openGroups, setOpenGroups] = useState({});
  const [hoveredItem, setHoveredItem] = useState(null);
  const { esSuperAdmin, esAdmin } = useUsuario();

  const menuGroups = esSuperAdmin
    ? MENU_SUPERADMIN
    : MENU_ADMIN_OPERADOR.filter((g) => {
        if (g.soloAdmin && !esAdmin) return false;
        return true;
      });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isMobile && open) setOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!open && !isMobile) {
      setOpenGroups({});
    }
  }, [open, isMobile]);

  const toggleGroup = (label) => {
    if (!open && !isMobile) {
      setOpen(true);
      setOpenGroups({ [label]: true });
      return;
    }
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile) setOpen(false);
  };

  const sidebarWidth = isMobile ? "280px" : open ? "260px" : "70px";

  return (
    <>
      {isMobile && open && (
        <div style={backdropStyle} onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {isMobile && !open && showMobileTrigger && (
        <button onClick={() => setOpen(true)} style={mobileOpenBtnStyle} type="button">
          <Menu size={20} color="#78350f" />
        </button>
      )}

      <aside
        style={{
          ...sidebarStyle,
          width: sidebarWidth,
          transform: isMobile && !open ? "translateX(-100%)" : "translateX(0)",
        }}
      >
        <div style={{
          ...logoStyle,
          justifyContent: open ? "space-between" : "center",
          padding: open ? "16px 14px" : "16px 0"
        }}>
          <div 
            style={{ ...logoInnerStyle, cursor: !open ? "pointer" : "default" }}
            onClick={() => !open && setOpen(true)}
            title={!open ? "Expandir menú" : undefined}
          >
            <img src="/logo.png" alt="logo" style={imgStyle} />
            {open && <span style={logoTextStyle}>AviGranja</span>}
          </div>
          {open && (
            <button
              onClick={() => setOpen(false)}
              style={toggleStyle}
              type="button"
              title="Colapsar menú"
            >
              <div style={{
                ...toggleIconWrap,
                transform: "rotate(0deg)",
              }}>
                <ChevronLeft size={16} color="#fef3c7" />
              </div>
            </button>
          )}
        </div>

        <nav style={navStyle}>
          {menuGroups.map((group, i) => {
            if (group.type === "single") {
              const isActive = location.pathname === group.path;
              const isHovered = hoveredItem === `single-${i}`;
              return (
                <button
                  key={i}
                  onClick={() => handleNavigate(group.path)}
                  onMouseEnter={() => setHoveredItem(`single-${i}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    ...navItemStyle,
                    justifyContent: open ? "flex-start" : "center",
                    ...(isActive ? activeStyle : {}),
                    ...(isHovered && !isActive ? hoverNavStyle : {}),
                    transform: isHovered ? "scale(1.02)" : "scale(1)",
                  }}
                  title={!open ? group.label : undefined}
                >
                  <span style={{
                    ...iconStyle,
                    transform: isHovered ? "scale(1.1)" : "scale(1)",
                  }}>
                    {group.icon}
                  </span>
                  {open && <span style={labelStyle}>{group.label}</span>}
                </button>
              );
            }

            const isGroupOpen = openGroups[group.label];
            const hasActiveChild = group.items.some(
              (item) => location.pathname === item.path
            );

            return (
              <div key={i} style={groupWrapperStyle}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  onMouseEnter={() => setHoveredItem(`group-${i}`)}
                  onMouseLeave={() => setHoveredItem(null)}
                  style={{
                    ...navItemStyle,
                    justifyContent: open ? "flex-start" : "center",
                    background:
                      hasActiveChild && !isGroupOpen
                        ? "rgba(255,255,255,0.1)"
                        : "transparent",
                  }}
                  title={!open ? group.label : undefined}
                >
                  <span style={{
                    ...iconStyle,
                    transform: hoveredItem === `group-${i}` ? "scale(1.1)" : "scale(1)",
                  }}>
                    {group.icon}
                  </span>
                  {open && (
                    <>
                      <span style={{ ...labelStyle, flex: 1 }}>{group.label}</span>
                      <div style={{
                        transform: isGroupOpen ? "rotate(0deg)" : "rotate(-90deg)",
                        transition: "transform 0.3s ease",
                        display: "flex",
                      }}>
                        <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
                      </div>
                    </>
                  )}
                </button>

                <div style={{
                  ...subMenuContainer,
                  maxHeight: open && isGroupOpen ? subMenuHeight : "0px",
                  opacity: open && isGroupOpen ? 1 : 0,
                }}>
                  <div style={subGroupStyle}>
                    {group.items.map((item, idx) => {
                      const isActive = location.pathname === item.path;
                      const subHovered = hoveredItem === `sub-${i}-${idx}`;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleNavigate(item.path)}
                          onMouseEnter={() => setHoveredItem(`sub-${i}-${idx}`)}
                          onMouseLeave={() => setHoveredItem(null)}
                          style={{
                            ...subItemStyle,
                            ...(isActive ? subActiveStyle : {}),
                            ...(subHovered && !isActive ? subHoverStyle : {}),
                            transform: subHovered ? "translateX(4px)" : "translateX(0)",
                          }}
                        >
                          <span style={{
                            ...subIconStyle,
                            color: isActive ? "#fbbf24" : "rgba(255,255,255,0.6)",
                          }}>
                            {item.icon}
                          </span>
                          <span style={{
                            fontSize: "13px",
                            color: isActive ? "#fbbf24" : "rgba(255,255,255,0.75)",
                            fontWeight: isActive ? "600" : "400",
                          }}>
                            {item.label}
                          </span>
                          {isActive && <div style={activeIndicatorStyle} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div style={footerStyle}>
          <button
            style={{
              ...logoutStyle,
              justifyContent: open ? "flex-start" : "center",
            }}
            onMouseEnter={() => setHoveredItem("logout")}
            onMouseLeave={() => setHoveredItem(null)}
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              localStorage.removeItem("usuario");
              handleNavigate("/login");
            }}
            type="button"
            title={!open ? "Cerrar Sesión" : undefined}
          >
            <span style={{
              ...iconStyle,
              transform: hoveredItem === "logout" ? "scale(1.1)" : "scale(1)",
            }}>
              <LogOut size={20} />
            </span>
            {open && <span style={logoutLabelStyle}>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .sidebar-item-enter {
          animation: fadeIn 0.25s ease forwards;
        }
        .sidebar-sub-enter {
          animation: slideIn 0.2s ease forwards;
        }
        aside::-webkit-scrollbar {
          width: 4px;
        }
        aside::-webkit-scrollbar-track {
          background: transparent;
        }
        aside::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 4px;
        }
        aside::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>
    </>
  );
}

const subMenuHeight = "500px";

// ─── Estilos ──────────────────────────────────────────────────────────────────

const sidebarStyle = {
  background: "linear-gradient(180deg, #78350f 0%, #92400e 100%)",
  display: "flex",
  flexDirection: "column",
  position: "fixed",
  top: 0,
  left: 0,
  height: "100dvh",
  zIndex: 100,
  transition: "width 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  overflow: "hidden",
  overflowY: "auto",
};

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  backdropFilter: "blur(4px)",
  zIndex: 90,
  animation: "fadeIn 0.25s ease",
};

const mobileOpenBtnStyle = {
  position: "fixed",
  top: "14px",
  left: "14px",
  zIndex: 110,
  background: "white",
  border: "1.5px solid #e5e7eb",
  borderRadius: "10px",
  padding: "8px",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
  transition: "all 0.2s ease",
};

const logoStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  padding: "16px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  minHeight: "70px",
};

const logoInnerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  overflow: "hidden",
};

const imgStyle = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  border: "2px solid #fbbf24",
  flexShrink: 0,
  transition: "transform 0.3s ease",
};

const logoTextStyle = {
  fontSize: "17px",
  fontWeight: "800",
  color: "#fef3c7",
  whiteSpace: "nowrap",
  animation: "fadeIn 0.3s ease",
};

const toggleStyle = {
  background: "rgba(255,255,255,0.1)",
  border: "none",
  borderRadius: "8px",
  padding: "6px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.3s ease",
  flexShrink: 0,
};

const toggleIconWrap = {
  display: "flex",
  alignItems: "center",
  transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
};

const navStyle = {
  display: "flex",
  flexDirection: "column",
  padding: "12px 8px",
  gap: "4px",
  flex: 1,
};

const navItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 12px",
  borderRadius: "10px",
  color: "rgba(255,255,255,0.9)",
  cursor: "pointer",
  border: "none",
  background: "transparent",
  width: "100%",
  fontFamily: "inherit",
  transition: "all 0.25s ease, transform 0.15s ease",
  position: "relative",
  overflow: "hidden",
};

const activeStyle = {
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  color: "white",
  fontWeight: "600",
  boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
};

const hoverNavStyle = {
  background: "rgba(255,255,255,0.08)",
};

const labelStyle = { fontSize: "14px", whiteSpace: "nowrap", textAlign: "left" };

const iconStyle = {
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  transition: "transform 0.2s ease",
};

const groupWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
};

const subMenuContainer = {
  overflow: "hidden",
  transition: "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
};

const subGroupStyle = {
  display: "flex",
  flexDirection: "column",
  paddingLeft: "12px",
  gap: "2px",
  marginTop: "2px",
  marginBottom: "4px",
};

const subItemStyle = {
  ...navItemStyle,
  padding: "8px 12px",
  borderRadius: "8px",
  gap: "10px",
};

const subActiveStyle = {
  background: "rgba(255,255,255,0.1)",
  fontWeight: "600",
};

const subHoverStyle = {
  background: "rgba(255,255,255,0.06)",
};

const subIconStyle = {
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  transition: "color 0.2s ease",
};

const activeIndicatorStyle = {
  width: "3px",
  height: "16px",
  background: "#fbbf24",
  borderRadius: "2px",
  position: "absolute",
  right: "4px",
};

const footerStyle = {
  padding: "12px 8px",
  borderTop: "1px solid rgba(255,255,255,0.1)",
};

const logoutStyle = {
  ...navItemStyle,
  color: "rgba(255,255,255,0.6)",
};

const logoutLabelStyle = {
  ...labelStyle,
  color: "rgba(255,255,255,0.6)",
};

export default Sidebar;
