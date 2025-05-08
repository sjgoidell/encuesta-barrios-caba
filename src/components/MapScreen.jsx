import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const MapScreen = ({
  setPinLocation,
  setPinMoved,
  mapRef,
  setMapClickCount,
  readOnly = false,
  blurred = false,
  overrideCenter,
  step
}) => {
  const mapContainerRef = useRef(null)
  const markerRef = useRef(null)
  const isMobile = window.innerWidth <= 768
  const cabaCenter = [-58.437, -34.6037] // lng, lat
  const defaultCenter = overrideCenter || cabaCenter

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: defaultCenter,
      zoom: 12,
      interactive: !readOnly
    })

    // Move to center after placing pin
    if (mapRef) {
      mapRef.current = map
    }

    // Add zoom controls
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    // Resize + center logic
    setTimeout(() => {
      map.resize()
      if (isMobile && !readOnly && step === 2) {
        const centerPoint = map.project(cabaCenter)
        const shiftedPoint = {
          x: centerPoint.x,
          y: centerPoint.y
        }
        const shiftedLngLat = map.unproject(shiftedPoint)
        map.setCenter(shiftedLngLat)
      } else {
        map.setCenter(defaultCenter)
      }
    }, 100)

    // ✅ Create initial red marker at center
    markerRef.current = new mapboxgl.Marker({ color: 'red' })
      .setLngLat(defaultCenter)
      .addTo(map)

    if (typeof setPinLocation === 'function') {
      setPinLocation({ lat: defaultCenter[1], lng: defaultCenter[0] })
    }

    // ✅ Update marker and state on click
    if (!readOnly) {
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat

        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat])
        }

        if (typeof setPinLocation === 'function') {
          setPinLocation({ lat, lng })
        }

        if (typeof setPinMoved === 'function') {
          setPinMoved(true)
        }

        if (typeof setMapClickCount === 'function') {
          setMapClickCount(prev => prev + 1)
        }

          // ✅ Center the map with slight upward offset
        if (isMobile) {
          const centerPoint = map.project([lng, lat])
          const shiftedPoint = {
            x: centerPoint.x,
            y: centerPoint.y + 50
          }
          const newCenter = map.unproject(shiftedPoint)
          map.flyTo({ center: newCenter, zoom: 13, speed: 0.8 })
        }
      })
    }

    return () => map.remove()
  }, [readOnly, step]) // ✅ keep this minimal
  

  return (
    <div
      ref={mapContainerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        filter: blurred ? 'grayscale(100%) blur(1px)' : 'none',
        pointerEvents: readOnly ? 'none' : 'auto'
      }}
    />
  )
}

export default MapScreen
