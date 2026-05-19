import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (!googleClientId) {
  // eslint-disable-next-line no-console
  console.warn(
    '[RIS-PDM] VITE_GOOGLE_CLIENT_ID is not set — Google sign-in will be unavailable.'
  )
}

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={googleClientId || ''}>
    <App />
  </GoogleOAuthProvider>
)
