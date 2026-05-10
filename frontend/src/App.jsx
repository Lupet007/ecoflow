import { useEffect, useState } from 'react'
import axios from 'axios'

function App() {

  const [message, setMessage] = useState("Loading...")

  useEffect(() => {
    axios.get("http://localhost:8080/api/health")
      .then(response => {
        setMessage(response.data.service)
      })
      .catch(error => {
        console.error(error)
        setMessage("Backend connection failed")
      })
  }, [])

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>EcoFlow</h1>
      <h2>{message}</h2>
    </div>
  )
}

export default App