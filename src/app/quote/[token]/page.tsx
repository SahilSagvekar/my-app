"use client";
import React from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ServiceLine {
  description: string;  // Service name shown in first column
  details?: string;     // Rich description shown in second column
  quantity: number;
  unitPrice: number; // in cents
  total: number;     // in cents
}

interface TermItem {
  title: string;
  body: string;
}

interface Quote {
  id: string;
  version: number;
  status: string;
  services: ServiceLine[];
  totalAmount: number;
  notes: string | null;
  validDays: number;
  createdAt: string;
  sentAt: string | null;
  preparedBy: string;
  inclusions: string[];
  terms: TermItem[];
  acceptanceText: string | null;
  preClient: {
    name: string;
    email: string;
    companyName: string | null;
  };
}

type ViewState = "loading" | "error" | "view" | "reject_form" | "accepted" | "rejected" | "already_done";

// ── Default content for new quotes ───────────────────────────────────────────
const DEFAULT_INCLUSIONS = [
  "12 social media videos — fully produced and ready to publish",
  "Concept ideation and content planning for every video",
  "Professional video editing",
  "Publishing and scheduling across 5 platforms — YouTube, TikTok, Instagram, Facebook, and LinkedIn",
  "Account management across all connected channels",
  "Community management — monitoring and responding to comments",
  "$500/month managed ad spend to boost reach and growth",
];

const DEFAULT_TERMS: TermItem[] = [
  {
    title: "Billing.",
    body: "Flat monthly fee invoiced at the start of each billing cycle and due on receipt.",
  },
  {
    title: "Ad spend.",
    body: "$500/month is a managed pass-through advertising budget deployed across platforms on the client's behalf, with spend reported monthly.",
  },
  {
    title: "Deliverables.",
    body: "12 social media videos per month, repurposed and optimized for each platform.",
  },
  {
    title: "Term & cancellation.",
    body: "12 month engagement; either party may cancel with [60] days' written notice.",
  },
];

