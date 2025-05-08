// Import
import { useState, useEffect, useRef } from 'react'
import './App.css'
import MapScreen from './components/MapScreen'
import Fuse from 'fuse.js'
import barrios from './data/barrios'
import BoundaryDrawScreen from './components/BoundaryDrawScreen'
import { collection, addDoc } from 'firebase/firestore'
import { db } from './firebase'
import * as turf from '@turf/turf'
import mapboxgl from 'mapbox-gl'
import { motion, AnimatePresence } from 'framer-motion'

mapboxgl.accessToken = 'pk.eyJ1Ijoic2dvaWRlbGwiLCJhIjoiY21hM2J0ZzFoMWFhNDJqcTZibzQ4NzM5ZSJ9.hTrCOqO2-fWRG86oum5g_A'

function App() {

  //Base Constants
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [livesInCaba, setLivesInCaba] = useState('')
  const [yearsInBarrio, setYearsInBarrio] = useState('')
  const [pinLocation, setPinLocation] = useState(null)
  const [barrioName, setBarrioName] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef()
  const [mapClickCount, setMapClickCount] = useState(0)
  const [showTerms, setShowTerms] = useState(false)
 
 // Map and motion constants
  const MotionButton = motion.button
  const mapRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)

  //Capturing metadata
  const [userRegion, setUserRegion] = useState('unknown')
  const sessionStartTime = useRef(Date.now())
  const deviceType = window.innerWidth <= 768 ? 'mobile' : 'desktop'
  const language = navigator.language || 'unknown'
  useEffect(() => {
    fetch('https://ipapi.co/json')
      .then(res => res.json())
      .then(data => {
        if (data.city && data.country) {
          setUserRegion(`${data.city}, ${data.country}`)
        } else if (data.country_name) {
          setUserRegion(data.country_name)
        }
      })
      .catch(() => setUserRegion('unknown'))
  }, [])
    

  // click outside barrio dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // barrio match in search
  const fuse = new Fuse(barrios, {
    includeScore: true,
    threshold: 0.4 // Adjust this for strict/loose match
  })

  // defining variables
  const [polygonGeoJson, setPolygonGeoJson] = useState(null)
  const [landmarks, setLandmarks] = useState('')
  const [altNames, setAltNames] = useState('')
  const [comments, setComments] = useState('')
  const [canContact, setCanContact] = useState(null)
  const [comunidad, setComunidad] = useState('')
  const [claseSocial, setClaseSocial] = useState('')
  const [genero, setGenero] = useState('')
  const [situacionDomicilio, setSituacionDomicilio] = useState('')
  const [formErrors, setFormErrors] = useState({})
  const [drawingInstructionsVisible, setDrawingInstructionsVisible] = useState(true)
  
  const backgroundMapStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: -1,
    filter: step <= 1 ? 'grayscale(100%) blur(1px)' : 'none'
  }

  const isMobile = window.innerWidth <= 768
  const floatingBoxStyle = {
    position: 'absolute',
    top: '1rem',
    left: '1rem',
    backgroundColor: '#2c2c2c',
    border: '1px solid white',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    padding: '2rem',
    borderRadius: '8px',
    width: 'calc(100vw - 4rem)',
    maxWidth: '350px',
    color: '#fff',
    zIndex: 1
  }

  // mobile-only screen 2
  const [showBarrioNameInput, setShowBarrioNameInput] = useState(!isMobile) // false on mobile initially

  // mobile constraints for transitions
    const slideVariants = {
      initial: {
        opacity: 0,
        transform: isMobile ? 'translateX(-50%) translateX(100vw)' : 'translateX(-100%)'
      },
      animate: {
        opacity: 1,
        transform: isMobile ? 'translateX(-50%) translateX(0)' : 'translateX(0%)'
      },
      exit: {
        opacity: 0,
        transform: isMobile ? 'translateX(-50%) translateX(-100vw)' : 'translateX(-100%)'
      }
    }


  const getFloatingStyle = () => {
    const isMobile = window.innerWidth <= 768
  
    const base = {
      backgroundColor: '#2c2c2c',
      border: '1px solid white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      padding: '1.5rem',
      borderRadius: '8px',
      width: isMobile ? '90%' : 'calc(100vw - 2rem)',
      maxWidth: isMobile ? '320px' : '350px',
      color: '#fff',
      zIndex: 1,
      fontSize: isMobile ? '0.9rem' : '1rem'
    }
  
    if (isMobile && (step === 2 || step === 3)) {
      return {
        ...base,
        position: 'fixed',
        bottom: '1rem',
        left: '50%'
      }
    }
  
    return {
      ...base,
      position: 'absolute',
      top: '1rem',
      left: '1rem'
    }
  }  
  
  // Tracking shape for submission (screen 2)
  const canProceedScreen2 = barrioName.trim().length > 0

  // Tracking shape for submission (screen 3)
  const isPolygonValid =
      polygonGeoJson?.geometry?.coordinates?.length &&
      polygonGeoJson.geometry.coordinates[0].length > 2 // at least a triangle

  const isPinInsidePolygon = (() => {
      if (!polygonGeoJson || !pinLocation) return false
      const polygon = polygonGeoJson.geometry.coordinates[0]
      const point = turf.point([pinLocation.lng, pinLocation.lat])
      const poly = turf.polygon([polygon])
      return turf.booleanPointInPolygon(point, poly)
    })()

  const canProceedScreen3 = isPolygonValid && isPinInsidePolygon

  const canProceedScreen4 = true
  
 //backup logic for screen4 email required
 // const canProceedScreen4 = (() => {
    //const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
    //return emailRegex.test(email.trim())
 // })()  

  // submission validation
  const validateScreen2 = () => {
    if (!barrioName.trim()) {
      setModalMessage('Por favor ingresá un nombre de barrio.')
      return false
    }
    return true
  }
  const [pinMoved, setPinMoved] = useState(false)
  const cabaCenter = { lat: -34.6037, lng: -58.437 }

  const validateScreen3 = () => {
    if (!polygonGeoJson || !polygonGeoJson.geometry?.coordinates?.length) {
      setModalMessage('Debés dibujar los límites de tu barrio.')
      return false
    }
  
    if (polygonGeoJson && pinLocation) {
      const polygon = polygonGeoJson.geometry.coordinates[0]
      const point = turf.point([pinLocation.lng, pinLocation.lat])
      const poly = turf.polygon([polygon])
      const inside = turf.booleanPointInPolygon(point, poly)
      if (!inside) {
        setModalMessage('El marcador debe estar dentro del límite que dibujaste.')
        return false
      }
    }
  
    return true
  }
  
  // email required code
      /*
      const validateScreen4 = () => {
        const emailRegex = /^.+@.+\..+$/
        if (!email || !emailRegex.test(email)) {
          setModalMessage('Por favor ingresá un email válido (ej: nombre@dominio.com).')
          return false
        }
        return true
      }
      */

  // email not required code
  const validateScreen4 = () => {
    return true
  }
     
  // submission
  const handleSubmit = async () => {

  // Bundle data for submission
    const fullSubmission = {
      email: email || '',
      age: age || '',
//      livesInCaba: livesInCaba || '',
      yearsInBarrio: yearsInBarrio || '',
      barrioName: barrioName || '',
      pinLocation: pinLocation || null,
//      landmarks: landmarks || '',
//      altNames: altNames || '',
      comments: comments || '',
      canContact: canContact || '',
      comunidad: comunidad || '',
//      claseSocial: claseSocial || '',
//      genero: genero || '',
      situacionDomicilio: situacionDomicilio || '',
      submittedAt: new Date(),
      sessionDuration: Date.now() - sessionStartTime.current,
      deviceType,
      language,
      userRegion,
      mapClickCount,
      polygon: polygonGeoJson ? JSON.stringify(polygonGeoJson) : null
    }
  
    console.log('Submitting with:', {
      email, canProceedScreen4
    })    

    try {
      await addDoc(collection(db, 'responses'), fullSubmission)
      console.log('✅ Submission saved!')
      setStep(5)
    } catch (err) {
      console.error('❌ Failed to save submission:', err)
    }
  }

  // Go next / back button logic
    const goNext = () => {
      if (step === 2 && !canProceedScreen2) {
        setModalMessage('Tocá el mapa y escribí el nombre del barrio.')
        setShowModal(true)
        return
      }
      if (step === 3 && !canProceedScreen3) {
        setModalMessage('Dibujá los límites y asegurate que el pin esté adentro del polígono.')
        setShowModal(true)
        return
      }
      if (step === 4 && !canProceedScreen4) {
        setModalMessage('Ingresá un email válido.')
        setShowModal(true)
        return
      }
      setStep((prev) => Math.min(prev + 1, 4))
    }
    
    const goBack = () => {
      setStep((prev) => Math.max(prev - 1, 1))
    }

  return (
    
    <div style={{
      position: 'relative',
      padding: (step >= 4 ? '2rem' : '0'),
      maxWidth: (step >= 4 ? '700px' : 'none'),
      margin: (step >= 4 ? '0 auto' : '0')
    }}>
    
    {step === 1 || step === 5 ? (
      <MapScreen readOnly blurred />
    ) : null}


      {/* Step 1: WELCOME */}
      <AnimatePresence mode="wait">
      {step === 1 && (
        <>
        <MapScreen readOnly blurred />
        <motion.div
          key="step1"
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={getFloatingStyle()}
        >
          <h1>Ayudanos a mapear los barrios de Buenos Aires! 🗺️</h1>
          <p>
          📌 ¿Dónde empieza y termina tu barrio? ¿Cómo se llama la zona? Cada día, porteños discuten los límites y nombres de sus barrios. Nuestra misión es construir un mapa colectivo de los barrios de CABA basado en cómo vos lo vivís.
          </p>
          <p>  
          🚀 ¡Sumate al proyecto! Recibirás información sobre los resultados cuando esté completo. 
          </p>
          <p>
            <span style={{color: '#ff3840' }}>Tus respuestas serán <em>anónimas</em> y usadas <em>exclusivamente para este proyecto.</em> </span>
          </p>
          <button onClick={goNext}>Aceptar y comenzar ➡️</button>
          <p style={{ fontSize: '0.8rem', marginTop: '2rem' }}>
            Al participar, aceptás los <span style={{ color: 'lightblue', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>términos y condiciones</span> del proyecto.  
            La inspiración del proyecto viene del New York Times ("<a href="https://www.nytimes.com/interactive/2023/upshot/extremely-detailed-nyc-neighborhood-map.html" target="_blank" rel="noopener noreferrer" style={{ color: 'lightblue' }}>
              Extremely Detailed Map of New York City Neighborhoods
            </a>")
          </p>
        </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* Step 2: PIN + BARRIO NAME */}
      <AnimatePresence mode="wait">
      {step === 2 && (
        <>
          <div style={{
            position: 'absolute',
            top: '0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#fff',
            color: '#000',
            padding: '0.6rem 1.2rem',
            borderRadius: '24px',
            fontSize: '1rem',
            fontWeight: '600',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '90%',
            lineHeight: '1.4'
          }}>
            {!pinMoved ? 'Hacé click donde vivís' : 'Escribí abajo cómo lo llamás'}
          </div>



        {(!isMobile || showBarrioNameInput) && (
                  <motion.div
                    key="step2"
                    variants={slideVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"                    
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    style={getFloatingStyle()}
                  >

            <div style={{ marginBottom: '1rem', position: 'relative' }} ref={inputRef}>
              <label>🎯 Nombre del barrio: Hacé click donde vivís y escribí cómo lo llamás<br />
                <input
                  type="text"
                  value={barrioName}
                  onChange={(e) => {
                    const input = e.target.value
                    setBarrioName(input)
                    if (input.length > 1) {
                      const results = fuse.search(input).map(r => r.item)
                      setSuggestions(results.slice(0, 5))
                    } else {
                      setSuggestions([])
                    }
                  }}
                  style={{ width: '95%', padding: '0.5rem', marginTop: '0.25rem' }}
                  placeholder="Ej: Villa Crespo, Palermo Soho..."
                />
              </label>

              {suggestions.length > 0 && (
                <ul style={{
                  position: 'absolute',
                  top: isMobile ? 'auto' : '105%',
                  bottom: isMobile ? '105%' : 'auto',
                  left: 0,
                  right: 0,
                  background: '#222',
                  color: 'white',
                  border: '1px solid #444',
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  zIndex: 10,
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      onClick={() => {
                        setBarrioName(suggestion)
                        setSuggestions([])
                      }}
                      style={{
                        padding: '0.5rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid #333'
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <AnimatePresence>
                {!canProceedScreen2 && (
                  <motion.p
                    key="tooltip"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      color: '#bbb',
                      textAlign: 'center',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Ingresá un nombre para continuar
                  </motion.p>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={goBack} className="btn-nav">
                  Volver
                  <span>⬅️</span>
                </button>

                <button
              onClick={goNext}
              className={`btn-nav ${canProceedScreen2 ? 'btn-next' : 'btn-disabled'}`}
              disabled={!canProceedScreen2}
            >
                    Siguiente
                    <span>➡️</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          <MapScreen
            step={step}
            setPinLocation={(loc) => {
              setPinLocation(loc)
              if (loc.lat !== cabaCenter.lat || loc.lng !== cabaCenter.lng) {
                setPinMoved(true)
                if (isMobile && !showBarrioNameInput) {
                  setShowBarrioNameInput(true)
                }
              }
            }}
            setMapClickCount={setMapClickCount}
            mapRef={mapRef}
            setMapReady={setMapReady}
          />
        </>
      )}
      </AnimatePresence>


      {/* Step 3: DIBUJAR LIMITES */}
      <AnimatePresence mode="wait">
      {step === 3 && (
        <>
          {/* 👇 Move the modal here first */}
          {drawingInstructionsVisible && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              overflowY: 'auto',
              padding: '1rem'
            }}>
              <div style={{
                backgroundColor: '#fff',
                color: '#000',
                padding: '1.5rem',
                borderRadius: '8px',
                maxWidth: '380px',
                width: '100%',
                textAlign: 'center',
                fontSize: '0.9rem',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)'
              }}>
                <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>📍 ¿Dónde están los límites de tu barrio?</h3>
                <p><strong>Cómo dibujar:</strong></p>
                <ol style={{ textAlign: 'left', paddingLeft: '1.2rem', fontSize: '1rem' }}>
                  <li>📌 Tocá el mapa para los puntos para formar el contorno.</li>
                  <li>✅ Hacé clic en el primer punto para cerrar el polígono.</li>
                  <li>🔄 Si necesitás reiniciar, usá el icono de la papelera arriba a la derecha.</li>
                </ol>
                <button
                  onClick={() => setDrawingInstructionsVisible(false)}
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.9rem 1.6rem',
                    fontSize: '1rem',
                    backgroundColor: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Estoy listo para dibujar ➡️
                </button>
              </div>
            </div>
          )}

        {/* White instructions at top */}
        {!canProceedScreen3 && (
          <div style={{
            position: 'fixed',
            top: '0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#fff',
            color: '#000',
            padding: '0.75rem 1.25rem',
            borderRadius: '16px',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            maxWidth: '260px',
            width: '60%',
            lineHeight: '1.4',
            textAlign: 'center',
            zIndex: 1000
          }}>
            ✏️ Tocá el mapa para agregar puntos y cerrar el polígono
          </div>
        )}

          {/* Floating instruction box */}
          <motion.div
            key="step3"
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"            
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            style={getFloatingStyle()}
          >

            <div style={{ marginTop: '0rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <AnimatePresence>
                {!canProceedScreen3 && (
                  <motion.p
                    key="tooltip4"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      fontSize: '0.75rem',
                      color: '#bbb',
                      textAlign: 'center',
                      marginBottom: '0.5rem'
                    }}
                  >
                    { !isPolygonValid ? 'Dibujá un límite para continuar' :
                      !isPinInsidePolygon ? 'El pin debe estar dentro del polígono' : ''
                    }
                  </motion.p>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={goBack} className="btn-nav">
                  Volver
                  <span>⬅️</span>
                </button>

                <MotionButton
                  onClick={goNext}
                  className={`btn-nav ${canProceedScreen3 ? 'btn-next' : 'btn-disabled'}`}
                  disabled={!canProceedScreen3}
                  animate={{ scale: canProceedScreen3 ? 1 : 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  Siguiente
                  <span>➡️</span>
                </MotionButton>
              </div>
            </div>

          </motion.div>

          <BoundaryDrawScreen
            setPolygonGeoJson={setPolygonGeoJson}
            pinLocation={pinLocation}
            barrioName={barrioName}
          />
        </>
      )}
      </AnimatePresence>


      {/* Step 4: MAS DETALLE */}
      <AnimatePresence mode="wait">
        {step === 4 && (
          <>
            <BoundaryDrawScreen
            polygonGeoJson={polygonGeoJson}
            barrioName={barrioName}
            readOnly={true}
            pinLocation={pinLocation}
          />
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={getFloatingStyle()}
                  >
            <h2>📝 Contanos un poco más</h2>

            {/* Open ended input */}
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                value={comments}
                placeholder= "Opcional | ¿Hay otros nombres para la zona? ¿Cuáles calles o lugares la definen y/o querés contarnos algo más?"
                onChange={(e) => setComments(e.target.value)}
                style={{ width: '95%' }}
                rows={4}
              />
            </div>

            {/* Comunidad */}
            <div style={{ marginBottom: '1rem' }}>
              <textarea
                value={comunidad}
                placeholder= "Opcional | ¿Te considerás parte de una(s) comunidad(es) en particular? (ej. religiosa, étnica, tribu urbana)"
                onChange={(e) => setComunidad(e.target.value)}
                style={{ width: '95%' }}
                rows={4}
              />
            </div>

            {/* Age  & años en el lugar*/}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <select
              value={age}
              onChange={(e) => setAge(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
              placeholder="Edad"
            >
              <option value="">Edad</option>
              <option value="<20">Menos de 20</option>
              <option value="20–29">20–29</option>
              <option value="30–39">30–39</option>
              <option value="40–49">40–49</option>
              <option value="50–59">50–59</option>
              <option value="60–69">60–69</option>
              <option value="70+">70 o más</option>
            </select>

            <select
              value={yearsInBarrio}
              onChange={(e) => setYearsInBarrio(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
              placeholder="Años en el barrio"
            >
              <option value="">Años en barrio</option>
              <option value="<1">Menos de 1 año</option>
              <option value="1–5">1–5 años</option>
              <option value="6–10">6–10 años</option>
              <option value="10+">Más de 10 años</option>
              <option value="toda_la_vida">Toda mi vida</option>
            </select>
          </div>

            {/* Situación Domicilio */}
            <div style={{ marginBottom: '1rem' }}>
              <label>OPCIONAL: Describe tu situación de domicilio</label>
              <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
                {[
                  { value: 'dueño', label: 'Dueño' },
                  { value: 'alquiler', label: 'Alquiler' },
                  { value: 'familiar', label: 'Domicilio de conocidos' }
                ].map(({ value, label }) => (
                  <div key={value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="situacionDomicilio"
                      value={value}
                      checked={situacionDomicilio === value}
                      onChange={() => setSituacionDomicilio(value)}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="email"
                placeholder="Email (opcional)"
                value={email}
                style={{ width: '75%' }}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

                {/* Contact permission - vertical radio buttons */}
                <div style={{ marginBottom: '1rem', width: '100%' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.9rem',
                      color: '#fff'
                    }}>
                      <input
                        type="checkbox"
                        checked={canContact === 'sí'}
                        onChange={(e) => setCanContact(e.target.checked ? 'sí' : 'no')}
                        style={{
                          marginRight: '0.5rem',
                          transform: 'scale(1.1)',
                          appearance: 'checkbox',
                          accentColor: '#fff',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <label style={{
                        cursor: 'pointer',
                        margin: 0,
                        lineHeight: 1.2
                      }}>
                        Estoy de acuerdo en que me contacten más adelante
                      </label>
                    </div>
                  </div>


            {/* Navigation Buttons */}
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <AnimatePresence>
                {!canProceedScreen4 && (
                  <motion.p
                    key="tooltip"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      fontSize: '0.75rem',
                      color: '#bbb',
                      textAlign: 'center',
                      marginBottom: '0.5rem'
                    }}
                  >
                    Ingresá un email para enviar
                  </motion.p>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={goBack} className="btn-nav">
                  Volver
                  <span>⬅️</span>
                </button>

                <MotionButton
                  onClick={handleSubmit}
                  className={`btn-nav ${canProceedScreen4 ? 'btn-next' : 'btn-disabled'}`}
                  disabled={!canProceedScreen4}
                  animate={{ scale: canProceedScreen4 ? 1 : 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  Enviar
                  <span>➡️</span>
                </MotionButton>
              </div>
            </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>

      {/* Step 5 */}
      {step === 5 && (
        <>
          <h2>✅ ¡Gracias por mapear tu barrio!</h2>
          <p>Tu aporte es muy valioso para el mapa colectivo de Buenos Aires. 🚀</p>
          <button onClick={goBack} className="btn-nav">Volver<span>⬅️</span></button>
        </>
      )}

{/* Progress Bar */}
{step >= 1 && step <= 4 && (
  <div style={{
    position: 'fixed',
    bottom: '0.75rem',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 1000,
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    boxShadow: '0 2px 4px rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(3px)'
  }}>
    <span style={{
      marginRight: '0.75rem',
      color: '#fff',
      fontSize: '0.7rem',
      fontWeight: 'bold'
    }}>Paso</span>
    {[1, 2, 3, 4].map((s) => (
      <div key={s} style={{
        width: '12px',
        height: '5px',
        margin: '0 3px',
        borderRadius: '3px',
        backgroundColor:
          step === s ? '#FFD700' : step > s ? '#00CC66' : '#666'
      }} />
    ))}
  </div>
)}

{/* Modals */}
{showModal && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }}>
    <div style={{
      backgroundColor: '#222',
      padding: '2rem',
      borderRadius: '8px',
      width: '75%',
      maxWidth: '275px',
      color: '#fff',
      border: '2px solid red'
    }}>
      <h3 style={{ color: 'red' }}>Aviso</h3>
      <p>{modalMessage || 'Placeholder text for Terms and Conditions'}</p>
      <button onClick={() => setShowModal(false)} style={{ marginTop: '1rem' }}>
        Cerrar
      </button>
    </div>
  </div>
)}


{showTerms && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  }}>
    <div style={{
      backgroundColor: '#222',
      padding: '2rem',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '500px',
      color: '#fff',
      border: '1px solid #aaa',
      fontSize: '0.70rem' // Smaller font size
    }}>
      <h3 style={{ color: '#fff' }}>Términos y Condiciones</h3>

      <p>Este proyecto busca recopilar información colectiva sobre cómo las personas en CABA definen sus barrios. Tus respuestas serán utilizadas exclusivamente para fines de análisis urbano, visualización pública, investigación académica y desarrollo de políticas basadas en evidencia.</p>

      <p>Al participar, estarás compartiendo información incluyendo:</p>

      <ul>
        <li>Tus respuestas en el formulario (mapa, nombres, descripciones, datos demográficos)</li>
        <li>Información técnica básica como el momento de la participación, idioma del navegador y tipo de dispositivo</li>
        <li>Tu ubicación aproximada basada en tu dirección IP (ciudad y país)</li>
        <li>Interacciones dentro del mapa (como la cantidad de clics)</li>
      </ul>

      <p><strong>No se recopilarán datos sensibles</strong> como tu nombre, dirección exacta ni tu IP completa.</p>

      <p>Toda la información será almacenada de forma segura y podrá ser compartida públicamente de manera agregada y anónima.</p>

      <p>Al hacer clic en “Aceptar y comenzar”, estás dando tu consentimiento para participar bajo estos términos.</p>

      <button onClick={() => setShowTerms(false)} style={{ marginTop: '1rem' }}>
        Cerrar
      </button>
    </div>
  </div>
)}


    </div>
  )
}

export default App
