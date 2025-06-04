import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import MapView from './components/MapView.jsx' 
import QueriedDB from './components/QueriedDB.jsx'
import './index.css'
import 'mapbox-gl/dist/mapbox-gl.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/db" element={<QueriedDB />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
