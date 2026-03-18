"use client";

import { AuthenticationFlow } from "../components/auth/AuthenticationFlow";
import { UploadProvider } from "../components/workflow/UploadContext";

/**
 * App Entry Point
 * 
 * Optimized to be a thin wrapper around the AuthenticationFlow.
 * Most logic has been decoupled into modular components to improve:
 * 1. Hydration Performance (smaller chunks)
 * 2. Maintenance (separated concerns)
 * 3. Bundle Size (dynamic imports for heavy segments)
 */
export default function App() {
  return (
    <UploadProvider>
      <div className="min-h-screen bg-background font-sans">
        <AuthenticationFlow />
      </div>
    </UploadProvider>
  );
}