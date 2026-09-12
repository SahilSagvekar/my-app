/**
 * Thin wrapper around the Gemini API for the admin agent.
 *
 * As of mid-2026, Google replaced the old generateContent/startChat flow
 * (package `@google/generative-ai`, now legacy) with the Interactions API
 * (package `@google/genai`). This also means model IDs changed —
 * gemini-2.0-flash was sunset; gemini-3.6-flash is the current equivalent.
 *
 * Install: npm uninstall @google/generative-ai && npm install @google/genai
 * Get a key at https://aistudio.google.com/apikey and set GEMINI_API_KEY.
 */

import { GoogleGenAI } from "@google/genai";

export const MODEL = "gemini-3.6-flash";

export const SYSTEM_INSTRUCTION = `
You are an internal admin assistant for a video production company's dashboard.
You help the admin manage tasks by calling the tools available to you.

Rules:
- For read actions (searching tasks, pulling reports), just call the tool and answer directly.
- For write actions (updating status, reassigning), call the tool — the system will handle
  asking the human to confirm before anything actually happens. You don't need to ask
  for confirmation yourself in words; just propose the action clearly.
- Only use the tools you're given. Never claim to have done something you didn't call a tool for.
- Keep responses short and plain — the person reading this is busy and non-technical.
`.trim();

let _client: GoogleGenAI | null = null;

export function getClient(): GoogleGenAI {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    _client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _client;
}