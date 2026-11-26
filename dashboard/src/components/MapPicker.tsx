import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet'in varsayılan işaret görseli paketleyicide yol bulamaz; mürekkep renkli SVG işaret kullanılır.
const pin = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg"><path d="M15 39s13-13.6 13-24A13 13 0 0 0 2 15c0 10.4 13 24 13 24z" fill="#1E1A16"/><circle cx="15" cy="15" r="5" fill="#F4EFE6"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

function ClickToSet({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

/** Salonun haritadaki yeri: tıklayın veya işareti sürükleyin. Müşteriler uygulamada bu noktayı görür. */
export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const set = (a: number, b: number) => onChange(Math.round(a * 1e6) / 1e6, Math.round(b * 1e6) / 1e6);
  return (
    <div className="map-box">
      <MapContainer center={[lat, lng]} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıcıları'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[lat, lng]}
          icon={pin}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              set(p.lat, p.lng);
            },
          }}
        />
        <ClickToSet onChange={set} />
        <Recenter lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}

/** Tarayıcı konumunu al (kullanıcı izin verirse) */
export function locateMe(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Tarayıcınız konum desteklemiyor"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error("Konum izni verilmedi")),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
