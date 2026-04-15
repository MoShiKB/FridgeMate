import React, { useEffect, useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { GoogleAuthCallback } from './components/GoogleAuthCallback';
import { Dashboard } from './pages/Dashboard';
import './styles/globals.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    // Check if user is authenticated by checking for tokens in localStorage
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    setIsAuthenticated(!!(accessToken || refreshToken));
  }, []);

  const handleLoginSuccess = (email: string) => {
    console.log('User logged in:', email);
    setIsAuthenticated(true);
  };

  // Google OAuth callback
  if (currentPath === '/auth/google/callback') {
    return (
      <div className="App">
        <GoogleAuthCallback onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Show Dashboard if authenticated, otherwise show LoginScreen
  return (
    <div className="App">
      {isAuthenticated ? (
        <Dashboard />
      ) : (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
