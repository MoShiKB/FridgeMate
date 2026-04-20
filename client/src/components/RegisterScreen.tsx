import React, { useState } from 'react';
import styles from '../styles/LoginScreen.module.css';
import {
  getFullNameError,
  getEmailError,
  getPasswordError,
  getPasswordConfirmError,
} from '../utils/validation';
import { api, tokenManager } from '../services/api';

interface RegisterScreenProps {
  onBackToLogin?: () => void;
  onSignUpSuccess?: (email: string) => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onBackToLogin,
  onSignUpSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors
    setFullNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setGeneralError(null);

    // Validate
    const fullNameErr = getFullNameError(fullName);
    const emailErr = getEmailError(email);
    const passwordErr = getPasswordError(password);
    const confirmPasswordErr = getPasswordConfirmError(password, confirmPassword);

    if (fullNameErr) setFullNameError(fullNameErr);
    if (emailErr) setEmailError(emailErr);
    if (passwordErr) setPasswordError(passwordErr);
    if (confirmPasswordErr) setConfirmPasswordError(confirmPasswordErr);

    if (fullNameErr || emailErr || passwordErr || confirmPasswordErr) {
      return;
    }

    // Call API
    setIsLoading(true);
    try {
      await api.register(fullName, email, password);
      
      setIsLoading(false);
      if (onSignUpSuccess) {
        onSignUpSuccess(email);
      }
      
      // Auto-redirect after 1 second
      setTimeout(() => {
        if (onBackToLogin) {
          onBackToLogin();
        }
      }, 1000);
    } catch (error: any) {
      setIsLoading(false);
      const errorMessage = error?.message || 'Sign up failed. Please try again.';
      setGeneralError(errorMessage);
      console.error('Sign up error:', error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className={styles.registerContainer}>
      <h2 className={styles.registerTitle}>Create Account</h2>

      <form onSubmit={handleSignUp}>
        {/* General Error Message */}
        {generalError && (
          <div className={styles.errorMessage}>{generalError}</div>
        )}

        {/* Full Name Field */}
        <div className={styles.inputGroup}>
          <label className={styles.sectionTitle}>Full Name</label>
          <div
            className={`${styles.inputWrapper} ${
              fullNameError ? styles.errorInput : ''
            }`}
          >
            <svg
              className={styles.startIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fullNameError) setFullNameError(null);
              }}
              disabled={isLoading}
              autoFocus
            />
          </div>
          {fullNameError && <span className={styles.error}>{fullNameError}</span>}
        </div>

        {/* Email Field */}
        <div className={styles.inputGroup}>
          <label className={styles.sectionTitle}>Email</label>
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
          <label className={styles.sectionTitle}>Password</label>
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
              placeholder="Create a password"
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

        {/* Confirm Password Field */}
        <div className={styles.inputGroup}>
          <label className={styles.sectionTitle}>Confirm Password</label>
          <div
            className={`${styles.inputWrapper} ${
              confirmPasswordError ? styles.errorInput : ''
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
              type={showConfirmPassword ? 'text' : 'password'}
              className={styles.input}
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError(null);
              }}
              disabled={isLoading}
            />
            <button
              type="button"
              className={styles.endIconButton}
              onClick={toggleConfirmPasswordVisibility}
              disabled={isLoading}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
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
          {confirmPasswordError && <span className={styles.error}>{confirmPasswordError}</span>}
        </div>

        {/* Sign Up Button */}
        <button
          type="submit"
          className={styles.loginButton}
          disabled={isLoading}
          style={{ marginTop: '16px' }}
        >
          {isLoading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      {/* Back to Login Link */}
      <button
        type="button"
        className={styles.backToLoginLink}
        onClick={onBackToLogin}
        disabled={isLoading}
      >
        Already have an account? Log In
      </button>
    </div>
  );
};
