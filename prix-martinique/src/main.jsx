import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// import App2 from './App2.jsx'
// import App3 from './App3.jsx'
// import App4 from './App4.jsx'
// import App5 from './App5.jsx'
// import App6 from './App6.jsx'
import App7 from './App7.jsx'
import App8 from './App8.jsx'
import App10 from './App10.jsx'
import { AuthProvider } from './contexts/AuthContext'
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error && this.state.error.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {/* <App /> */}
        {/* <App2 /> */}
        {/* <App3 /> */}
        {/* <App4 /> */}
        {/* <App5 /> */}
        {/* <App6 /> */}
        {/* <App7 /> */}
        {/* <App8 /> */}
        {/* <App9 /> */}
        <App10 />
      </AuthProvider>
    </ErrorBoundary>
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
