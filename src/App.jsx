import { useState } from 'react'
import './App.css'
import MapScreen from './components/MapScreen'
import Fuse from 'fuse.js'
import barrios from './data/barrios'
import BoundaryDrawScreen from './components/BoundaryDrawScreen'
import { collection, addDoc } from 'firebase/firestore'
import { db } from './firebase'


function App() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [livesInCaba, setLivesInCaba] = useState('')
  const [yearsInBarrio, setYearsInBarrio] = useState('')
  const [pinLocation, setPinLocation] = useState(null)
  const [barrioName, setBarrioName] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const fuse = new Fuse(barrios, {
    includeScore: true,
    threshold: 0.4 // Adjust this for strict/loose match
  })
  const [polygonGeoJson, setPolygonGeoJson] = useState(null)
  const [landmarks, setLandmarks] = useState('')
  const [altNames, setAltNames] = useState('')
  const [comments, setComments] = useState('')
  const [canContact, setCanContact] = useState(null)
  const [comunidad, setComunidad] = useState('')
  const [estadoSocial, setEstadoSocial] = useState('')
  const [genero, setGenero] = useState('')
  const [situacionDomicilio, setSituacionDomicilio] = useState('')
  const [formErrors, setFormErrors] = useState({})

     
  const handleSubmit = async () => {

    const newErrors = {}

    if (!email || !email.includes('@')) newErrors.email = 'Por favor ingresá un email válido.'
    if (!barrioName) newErrors.barrioName = 'Ingresá un nombre de barrio.'
    if (!pinLocation) newErrors.pin = 'Marcá un punto en el mapa.'
    if (!polygonGeoJson) newErrors.polygon = 'Dibujá los límites de tu barrio.'
    if (canContact === null) newErrors.canContact = 'Seleccioná una opción.'
    
    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors)
      return
    }
    
    setFormErrors({})
    

      // ✅ Step 1: Validate required fields
  if (!email || !email.includes('@')) {
    alert('Por favor ingresá un email válido.')
    return
  }

  if (!barrioName || !pinLocation || !polygonGeoJson || canContact === null) {
    alert('Por favor completá todos los campos obligatorios.')
    return
  }

  // ✅ Step 2: Bundle data
    const fullSubmission = {
      email: email || '',
      age: age || '',
      livesInCaba: livesInCaba || '',
      yearsInBarrio: yearsInBarrio || '',
      barrioName: barrioName || '',
      pinLocation: pinLocation || null,
      polygon: polygonGeoJson ? JSON.stringify(polygonGeoJson) : null,
      landmarks: landmarks || '',
      altNames: altNames || '',
      comments: comments || '',
      canContact: canContact || '',
      comunidad: comunidad || '',
      estadoSocial: estadoSocial || '',
      genero: genero || '',
      situacionDomicilio: situacionDomicilio || '',
      submittedAt: new Date()
    }
  
    try {
      console.log('Polygon (string):', polygonGeoJson ? JSON.stringify(polygonGeoJson) : 'null')
      console.log('Submitting:', fullSubmission)
      if (
        !email ||
        !barrioName ||
        !pinLocation ||
        !polygonGeoJson ||
        canContact === null
      ) {
        alert("Por favor completá todos los campos obligatorios antes de enviar.")
        return
      }      
      await addDoc(collection(db, 'responses'), fullSubmission)
      console.log('✅ Submission saved!')
      setStep(6)
    } catch (err) {
      console.error('❌ Failed to save submission:', err)
    }
  } 

  


  const goNext = () => setStep((prev) => Math.min(prev + 1, 6))
  const goBack = () => setStep((prev) => Math.max(prev - 1, 1))

  console.log('Pin location:', pinLocation)
  console.log(polygonGeoJson)

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      {/* Step 1 */}
      {step === 1 && (
        <>
          <h1>Ayudanos a mapear los barrios de Buenos Aires</h1>
          <p>
            ¿Dónde empieza y termina tu barrio? Queremos construir un mapa colectivo basado en cómo vos lo vivís.
            Tus respuestas serán anónimas y usadas exclusivamente para este proyecto.
          </p>
          <button onClick={goNext}>Aceptar y comenzar →</button>
          <p style={{ fontSize: '0.8rem', marginTop: '2rem' }}>
            Al participar, aceptás los términos y condiciones del proyecto.
          </p>
        </>
      )}

      {/* Step 2 */}
      {step === 2 && (
  <>
    <h2>Información del participante</h2>

        <div style={{ marginBottom: '1rem' }}>
      <label>Email (requerido):</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {formErrors.email && <p style={{ color: 'red', fontSize: '0.9rem' }}>{formErrors.email}</p>}
    </div>


    <div style={{ marginBottom: '1rem' }}>
      <label>Edad:<br />
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
      </label>
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
      <label>¿Cuántos años vivís en este lugar?<br />
        <select
          value={yearsInBarrio}
          onChange={(e) => setYearsInBarrio(e.target.value)}
          style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
        >
          <option value="">Seleccioná una opción</option>
          <option value="<1">Menos de 1 año</option>
          <option value="1–2">1–2 años</option>
          <option value="3–5">3–5 años</option>
          <option value="6–10">6–10 años</option>
          <option value="11–20">11–20 años</option>
          <option value="20+">Más de 20 años</option>
          <option value="toda_la_vida">Toda mi vida</option>
        </select>
      </label>
    </div>

    <div style={{ marginTop: '2rem' }}>
      <button onClick={goBack} style={{ marginRight: '1rem' }}>← Volver</button>
      <button onClick={goNext}>Siguiente →</button>
    </div>
        </>
      )}


      {/* Step 3 */}
      {step === 3 && (
  <>
    <h2>Ubicación y nombre del barrio</h2>
    <p>Ubicá el centro de tu barrio en el mapa y escribí cómo lo llamás.</p>

    <MapScreen
      setPinLocation={setPinLocation}
    />


    <div style={{ marginBottom: '6rem', position: 'relative' }}>
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
          style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
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


        <div style={{ marginTop: '2rem' }}>
          <button onClick={goBack} style={{ marginRight: '1rem' }}>← Volver</button>
          <button onClick={goNext}>Siguiente →</button>
        </div>
            </>
          )}


      {/* Step 4 */}
      {step === 4 && (
        <>
          <h2>Dibujá tu barrio</h2>
          <p>Usá las herramientas para dibujar los límites de tu barrio. Podés editarlo o borrarlo.</p>

          <BoundaryDrawScreen
            setPolygonGeoJson={setPolygonGeoJson}
            pinLocation={pinLocation}
            barrioName={barrioName}
          />


          <div style={{ marginTop: '2rem' }}>
            <button onClick={goBack} style={{ marginRight: '1rem' }}>← Volver</button>
            <button onClick={goNext}>Siguiente →</button>
          </div>
        </>
      )}


