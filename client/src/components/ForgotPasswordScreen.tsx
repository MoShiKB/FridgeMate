import React, { useState } from 'react';
import styles from '../styles/LoginScreen.module.css';
import { getEmailError, getPasswordError } from '../utils/validation';
import { api } from '../services/api';

type ForgotPasswordStep = 'enterEmail' | 'verifyCode';

interface ForgotPasswordScreenProps {
  onBackToLogin?: () => void;
  onResetSuccess?: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onBackToLogin,
  onResetSuccess,
}) => {
  // Step 1: Request reset code (email)
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  
  // Step 2: Verify code and reset password
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // UI state
  const [currentStep, setCurrentStep] = useState<ForgotPasswordStep>('enterEmail');
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Step 1: Send reset code to email
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset messages
    setEmailError(null);
    setGeneralError(null);
    setSuccessMessage('');

    // Validate
    const emailErr = getEmailError(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }

    // Call API
    setIsLoading(true);
    try {
      await api.forgotPassword(email);
      setIsLoading(false);
      setSuccessMessage('Password reset code has been sent to your email!');
      
      // Move to step 2 after brief delay
      setTimeout(() => {
        setSuccessMessage('');
        setCurrentStep('verifyCode');
      }, 1500);
    } catch (error: any) {
      setIsLoading(false);
      const errorMessage = error?.message || 'Failed to send reset code. Please try again.';
      setGeneralError(errorMessage);
      console.error('Forgot password error:', error);
    }
  };

  // Step 2: Verify code and reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset messages
    setCodeError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setGeneralError(null);
    setSuccessMessage('');

    // Validate
    if (!resetCode.trim()) {
      setCodeError('Reset code is required');
      return;
    }

    const passwordErr = getPasswordError(newPassword);
    if (passwordErr) {
      setPasswordError(passwordErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    // Call API
    setIsLoading(true);
    try {
      await api.resetPassword(email, resetCode, newPassword);
      setIsLoading(false);
      setSuccessMessage('Password has been reset successfully!');
      
      // Auto-redirect after 2 seconds
      setTimeout(() => {
        if (onBackToLogin) {
          onBackToLogin();
        }
      }, 2000);
    } catch (error: any) {
      setIsLoading(false);
      const errorMessage = error?.message || 'Failed to reset password. Please check your code and try again.';
      setGeneralError(errorMessage);
      console.error('Reset password error:', error);
    }
  };

  // Go back to step 1
  const handleBackToEmailStep = () => {
    setCurrentStep('enterEmail');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setCodeError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setGeneralError(null);
    setSuccessMessage('');
  };

  return (
    <div className={styles.forgotPasswordContainer}>
      {currentStep === 'enterEmail' ? (
        <>
          <h2 className={styles.forgotPasswordTitle}>Forgot Password?</h2>
          
          <p className={styles.forgotPasswordDescription}>
            Enter your email address and we'll send you a code to reset your password.
          </p>

          <form onSubmit={handleSendResetCode}>
            {/* General Error Message */}
            {generalError && (
              <div className={styles.errorMessage}>{generalError}</div>
            )}

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
                  autoFocus
                />
              </div>
              {emailError && <span className={styles.error}>{emailError}</span>}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className={styles.successMessage}>{successMessage}</div>
            )}

            {/* Send Code Button */}
            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading || successMessage !== ''}
              style={{ marginTop: '16px' }}
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>

          {/* Back to Login Link */}
          <button
            type="button"
            className={styles.backToLoginLink}
            onClick={onBackToLogin}
            disabled={isLoading}
          >
            Back to Login
          </button>
        </>
      ) : (
        <>
          <h2 className={styles.forgotPasswordTitle}>Verify Code</h2>
          
          <p className={styles.forgotPasswordDescription}>
            We've sent a code to <strong>{email}</strong>. Enter it below along with your new password.
          </p>

          <form onSubmit={handleResetPassword}>
            {/* General Error Message */}
            {generalError && (
              <div className={styles.errorMessage}>{generalError}</div>
            )}

            {/* Reset Code Field */}
            <div className={styles.inputGroup}>
              <label className={styles.sectionTitle}>Reset Code</label>
              <div
                className={`${styles.inputWrapper} ${
                  codeError ? styles.errorInput : ''
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
                  type="text"
                  className={styles.input}
                  placeholder="Enter reset code"
                  value={resetCode}
                  onChange={(e) => {
                    setResetCode(e.target.value);
                    if (codeError) setCodeError(null);
                  }}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              {codeError && <span className={styles.error}>{codeError}</span>}
            </div>

            {/* New Password Field */}
            <div className={styles.inputGroup}>
              <label className={styles.sectionTitle}>New Password</label>
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
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className={styles.endIcon}
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
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
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError(null);
                  }}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className={styles.endIcon}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {confirmPasswordError && <span className={styles.error}>{confirmPasswordError}</span>}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className={styles.successMessage}>{successMessage}</div>
            )}

            {/* Reset Password Button */}
            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading || successMessage !== ''}
              style={{ marginTop: '16px' }}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          {/* Back Button */}
          <button
            type="button"
            className={styles.backToLoginLink}
            onClick={handleBackToEmailStep}
            disabled={isLoading}
          >
            Back to Enter Email
          </button>
        </>
      )}
    </div>
  );
};
