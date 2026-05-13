import { useState, useEffect } from "react";
import { Bird, Skull, Package, Thermometer, Zap, AlertCircle } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import StatCard from "../../components/StatCard";
import AlertItem from "../../components/AlertItem";
import api from "../../api/axios";
import useIsMobile from "../../hooks/useIsMobile";

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAves: 0,
    lotesActivos: 0,
    alertasInventario: 0,
    galponesActivos: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [lotRes, galRes, insRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/galpones/"),
        api.get("/insumos/catalogo/"),
      ]);

      const lotes = Array.isArray(lotRes.data) ? lotRes.data : [];
      const activos = lotes.filter(l => ["crianza", "crecimiento", "engorde", "activo"].includes(l.estado.toLowerCase()));
      const aves = activos.reduce((acc, l) => acc + (Number(l.cantidad_actual) || 0), 0);
      
      const insumos = Array.isArray(insRes.data) ? insRes.data : [];
      const alertas = insumos.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)).length;

      setStats({
        totalAves: aves,
        lotesActivos: activos.length,
        alertasInventario: alertas,
        galponesActivos: (galRes.data || []).filter(g => g.estado === 'activo').length
      });
    } catch (e) {
      console.error("Error al cargar estadísticas", e);
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    {
      label: "Población Total",
      value: loading ? "—" : stats.totalAves.toLocaleString(),
      trend: "Aves",
      trendType: "trend-up",
      icon: <Bird size={24} color="#f59e0b" />,
      iconBg: "#fef3c7",
    },
    {
      label: "Lotes Activos",
      value: loading ? "—" : stats.lotesActivos,
      trend: "En curso",
      trendType: "trend-up",
      icon: <Zap size={24} color="#3b82f6" />,
      iconBg: "#dbeafe",
    },
    {
      label: "Alertas Inventario",
      value: loading ? "—" : stats.alertasInventario,
      trend: stats.alertasInventario > 0 ? "Bajo Stock" : "OK",
      trendType: stats.alertasInventario > 0 ? "trend-down" : "trend-up",
      icon: <Package size={24} color="#d97706" />,
      iconBg: "#fef3c7",
    },
    {
      label: "Galpones en Uso",
      value: loading ? "—" : stats.galponesActivos,
      trend: "Activos",
      trendType: "trend-up",
      icon: <Bird size={24} color="#16a34a" />,
      iconBg: "#dcfce7",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f8fafc",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
        showMobileTrigger={false}
      />

      <main
        style={{
          marginLeft: isMobile ? "0" : sidebarOpen ? "240px" : "70px",
          flex: 1,
          padding: isMobile ? "20px" : "32px",
          paddingTop: isMobile ? "80px" : "32px",
          transition: "margin-left 0.3s ease",
          display: "flex",
          flexDirection: "column",
          gap: "24px"
        }}
      >
        <Topbar titulo="Resumen de la Granja" subtitulo="Vista general de producción" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {cards.map((card, i) => (
            <StatCard key={i} {...card} />
          ))}
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "24px",
            padding: "28px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            border: "1px solid #f1f5f9",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#334155",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <AlertCircle size={18} color="#ef4444" /> Centro de Notificaciones
          </h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {stats.alertasInventario > 0 ? (
              <AlertItem 
                type="danger" 
                title="Atención: Insumos Críticos" 
                desc={`Hay ${stats.alertasInventario} productos con stock por debajo del mínimo.`} 
                icon={<Package size={18} color="#dc2626" />}
              />
            ) : (
              <AlertItem 
                type="info" 
                title="Inventario Saludable" 
                desc="Todos los insumos tienen stock suficiente." 
                icon={<Package size={18} color="#16a34a" />}
              />
            )}
            
            <AlertItem 
              type="info" 
              title="Monitoreo Activo" 
              desc={`Actualmente gestionando ${stats.lotesActivos} lotes en producción.`} 
              icon={<Bird size={18} color="#3b82f6" />}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
