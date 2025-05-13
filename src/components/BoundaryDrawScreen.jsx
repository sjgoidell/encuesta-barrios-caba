import React, { useEffect, useRef, useState } from 'react'
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
  const [showResetButton, setShowResetButton] = useState(false)
  const defaultCenter = [-58.437, -34.6037]

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: pinLocation ? [pinLocation.lng, pinLocation.lat] : defaultCenter,
      zoom: pinLocation ? 14 : 12,
      interactive: !readOnly
    })

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: readOnly ? {} : { polygon: true, trash: true },
      defaultMode: readOnly ? 'simple_select' : 'draw_polygon',
      styles: [
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
          paint: {
            'fill-color': '#FFD700',
            'fill-opacity': 0.3
          }
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#FFD700',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        },
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'active', 'true']],
          paint: {
            'fill-color': '#00cc66',
            'fill-opacity': 0.3
          }
        },
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'active', 'true']],
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': '#00cc66',
            'line-width': 3
          }
        },
        {
          id: 'gl-draw-polygon-and-line-vertex-halo-active',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 8,
            'circle-color': '#000'
          }
        },
        {
          id: 'gl-draw-polygon-and-line-vertex-active',
          type: 'circle',
          filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
          paint: {
            'circle-radius': 5,
            'circle-color': '#FFD700'
          }
        }
      ]
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

      if (readOnly && polygonGeoJson?.geometry?.type === 'Polygon') {
        try {
          draw.add(polygonGeoJson)
          draw.changeMode('simple_select')
        } catch (e) {
          console.warn('⚠️ Failed to load polygon in read-only mode:', e)
        }
      }
    })

    const handleDrawFinish = (e) => {
      if (!drawRef.current) return

      const all = drawRef.current.getAll?.()
      if (!all || !all.features || !all.features.length) {
        setPolygonGeoJson(null)
        setShowResetButton(false)
        return
      }

      const feature = all.features[0]
      if (feature.geometry?.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0]
        const isClosed =
          coords.length >= 4 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]

        if (isClosed) {
          setPolygonGeoJson(feature)
          drawRef.current.deleteAll()
          drawRef.current.add(feature)
          setShowResetButton(true)
        }
      } else {
        setPolygonGeoJson(null)
        setShowResetButton(false)
      }
    }

    if (!readOnly) {
      map.on('draw.create', handleDrawFinish)
      map.on('draw.update', handleDrawFinish)
      map.on('draw.selectionchange', handleDrawFinish)
      map.on('draw.delete', () => {
        setPolygonGeoJson(null)
        setShowResetButton(false)
      })
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
      zIndex: -1,
      pointerEvents: 'auto'
    }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {showResetButton && (
        <div style={{
          position: 'absolute',
          top: '7%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000
        }}>
          <button
            onClick={() => {
              drawRef.current.deleteAll()
              setPolygonGeoJson(null)
              setShowResetButton(false)
              drawRef.current.changeMode('draw_polygon')
            }}
            style={{
              backgroundColor: '#fff8b3',
              color: '#000',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              border: '2px solid #FFD700',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            🔄 Empezá de nuevo
          </button>
        </div>
      )}
    </div>
  )
}

export default BoundaryDrawScreen
