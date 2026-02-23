'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html>
      <head>
        <title>Something Went Wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Main content */}
          <div style={{ position: 'relative', zIndex: 10, maxWidth: '800px', width: '100%' }}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '30px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                padding: '3rem 2rem',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
                textAlign: 'center',
              }}
            >
              {/* Icon */}
              <div style={{ marginBottom: '2rem' }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    margin: '0 auto',
                    background: '#000000',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <svg
                    style={{ width: '60px', height: '60px', fill: 'white' }}
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <h1
                style={{
                  color: '#000000',
                  fontSize: '3rem',
                  fontWeight: 800,
                  marginBottom: '1rem',
                  letterSpacing: '-1px',
                }}
              >
                Critical Error
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  color: 'rgba(0, 0, 0, 0.6)',
                  fontSize: '1.25rem',
                  fontWeight: 400,
                  marginBottom: '2.5rem',
                  lineHeight: 1.6,
                }}
              >
                We encountered a critical error. Please try refreshing the page.
              </p>

              {/* Error details (development only) */}
              {process.env.NODE_ENV === 'development' && (
                <div
                  style={{
                    marginBottom: '2rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'rgba(0, 0, 0, 0.8)', marginBottom: '0.5rem' }}>
                    Error Details:
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(0, 0, 0, 0.7)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {error.message || 'An unknown error occurred'}
                  </p>
                  {error.digest && (
                    <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', marginTop: '0.5rem' }}>
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={reset}
                  style={{
                    padding: '1rem 2rem',
                    background: '#000000',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50px',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  Try Again
                </button>
                <button
                  onClick={() => (window.location.href = '/')}
                  style={{
                    padding: '1rem 2rem',
                    background: '#ffffff',
                    color: '#000000',
                    border: '2px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '50px',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  Go Home
                </button>
              </div>

              {/* Support section */}
              <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid rgba(0, 0, 0, 0.1)' }}>
                <p style={{ color: 'rgba(0, 0, 0, 0.6)', marginBottom: '1rem', fontWeight: 500 }}>
                  Need immediate assistance?
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a
                    href="mailto:support@yourwebsite.com"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '50px',
                      fontSize: '1rem',
                      fontWeight: 500,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    📧 Email Us
                  </a>
                  <a
                    href="tel:+1234567890"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '50px',
                      fontSize: '1rem',
                      fontWeight: 500,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    📞 Call Support
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
