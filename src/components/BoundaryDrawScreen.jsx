import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

mapboxgl.accessToken = 'pk.eyJ1Ijoic2dvaWRlbGwiLCJhIjoiY21hM2J0ZzFoMWFhNDJqcTZibzQ4NzM5ZSJ9.hTrCOqO2-fWRG86oum5g_A'

const BoundaryDrawScreen = ({ setPolygonGeoJson, pinLocation, barrioName, polygonGeoJson, readOnly = false }) => {
  const draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: readOnly ? {} : { polygon: true, trash: true },
    defaultMode: readOnly ? 'simple_select' : 'draw_polygon'
  })
  const mapContainerRef = useRef(null)
  const drawRef = useRef(null)
  const defaultCenter = [-58.437, -34.6037]

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: defaultCenter,
      zoom: 12,
      interactive: !readOnly
    })

    if (readOnly) {
      map.scrollZoom.disable()
      map.dragPan.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      map.doubleClickZoom.disable()
      map.touchZoomRotate.disable()
    }    
  
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: readOnly ? {} : { polygon: true, trash: true },
      defaultMode: readOnly ? 'simple_select' : 'draw_polygon'
    })
  
    map.addControl(draw, 'top-right')
  
    if (readOnly && polygonGeoJson) {
      try {
        // Ensure it's added *after* the draw tool is mounted
        map.on('load', () => {
          draw.add(polygonGeoJson)
          if (readOnly && polygonGeoJson && polygonGeoJson.geometry?.type === 'Polygon') {
            // Calculate the center of the polygon by averaging all coordinates
            const coords = polygonGeoJson.geometry.coordinates[0]
            const center = coords.reduce(
              (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
              [0, 0]
            ).map(val => val / coords.length)
          
            // Add popup with barrio name
            if (barrioName) {
              new mapboxgl.Popup({ closeButton: false, offset: 25 })
                .setLngLat(center)
                .setHTML(`<div style="color:#ccc;font-weight:bold;">${barrioName}</div>`)
                .addTo(map)
            }
          }          
          draw.changeMode('simple_select')
        })
      } catch (e) {
        console.warn('⚠️ Failed to load polygon in read-only mode:', e)
      } } 
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
  
    // ✅ Add this inside the setTimeout so it's guaranteed to happen after layout
    setTimeout(() => {
      map.resize(),100
  
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
    map.on('draw.create', (e) => {
      const existing = draw.getAll()
      if (existing.features.length > 1) {
        // Delete all except the most recent
        draw.delete(existing.features[0].id)
      }
      updateGeoJSON()
    })    
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
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1
      }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

export default BoundaryDrawScreen