{step === 5 && (
  <>
    <h2>Contanos un poco más</h2>

    {/* Text input fields */}
    <div style={{ marginBottom: '1rem' }}>
      <label>¿Qué calles, plazas o lugares definen tu barrio?</label>
      <input
        type="text"
        value={landmarks}
        onChange={(e) => setLandmarks(e.target.value)}
      />
    </div>

    <div style={{ marginBottom: '1rem' }}>
      <label>¿Usás otros nombres para esta zona?</label>
      <input
        type="text"
        value={altNames}
        onChange={(e) => setAltNames(e.target.value)}
      />
    </div>

    <div style={{ marginBottom: '1rem' }}>
      <label>¿Querés contarnos algo más sobre tu barrio?</label>
      <textarea
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        rows={4}
      />
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

    {/* Comunidad */}
    <div style={{ marginBottom: '1rem' }}>
      <label>¿Te considerás parte de una(s) comunidad(es) en particular? (ej. religiosa, étnica, tribu urbana)</label>
      <textarea
        value={comunidad}
        onChange={(e) => setComunidad(e.target.value)}
        rows={3}
      />
    </div>

    {/* Estado Social */}
    <div style={{ marginBottom: '1rem' }}>
      <label>¿Cómo definirías tu estado social autopercibido?</label>
      <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem' }}>
        {['alto', 'mediano', 'bajo'].map((option) => (
          <div key={option} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <input
              type="radio"
              name="estadoSocial"
              value={option}
              checked={estadoSocial === option}
              onChange={() => setEstadoSocial(option)}
            />
            <span style={{ textTransform: 'capitalize' }}>{option}</span>
          </div>
        ))}
      </div>
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

    {/* Navigation Buttons */}
    <div style={{ marginTop: '2rem' }}>
      <button onClick={goBack} style={{ marginRight: '1rem' }}>← Volver</button>
      <button onClick={handleSubmit}>Enviar respuestas →</button>
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
    </div>
  )
}

export default App
