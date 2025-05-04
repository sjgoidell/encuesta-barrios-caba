import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = 'pk.eyJ1Ijoic2dvaWRlbGwiLCJhIjoiY21hM2J0ZzFoMWFhNDJqcTZibzQ4NzM5ZSJ9.hTrCOqO2-fWRG86oum5g_A'

const MapScreen = ({ setPinLocation, readOnly = false, blurred = false, overrideCenter, step}) => {
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

    // Add + / - controls
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    // Ensure map sizes properly
    setTimeout(() => {
      map.resize()
    
      if (isMobile && !readOnly && step === 3) {
        // Shift the visible center upward for Screen 3 on mobile
        const centerPoint = map.project(cabaCenter)
        const shiftedPoint = {
          x: centerPoint.x,
          y: centerPoint.y + 200 // shift the map up by 100 pixels
        }
        const shiftedLngLat = map.unproject(shiftedPoint)
        map.setCenter(shiftedLngLat)
      } else {
        map.setCenter(defaultCenter)
      }
    }, 100)    
    

    // 🧭 Create a movable marker, starting in center
    markerRef.current = new mapboxgl.Marker({ color: 'red' })
      .setLngLat(cabaCenter)
      .addTo(map)
      if (!readOnly && typeof setPinLocation === 'function') {
        setPinLocation({ lat: defaultCenter[1], lng: defaultCenter[0] })      
      }      

    // 💡 Move marker on click
    if (!readOnly && typeof setPinLocation === 'function') {
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat
        markerRef.current.setLngLat([lng, lat])
        setPinLocation({ lat, lng })
      })
    }    
      
    // Read only
    if (!readOnly) {
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat
        if (setPinLocation) {
          setPinLocation({ lat, lng })
        }
      })
    }

    return () => map.remove()
  }, [readOnly, setPinLocation])

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
