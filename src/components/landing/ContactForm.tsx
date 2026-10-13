'use client';

import React, { useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [transactionalSmsConsent, setTransactionalSmsConsent] = useState(false);
  const [promotionalSmsConsent, setPromotionalSmsConsent] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus({ type: 'error', message: 'Please fill out all fields.' });
      return;
    }
    if ((transactionalSmsConsent || promotionalSmsConsent) && !phone.trim()) {
      setStatus({ type: 'error', message: 'Please enter a phone number to opt in to SMS messages.' });
      return;
    }
    if (!acceptedTerms) {
      setStatus({ type: 'error', message: 'Please accept the Terms of Service and Privacy Policy to continue.' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          message: message.trim(),
          transactionalSmsConsent,
          promotionalSmsConsent,
          acceptedTerms,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: data.message || 'Message sent. We will get back to you shortly.' });
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
        setTransactionalSmsConsent(false);
        setPromotionalSmsConsent(false);
        setAcceptedTerms(false);

      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to send message. Try again later.' });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
      {status ? (
        <div
          className={`p-3 sm:p-4 rounded-xl text-sm sm:text-base ${status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}
        >
          {status.message}
        </div>
      ) : null}

      {/* Name + Email on same row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm text-black/70 mb-2 font-medium">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            id="name"
            className="w-full px-4 py-3 text-base border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm text-black/70 mb-2 font-medium">
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            id="email"
            className="w-full px-4 py-3 text-base border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all"
            placeholder="your@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm text-black/70 mb-2 font-medium">
          Phone Number <span className="text-black/40 font-normal">(optional)</span>
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
          id="phone"
          autoComplete="tel"
          inputMode="tel"
          maxLength={30}
          className="w-full px-4 py-3 text-base border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all"
          placeholder="(555) 123-4567"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm text-black/70 mb-2 font-medium">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          id="message"
          rows={4}
          className="w-full px-4 py-3 text-base border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all resize-none"
          placeholder="Tell us about your project..."
        />
      </div>

      <fieldset className="space-y-4 rounded-xl border border-black/10 p-4 sm:p-5">
        <legend className="px-1 text-sm font-semibold text-black/80">Communication preferences</legend>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-black/70">
          <input type="checkbox" checked={transactionalSmsConsent} onChange={(e) => setTransactionalSmsConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
          <span>By checking, you are allowing to receive transactional/informational SMS communications regarding account notifications, customer care, etc., from <strong className="font-semibold text-black">E8 Productions, LLC</strong>. Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt out.</span>
        </label>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-black/70">
          <input type="checkbox" checked={promotionalSmsConsent} onChange={(e) => setPromotionalSmsConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-black" />
          <span>By checking, you are allowing to receive promotional/marketing SMS communications from <strong className="font-semibold text-black">E8 Productions, LLC</strong>. Message frequency may vary. Message and data rates may apply. Reply HELP for help or STOP to opt out.</span>
        </label>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-black/70">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0 accent-black" />
          <span>By checking, I accept the{' '}<a href="https://e8productions.com/terms" className="font-medium text-black underline underline-offset-2 hover:text-black/70">Terms of Service</a>{' '}and{' '}<a href="https://e8productions.com/privacy" className="font-medium text-black underline underline-offset-2 hover:text-black/70">Privacy Policy</a>.</span>
        </label>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 sm:px-8 py-4 sm:py-4 text-base sm:text-base bg-black text-white rounded-full transition-all hover:bg-black/90 active:scale-95 disabled:opacity-60 font-medium shadow-lg shadow-black/10"
      >
        {loading ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
