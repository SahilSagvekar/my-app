"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };
type Pending = { toolName: string; args: any; description: string } | null;

export default function AdminAgentChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const userMsg: Msg = { role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    const res = await fetch("/api/admin/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg.text }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.type === "text") {
      setMessages((m) => [...m, { role: "assistant", text: data.text }]);
    } else if (data.type === "pending_confirmation") {
      setPending({ toolName: data.toolName, args: data.args, description: data.description });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Proposed action: ${data.description}` },
      ]);
    }
  }

  async function confirmAction() {
    if (!pending) return;
    setLoading(true);
    const res = await fetch("/api/admin/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: pending }),
    });
    const data = await res.json();
    setLoading(false);
    setPending(null);
    setMessages((m) => [...m, { role: "assistant", text: `Done: ${pending.description}` }]);
  }

  return (
    <div className="flex flex-col gap-3 max-w-md">
      <div className="flex flex-col gap-2 min-h-[200px] p-3 border rounded-lg bg-white">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <span
              className={
                "inline-block px-3 py-2 rounded-lg text-sm " +
                (m.role === "user" ? "bg-blue-100" : "bg-gray-100")
              }
            >
              {m.text}
            </span>
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">Thinking…</div>}
      </div>

      {pending && (
        <div className="flex items-center justify-between border rounded-lg p-3 bg-yellow-50">
          <span className="text-sm">{pending.description}</span>
          <div className="flex gap-2">
            <button
              onClick={confirmAction}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm"
            >
              Confirm
            </button>
            <button
              onClick={() => setPending(null)}
              className="px-3 py-1 bg-gray-200 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="e.g. reassign task 123 to Sarah"
        />
        <button onClick={send} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          Send
        </button>
      </div>
    </div>
  );
}