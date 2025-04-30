import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

mapboxgl.accessToken = 'pk.eyJ1Ijoic2dvaWRlbGwiLCJhIjoiY21hM2J0ZzFoMWFhNDJqcTZibzQ4NzM5ZSJ9.hTrCOqO2-fWRG86oum5g_A'

const BoundaryDrawScreen = ({ setPolygonGeoJson, pinLocation, barrioName }) => {
  const mapContainerRef = useRef(null)
  const drawRef = useRef(null)
  const defaultCenter = [-58.437, -34.6037]

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: defaultCenter,
      zoom: 12,
    })
  
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'draw_polygon'
    })
  
    drawRef.current = draw
    map.addControl(draw, 'top-right')
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
  
    // ✅ Add this inside the setTimeout so it's guaranteed to happen after layout
    setTimeout(() => {
      map.resize()
  
      // 🔴 Add fixed pin from previous screen
      if (pinLocation) {
        new mapboxgl.Marker({ color: 'red' })
          .setLngLat([pinLocation.lng, pinLocation.lat])
          .addTo(map)
      
        if (barrioName) {
          new mapboxgl.Popup({ offset: 25 })
            .setLngLat([pinLocation.lng, pinLocation.lat])
            .setHTML(`<strong style="color: #999;">${barrioName}</strong>`)
            .addTo(map)
        }
      }      
    }, 100)
  
    // 🔁 Handle draw events
    map.on('draw.create', updateGeoJSON)
    map.on('draw.update', updateGeoJSON)
    map.on('draw.delete', () => setPolygonGeoJson(null))
  
    function updateGeoJSON() {
      const data = draw.getAll()
      if (data.features.length > 0) {
        setPolygonGeoJson(data.features[0])
      } else {
        setPolygonGeoJson(null)
      }
    }
  
    return () => map.remove()
  }, [setPolygonGeoJson, pinLocation, barrioName])
  

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

export default BoundaryDrawScreen
