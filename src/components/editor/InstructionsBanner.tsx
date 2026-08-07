"use client";

import { Megaphone } from "lucide-react";

// Simple scrolling instructions banner for the Editor Portal.
// To change the message, just edit the text below — no config/API involved.
const INSTRUCTIONS_TEXT =
  "Please add tags on your tasks, it helps scheduler to prioritize and group tasks";

export function InstructionsBanner() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-amber-200 bg-amber-50 text-amber-900 py-2 mb-4">
      <div className="flex items-center">
        <div className="flex items-center gap-1.5 shrink-0 px-3 z-10 bg-amber-50">
          <Megaphone className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Instructions</span>
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-marquee">
            <span className="text-sm px-4">{INSTRUCTIONS_TEXT}</span>
            <span className="text-sm px-4">{INSTRUCTIONS_TEXT}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 22s linear infinite;
        }
      `}</style>
    </div>
  );
}