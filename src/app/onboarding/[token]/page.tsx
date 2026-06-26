"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const LOOM_VIDEO_URL = process.env.NEXT_PUBLIC_LOOM_ONBOARDING_URL || "";
const LOOM_URL_VALID =
  LOOM_VIDEO_URL.includes("loom.com/embed/") &&
  !LOOM_VIDEO_URL.includes("YOUR_LOOM_ID_HERE");

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

  // Listen for Loom message events (video end + progress)
  useEffect(() => {
    let durationSecs = 0;

    function handleMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return;
      const { type } = e.data;

      // Video ended
      if (type === 'loom:video-ended' || type === 'video-ended') {
        setVideoEnded(true);
        setVideoProgress(100);
      }

      // Progress via currentTime (most reliable Loom event)
      if (type === 'loom:currentTime' && e.data.currentTime != null) {
        if (durationSecs > 0) {
          const pct = Math.min(100, Math.round((e.data.currentTime / durationSecs) * 100));
          setVideoProgress(pct);
          // Unlock at 85% — accounts for Loom sometimes not firing ended event
          if (pct >= 85) {
            setVideoEnded(true);
          }
        }
      }

      // Duration event — capture video length
      if (type === 'loom:duration' && e.data.duration) {
        durationSecs = e.data.duration;
      }

      // Legacy progress event
      if (type === 'loom:video:progress' && e.data.progress != null) {
        const pct = Math.round(e.data.progress * 100);
        setVideoProgress(pct);
        if (pct >= 85) setVideoEnded(true);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    // Guard: misconfigured Loom URL
    if (!LOOM_URL_VALID) {
      console.error(
        "[Onboarding] NEXT_PUBLIC_LOOM_ONBOARDING_URL is missing or invalid.",
        "Set it to a Loom embed URL like: https://www.loom.com/embed/3b9e9c1ba72b4e3aa9e7451aaac52044",
        "Current value:", LOOM_VIDEO_URL || "(empty)"
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

        {/* Loom embed — fullscreen allowed, no overlay blocking */}
        <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl bg-black">
          <div className="relative pb-[56.25%] h-0">
            <iframe
              src={`${LOOM_VIDEO_URL}?autoplay=1&hideEmbedTopBar=true&hide_owner=true&hide_share=true&hide_title=true`}
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
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
            You'll be taken to your contracts & billing page next
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
