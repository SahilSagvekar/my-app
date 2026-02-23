'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 overflow-hidden relative">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-black/5 animate-float"
            style={{
              width: `${60 + i * 15}px`,
              height: `${60 + i * 15}px`,
              left: `${10 + i * 15}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: '15s',
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl w-full">
        <div className="bg-white border border-black/10 rounded-3xl shadow-xl p-8 md:p-12 animate-slideIn">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-28 h-28 bg-black rounded-full flex items-center justify-center shadow-lg animate-bounce-slow">
                <svg
                  className="w-14 h-14 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="absolute inset-0 w-28 h-28 border-4 border-black/10 rounded-full animate-pulse-ring" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-black text-center mb-4 tracking-tight">
            Oops! Something Went Wrong
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-black/60 text-center mb-8 leading-relaxed">
            We encountered an unexpected error. Don't worry, our team has been notified and we're working on it!
          </p>

          {/* Error details (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-8 p-4 bg-black/5 rounded-xl border border-black/10">
              <p className="text-sm font-semibold text-black/80 mb-2">Error Details:</p>
              <p className="text-sm text-black/70 font-mono break-all">
                {error.message || 'An unknown error occurred'}
              </p>
              {error.digest && (
                <p className="text-xs text-black/60 mt-2">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}

          {/* Loading dots */}
          <div className="flex justify-center gap-2 mb-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-black rounded-full animate-loading-dot"
                style={{ animationDelay: `${i * 0.16}s` }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="px-8 py-4 bg-black text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 hover:scale-105"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-4 bg-white text-black rounded-full font-semibold text-lg border-2 border-black/10 hover:border-black/30 transform hover:-translate-y-1 transition-all duration-300 hover:scale-105"
            >
              Go Home
            </button>
          </div>

          {/* Support section */}
          <div className="mt-10 pt-8 border-t border-black/10">
            <p className="text-black/60 text-center mb-4 font-medium">
              Need help? Get in touch with us
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="mailto:support@yourwebsite.com"
                className="px-6 py-3 bg-black/5 text-black rounded-full text-sm font-medium border border-black/10 hover:bg-black/10 transition-all duration-300"
              >
                📧 Email Support
              </a>
              <a
                href="tel:+1234567890"
                className="px-6 py-3 bg-black/5 text-black rounded-full text-sm font-medium border border-black/10 hover:bg-black/10 transition-all duration-300"
              >
                📞 Call Us
              </a>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) scale(1);
            opacity: 0;
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        @keyframes loading-dot {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-float {
          animation: float 15s infinite ease-in-out;
        }

        .animate-slideIn {
          animation: slideIn 0.8s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }

        .animate-pulse-ring {
          animation: pulse-ring 2s infinite;
        }

        .animate-loading-dot {
          animation: loading-dot 1.4s infinite ease-in-out both;
        }
      `}</style>
    </div>
  );
}
