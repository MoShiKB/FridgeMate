import React, { useEffect, useState } from 'react';
import { tokenManager } from '../services/api';

interface GoogleAuthCallbackProps {
  onLoginSuccess?: (email: string) => void;
}

export const GoogleAuthCallback: React.FC<GoogleAuthCallbackProps> = ({ onLoginSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get tokens from URL parameters
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

        if (!accessToken || !refreshToken) {
          setError('Missing authentication tokens. Please try again.');
          setIsProcessing(false);
          return;
        }

        // Store tokens
        tokenManager.setTokens(accessToken, refreshToken);

        // Redirect to home page after a short delay
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess('Google User');
          }
          window.location.href = '/';
        }, 500);
      } catch (err) {
        setError('Failed to process authentication. Please try again.');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [onLoginSuccess]);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f1fcf5',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
      }}
    >
      {isProcessing ? (
        <>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              border: '4px solid #e0e0e0',
              borderTop: '4px solid #00bc7d',
              animation: 'spin 1s linear infinite',
              marginBottom: 20,
            }}
          />
          <p style={{ fontSize: 18, color: '#666', margin: 0 }}>Logging you in...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </>
      ) : (
        <>
          <p style={{ fontSize: 18, color: '#d32f2f', margin: 0 }}>{error}</p>
        </>
      )}
    </div>
  );
};
