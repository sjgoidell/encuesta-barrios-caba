import React, { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'

mapboxgl.accessToken = 'pk.eyJ1Ijoic2dvaWRlbGwiLCJhIjoiY21hM2J0ZzFoMWFhNDJqcTZibzQ4NzM5ZSJ9.hTrCOqO2-fWRG86oum5g_A'

const MapScreen = ({ setPinLocation }) => {
  const mapContainerRef = useRef(null)
  const markerRef = useRef(null)
  const defaultCenter = [-58.437, -34.6037] // Center of CABA

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: defaultCenter,
      zoom: 12,
    })

    // Add + / - controls
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

    // Ensure map sizes properly
    setTimeout(() => {
      map.resize()
    }, 100)

    // 🧭 Create a movable marker, starting in center
    markerRef.current = new mapboxgl.Marker({ color: 'red' })
      .setLngLat(defaultCenter)
      .addTo(map)
      setPinLocation({ lat: defaultCenter[1], lng: defaultCenter[0] })


    // 💡 Move marker on click
    map.on('click', (e) => {
        const { lng, lat } = e.lngLat
        markerRef.current.setLngLat([lng, lat])
        setPinLocation({ lat, lng })
      })
      

    return () => map.remove()
  }, [])

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

export default MapScreen
