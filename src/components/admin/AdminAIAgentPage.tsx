'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, RefreshCw, Trash2, ArrowUpRight, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

type Msg = {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
};

const SUGGESTIONS = [
  'Search pending tasks',
  'Show all tasks for Sarah',
  'Pull today\'s production report',
  'Find tasks ready for QC',
  'Reassign task to an editor',
];

export function AdminAIAgentPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: "Hello Sahil! I'm your operations AI Agent. You can ask me to search tasks, inspect workflows, pull reports, or execute task updates across the production pipeline.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastInteractionId, setLastInteractionId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  async function handleSend(textToSend?: string) {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;

    const userMsg: Msg = {
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          previousInteractionId: lastInteractionId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.text || 'Action completed.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setLastInteractionId(data.interactionId);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Error: ${err.message || 'Unable to process request'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const handleClearHistory = () => {
    setMessages([
      {
        role: 'assistant',
        text: "Conversation cleared. How can I assist you with operations today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLastInteractionId(undefined);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Bot className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Agent</h1>
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900 gap-1 font-semibold">
                <Sparkles className="h-3 w-3" />
                Gemini Assistant
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Automate task updates, query production records, and execute operations via natural language
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 py-1 px-2.5 text-xs text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Session
          </Badge>
          <Badge variant="secondary" className="hidden md:flex items-center gap-1 text-xs text-muted-foreground font-mono">
            <ShieldCheck className="h-3 w-3 text-blue-500" />
            sahilsagvekar230@gmail.com
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearHistory}
            className="text-xs gap-1.5 h-8 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Suggested prompts chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 flex items-center gap-1">
          <Terminal className="h-3 w-3" />
          Quick Actions:
        </span>
        {SUGGESTIONS.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => handleSend(suggestion)}
            disabled={loading}
            className="text-xs shrink-0 px-3 py-1.5 rounded-full bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/60 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <span>{suggestion}</span>
            <ArrowUpRight className="h-3 w-3 opacity-60" />
          </button>
        ))}
      </div>

      {/* Main Chat Box */}
      <div className="bg-card border border-border rounded-2xl shadow-xs flex flex-col h-[650px] overflow-hidden">
        {/* Messages Feed */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
          {messages.map((m, i) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={i}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {isUser ? 'You' : <Bot className="h-4 w-4" />}
                </div>

                <div className="flex flex-col gap-1">
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-muted/70 text-foreground border border-border/70 rounded-tl-xs'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span
                    className={`text-[10px] text-muted-foreground/70 px-1 ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-[85%] mr-auto">
              <div className="h-8 w-8 rounded-lg shrink-0 bg-muted text-muted-foreground border border-border flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-muted/70 text-muted-foreground border border-border/70 rounded-tl-xs flex items-center gap-2 text-sm">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-500" />
                <span>Thinking and analyzing tools…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-border bg-background/50 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI agent to search tasks, reassign tasks, or pull reports…"
              disabled={loading}
              className="flex-1 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </Button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 mt-2 px-1">
            <span>Press Enter to send</span>
            <span>Google Gemini 2.5 API</span>
          </div>
        </div>
      </div>
    </div>
  );
}
