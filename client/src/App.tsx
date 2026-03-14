import React from 'react';
import { LoginScreen } from './components/LoginScreen';
import './styles/globals.css';

function App() {
  const handleLoginSuccess = (email: string) => {
    console.log('User logged in:', email);
    // TODO: Navigate to dashboard
  };

  return (
    <div className="App">
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
