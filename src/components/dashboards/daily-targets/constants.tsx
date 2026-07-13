// Platform icon/color + deliverable-type color config, lifted from the original
// Admindailytargetspage.tsx implementation (already correct, already in production).

import type React from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><circle cx="12" cy="12" r="5" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" />
  </svg>
);

type PlatformIcon = React.ComponentType<{ className?: string }>;

export const PLATFORM_CONFIG: Record<string, { icon: PlatformIcon | null; color: string; bgColor: string }> = {
  'ig': { icon: InstagramIcon, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'ig (trials)': { icon: InstagramIcon, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'instagram': { icon: InstagramIcon, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'yt': { icon: YoutubeIcon, color: 'text-red-600', bgColor: 'bg-red-50' },
  'youtube': { icon: YoutubeIcon, color: 'text-red-600', bgColor: 'bg-red-50' },
  'tt': { icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
  'tiktok': { icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
  'fb profile': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'fb page': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'fb tv': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'facebook': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'li': { icon: LinkedinIcon, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'linkedin': { icon: LinkedinIcon, color: 'text-blue-700', bgColor: 'bg-blue-50' },
};

export const DELIVERABLE_COLORS: Record<string, { bg: string; text: string }> = {
  'SF': { bg: 'bg-violet-100', text: 'text-violet-700' },
  'BSF': { bg: 'bg-slate-100', text: 'text-slate-700' },
  'SQF': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'HP': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'LF': { bg: 'bg-blue-100', text: 'text-blue-700' },
};

export const getPlatformConfig = (platformName: string) => {
  const key = platformName.toLowerCase();
  return PLATFORM_CONFIG[key] || PLATFORM_CONFIG[key.split(' ')[0]] || { icon: null, color: 'text-gray-600', bgColor: 'bg-gray-100' };
};

export function formatDateEST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTimeEST(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Tailwind gradient stops — used for progress bars/rings/badges.
export function getProgressColor(progress: number): string {
  if (progress >= 100) return 'from-emerald-400 to-teal-500';
  if (progress >= 50) return 'from-amber-400 to-orange-500';
  return 'from-rose-400 to-pink-500';
}

// Hex equivalents of the gradient stops above — used where inline SVG/style color is needed (e.g. drawer border, progress ring stroke).
export function getProgressHexColor(progress: number): string {
  if (progress >= 100) return '#10b981'; // emerald-500
  if (progress >= 50) return '#f59e0b'; // amber-500
  return '#f43f5e'; // rose-500
}

export function getProgressIcon(progress: number) {
  if (progress >= 100) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (progress >= 50) return <Clock className="h-4 w-4 text-amber-500" />;
  return <AlertCircle className="h-4 w-4 text-rose-500" />;
}
