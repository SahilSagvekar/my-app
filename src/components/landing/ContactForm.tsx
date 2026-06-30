'use client';

import React, { useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus({ type: 'error', message: 'Please fill out all fields.' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: data.message || 'Message sent. We will get back to you shortly.' });
        setName('');
        setEmail('');
        setMessage('');

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

      <div>
        <label htmlFor="name" className="block text-sm sm:text-base text-black/70 mb-2 sm:mb-2.5 font-medium">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          type="text"
          id="name"
          className="w-full px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-base border border-black/10 rounded-xl sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm sm:text-base text-black/70 mb-2 sm:mb-2.5 font-medium">
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          id="email"
          className="w-full px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-base border border-black/10 rounded-xl sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm sm:text-base text-black/70 mb-2 sm:mb-2.5 font-medium">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          id="message"
          rows={6}
          className="w-full px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-base border border-black/10 rounded-xl sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 focus:border-black/30 transition-all resize-none"
          placeholder="Tell us about your project..."
        />
      </div>


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
