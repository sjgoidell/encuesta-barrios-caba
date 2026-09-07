import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import MapScreen from './MapScreen'

// Landing — the site's front door at "/". A minimal hub: title, tagline, and
// two big buttons into the survey (/encuesta) and the results (/live_results).
// The fuller pitch/confidentiality/terms text stays on the survey's own step 1
// (App.jsx), since that's consent-to-participate language tied to starting it.
function Landing() {
  const navigate = useNavigate()
  const [showTerms, setShowTerms] = useState(false)
  const MotionDiv = motion.div

  const tileStyle = {
    flex: '1 1 0',
    aspectRatio: '1 / 1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    fontSize: '1.15rem',
    fontWeight: '700',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'center',
    lineHeight: 1.3,
  }

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <MapScreen readOnly blurred />

      {/* Hover "bezel" affordance on the hub tiles -- plain <style>, since
          inline styles can't express :hover. */}
      <style>{`
        .hub-tile { transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
        .hub-tile:hover { transform: translateY(-2px); }
        .hub-tile-primary { border: 2px solid transparent; }
        .hub-tile-primary:hover { border-color: #baffd8; box-shadow: 0 0 0 2px rgba(186,255,216,0.4); }
        .hub-tile-secondary { border: 2px solid #5b7c99; }
        .hub-tile-secondary:hover { border-color: #cfe3f2; box-shadow: 0 0 0 2px rgba(207,227,242,0.4); }
      `}</style>

      {/* Opacity-only fade: framer-motion takes over the `transform` CSS
          property for any animated x/y/scale, which would silently overwrite
          the translate(-50%,-50%) centering below. */}
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#2c2c2c',
          border: '1px solid white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '2rem',
          borderRadius: '8px',
          width: 'calc(100vw - 4rem)',
          maxWidth: '560px',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <h1 style={{ marginTop: 0 }}>Dónde Vivo CABA 🗺️</h1>
        <p style={{ marginBottom: '2rem' }}>
          El mapa colectivo de cómo los porteños definimos nuestros barrios.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            className="hub-tile hub-tile-primary"
            style={{ ...tileStyle, backgroundColor: '#00cc66', color: '#fff' }}
            onClick={() => navigate('/encuesta')}
          >
            <span style={{ fontSize: '2rem' }}>📝</span>
            Sumar mi barrio
          </button>

          <button
            className="hub-tile hub-tile-secondary"
            style={{ ...tileStyle, backgroundColor: '#3e5c76', color: '#fff' }}
            onClick={() => navigate('/live_results')}
          >
            <span style={{ fontSize: '2rem' }}>🗺️</span>
            Revisar los resultados
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', marginTop: '2rem' }}>
          Al participar, aceptás los <span style={{ color: 'lightblue', cursor: 'pointer' }} onClick={() => setShowTerms(true)}>términos y condiciones</span> del proyecto.
        </p>

        <p style={{ fontSize: '0.8rem' }}>
          Seguinos en Instagram: <a href="https://instagram.com/dondevivocaba" target="_blank" rel="noopener noreferrer" style={{ color: 'lightblue' }}>
            @dondevivocaba
          </a>
        </p>

        <p style={{ fontSize: '0.8rem', marginTop: '1rem' }}>
          Dónde Vivo CABA es un proyecto impulsado por Sam Goidell, con el apoyo de amigos y
          conocidos que aman a la Ciudad de Buenos Aires y el patrimonio cultural de sus barrios.
          La comunidad cuenta con representación del mundo académico e inmobiliario, y del
          gobierno local. ¡Gracias a todos por su apoyo!
        </p>
      </MotionDiv>

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
            fontSize: '0.70rem'
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

            <button onClick={() => setShowTerms(false)} style={{ marginTop: '1rem' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Landing