const DEFAULT_ACCEPTANCE = "To get started, sign below and return a copy. We'll send the first invoice and begin onboarding right away.";

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableText({
  value,
  onChange,
  isEdit,
  tag: Tag = "span",
  className = "",
  multiline = false,
  placeholder = "Click to edit...",
}: {
  value: string;
  onChange: (v: string) => void;
  isEdit: boolean;
  tag?: keyof React.JSX.IntrinsicElements;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  if (!isEdit) return <Tag className={className}>{value || <span className="text-gray-400 italic">{placeholder}</span>}</Tag>;

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={`${className} w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 resize-y`}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${className} border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 w-full`}
    />
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function QuotePage() {
  const { token } = useParams() as { token: string };
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("edit") === "1";

  const [quote, setQuote] = useState<Quote | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local edit state (mirrors quote fields)
  const [localPreparedBy, setLocalPreparedBy] = useState("");
  const [localInclusions, setLocalInclusions] = useState<string[]>([]);
  const [localTerms, setLocalTerms] = useState<TermItem[]>([]);
  const [localAcceptanceText, setLocalAcceptanceText] = useState("");
  const [localServices, setLocalServices] = useState<ServiceLine[]>([]);
  const [localNotes, setLocalNotes] = useState("");

  useEffect(() => {
    fetch(`/api/quotes/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setViewState("error"); return; }
        setQuote(data);
        // Seed local edit state with DB values (or defaults for new quotes)
        setLocalPreparedBy(data.preparedBy || "Gabe Rabinowitz + Eric Davis");
        setLocalInclusions(data.inclusions?.length ? data.inclusions : DEFAULT_INCLUSIONS);
        setLocalTerms(data.terms?.length ? data.terms : DEFAULT_TERMS);
        setLocalAcceptanceText(data.acceptanceText || DEFAULT_ACCEPTANCE);
        setLocalServices(data.services || []);
        setLocalNotes(data.notes || "");

        if (data.status === "ACCEPTED" || data.status === "REJECTED") setViewState("already_done");
        else setViewState("view");
      })
      .catch(() => { setError("Failed to load quote"); setViewState("error"); });
  }, [token]);

  // ── Debounced save ────────────────────────────────────────────────────────
  const scheduleSave = useCallback((patch: object) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      setSaveMsg("");
      try {
        const res = await fetch(`/api/quotes/${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (data.success) {
          setSaveMsg("Saved ✓");
          if (data.totalAmount !== undefined && quote) {
            setQuote({ ...quote, totalAmount: data.totalAmount });
          }
        } else {
          setSaveMsg("Save failed");
        }
      } catch {
        setSaveMsg("Save failed");
      } finally {
        setSaving(false);
        setTimeout(() => setSaveMsg(""), 2500);
      }
    }, 800);
  }, [token, quote]);

  // Field change helpers
  function changePreparedBy(v: string) {
    setLocalPreparedBy(v);
    scheduleSave({ preparedBy: v });
  }
  function changeAcceptanceText(v: string) {
    setLocalAcceptanceText(v);
    scheduleSave({ acceptanceText: v });
  }
  function changeNotes(v: string) {
    setLocalNotes(v);
    scheduleSave({ notes: v });
  }
  function changeInclusion(i: number, v: string) {
    const next = [...localInclusions];
    next[i] = v;
    setLocalInclusions(next);
    scheduleSave({ inclusions: next });
  }
  function addInclusion() {
    const next = [...localInclusions, "New bullet point"];
    setLocalInclusions(next);
    scheduleSave({ inclusions: next });
  }
  function removeInclusion(i: number) {
    const next = localInclusions.filter((_, idx) => idx !== i);
    setLocalInclusions(next);
    scheduleSave({ inclusions: next });
  }
  function changeTerm(i: number, field: "title" | "body", v: string) {
    const next = [...localTerms];
    next[i] = { ...next[i], [field]: v };
    setLocalTerms(next);
    scheduleSave({ terms: next });
  }
  function addTerm() {
    const next = [...localTerms, { title: "New term.", body: "Term description here." }];
    setLocalTerms(next);
    scheduleSave({ terms: next });
  }
  function removeTerm(i: number) {
    const next = localTerms.filter((_, idx) => idx !== i);
    setLocalTerms(next);
    scheduleSave({ terms: next });
  }
  function changeServiceDesc(i: number, v: string) {
    const next = [...localServices];
    next[i] = { ...next[i], description: v };
    setLocalServices(next);
    scheduleSave({ services: next });
  }
  function changeServiceDetails(i: number, v: string) {
    const next = [...localServices];
    next[i] = { ...next[i], details: v };
    setLocalServices(next);
    scheduleSave({ services: next });
  }
  function changeServicePrice(i: number, dollars: string) {
    const cents = Math.round(parseFloat(dollars || "0") * 100);
    const next = [...localServices];
    next[i] = { ...next[i], unitPrice: cents, total: cents * (next[i].quantity || 1) };
    setLocalServices(next);
    scheduleSave({ services: next });
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  async function handleAccept() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const data = await res.json();
      if (data.success) setViewState("accepted");
      else setError(data.error || "Something went wrong");
    } finally { setSubmitting(false); }
  }

  async function handleReject() {
    if (!rejectionReason.trim() && !changeRequest.trim()) {
      setError("Please provide a reason or describe what changes you need.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", rejectionReason, changeRequest }),
      });
      const data = await res.json();
      if (data.success) setViewState("rejected");
      else setError(data.error || "Something went wrong");
    } finally { setSubmitting(false); }
  }

  // ── Formatters ────────────────────────────────────────────────────────────
  function fmt(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  function fmtFull(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
  function fmtDate(d: string | null) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  // ── State screens ─────────────────────────────────────────────────────────
  if (viewState === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#6b7280", fontSize: 14 }}>Loading your quote...</div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", padding: "2.5rem", maxWidth: 400, width: "100%", textAlign: "center" }}>
          <p style={{ color: "#dc2626", fontWeight: 600 }}>{error}</p>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>Please contact E8 Productions for assistance.</p>
        </div>
      </div>
    );
  }

  if (viewState === "accepted") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.10)", padding: "3rem 2.5rem", maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, background: "#dcfce7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <svg width="32" height="32" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Quote Accepted!</h2>
          <p style={{ color: "#4b5563" }}>Thank you, {quote?.preClient.name}. We're excited to work with you. The E8 team will be in touch shortly to get everything set up.</p>
        </div>
      </div>
    );
  }

  if (viewState === "rejected") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.10)", padding: "3rem 2.5rem", maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, background: "#fef9c3", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <svg width="32" height="32" fill="none" stroke="#ca8a04" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#111827", marginBottom: 8 }}>Feedback Received</h2>
          <p style={{ color: "#4b5563" }}>We've received your feedback and will get back to you with a revised proposal shortly.</p>
        </div>
      </div>
    );
  }

  if (viewState === "already_done") {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 8px 40px rgba(0,0,0,0.10)", padding: "3rem 2.5rem", maxWidth: 440, width: "100%", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>
            This quote has already been {quote?.status === "ACCEPTED" ? "accepted ✓" : "responded to"}.
          </p>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>Please contact E8 if you need anything else.</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const validUntil = quote.sentAt
    ? new Date(new Date(quote.sentAt).getTime() + quote.validDays * 86400000)
    : null;

  const quoteNumber = `E8-${new Date(quote.createdAt).getFullYear()}-${String(quote.version).padStart(4, "0")}`;
  const totalCents = localServices.reduce((s, l) => s + (l.total || 0), 0);

  // ── E8 logo SVG (inline) ──────────────────────────────────────────────────
  const E8Logo = () => (
    <svg width="40" height="54" viewBox="0 0 370.08 496.58" fill="currentColor" style={{ display: "block" }}>
      <path d="M370.08,111.08v274.43l-.99,10.88c-7.12,55.78-54.98,98.68-111.19,100.2H111.71c-56-2.02-103.16-43.93-110.72-99.48L0,387.42C0,294.67.01,201.91,0,109.16,2.69,51.08,50.91,2.78,109.07,0h151.7c59.51,2.98,107.01,51.79,109.31,111.08ZM254.64,14.64H110.27C57.77,17.38,16.53,59.7,14.63,112.15v271.81c1.87,54.01,44.72,96.62,98.76,97.99h141.25v-72.69H114.83c-14.27-.41-26.11-11.55-27.23-25.79v-98.95s97.44,0,97.44,0v-72.68h-97.44v-98.71c.97-13.67,11.91-24.67,25.55-25.8h141.49s0-72.68,0-72.68ZM267.6,197.2v-84.56c0-4.53-6.98-10.84-11.64-10.67-47.95.22-95.99-.47-143.88.35-4.92,1.13-9.83,6.62-9.83,11.76v83.12h165.36ZM267.6,299.15H102.24v83.12c0,5.81,5.68,11.63,11.39,12.12h143.05c4.54-.18,10.92-6.2,10.92-10.68v-84.56Z" />
    </svg>
  );

  // ── Document styles ───────────────────────────────────────────────────────
  const doc: React.CSSProperties = {
    background: "#fff",
    maxWidth: 780,
    margin: "2.5rem auto",
    boxShadow: "0 4px 32px rgba(0,0,0,0.13)",
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: 13,
    color: "#1a1a1a",
    lineHeight: 1.6,
    padding: "0 0 2rem",
  };

  const sectionTitle: React.CSSProperties = {
    fontFamily: "'Arial', 'Helvetica', sans-serif",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.1em",
    color: "#1a56db",
    textTransform: "uppercase" as const,
    marginBottom: 10,
  };

  const blueLine: React.CSSProperties = {
    borderTop: "2.5px solid #1a56db",
    margin: "0 0 0",
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .quote-doc { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
          @page { margin: 1cm; size: A4; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { background: #e5e7eb; }
        .editable-row:hover { background: #f0f7ff; }
      `}</style>

      {/* Edit mode badge + save indicator */}
      {isEdit && (
        <div className="no-print" style={{ background: "#1e40af", color: "#fff", textAlign: "center", padding: "8px 16px", fontSize: 13, fontFamily: "Arial, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, position: "sticky", top: 0, zIndex: 100 }}>
          <span>✏️ <strong>Edit Mode</strong> — Click any text to edit. Changes auto-save.</span>
          {saving && <span style={{ opacity: 0.7 }}>Saving...</span>}
          {saveMsg && <span style={{ background: saveMsg.includes("failed") ? "#dc2626" : "#16a34a", borderRadius: 6, padding: "2px 10px", fontSize: 12 }}>{saveMsg}</span>}
          <button onClick={() => window.print()} style={{ marginLeft: 16, background: "#fff", color: "#1e40af", border: "none", borderRadius: 6, padding: "4px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🖨 Print / Save PDF</button>
        </div>
      )}

      {/* Print button for non-edit mode */}
      {!isEdit && viewState === "view" && (
        <div className="no-print" style={{ textAlign: "center", padding: "1rem 0 0", fontFamily: "Arial, sans-serif" }}>
          <button onClick={() => window.print()} style={{ background: "#1a56db", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🖨 Print / Save PDF</button>
        </div>
      )}

      {/* ── DOCUMENT ── */}
      <div className="quote-doc" style={{ ...doc, position: "relative", overflow: "hidden" }}>
        {quote.status === "ACCEPTED" && (
          <img
            src="/icons/accepted_stamp_e8.svg"
            alt="Accepted"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "90%",
              opacity: 0.65,
              pointerEvents: "none",
              zIndex: 10,
              userSelect: "none",
            }}
          />
        )}

        {/* ── TOP HEADER ── */}
        <div style={{ padding: "24px 36px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            {/* Logo + name */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <E8Logo />
              <div>
                <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "0.05em", lineHeight: 1.1 }}>E8</div>
                <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 400, fontSize: 10, letterSpacing: "0.15em", color: "#4b5563", textTransform: "uppercase" }}>Full Service Video + Content</div>
              </div>
            </div>
            {/* Quote meta */}
            <div style={{ textAlign: "right", fontFamily: "Arial, sans-serif", fontSize: 12, color: "#374151", lineHeight: 1.9 }}>
              <div>Quote No. <strong>{quoteNumber}</strong></div>
              <div>Date <strong>{fmtDate(quote.createdAt)}</strong></div>
              {validUntil && <div>Valid Until <strong style={{ color: "#1a56db" }}>{fmtDate(validUntil.toISOString())}</strong></div>}
            </div>
          </div>

          {/* Blue rule */}
          <div style={{ ...blueLine, marginTop: 20, marginBottom: 18 }} />

          {/* Title row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <h1 style={{ fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 900, letterSpacing: "0.04em", margin: 0 }}>MONTHLY SERVICE QUOTE</h1>
          </div>
        </div>

        {/* ── PREPARED FOR / BY ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", margin: "0 36px", padding: "14px 0 16px" }}>
          <div style={{ paddingRight: 24 }}>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#1a56db", textTransform: "uppercase", marginBottom: 4 }}>Prepared For</div>
            <div style={{ fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: 14 }}>{quote.preClient.name}</div>
            {quote.preClient.companyName && <div style={{ fontFamily: "Arial, sans-serif", color: "#4b5563", fontSize: 13 }}>{quote.preClient.companyName}</div>}
          </div>
          <div>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#1a56db", textTransform: "uppercase", marginBottom: 4 }}>Prepared By</div>
            <div style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <EditableText
                value={localPreparedBy}
                onChange={changePreparedBy}
                isEdit={isEdit}
                placeholder="Names of team members"
              />
            </div>
          </div>
        </div>

        {/* ── INTRO TEXT ── */}
        <div style={{ padding: "14px 36px 8px" }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            Thank you for the opportunity. Below is your monthly engagement for{" "}
            <span style={{ color: "#1a56db" }}>full-service social media content production, publishing, and management across five platforms.</span>
          </p>
        </div>

        {/* ── COST SUMMARY ── */}
        <div style={{ padding: "16px 36px 0" }}>
          <div style={sectionTitle}>Cost Summary</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "Arial, sans-serif" }}>
            <thead>
              <tr style={{ background: "#1a1a1a", color: "#fff" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase", width: "25%" }}>Service</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>Description</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase", width: "13%" }}>Monthly</th>
              </tr>
            </thead>
            <tbody>
              {localServices.map((s, i) => (
                <tr key={i} className="editable-row" style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, verticalAlign: "top" }}>
                    <EditableText
                      value={s.description}
                      onChange={(v) => changeServiceDesc(i, v)}
                      isEdit={isEdit}
                      placeholder="Service name"
                    />
                  </td>
                  <td style={{ padding: "12px 14px", color: "#4b5563", fontSize: 13, verticalAlign: "top" }}>
                    {isEdit ? (
                      <textarea
                        value={s.details ?? ""}
                        onChange={(e) => changeServiceDetails(i, e.target.value)}
                        rows={3}
                        placeholder="Describe what's included in this service line..."
                        style={{ width: "100%", border: "1px solid #93c5fd", borderRadius: 4, padding: "4px 8px", fontSize: 13, fontFamily: "Arial, sans-serif", color: "#4b5563", resize: "vertical", background: "#eff6ff" }}
                      />
                    ) : (
                      <span style={{ color: "#4b5563" }}>{s.details || s.description}</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: 14, verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {isEdit ? (
                      <input
                        type="number"
                        defaultValue={(s.unitPrice / 100).toFixed(0)}
                        onBlur={(e) => changeServicePrice(i, e.target.value)}
                        style={{ width: 80, border: "1px solid #93c5fd", borderRadius: 4, padding: "4px 6px", fontSize: 13, textAlign: "right", background: "#eff6ff" }}
                      />
                    ) : (
                      fmt(s.total)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a56db", color: "#fff" }}>
                <td colSpan={2} style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "Arial, sans-serif" }}>Total Monthly Cost</td>
                <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 900, fontSize: 17, whiteSpace: "nowrap" }}>{fmt(totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── WHAT'S INCLUDED ── */}
        <div style={{ padding: "22px 36px 0" }}>
          <div style={sectionTitle}>What's Included Every Month:</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: "#1a1a1a", lineHeight: 2, listStyleType: "disc" }}>
            {localInclusions.map((item, i) => (
              <li key={i} style={{ marginBottom: isEdit ? 6 : 2 }}>
                {isEdit ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      value={item}
                      onChange={(e) => changeInclusion(i, e.target.value)}
                      style={{ flex: 1, border: "1px solid #93c5fd", borderRadius: 4, padding: "4px 8px", fontSize: 13, background: "#eff6ff" }}
                    />
                    <button onClick={() => removeInclusion(i)} title="Remove" style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 13 }}>✕</button>
                  </div>
                ) : (
                  <span>{item}</span>
                )}
              </li>
            ))}
          </ul>
          {isEdit && (
            <button onClick={addInclusion} style={{ marginTop: 8, background: "#eff6ff", color: "#1d4ed8", border: "1px dashed #93c5fd", borderRadius: 6, padding: "4px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif" }}>+ Add bullet</button>
          )}
        </div>

        {/* ── TERMS ── */}
        <div style={{ padding: "22px 36px 0" }}>
          <div style={sectionTitle}>Terms:</div>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, listStyleType: "decimal" }}>
            {localTerms.map((term, i) => (
              <li key={i} style={{ marginBottom: isEdit ? 10 : 6 }}>
                {isEdit ? (
                  <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={term.title}
                        onChange={(e) => changeTerm(i, "title", e.target.value)}
                        placeholder="Term title (e.g. Billing.)"
                        style={{ width: 180, border: "1px solid #93c5fd", borderRadius: 4, padding: "4px 8px", fontSize: 13, fontWeight: 700, background: "#eff6ff" }}
                      />
                      <button onClick={() => removeTerm(i)} title="Remove" style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontSize: 13 }}>✕</button>
                    </div>
                    <textarea
                      value={term.body}
                      onChange={(e) => changeTerm(i, "body", e.target.value)}
                      rows={2}
                      placeholder="Term description..."
                      style={{ border: "1px solid #93c5fd", borderRadius: 4, padding: "4px 8px", fontSize: 13, background: "#eff6ff", resize: "vertical", fontFamily: "Georgia, serif" }}
                    />
                  </div>
                ) : (
                  <span>
                    <strong>{term.title}</strong>{" "}
                    <span style={{ color: "#374151" }}>{term.body}</span>
                  </span>
                )}
              </li>
            ))}
          </ol>
          {isEdit && (
            <button onClick={addTerm} style={{ marginTop: 8, background: "#eff6ff", color: "#1d4ed8", border: "1px dashed #93c5fd", borderRadius: 6, padding: "4px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Arial, sans-serif" }}>+ Add term</button>
          )}
        </div>

        {/* ── NOTES (if any) ── */}
        {(localNotes || isEdit) && (
          <div style={{ padding: "22px 36px 0" }}>
            <div style={sectionTitle}>Additional Notes:</div>
            {isEdit ? (
              <textarea
                value={localNotes}
                onChange={(e) => changeNotes(e.target.value)}
                rows={3}
                placeholder="Any additional notes for this quote..."
                style={{ width: "100%", border: "1px solid #93c5fd", borderRadius: 4, padding: "6px 10px", fontSize: 13, background: "#eff6ff", resize: "vertical", fontFamily: "Georgia, serif" }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{localNotes}</p>
            )}
          </div>
        )}

        {/* ── ACCEPTANCE ── */}
        <div style={{ padding: "22px 36px 0" }}>
          <div style={sectionTitle}>Acceptance:</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>
            <EditableText
              value={localAcceptanceText}
              onChange={changeAcceptanceText}
              isEdit={isEdit}
              multiline
              tag="p"
              className=""
              placeholder="Acceptance paragraph..."
            />
          </div>

          {/* Signature lines — always shown in the document */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 16 }}>
            <div>
              <div style={{ borderTop: "1px solid #374151", paddingTop: 6, fontFamily: "Arial, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase" }}>Authorized Signature</div>
            </div>
            <div>
              <div style={{ borderTop: "1px solid #374151", paddingTop: 6, fontFamily: "Arial, sans-serif", fontSize: 10, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase" }}>Date</div>
            </div>
          </div>
        </div>

        {/* ── CTA BUTTONS (hidden in print) ── */}
        {viewState === "view" && (
          <div className="no-print" style={{ padding: "28px 36px 8px" }}>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 22 }}>
              {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>{error}</p>}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={handleAccept}
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all py-3.5 flex items-center justify-center gap-2"
                  style={{ border: "none", fontFamily: "Arial, sans-serif" }}
                >
                  <CheckCircle2 size={18} />
                  <span>{submitting ? "Processing..." : "Accept Quote"}</span>
                </button>
                <button
                  onClick={() => { setViewState("reject_form"); setError(""); }}
                  disabled={submitting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-[15px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all py-3.5 flex items-center justify-center gap-2"
                  style={{ border: "none", fontFamily: "Arial, sans-serif" }}
                >
                  <MessageSquare size={18} />
                  <span>Request Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {viewState === "reject_form" && (
          <div className="no-print" style={{ padding: "28px 36px 8px" }}>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 22 }}>
              <h3 style={{ margin: "0 0 16px", fontFamily: "Arial, sans-serif", fontSize: 16, fontWeight: 700 }}>Let us know what you'd like changed</h3>
              {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>{error}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: "Arial, sans-serif", color: "#374151" }}>Reason (optional)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Budget is too high, scope doesn't match our needs..."
                    style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, fontFamily: "Arial, sans-serif", color: "#374151" }}>Changes you'd like</label>
                  <textarea
                    value={changeRequest}
                    onChange={(e) => setChangeRequest(e.target.value)}
                    rows={4}
                    placeholder="e.g. Can we do 8 videos instead of 12? Or reduce ad spend to $300..."
                    style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleReject}
                    disabled={submitting}
                    style={{ flex: 1, background: "#111827", color: "#fff", border: "none", borderRadius: 8, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1, fontFamily: "Arial, sans-serif" }}
                  >
                    {submitting ? "Sending..." : "Send Feedback"}
                  </button>
                  <button
                    onClick={() => { setViewState("view"); setError(""); }}
                    disabled={submitting}
                    style={{ padding: "13px 24px", background: "transparent", border: "none", color: "#6b7280", fontWeight: 500, fontSize: 14, cursor: "pointer", fontFamily: "Arial, sans-serif" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCUMENT FOOTER ── */}
        <div style={{ ...blueLine, margin: "24px 36px 0" }} />
        <div style={{ padding: "10px 36px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#6b7280" }}>E8 Productions, LLC</div>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#1a56db" }}>e8productions.com</div>
        </div>
      </div>
    </>
  );
}