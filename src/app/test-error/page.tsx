'use client';

import { useState } from 'react';

export default function TestErrorPage() {
  const [shouldError, setShouldError] = useState(false);

  // This will trigger the custom error.tsx page
  if (shouldError) {
    throw new Error('This is a test error to showcase the custom error page! 🎨');
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white border border-black/10 rounded-2xl p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-black mb-4">
            🧪 Error Page Testing Lab
          </h1>
          <p className="text-black/60 text-lg mb-8">
            Click the button below to trigger a runtime error and see your beautiful custom error page!
          </p>

          <div className="space-y-4">
            <button
              onClick={() => setShouldError(true)}
              className="w-full px-8 py-4 bg-black text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              💥 Trigger Error Page
            </button>

            <button
              onClick={() => window.location.href = '/non-existent-page'}
              className="w-full px-8 py-4 bg-black text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              🔍 Test 404 Page
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-8 py-4 bg-white text-black rounded-full font-semibold text-lg border-2 border-black/10 hover:border-black/30 transition-all duration-300"
            >
              🏠 Go Home
            </button>
          </div>

          <div className="mt-8 p-4 bg-black/5 border border-black/10 rounded-lg">
            <p className="text-black/70 text-sm">
              <strong>Note:</strong> The error page will have a "Try Again" button that will bring you back to this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
