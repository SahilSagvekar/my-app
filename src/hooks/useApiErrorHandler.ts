// hooks/useApiErrorHandler.ts
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function useApiErrorHandler() {
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Global fetch interceptor
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      // Clone response to read it without consuming the stream
      const clonedResponse = response.clone();
      
      try {
        // Check if response is JSON and has error
        const data = await clonedResponse.json();
        
        // Check for JWT expiration errors
        if (
          (response.status === 401 || response.status === 500) &&
          (data.message?.includes('jwt expired') ||
           data.message?.includes('Token expired') ||
           data.message?.includes('Unauthorized') ||
           data.error?.includes('jwt expired'))
        ) {
          setShowSessionExpired(true);
        }
      } catch (e) {
        // Response is not JSON, ignore
      }
      
      return response;
    };

    // Cleanup: restore original fetch
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return {
    showSessionExpired,
    setShowSessionExpired
  };
}