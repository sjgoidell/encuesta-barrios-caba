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
    filter: step <= 2 ? 'grayscale(100%) blur(1px)' : 'none'
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
      zIndex: 1
    }
  
    if (isMobile && (step === 3 || step === 4)) {
      return {
        ...base,
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)'
      }
    }
  
    return {
      ...base,
      position: 'absolute',
      top: '1rem',
      left: '1rem'
    }
  }  
  
  // submission validation
  const validateScreen2 = () => {
    const emailRegex = /^.+@.+\..+$/
    if (!email || !emailRegex.test(email)) {
      setModalMessage('Por favor ingresá un email válido (ej: nombre@dominio.com).')
      return false
    }
    return true
  }

  const validateScreen3 = () => {
    if (!barrioName.trim()) {
      setModalMessage('Por favor ingresá un nombre de barrio.')
      return false
    }
    return true
  }

  const validateScreen4 = () => {
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
     
  // submission
  const handleSubmit = async () => {

  // Bundle data for submission
    const fullSubmission = {
      email: email || '',
      age: age || '',
      livesInCaba: livesInCaba || '',
      yearsInBarrio: yearsInBarrio || '',
      barrioName: barrioName || '',
      pinLocation: pinLocation || null,
      landmarks: landmarks || '',
      altNames: altNames || '',
      comments: comments || '',
      canContact: canContact || '',
      comunidad: comunidad || '',
      claseSocial: claseSocial || '',
      genero: genero || '',
      situacionDomicilio: situacionDomicilio || '',
      submittedAt: new Date(),
      sessionDuration: Date.now() - sessionStartTime.current,
      deviceType,
      language,
      userRegion,
      mapClickCount,
      polygon: polygonGeoJson ? JSON.stringify(polygonGeoJson) : null
    }
  
    try {
      await addDoc(collection(db, 'responses'), fullSubmission)
      console.log('✅ Submission saved!')
      setStep(6)
    } catch (err) {
      console.error('❌ Failed to save submission:', err)
    }
  }

  const goNext = () => {
    if (step === 2 && !validateScreen2()) {
      setShowModal(true)
      return
    }
    if (step === 3 && !validateScreen3()) {
      setShowModal(true)
      return
    }
    if (step === 4 && !validateScreen4()) {
      setShowModal(true)
      return
    }
    setStep((prev) => Math.min(prev + 1, 6))
  }

  const goBack = () => setStep((prev) => Math.max(prev - 1, 1))

  return (
    <div style={{
      position: 'relative',
      padding: (step >= 6 ? '2rem' : '0'),
      maxWidth: (step >= 6 ? '700px' : 'none'),
      margin: (step >= 6 ? '0 auto' : '0')
    }}>
    
    {step === 1 || step === 2 || step === 5 ? (
      <MapScreen readOnly blurred />
    ) : null}


      {/* Step 1 */}
      {step === 1 && (
        <>
        <MapScreen readOnly blurred />
        <div style={getFloatingStyle()}>
          <h1>Ayudanos a mapear los barrios y límites de Buenos Aires! 🗺️</h1>
          <p>
          📌 ¿Dónde empieza y termina tu barrio? ¿Cómo se llama la zona? Cada día, porteños siguen discutiendo los límites y nombres de sus barrios. Nuestra misión es construir un mapa colectivo de todos los barrios de CABA basado en cómo vos lo vivís.
          </p>
          <p>  
          🚀 ¡Sumate al proyecto! Recibirás información sobre los resultados cuando esté completo. 
          </p>
          <p>
            <span style={{color: '#ff3840' }}>Tus respuestas serán <em>anónimas</em> y usadas <em>exclusivamente para este proyecto.</em> </span>
          </p>
          <button onClick={goNext}>Aceptar y comenzar →</button>
          <p style={{ fontSize: '0.8rem', marginTop: '2rem' }}>
            Al participar, aceptás los <span style={{ color: 'lightblue', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>términos y condiciones</span> del proyecto.  
            Este proyecto quería agradecer al trabajo del New York Times en su "<a href="https://www.nytimes.com/interactive/2023/upshot/extremely-detailed-nyc-neighborhood-map.html" target="_blank" rel="noopener noreferrer" style={{ color: 'lightblue' }}>
              Extremely Detailed Map of New York City Neighborhoods
            </a>" por la inspiración de este proyecto.
          </p>
        </div>
        </>
      )}

      {/* Step 2 */}
          {step === 2 && (
          <div style={getFloatingStyle()}>
        <h2>👉 Información del participante</h2>

        <div style={{ marginBottom: '1rem' }}>
          <label>Email (requerido):</label>
          <input
            type="email"
            value={email}
            style={{ width: '75%' }}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Edad:</label>
          <select
            value={age}
            onChange={(e) => setAge(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          >
            <option value="">Seleccioná una opción</option>
            <option value="<18">Menos de 18</option>
            <option value="18–24">18–24</option>
            <option value="25–34">25–34</option>
            <option value="35–44">35–44</option>
            <option value="45–54">45–54</option>
            <option value="55–64">55–64</option>
            <option value="65+">65 o más</option>
          </select>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            ¿Vivís actualmente en CABA?
          </label>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                type="radio"
                name="caba"
                value="sí"
                checked={livesInCaba === 'sí'}
                onChange={() => setLivesInCaba('sí')}
              />
              <span style={{ marginTop: '0.25rem' }}>Sí</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                type="radio"
                name="caba"
                value="no"
                checked={livesInCaba === 'no'}
                onChange={() => setLivesInCaba('no')}
              />
              <span style={{ marginTop: '0.25rem' }}>No</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>¿Hace cuántos años vivís en este lugar?</label>
          <select
            value={yearsInBarrio}
            onChange={(e) => setYearsInBarrio(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          >
            <option value="">Seleccioná una opción</option>
            <option value="<1">Menos de 1 año</option>
            <option value="1–5">1–5 años</option>
            <option value="6–10">6–10 años</option>
            <option value="10+">Más de 10 años</option>
            <option value="toda_la_vida">Toda mi vida</option>
          </select>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button onClick={goBack} style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>← Volver</button>
          <button onClick={goNext}style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>→ Siguiente</button>
        </div>
      </div>
    )}


      {/* Step 3 */}
      {step === 3 && (
        <>
          <div style={getFloatingStyle()}>
            <h2>🎯 Ubicación y nombre del barrio</h2>
            <p>Ubicá el centro de tu barrio en el mapa y escribí cómo lo llamás.</p>

            <div style={{ marginBottom: '4rem', position: 'relative' }} ref={inputRef}>
              <label>Nombre del barrio:<br />
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
                  top: '105%',
                  left: 0,
                  right: 0,
                  background: '#222',
                  color: 'white',
                  border: '1px solid #444',
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  zIndex: 10
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

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button onClick={goBack} style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>← Volver</button>
              <button onClick={goNext}style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>→ Siguiente</button>
            </div>
          </div>

          <MapScreen
            step={step}
            setPinLocation={setPinLocation}
            setMapClickCount={setMapClickCount}
            //overrideCenter={isMobile && step === 3 ? [-58.437, -34.6337] : undefined}
          />


        </>
      )}


{step === 4 && (
  <>
    <div style={getFloatingStyle()}>
      <h2>✏️ Dibujá tu barrio</h2>
      <p>Usá las herramientas para dibujar los límites de tu barrio. Podés editarlo o borrarlo.</p>

      {drawingInstructionsVisible && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '10vh',
            zIndex: 999,
            overflowY: 'auto'
          }}>
            <div style={{
              backgroundColor: '#fff',
              color: '#000',
              padding: '1.5rem',
              borderRadius: '8px',
              maxWidth: '380px',
              width: '90%',
              textAlign: 'center',
              fontSize: '0.9rem',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '1.1rem' }}>📍 ¿Dónde están los límites de tu barrio?</h3>
              <p><strong>Cómo dibujar:</strong></p>
              <ol style={{ textAlign: 'left', paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                <li>🖊️ Tocá el mapa para agregar el punto de inicio.</li>
                <li>📌 Tocá para agregar más puntos y formar el contorno.</li>
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
                Estoy listo para dibujar →
              </button>
            </div>
          </div>
        )}

            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button onClick={goBack} style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>← Volver</button>
              <button onClick={goNext}style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>→ Siguiente</button>
      </div>
    </div>

    <BoundaryDrawScreen
      setPolygonGeoJson={setPolygonGeoJson}
      pinLocation={pinLocation}
      barrioName={barrioName}
    />
  </>
)}


{step === 5 && (
  <>
    <BoundaryDrawScreen
    polygonGeoJson={polygonGeoJson}
    barrioName={barrioName}
    readOnly={true}
    pinLocation={pinLocation}
  />
  <div style={getFloatingStyle()}>
    <h2>📝 Contanos un poco más</h2>

    {/* Text input fields */}
    <div style={{ marginBottom: '1rem' }}>
      <label>¿Qué calles, plazas o lugares definen tu barrio?</label>
      <input
        type="text"
        value={landmarks}
        onChange={(e) => setLandmarks(e.target.value)}
        style={{ width: '95%' }}
      />
    </div>

    <div style={{ marginBottom: '1rem' }}>
      <label>¿Usás otros nombres para esta zona?</label>
      <input
        type="text"
        value={altNames}
        onChange={(e) => setAltNames(e.target.value)}
        style={{ width: '95%' }}
      />
    </div>

    <div style={{ marginBottom: '1rem' }}>
      <label>¿Querés contarnos algo más sobre tu barrio?</label>
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        style={{ width: '95%' }}
        rows={4}
      />
    </div>

    {/* Comunidad */}
    <div style={{ marginBottom: '1rem' }}>
      <label>¿Te considerás parte de una(s) comunidad(es) en particular? (ej. religiosa, étnica, tribu urbana)</label>
      <textarea
        value={comunidad}
        onChange={(e) => setComunidad(e.target.value)}
        style={{ width: '95%' }}
        rows={3}
      />
    </div>

    {/* Clase Social */}
        <div style={{ marginBottom: '1rem' }}>
      <label>¿Cómo definirías tu clase social?</label>
      <select
        value={claseSocial}
        onChange={(e) => setClaseSocial(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
      >
            <option value="">Seleccioná una opción</option>
            <option value="alta">Clase alta</option>
            <option value="mediaalta">Clase media alta</option>
            <option value="media">Clase media</option>
            <option value="mediabaja">Clase media baja</option>
            <option value="baja">Clase baja</option>
      </select>
    </div>

    {/* Género */}
    <div style={{ marginBottom: '1rem' }}>
      <label>¿Cómo es tu género?</label>
      <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
        {['hombre', 'mujer', 'otro'].map((option) => (
          <div key={option} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              type="radio"
              name="genero"
              value={option}
              checked={genero === option}
              onChange={() => setGenero(option)}
            />
            <span style={{ textTransform: 'capitalize' }}>{option}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Situación Domicilio */}
    <div style={{ marginBottom: '1rem' }}>
      <label>Describe tu situación de domicilio</label>
      <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
        {[
          { value: 'dueño', label: 'Dueño' },
          { value: 'alquiler', label: 'Alquiler' },
          { value: 'familiar', label: 'Domicilio de familia / amigos' }
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

        {/* Contact permission - vertical radio buttons */}
        <div style={{ marginBottom: '1rem' }}>
      <label>¿Te gustaría que te contactemos más adelante?</label>
      <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="radio"
            name="contact"
            value="sí"
            checked={canContact === 'sí'}
            onChange={() => setCanContact('sí')}
          />
          <span>Sí</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="radio"
            name="contact"
            value="no"
            checked={canContact === 'no'}
            onChange={() => setCanContact('no')}
          />
          <span>No</span>
        </div>
      </div>
    </div>

    {/* Navigation Buttons */}
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button onClick={goBack} style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px'}}>← Volver</button>
              <button onClick={handleSubmit}style={{ marginRight: '1rem' ,width: '80%', maxWidth:'150px', color: '#ceffd0'}}>→ Enviar</button>
    </div>
    </div>
  </>
)}



      {/* Step 6 */}
      {step === 6 && (
        <>
          <h2>¡Gracias por mapear tu barrio!</h2>
          <p>Tu aporte es muy valioso para el mapa colectivo de Buenos Aires.</p>
          <button onClick={goBack}>← Volver</button>
        </>
      )}

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
      border: '1px solid #aaa'
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
