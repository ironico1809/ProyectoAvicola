/**
 * MapPicker
 *
 * Muestra un mapa Leaflet interactivo. Al hacer clic, captura las
 * coordenadas y llama al backend para obtener el nombre del lugar
 * (Reverse Geocoding via OpenWeather).
 *
 * Props:
 *   lat          {number|null}  Latitud actual (controlado)
 *   lon          {number|null}  Longitud actual (controlado)
 *   ubicacion    {string}       Nombre del lugar actual
 *   onChange     {function}     Callback({ lat, lon, ubicacion })
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../api/axios";

// Leaflet necesita que los íconos se configuren manualmente en Vite/Webpack
// porque no puede resolver las rutas de imagen automáticamente.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Centro por defecto: Santa Cruz de la Sierra, Bolivia
const DEFAULT_CENTER = [-17.7833, -63.1821];
const DEFAULT_ZOOM = 12;

/**
 * Componente interno que escucha los clics en el mapa.
 */
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapPicker({ lat, lon, ubicacion, onChange }) {
  const center = lat && lon ? [lat, lon] : DEFAULT_CENTER;

  const handleMapClick = async (clickLat, clickLon) => {
    // Redondear a 6 decimales (~11cm de precisión, evita overflow en DecimalField)
    const lat = Math.round(clickLat * 1e6) / 1e6;
    const lon = Math.round(clickLon * 1e6) / 1e6;

    onChange({ lat, lon, ubicacion: "Obteniendo nombre..." });

    try {
      const res = await api.get("/temperatura/reverse-geocoding/", {
        params: { lat, lon },
      });
      onChange({
        lat,
        lon,
        ubicacion: res.data.nombre || "Ubicación desconocida",
      });
    } catch {
      onChange({ lat, lon, ubicacion: "Ubicación desconocida" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
        Haz clic en el mapa para seleccionar la ubicación del galpón.
      </p>

      <div
        style={{
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          height: "260px",
        }}
      >
        <MapContainer
          center={center}
          zoom={DEFAULT_ZOOM}
          style={{ height: "100%", width: "100%" }}
          key={`map-${lat}-${lon}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onMapClick={handleMapClick} />
          {lat && lon && <Marker position={[lat, lon]} />}
        </MapContainer>
      </div>

      {ubicacion && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "13px",
            color: "#166534",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>📍</span>
          <span>
            <strong>Ubicación detectada:</strong> {ubicacion}
          </span>
        </div>
      )}

      {lat && lon && (
        <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
          Coordenadas: {lat.toFixed(6)}, {lon.toFixed(6)}
        </p>
      )}
    </div>
  );
}

export default MapPicker;
