import React from 'react';
import { LoginScreen } from './components/LoginScreen';
import './styles/globals.css';

function App() {
  const handleLoginSuccess = (email: string) => {
    console.log('User logged in:', email);
    // TODO: Navigate to dashboard
  };

  const handleSignUpClick = () => {
    console.log('Sign up clicked');
    // TODO: Navigate to sign up page
  };

  const handleForgotPasswordClick = () => {
    console.log('Forgot password clicked');
    // TODO: Navigate to forgot password page
  };

  return (
    <div className="App">
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onSignUpClick={handleSignUpClick}
        onForgotPasswordClick={handleForgotPasswordClick}
      />
    </div>
  );
}

export default App;
