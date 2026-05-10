import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function App() {

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={[46.5547, 15.6459]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >

        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[46.5547, 15.6459]}>
          <Popup>
            EcoFlow - Maribor
          </Popup>
        </Marker>

      </MapContainer>
    </div>
  )
}

export default App