"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Link as LinkIcon, Upload, AlertCircle, Loader2 } from "lucide-react";

type Stage = "loading" | "invalid" | "expired" | "already-submitted" | "form" | "submitted";
type SubmitMode = "link" | "upload";

interface TestTaskInfo {
  id: string;
  title: string;
  instructions: string;
  rawFootageUrl: string | null;
  candidateName: string;
}

export default function HiringTestPage() {
  const { token } = useParams() as { token: string };

  const [stage, setStage] = useState<Stage>("loading");
  const [task, setTask] = useState<TestTaskInfo | null>(null);
  const [mode, setMode] = useState<SubmitMode>("link");
  const [linkValue, setLinkValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/hiring/test/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStage("invalid"); return; }
        const t = data.testTask;
        if (t.expired) { setStage("expired"); return; }
        if (t.status !== "PENDING" && t.status !== "SENT") { setStage("already-submitted"); return; }
        setTask(t);
        setStage("form");
      })
      .catch(() => setStage("invalid"));
  }, [token]);

  async function handleSubmitLink() {
    if (!linkValue.trim()) { setError("Paste a link to your finished edit."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/hiring/test/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionUrl: linkValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setStage("submitted");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitUpload() {
    if (!file) { setError("Choose a file to upload."); return; }
    setSubmitting(true);
    setError("");
    try {
      setUploadProgress(0);
      const presignRes = await fetch(`/api/hiring/test/${token}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "video/mp4" }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignData.error || "Failed to prepare upload");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", presignData.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      const res = await fetch(`/api/hiring/test/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionS3Key: presignData.s3Key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setStage("submitted");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <div className="min-h-screen bg-black/[0.02] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-full">
            E8 PRODUCTIONS
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-8">
          {stage === "loading" && (
            <div className="flex items-center justify-center py-16 text-black/40">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}

          {stage === "invalid" && (
            <StatusMessage icon={<AlertCircle className="h-10 w-10 text-red-400" />} title="Link not found" body="This test task link doesn't exist. Double-check the link E8 Productions sent you." />
          )}

          {stage === "expired" && (
            <StatusMessage icon={<AlertCircle className="h-10 w-10 text-amber-400" />} title="Link expired" body="This test task link has expired. Reach out to E8 Productions for a new one." />
          )}

          {stage === "already-submitted" && (
            <StatusMessage icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />} title="Already submitted" body="This test task has already been submitted. We'll be in touch soon." />
          )}

          {stage === "submitted" && (
            <StatusMessage icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />} title="Submitted!" body="Thanks — your test edit has been received. Our team will review it and follow up by email." />
          )}

          {stage === "form" && task && (
            <div className="space-y-5">
              <div>
                <h1 className="text-xl font-semibold text-black">{task.title}</h1>
                <p className="text-sm text-black/50 mt-1">Hi {task.candidateName}, here's your test task.</p>
              </div>

              <div className="bg-black/[0.03] rounded-xl p-4">
                <p className="text-sm text-black/70 whitespace-pre-wrap leading-relaxed">{task.instructions}</p>
                {task.rawFootageUrl && (
                  <a href={task.rawFootageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mt-3">
                    <LinkIcon className="h-3.5 w-3.5" /> Raw footage
                  </a>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2 p-1 bg-black/5 rounded-full w-fit">
                <button onClick={() => setMode("link")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === "link" ? "bg-black text-white" : "text-black/60"}`}>
                  Paste a Link
                </button>
                <button onClick={() => setMode("upload")} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${mode === "upload" ? "bg-black text-white" : "text-black/60"}`}>
                  Upload File
                </button>
              </div>

              {mode === "link" ? (
                <div className="space-y-3">
                  <input
                    type="url"
                    placeholder="https://drive.google.com/... or youtube.com/..."
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  />
                  <button
                    onClick={handleSubmitLink}
                    disabled={submitting}
                    className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-black/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                    {submitting ? "Submitting…" : "Submit Link"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black/10 rounded-xl py-8 cursor-pointer hover:border-black/20 transition-colors">
                    <Upload className="h-6 w-6 text-black/30" />
                    <span className="text-sm text-black/60">{file ? file.name : "Click to choose a video file"}</span>
                    <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  </label>
                  {uploadProgress !== null && (
                    <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full bg-black transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                  <button
                    onClick={handleSubmitUpload}
                    disabled={submitting}
                    className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-black/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {submitting ? (uploadProgress !== null ? `Uploading… ${uploadProgress}%` : "Submitting…") : "Upload & Submit"}
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="text-center py-8">
      <div className="flex justify-center mb-4">{icon}</div>
      <h2 className="text-lg font-semibold text-black mb-2">{title}</h2>
      <p className="text-sm text-black/50 max-w-sm mx-auto">{body}</p>
    </div>
  );
}
