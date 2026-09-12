/**
 * Thin wrapper around the Gemini API for the admin agent.
 *
 * Uses the free tier of gemini-2.0-flash. Get a key at
 * https://aistudio.google.com/apikey and set GEMINI_API_KEY in your env.
 *
 * Install: npm install @google/generative-ai
 */

import { GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";
import { toolDeclarations } from "./tools";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_INSTRUCTION = `
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

export function getModel() {
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: toolDeclarations }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });
}