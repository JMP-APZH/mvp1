import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// import App2 from './App2.jsx'
// import App3 from './App3.jsx'
// import App4 from './App4.jsx'
// import App5 from './App5.jsx'
import App6 from './App6.jsx'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      {/* <App /> */}
      {/* <App2 /> */}
      {/* <App3 /> */}
      {/* <App4 /> */}
      {/* <App5 /> */}
      <App6 />
    </AuthProvider>
  </StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
