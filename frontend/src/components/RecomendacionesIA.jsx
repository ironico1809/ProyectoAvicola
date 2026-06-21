import { useState } from "react";
import { Zap, Check, X, Brain } from "lucide-react";
import api from "../api/axios";

const ESTADO_STYLES = {
  Pendiente: { bg: "#fef3c7", color: "#d97706", borderColor: "#f59e0b" },
  Aplicada: { bg: "#dcfce7", color: "#15803d", borderColor: "#10b981" },
  Ignorada: { bg: "#f3f4f6", color: "#4b5563", borderColor: "#9ca3af" },
};

export default function RecomendacionesIA({
  recomendaciones = [],
  prediccionId,
  onActualizar,
  compact = false,
  maxItems = 5,
}) {
  const [actualizando, setActualizando] = useState(null);

  if (!recomendaciones || recomendaciones.length === 0) return null;

  const handleAction = async (recId, nuevoEstado) => {
    if (!prediccionId) return;
    setActualizando(recId);
    try {
      const res = await api.patch(
        `/mortandad/prediccion/${prediccionId}/recomendacion/`,
        { recomendacion_id: recId, estado: nuevoEstado }
      );
      if (onActualizar) onActualizar(res.data.recomendaciones);
    } catch (e) {
      console.error("Error al actualizar recomendación", e);
    } finally {
      setActualizando(null);
    }
  };

  const items = recomendaciones.slice(0, maxItems);

  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map((rec, idx) => {
          const isObj = typeof rec === "object" && rec !== null;
          const texto = isObj ? rec.texto : rec;
          const estado = isObj ? rec.estado : "Pendiente";
          const recId = isObj ? rec.id : idx + 1;
          const est = ESTADO_STYLES[estado] || ESTADO_STYLES.Pendiente;

          return (
            <div
              key={recId}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "10px 12px",
                background: "#fafafa",
                borderRadius: "10px",
                borderLeft: `4px solid ${est.borderColor}`,
                fontSize: "13px",
              }}
            >
              <div style={{ flex: 1, color: "#374151", lineHeight: 1.4 }}>
                {texto}
              </div>
              {isObj && estado === "Pendiente" && (
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => handleAction(recId, "Aplicada")}
                    disabled={actualizando === recId}
                    title="Aplicar sugerencia"
                    style={{
                      border: "none",
                      background: "#dcfce7",
                      color: "#15803d",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: actualizando === recId ? "not-allowed" : "pointer",
                    }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => handleAction(recId, "Ignorada")}
                    disabled={actualizando === recId}
                    title="Ignorar"
                    style={{
                      border: "none",
                      background: "#f3f4f6",
                      color: "#4b5563",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: actualizando === recId ? "not-allowed" : "pointer",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {isObj && estado !== "Pendiente" && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: est.bg,
                    color: est.color,
                    flexShrink: 0,
                  }}
                >
                  {estado}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {items.map((rec, idx) => {
        const isObj = typeof rec === "object" && rec !== null;
        const texto = isObj ? rec.texto : rec;
        const estado = isObj ? rec.estado : "Pendiente";
        const recId = isObj ? rec.id : idx + 1;
        const est = ESTADO_STYLES[estado] || ESTADO_STYLES.Pendiente;

        return (
          <div
            key={idx}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              padding: "16px",
              background: "#fafafa",
              borderRadius: "12px",
              borderLeft: `4px solid ${est.borderColor}`,
            }}
          >
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div
                style={{
                  background: est.bg,
                  color: est.color,
                  fontWeight: 700,
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>
              <div style={{ flex: 1, fontSize: "14px", color: "#374151" }}>
                {texto}
              </div>
            </div>

            {isObj && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignSelf: "flex-end",
                  marginTop: "4px",
                }}
              >
                {estado === "Pendiente" ? (
                  <>
                    <button
                      onClick={() => handleAction(recId, "Aplicada")}
                      disabled={actualizando === recId}
                      style={{
                        border: "none",
                        background: "#dcfce7",
                        color: "#15803d",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: actualizando === recId ? "not-allowed" : "pointer",
                      }}
                    >
                      {actualizando === recId ? "..." : "✓ Aplicar sugerencia"}
                    </button>
                    <button
                      onClick={() => handleAction(recId, "Ignorada")}
                      disabled={actualizando === recId}
                      style={{
                        border: "none",
                        background: "#f3f4f6",
                        color: "#4b5563",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: actualizando === recId ? "not-allowed" : "pointer",
                      }}
                    >
                      ✕ Ignorar
                    </button>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: est.bg,
                      color: est.color,
                    }}
                  >
                    Estado: {estado}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
