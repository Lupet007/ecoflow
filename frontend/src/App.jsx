import { useEffect, useState } from 'react'
import axios from 'axios'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function App() {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState('Loading Copernicus products...')

  useEffect(() => {
    axios.get('http://localhost:8080/api/copernicus-products')
      .then(response => {
        setProducts(response.data)
        setStatus('Copernicus products loaded successfully')
      })
      .catch(error => {
        console.error(error)
        setStatus('Failed to load Copernicus products')
      })
  }, [])

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <header style={{ padding: '20px', backgroundColor: '#f4f4f4' }}>
        <h1>EcoFlow</h1>
        <p>{status}</p>
      </header>

      <section style={{ height: '400px', width: '100%' }}>
        <MapContainer
          center={[46.5547, 15.6459]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />

          <Marker position={[46.5547, 15.6459]}>
            <Popup>
              EcoFlow - Slovenia environmental data prototype
            </Popup>
          </Marker>
        </MapContainer>
      </section>

      <section style={{ padding: '20px' }}>
        <h2>Copernicus Products</h2>

        <table border="1" cellPadding="8" cellSpacing="0" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Product name</th>
              <th>Content type</th>
              <th>Content length</th>
              <th>Publication date</th>
            </tr>
          </thead>

          <tbody>
            {products.map(product => (
              <tr key={product.id}>
                <td>{product.id}</td>
                <td>{product.name}</td>
                <td>{product.contentType}</td>
                <td>{product.contentLength}</td>
                <td>{product.publicationDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default App