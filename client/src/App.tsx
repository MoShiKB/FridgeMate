import React, { useEffect, useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { GoogleAuthCallback } from './components/GoogleAuthCallback';
import './styles/globals.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSuccess = (email: string) => {
    console.log('User logged in:', email);
    // TODO: Navigate to dashboard
  };

  return (
    <div className="App">
      {currentPath === '/auth/google/callback' ? (
        <GoogleAuthCallback onLoginSuccess={handleLoginSuccess} />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
