import { useState, useEffect } from "react";
import { Bird, Skull, Package, Thermometer } from "lucide-react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import StatCard from "../../components/StatCard";
import AlertItem from "../../components/AlertItem";
import useIsMobile from "../../hooks/useIsMobile";
import api from "../../api/axios"; // Importamos axios para conectar al backend

const alerts = [
  {
    type: "warn",
    icon: <Package size={20} color="#d97706" />,
    title: "Stock de alimento bajo",
    desc: "Quedan menos de 1000 kg en inventario",
  },
  {
    type: "danger",
    icon: <Thermometer size={20} color="#dc2626" />,
    title: "Temperatura crítica en Galpón 3",
    desc: "Se detectaron 35°C, revisar ventilación",
  },
  {
    type: "info",
    icon: <Bird size={20} color="#2563eb" />,
    title: "Lote #5 listo para comercialización",
    desc: "800 pollos alcanzaron el peso ideal",
  },
];

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);

  // Estado para guardar los números reales que vienen del backend
  const [stats, setStats] = useState({
    totalPollos: 0,
    mortandadHoy: 0,
    // Estos dos se quedarán estáticos hasta que terminen esos módulos en el backend
    stockAlimento: "850", 
    temperatura: "28", 
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Hacemos las dos peticiones al mismo tiempo para que cargue más rápido
      const [lotesRes, mortRes] = await Promise.all([
        api.get("/lotes/"),
        api.get("/mortandad/")
      ]);

      const lotes = lotesRes.data || [];
      const historialMortandad = mortRes.data || [];

      // 1. Calcular "Total de Pollos" sumando la cantidad_actual de todos los lotes
      const totalVivos = lotes.reduce((suma, lote) => suma + (lote.cantidad_actual || 0), 0);

      // 2. Calcular "Mortalidad del Día" filtrando las muertes que ocurrieron hoy
      // Obtenemos la fecha de hoy en formato YYYY-MM-DD
      const hoy = new Date().toISOString().split("T")[0]; 
      
      const bajasDeHoy = historialMortandad
        .filter(registro => registro.fecha_hora && registro.fecha_hora.startsWith(hoy))
        .reduce((suma, registro) => suma + (registro.cantidad || 0), 0);

      // Actualizamos el estado con los datos reales
      setStats({
        ...stats,
        totalPollos: totalVivos,
        mortandadHoy: bajasDeHoy
      });

    } catch (error) {
      console.error("Error cargando datos del dashboard", error);
    } finally {
      setLoading(false);
    }
  };

  // Construimos las tarjetas usando las variables de estado "stats"
  const cards = [
    {
      label: "Total de Pollos",
      value: loading ? "..." : stats.totalPollos.toLocaleString(),
      trend: "En todos los lotes",
      trendType: "trend-up",
      icon: <Bird size={24} color="#f59e0b" />,
      iconBg: "#fef3c7",
    },
    {
      label: "Mortalidad del Día",
      value: loading ? "..." : stats.mortandadHoy.toString(),
      trend: stats.mortandadHoy > 0 ? "Requiere atención" : "Sin bajas hoy",
      trendType: stats.mortandadHoy > 0 ? "trend-down" : "trend-up",
      icon: <Skull size={24} color="#dc2626" />,
      iconBg: "#fee2e2",
    },
    {
      label: "Stock de Alimento",
      value: `${stats.stockAlimento} kg`,
      trend: "Bajo stock",
      trendType: "trend-warn",
      icon: <Package size={24} color="#d97706" />,
      iconBg: "#fef3c7",
    },
    {
      label: "Temperatura Galpón",
      value: `${stats.temperatura}°C`,
      trend: "Normal",
      trendType: "trend-up",
      icon: <Thermometer size={24} color="#2563eb" />,
      iconBg: "#dbeafe",
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f9fafb",
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
          padding: "32px",
          transition: "margin-left 0.3s ease",
        }}
      >
        <Topbar
          titulo="Dashboard"
          subtitulo="Resumen general de la granja"
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          {cards.map((card, i) => (
            <StatCard key={i} {...card} />
          ))}
        </div>

        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: "700",
              color: "#1c1c1c",
              margin: "0 0 16px 0",
            }}
          >
            Alertas Recientes
          </h2>
          {alerts.map((alert, i) => (
            <AlertItem key={i} {...alert} />
          ))}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;