import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './app/App.jsx'
import MapView from './map/MapView.jsx'
import QueriedDB from './components/QueriedDB.jsx'
import './index.css'
import 'mapbox-gl/dist/mapbox-gl.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/live_results" element={<MapView />} />
        {/* old link, keep redirecting so previously-shared /map_test links still work */}
        <Route path="/map_test" element={<Navigate to="/live_results" replace />} />
        <Route path="/db" element={<QueriedDB />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
