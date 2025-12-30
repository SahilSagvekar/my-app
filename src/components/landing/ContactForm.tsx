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
    <form className="space-y-6" onSubmit={handleSubmit}>
      {status ? (
        <div
          className={`p-3 rounded-md text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}
        >
          {status.message}
        </div>
      ) : null}

      <div>
        <label htmlFor="name" className="block text-sm text-black/70 mb-2">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          type="text"
          id="name"
          className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:border-black/30 transition-colors"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm text-black/70 mb-2">
          Email
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          id="email"
          className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:border-black/30 transition-colors"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm text-black/70 mb-2">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          id="message"
          rows={5}
          className="w-full px-4 py-3 border border-black/10 rounded-xl focus:outline-none focus:border-black/30 transition-colors resize-none"
          placeholder="Tell us about your project..."
        />
      </div>


      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-4 bg-black text-white rounded-full transition-all hover:bg-black/90 hover:scale-105 disabled:opacity-60"
      >
        {loading ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
