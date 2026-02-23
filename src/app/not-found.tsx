'use client';

export default function NotFound() {
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
          {/* 404 Number */}
          <div className="text-center mb-8">
            <h1 className="text-9xl md:text-[12rem] font-black text-black/10 leading-none mb-4 select-none">
              404
            </h1>
            <div className="relative -mt-20 md:-mt-24">
              <div className="w-32 h-32 mx-auto bg-black rounded-full flex items-center justify-center shadow-lg animate-bounce-slow">
                <svg
                  className="w-16 h-16 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl md:text-5xl font-bold text-black text-center mb-4 tracking-tight">
            Page Not Found
          </h2>

          {/* Subtitle */}
          <p className="text-lg text-black/60 text-center mb-8 leading-relaxed">
            Oops! The page you're looking for seems to have wandered off into the digital void.
          </p>

          {/* Fun message */}
          <div className="mb-8 p-4 bg-black/5 rounded-xl border border-black/10">
            <p className="text-black/70 text-center text-sm">
              💡 <strong>Tip:</strong> Double-check the URL or head back to safety!
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => window.history.back()}
              className="px-8 py-4 bg-black text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 hover:scale-105"
            >
              ← Go Back
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-8 py-4 bg-white text-black rounded-full font-semibold text-lg border-2 border-black/10 hover:border-black/30 transform hover:-translate-y-1 transition-all duration-300 hover:scale-105"
            >
              🏠 Go Home
            </button>
          </div>

          {/* Quick links */}
          <div className="pt-8 border-t border-black/10">
            <p className="text-black/60 text-center mb-4 font-medium">
              Popular pages you might be looking for:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="/"
                className="px-4 py-2 bg-black/5 text-black rounded-full text-sm font-medium border border-black/10 hover:bg-black/10 transition-all duration-300"
              >
                Home
              </a>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-black/5 text-black rounded-full text-sm font-medium border border-black/10 hover:bg-black/10 transition-all duration-300"
              >
                Dashboard
              </a>
              <a
                href="/about"
                className="px-4 py-2 bg-black/5 text-black rounded-full text-sm font-medium border border-black/10 hover:bg-black/10 transition-all duration-300"
              >
                About
              </a>
              <a
                href="/contact"
                className="px-4 py-2 bg-black/5 text-black rounded-full text-sm font-medium border border-black/10 hover:bg-black/10 transition-all duration-300"
              >
                Contact
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

        .animate-float {
          animation: float 15s infinite ease-in-out;
        }

        .animate-slideIn {
          animation: slideIn 0.8s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }
      `}</style>
    </div>
  );
}
