"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const GDRIVE_VIDEO_URL = process.env.NEXT_PUBLIC_GDRIVE_ONBOARDING_URL || "";
const GDRIVE_URL_VALID =
  GDRIVE_VIDEO_URL.includes("drive.google.com") &&
  !GDRIVE_VIDEO_URL.includes("YOUR_FILE_ID_HERE");

type Stage = "loading" | "invalid" | "expired" | "used" | "video" | "password" | "done";

interface ClientInfo {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
}

export default function OnboardingPage() {
  const { token } = useParams() as { token: string };
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // 0-100

  // Validate token on mount
  useEffect(() => {
    fetch(`/api/onboarding/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error === "This link has already been used") {
          setStage("used");
        } else if (data.error === "This link has expired") {
          setStage("expired");
        } else if (data.error) {
          setStage("invalid");
        } else {
          setClient(data.client);
          setStage("video");
        }
      })
      .catch(() => setStage("invalid"));
  }, [token]);

  // Google Drive doesn't emit postMessages — use a timer to track watch progress
  useEffect(() => {
    if (stage !== 'video') return;
    // Tick every second and simulate progress over 120s (adjust to your video length)
    const VIDEO_DURATION_S = 120;
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 1;
      const pct = Math.min(100, Math.round((elapsed / VIDEO_DURATION_S) * 100));
      setVideoProgress(pct);
      if (pct >= 85) {
        setVideoEnded(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  // Fallback: show manual "I've finished" button after 30 seconds
  // in case Loom postMessages never fire (iframe sandboxing, cross-origin, etc.)
  const [showManualContinue, setShowManualContinue] = useState(false);
  useEffect(() => {
    if (stage !== 'video') return;
    const t = setTimeout(() => setShowManualContinue(true), 30_000);
    return () => clearTimeout(t);
  }, [stage]);

  async function handleSetPassword() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/${token}/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, watchedVideo: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setStage("done");
      // Small delay so user sees the success state, then go to dashboard
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <FullScreen>
        <div className="text-gray-400 text-sm animate-pulse">Verifying your link...</div>
      </FullScreen>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────────
  if (stage === "invalid" || stage === "expired" || stage === "used") {
    const messages = {
      invalid: { title: "Link not found", body: "This link is invalid. Please contact E8 Productions." },
      expired: { title: "Link expired", body: "This link has expired (48h limit). Please contact the E8 team to get a new one." },
      used:    { title: "Already used", body: "This link has already been used to set up your portal. Try logging in, or contact us if you need help." },
    };
    const msg = messages[stage];
    return (
      <FullScreen>
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{msg.title}</h2>
          <p className="text-gray-500 text-sm">{msg.body}</p>
          <a
            href="mailto:eric@e8productions.com"
            className="inline-block mt-6 text-blue-600 text-sm hover:underline"
          >
            Contact E8 Productions →
          </a>
        </div>
      </FullScreen>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <FullScreen>
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">You're all set!</h2>
          <p className="text-gray-500 text-sm">Taking you to your portal...</p>
        </div>
      </FullScreen>
    );
  }

  // ── Video stage ──────────────────────────────────────────────────────────
  if (stage === "video") {
    // Guard: misconfigured Google Drive URL
    if (!GDRIVE_URL_VALID) {
      console.error(
        "[Onboarding] NEXT_PUBLIC_GDRIVE_ONBOARDING_URL is missing or invalid.",
        "Set it to a Google Drive embed URL like: https://drive.google.com/file/d/FILE_ID/preview",
        "Current value:", GDRIVE_VIDEO_URL || "(empty)"
      );
      return (
        <FullScreen>
          <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
            <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Video not configured</h2>
            <p className="text-gray-500 text-sm mb-4">
              The welcome video isn&apos;t set up yet. Please contact E8 Productions to get access.
            </p>
            <a
              href="mailto:eric@e8productions.com"
              className="inline-block text-blue-600 text-sm hover:underline"
            >
              Contact E8 Productions →
            </a>
          </div>
        </FullScreen>
      );
    }

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-10">
        {/* E8 header */}
        <div className="mb-8 text-center">
          <div className="text-white font-bold text-2xl tracking-tight">E8 Productions</div>
          <p className="text-gray-400 text-sm mt-1">
            Welcome, {client?.name} 👋 — Watch this quick video before setting up your portal
          </p>
        </div>

        {/* Google Drive embed */}
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl bg-black">
          <div className="relative pb-[56.25%] h-0">
            <iframe
              src={GDRIVE_VIDEO_URL}
              className="absolute top-0 left-0 w-full h-full"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          </div>
        </div>

        {/* Progress hint */}
        {!videoEnded && videoProgress > 0 && videoProgress < 100 && (
          <p className="text-gray-500 text-xs mt-4">{videoProgress}% watched</p>
        )}

        {/* Continue button — appears after video ends (or 85% watched) */}
        <div className={`mt-8 transition-all duration-500 ${
          videoEnded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <button
            onClick={() => setStage('password')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-xl text-base transition"
          >
            Continue — Set up my password →
          </button>
        </div>

        {/* Fallback: manual continue if postMessages never fire (after 30s) */}
        {!videoEnded && showManualContinue && (
          <button
            onClick={() => setVideoEnded(true)}
            className="mt-6 text-xs text-gray-500 hover:text-gray-300 underline transition"
          >
            Finished watching? Click here to continue →
          </button>
        )}

        {/* Dev skip */}
        {process.env.NODE_ENV === 'development' && !videoEnded && (
          <button
            onClick={() => setVideoEnded(true)}
            className="mt-3 text-xs text-gray-700 hover:text-gray-500 underline"
          >
            [dev] skip video
          </button>
        )}
      </div>
    );
  }

  // ── Password stage ───────────────────────────────────────────────────────
  if (stage === "password") {
    return (
      <FullScreen>
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 370.08 496.58" className="w-8 h-8" fill="#1d4ed8" xmlns="http://www.w3.org/2000/svg">
                <path d="M370.08,111.08v274.43l-.99,10.88c-7.12,55.78-54.98,98.68-111.19,100.2H111.71c-56-2.02-103.16-43.93-110.72-99.48L0,387.42C0,294.67.01,201.91,0,109.16,2.69,51.08,50.91,2.78,109.07,0h151.7c59.51,2.98,107.01,51.79,109.31,111.08ZM254.64,14.64H110.27C57.77,17.38,16.53,59.7,14.63,112.15v271.81c1.87,54.01,44.72,96.62,98.76,97.99h141.25v-72.69H114.83c-14.27-.41-26.11-11.55-27.23-25.79v-98.95s97.44,0,97.44,0v-72.68h-97.44v-98.71c.97-13.67,11.91-24.67,25.55-25.8h141.49s0-72.68,0-72.68ZM267.6,197.2v-84.56c0-4.53-6.98-10.84-11.64-10.67-47.95.22-95.99-.47-143.88.35-4.92,1.13-9.83,6.62-9.83,11.76v83.12h165.36ZM267.6,299.15H102.24v83.12c0,5.81,5.68,11.63,11.39,12.12h143.05c4.54-.18,10.92-6.2,10.92-10.68v-84.56Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Create your password</h2>
            <p className="text-gray-500 text-sm mt-1">
              This will be your E8 portal login for <span className="font-medium">{client?.email}</span>
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              onClick={handleSetPassword}
              disabled={submitting || !password || !confirm}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold
                         py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? "Setting up your portal..." : "Set password & enter portal →"}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            You'll be taken to your Agreement page next
          </p>
        </div>
      </FullScreen>
    );
  }

  return null;
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      {children}
    </div>
  );
}
