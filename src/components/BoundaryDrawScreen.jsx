import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const BoundaryDrawScreen = ({
  setPolygonGeoJson,
  pinLocation,
  barrioName,
  polygonGeoJson,
  readOnly = false
}) => {
  const mapContainerRef = useRef(null)
  const drawRef = useRef(null)
  const defaultCenter = [-58.437, -34.6037]

  useEffect(() => {
    const isMobile = window.innerWidth <= 768

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: pinLocation ? [pinLocation.lng, pinLocation.lat] : defaultCenter,
      zoom: pinLocation ? 13 : 11,
      interactive: !readOnly
    })

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: readOnly ? {} : { polygon: true, trash: true },
      defaultMode: readOnly ? 'simple_select' : 'draw_polygon'
    })

    drawRef.current = draw
    map.addControl(draw, 'top-right')
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    if (readOnly) {
      map.scrollZoom.disable()
      map.dragPan.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      map.doubleClickZoom.disable()
      map.touchZoomRotate.disable()
    }

    map.on('load', () => {
      map.resize()

      // Pin + optional popup
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

      // Read-only polygon display
      if (readOnly && polygonGeoJson?.geometry?.type === 'Polygon') {
        try {
          draw.add(polygonGeoJson)
          draw.changeMode('simple_select')
        } catch (e) {
          console.warn('⚠️ Failed to load polygon in read-only mode:', e)
        }
      }
    })

    // Standard polygon tracker
    function updateGeoJSON() {
      const all = draw.getAll()

      if (!all || !all.features.length) {
        setPolygonGeoJson(null)
        return
      }

      const feature = all.features[0]

      if (feature.geometry.type === 'Polygon') {
        setPolygonGeoJson(feature)
      } else {
        setPolygonGeoJson(null)
      }
    }

    if (!readOnly) {
      map.on('draw.create', updateGeoJSON)
      map.on('draw.update', updateGeoJSON)
      map.on('draw.selectionchange', updateGeoJSON)
      map.on('draw.delete', () => setPolygonGeoJson(null))
    }

    return () => map.remove()
  }, [setPolygonGeoJson, pinLocation, barrioName, polygonGeoJson, readOnly])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'auto'
      }}
    >
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

export default BoundaryDrawScreen