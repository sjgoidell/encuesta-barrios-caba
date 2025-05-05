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
    const isMobile = window.innerWidth <= 768
    const defaultCenter = [-58.437, -34.6037]
  
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: pinLocation ? [pinLocation.lng, pinLocation.lat] : defaultCenter,
      zoom: pinLocation ? 13 : 11,
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
  
    drawRef.current = draw
    map.addControl(draw, 'top-right')
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
  
    map.on('load', () => {
      map.resize()
  
      // 1. Fly to pin with offset (for mobile layout)
      if (pinLocation && isMobile) {
        const screenPoint = map.project([pinLocation.lng, pinLocation.lat])
        const shifted = { x: screenPoint.x, y: screenPoint.y + 100 }
        const newCenter = map.unproject(shifted)
        map.flyTo({ center: newCenter, zoom: 13, speed: 0.6 })
      }
  
      // 2. Show red pin
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
  
      // 3. Show polygon if in readOnly mode
      if (readOnly && polygonGeoJson && polygonGeoJson.geometry?.type === 'Polygon') {
        try {
          draw.add(polygonGeoJson)
          draw.changeMode('simple_select')
  
          // Optional: center map on polygon if pin doesn't exist
          if (!pinLocation) {
            const coords = polygonGeoJson.geometry.coordinates[0]
            const center = coords.reduce(
              (acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]],
              [0, 0]
            ).map(val => val / coords.length)
            map.flyTo({ center, zoom: 13, speed: 0.6 })
          }
        } catch (e) {
          console.warn('⚠️ Failed to load polygon in read-only mode:', e)
        }
      }
    })
  
    if (!readOnly) {
      map.on('draw.create', (e) => {
        const existing = draw.getAll()
        if (existing.features.length > 1) {
          draw.delete(existing.features[0].id)
        }
        updateGeoJSON()
      })
      map.on('draw.update', updateGeoJSON)
      map.on('draw.delete', () => setPolygonGeoJson(null))
    }
  
    function updateGeoJSON() {
      const data = draw.getAll()
      if (data.features.length > 0) {
        setPolygonGeoJson(data.features[0])
      } else {
        setPolygonGeoJson(null)
      }
    }
  
    return () => map.remove()
  }, [setPolygonGeoJson, pinLocation, barrioName, polygonGeoJson, readOnly])  
  

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
