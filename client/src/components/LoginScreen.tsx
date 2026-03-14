import React, { useState } from 'react';
import styles from '../styles/LoginScreen.module.css';
import { getEmailError, getPasswordError } from '../utils/validation';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { RegisterScreen } from './RegisterScreen';
import { api, tokenManager } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess?: (email: string) => void;
}

type AuthScreenType = 'login' | 'forgotPassword' | 'register';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AuthScreenType>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    // Validate
    const emailErr = getEmailError(email);
    const passwordErr = getPasswordError(password);

    if (emailErr) {
      setEmailError(emailErr);
    }
    if (passwordErr) {
      setPasswordError(passwordErr);
    }

    if (emailErr || passwordErr) {
      return;
    }

    // Call API
    setIsLoading(true);
    try {
      const response = await api.login(email, password);
      
      // Store tokens
      tokenManager.setTokens(response.accessToken, response.refreshToken);
      
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess(email);
      }
      console.log('Login successful:', { email });
    } catch (error: any) {
      setIsLoading(false);
      const errorMessage = error?.message || 'Login failed. Please try again.';
      setGeneralError(errorMessage);
      console.error('Login error:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.logoContainer}>
        <img
          src="/assets/images/logo.png"
          alt="FridgeMate Logo"
          className={styles.logo}
        />
        <h1 className={styles.appName}>FridgeMate</h1>
      </div>

      <div className={`${styles.card} ${styles[`card-${currentScreen}`]}`}>
        {currentScreen === 'login' ? (
          <>
            <form onSubmit={handleLogin}>
              {/* General Error Message */}
              {generalError && (
                <div className={styles.errorMessage}>{generalError}</div>
              )}

              {/* Email Field */}
              <div className={styles.inputGroup}>
                <label className={styles.sectionTitle}>Email or Username</label>
                <div
                  className={`${styles.inputWrapper} ${
                    emailError ? styles.errorInput : ''
                  }`}
                >
                  <svg
                    className={styles.startIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    type="email"
                    className={styles.input}
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    disabled={isLoading}
                  />
                </div>
                {emailError && <span className={styles.error}>{emailError}</span>}
              </div>

              {/* Password Field */}
              <div className={styles.inputGroup}>
                <label className={`${styles.sectionTitle} ${styles.sectionTitlePassword}`}>
                  Password
                </label>
                <div
                  className={`${styles.inputWrapper} ${
                    passwordError ? styles.errorInput : ''
                  }`}
                >
                  <svg
                    className={styles.startIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={styles.input}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className={styles.endIconButton}
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordError && <span className={styles.error}>{passwordError}</span>}
              </div>

              {/* Forgot Password Link */}
              <button
                type="button"
                className={styles.forgotPasswordLink}
                onClick={() => setCurrentScreen('forgotPassword')}
                disabled={isLoading}
              >
                Forgot Password?
              </button>

              {/* Login Button */}
              <button
                type="submit"
                className={styles.loginButton}
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Log In'}
              </button>
            </form>

            {/* Sign Up Link */}
            <div className={styles.signupContainer}>
              <span className={styles.signupText}>Don't have an account?</span>
              <button
                type="button"
                className={styles.signupLink}
                onClick={() => setCurrentScreen('register')}
                disabled={isLoading}
              >
                Sign Up
              </button>
            </div>

            {/* Social Login Buttons */}
            <div className={styles.socialButtonsContainer}>
              <div className={styles.socialButtonsTitle}>Or continue with</div>
              <div className={styles.socialButtonsGrid}>
                <button
                  type="button"
                  className={`${styles.socialButton} ${styles.googleButton}`}
                  disabled={isLoading}
                  aria-label="Login with Google"
                >
                  <svg
                    className={styles.socialIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="none"
                  >
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  className={`${styles.socialButton} ${styles.facebookButton}`}
                  disabled={isLoading}
                  aria-label="Login with Facebook"
                >
                  <svg
                    className={styles.socialIcon}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      fill="#1877F2"
                      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                    />
                  </svg>
                  Facebook
                </button>
              </div>
            </div>
          </>
        ) : currentScreen === 'forgotPassword' ? (
          <ForgotPasswordScreen
            onBackToLogin={() => setCurrentScreen('login')}
            onResetSuccess={() => {
              setCurrentScreen('login');
              // Reset form
              setEmail('');
              setPassword('');
            }}
          />
        ) : (
          <RegisterScreen
            onBackToLogin={() => setCurrentScreen('login')}
            onSignUpSuccess={() => {
              setCurrentScreen('login');
              // Reset form
              setEmail('');
              setPassword('');
            }}
          />
        )}
      </div>
    </div>
  );
};