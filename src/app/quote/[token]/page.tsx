"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface ServiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
  preClient: {
    name: string;
    email: string;
    companyName: string | null;
  };
}

type ViewState = "loading" | "error" | "view" | "reject_form" | "accepted" | "rejected" | "already_done";

export default function QuotePage() {
  const { token } = useParams() as { token: string };
  const [quote, setQuote] = useState<Quote | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/quotes/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); setViewState("error"); return; }
        setQuote(data);
        if (data.status === "ACCEPTED" || data.status === "REJECTED") setViewState("already_done");
        else setViewState("view");
      })
      .catch(() => { setError("Failed to load quote"); setViewState("error"); });
  }, [token]);

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

  function fmt(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }

  function fmtDate(d: string | null) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  if (viewState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading your quote...</div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow p-8 max-w-md w-full text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <p className="text-gray-500 text-sm mt-2">Please contact E8 Productions for assistance.</p>
        </div>
      </div>
    );
  }

  if (viewState === "accepted") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Quote Accepted!</h2>
          <p className="text-gray-600">
            Thank you, {quote?.preClient.name}. We're excited to work with you.
            The E8 team will be in touch shortly to get everything set up.
          </p>
        </div>
      </div>
    );
  }

  if (viewState === "rejected") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Feedback Received</h2>
          <p className="text-gray-600">We've received your feedback and will get back to you with a revised proposal shortly.</p>
        </div>
      </div>
    );
  }

  if (viewState === "already_done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-10 max-w-md w-full text-center">
          <p className="text-lg font-medium text-gray-700">
            This quote has already been {quote?.status === "ACCEPTED" ? "accepted ✓" : "responded to"}.
          </p>
          <p className="text-gray-500 text-sm mt-2">Please contact E8 if you need anything else.</p>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  const validUntil = quote.sentAt
    ? new Date(new Date(quote.sentAt).getTime() + quote.validDays * 86400000)
    : null;

  const quoteNumber = `E8-${new Date(quote.createdAt).getFullYear()}-${String(quote.version).padStart(4, "0")}`;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-black px-8 py-6 flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-2xl tracking-tight">E8</div>
              <div className="text-gray-400 text-xs uppercase tracking-widest mt-0.5">Full Service Video + Content</div>
            </div>
            <div className="text-right text-sm text-gray-400 space-y-1">
              <div>Quote No. <span className="text-white font-medium">{quoteNumber}</span></div>
              <div>Date <span className="text-white font-medium">{fmtDate(quote.createdAt)}</span></div>
              {validUntil && <div>Valid Until <span className="text-white font-medium">{fmtDate(validUntil.toISOString())}</span></div>}
            </div>
          </div>

          <div className="px-8 py-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Prepared For</div>
                <div className="font-semibold text-gray-900">{quote.preClient.name}</div>
                {quote.preClient.companyName && <div className="text-gray-500 text-sm">{quote.preClient.companyName}</div>}
              </div>
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Prepared By</div>
                <div className="text-gray-700">Gabe Rabinowitz + Eric Davis</div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            <p className="text-gray-600 text-sm leading-relaxed">
              Thank you for the opportunity. Below is your monthly engagement for full-service social media content production, publishing, and management.
            </p>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-8 py-4 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Cost Summary</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-900 text-white text-xs uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-medium">Service</th>
                <th className="px-6 py-3 text-left font-medium">Description</th>
                <th className="px-6 py-3 text-right font-medium">Monthly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(quote.services as ServiceLine[]).map((s, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-semibold text-gray-900 text-sm align-top whitespace-nowrap">{s.description}</td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {s.quantity > 1 && <span className="mr-1">{s.quantity}×</span>}
                    {fmt(s.unitPrice)}/mo
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900 text-sm">{fmt(s.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-600 text-white">
                <td colSpan={2} className="px-6 py-4 font-bold text-sm text-right uppercase tracking-wider">Total Monthly Cost</td>
                <td className="px-6 py-4 text-right font-bold text-lg">{fmt(quote.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 py-6 mb-6">
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Notes</h2>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}

        {/* Actions */}
        {viewState === "view" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 py-6">
            {error && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
            <p className="text-gray-600 text-sm mb-6">
              To get started, accept this quote below. If you'd like any changes, let us know and we'll revise it for you.
            </p>
            <div className="flex gap-3">
              <button onClick={handleAccept} disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50">
                {submitting ? "Processing..." : "✓ Accept Quote"}
              </button>
              <button onClick={() => { setViewState("reject_form"); setError(""); }} disabled={submitting}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-lg border border-gray-300 transition disabled:opacity-50">
                Request Changes
              </button>
            </div>
          </div>
        )}

        {viewState === "reject_form" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-8 py-6">
            <h3 className="font-semibold text-gray-900 mb-4">Let us know what you'd like changed</h3>
            {error && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3}
                  placeholder="e.g. Budget is too high, scope doesn't match our needs..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Changes you'd like</label>
                <textarea value={changeRequest} onChange={(e) => setChangeRequest(e.target.value)} rows={4}
                  placeholder="e.g. Can we do 8 videos instead of 12? Or reduce ad spend to $300..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleReject} disabled={submitting}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition disabled:opacity-50">
                  {submitting ? "Sending..." : "Send Feedback"}
                </button>
                <button onClick={() => { setViewState("view"); setError(""); }} disabled={submitting}
                  className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 mt-6">E8 Productions, LLC · e8productions.com</div>
      </div>
    </div>
  );
}