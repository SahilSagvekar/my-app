'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    X, Play, ChevronDown, Film, Video, Scissors, Camera, Mic,
    Lock, ArrowRight, Loader2, Check, Phone, Mail, User, Briefcase
} from 'lucide-react';
import logoImage from '../../../public/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png';

/* ───────────────────────────── types ───────────────────────────── */
interface PortfolioVideo {
    id: string;
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl: string | null;
    category: string;
}

/* ───────────────────────── constants ───────────────────────────── */
const SERVICE_OPTIONS = [
    'Videography',
    'Video Editing',
    'Build A Show',
    'Social Media Management',
    'Multiple Services',
    'Other',
];

const CATEGORIES = [
    { key: 'short_form', label: 'Short Form Videos', icon: Film },
    { key: 'long_form', label: 'Long Form Videos', icon: Video },
    { key: 'montage', label: 'Montage Edits', icon: Scissors },
    { key: 'ugc', label: 'UGC Content', icon: Camera },
    { key: 'talking_head', label: 'Talking Head Videos', icon: Mic },
];

/* ──────── helper: extract embed url from YouTube / Vimeo ──────── */
function getEmbedUrl(url: string): string {
    // YouTube
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    // Vimeo
    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;

    return url; // already an embed url
}

function getThumbnailFromUrl(url: string): string | null {
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    return null;
}

/* ═══════════════════════════════════════════════════════════════════
   GATE FORM  — full-screen overlay that captures lead info
   ═══════════════════════════════════════════════════════════════════ */
function GateForm({ onUnlock }: { onUnlock: () => void }) {
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        serviceNeeded: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.firstName.trim()) e.firstName = 'First name is required';
        if (!form.lastName.trim()) e.lastName = 'Last name is required';
        if (!form.phone.trim()) e.phone = 'Phone number is required';
        if (!form.email.trim()) e.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
            e.email = 'Enter a valid email';
        if (!form.serviceNeeded) e.serviceNeeded = 'Select a service';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/portfolio/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.ok) {
                // persist unlock in sessionStorage so refreshing doesn't re-show
                sessionStorage.setItem('portfolio_unlocked', '1');
                onUnlock();
            } else {
                setErrors({ _form: data.message || 'Something went wrong' });
            }
        } catch {
            setErrors({ _form: 'Network error. Please try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    const set = (key: string, value: string) =>
        setForm((p) => ({ ...p, [key]: value }));

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            {/* card */}
            <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-gate-in">
                {/* decorative top bar */}
                <div className="h-1.5 bg-gradient-to-r from-black via-gray-700 to-black" />

                <div className="p-6 sm:p-10">
                    {/* logo + heading */}
                    <div className="flex flex-col items-center mb-8">
                        <Image
                            src={logoImage}
                            alt="E8 Productions"
                            width={140}
                            height={36}
                            className="h-8 w-auto mb-5"
                        />
                        <h1 className="text-2xl sm:text-3xl font-bold text-black text-center">
                            Unlock Our Portfolio
                        </h1>
                        <p className="text-black/50 text-sm sm:text-base mt-2 text-center max-w-sm">
                            Fill in your details to get instant access to our full video portfolio.
                        </p>
                    </div>

                    {/* form error */}
                    {errors._form && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                            {errors._form}
                        </div>
                    )}

                    {/* fields */}
                    <div className="space-y-4">
                        {/* Row: first + last */}
                        <div className="grid grid-cols-2 gap-3">
                            <Field
                                icon={<User className="w-4 h-4" />}
                                placeholder="First Name"
                                value={form.firstName}
                                onChange={(v) => set('firstName', v)}
                                error={errors.firstName}
                            />
                            <Field
                                icon={<User className="w-4 h-4" />}
                                placeholder="Last Name"
                                value={form.lastName}
                                onChange={(v) => set('lastName', v)}
                                error={errors.lastName}
                            />
                        </div>

                        <Field
                            icon={<Phone className="w-4 h-4" />}
                            placeholder="Phone Number"
                            type="tel"
                            value={form.phone}
                            onChange={(v) => set('phone', v)}
                            error={errors.phone}
                        />

                        <Field
                            icon={<Mail className="w-4 h-4" />}
                            placeholder="Email Address"
                            type="email"
                            value={form.email}
                            onChange={(v) => set('email', v)}
                            error={errors.email}
                        />

                        {/* Dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border ${errors.serviceNeeded
                                    ? 'border-red-300 bg-red-50/50'
                                    : 'border-black/10 bg-black/[0.02]'
                                    } transition-all hover:border-black/20 text-left`}
                            >
                                <Briefcase className="w-4 h-4 text-black/40 shrink-0" />
                                <span
                                    className={`flex-1 text-sm ${form.serviceNeeded ? 'text-black' : 'text-black/40'
                                        }`}
                                >
                                    {form.serviceNeeded || 'Services Needed'}
                                </span>
                                <ChevronDown
                                    className={`w-4 h-4 text-black/40 transition-transform ${dropdownOpen ? 'rotate-180' : ''
                                        }`}
                                />
                            </button>

                            {dropdownOpen && (
                                <div className="absolute z-20 bottom-full mb-1 w-full bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden animate-dropdown max-h-[240px] overflow-y-auto">
                                    {SERVICE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                                set('serviceNeeded', opt);
                                                setDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm transition-colors ${form.serviceNeeded === opt
                                                ? 'bg-black text-white'
                                                : 'text-black/70 hover:bg-black/5'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {errors.serviceNeeded && (
                                <p className="text-red-500 text-xs mt-1 pl-1">
                                    {errors.serviceNeeded}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white rounded-xl font-semibold text-base hover:bg-black/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-black/10"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting…
                            </>
                        ) : (
                            <>
                                Unlock Portfolio
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* animations */}
            <style jsx global>{`
        @keyframes gateIn {
          from { opacity: 0; transform: scale(0.92) translateY(24px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-gate-in { animation: gateIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown { animation: dropdownIn 0.2s ease-out both; }
      `}</style>
        </div>
    );
}

/* ── reusable input field ── */
function Field({
    icon,
    placeholder,
    value,
    onChange,
    error,
    type = 'text',
}: {
    icon: React.ReactNode;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    error?: string;
    type?: string;
}) {
    return (
        <div>
            <div
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${error
                    ? 'border-red-300 bg-red-50/50'
                    : 'border-black/10 bg-black/[0.02] focus-within:border-black/30'
                    }`}
            >
                <span className="text-black/40 shrink-0">{icon}</span>
                <input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-black placeholder:text-black/40"
                />
            </div>
            {error && (
                <p className="text-red-500 text-xs mt-1 pl-1">{error}</p>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO NAV  — same aesthetic as homepage, different links
   ═══════════════════════════════════════════════════════════════════ */
function PortfolioNav({
    active,
    onSelect,
}: {
    active: string;
    onSelect: (key: string) => void;
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between h-14 sm:h-16">
                        {/* Logo */}
                        <div className="flex-shrink-0">
                            <Link href="/" className="text-black transition-opacity hover:opacity-60">
                                <Image
                                    src={logoImage}
                                    alt="E8 Productions"
                                    width={120}
                                    height={32}
                                    className="h-6 sm:h-8 w-auto"
                                />
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden lg:flex items-center space-x-1 font-bold">
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => onSelect(cat.key)}
                                        className={`flex items-center gap-1.5 px-3 xl:px-4 py-2 rounded-full text-sm transition-all ${active === cat.key
                                            ? 'bg-black text-white shadow-lg shadow-black/10'
                                            : 'text-black/60 hover:text-black hover:bg-black/5'
                                            }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span className="hidden xl:inline">{cat.label}</span>
                                        <span className="xl:hidden">{cat.label.split(' ').slice(0, 2).join(' ')}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="lg:hidden p-2 text-black"
                            aria-label="Toggle menu"
                        >
                            <svg
                                className="w-5 h-5 sm:w-6 sm:h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={
                                        mobileMenuOpen
                                            ? 'M6 18L18 6M6 6l12 12'
                                            : 'M4 6h16M4 12h16M4 18h16'
                                    }
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Mobile Menu */}
                    {mobileMenuOpen && (
                        <div className="lg:hidden py-4 space-y-1 border-t border-black/5 mt-2">
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => {
                                            onSelect(cat.key);
                                            setMobileMenuOpen(false);
                                        }}
                                        className={`flex items-center gap-3 w-full px-5 py-3.5 text-base rounded-xl transition-all ${active === cat.key
                                            ? 'bg-black text-white'
                                            : 'text-black/70 hover:text-black hover:bg-black/5'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   EXPANDED VIDEO MODAL  — click-to-expand overlay
   ═══════════════════════════════════════════════════════════════════ */
function VideoModal({
    video,
    onClose,
}: {
    video: PortfolioVideo;
    onClose: () => void;
}) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl bg-black rounded-2xl overflow-hidden shadow-2xl animate-modal-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 backdrop-blur-md hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>

                {/* Embedded video */}
                <div className="aspect-video w-full">
                    <iframe
                        src={getEmbedUrl(video.videoUrl) + '?autoplay=1'}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={video.title}
                    />
                </div>

                {/* Title bar */}
                <div className="p-4 sm:p-6 bg-gradient-to-t from-black to-black/90">
                    <h3 className="text-white text-lg sm:text-xl font-semibold">
                        {video.title}
                    </h3>
                    {video.description && (
                        <p className="text-white/60 text-sm mt-1">{video.description}</p>
                    )}
                </div>
            </div>

            <style jsx global>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-modal-in { animation: modalIn 0.3s cubic-bezier(0.16,1,0.3,1) both; }
      `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   VIDEO GRID  — clean grid of embedded video thumbnails
   ═══════════════════════════════════════════════════════════════════ */
function VideoGrid({
    videos,
    loading,
}: {
    videos: PortfolioVideo[];
    loading: boolean;
}) {
    const [expanded, setExpanded] = useState<PortfolioVideo | null>(null);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-black/30" />
            </div>
        );
    }

    if (videos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mb-4">
                    <Film className="w-7 h-7 text-black/30" />
                </div>
                <h3 className="text-lg font-semibold text-black/70 mb-1">
                    Coming Soon
                </h3>
                <p className="text-black/40 text-sm max-w-sm">
                    Videos for this category are being prepared. Check back soon!
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {videos.map((video) => {
                    const thumb =
                        video.thumbnailUrl || getThumbnailFromUrl(video.videoUrl);
                    return (
                        <div
                            key={video.id}
                            onClick={() => setExpanded(video)}
                            className="group cursor-pointer bg-white border border-black/5 rounded-2xl overflow-hidden hover:shadow-xl hover:border-black/10 active:scale-[0.98] transition-all duration-300"
                        >
                            {/* Thumbnail */}
                            <div className="relative aspect-video overflow-hidden bg-black/5">
                                {thumb ? (
                                    <img
                                        src={thumb}
                                        alt={video.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-black/10 to-black/5 flex items-center justify-center">
                                        <Film className="w-10 h-10 text-black/20" />
                                    </div>
                                )}
                                {/* Play overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg">
                                        <Play
                                            className="w-5 h-5 sm:w-6 sm:h-6 text-black ml-0.5"
                                            fill="black"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-4 sm:p-5">
                                <h3 className="text-base sm:text-lg font-semibold text-black group-hover:text-black transition-colors line-clamp-1">
                                    {video.title}
                                </h3>
                                {video.description && (
                                    <p className="text-sm text-black/50 mt-1 line-clamp-2">
                                        {video.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {expanded && (
                <VideoModal video={expanded} onClose={() => setExpanded(null)} />
            )}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO CONTENT  — the unlocked portfolio page
   ═══════════════════════════════════════════════════════════════════ */
function PortfolioContent() {
    const [activeCategory, setActiveCategory] = useState('short_form');
    const [videos, setVideos] = useState<PortfolioVideo[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchVideos = useCallback(async (category: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/portfolio/videos?category=${category}`);
            const data = await res.json();
            if (data.ok) setVideos(data.videos);
        } catch (err) {
            console.error('Failed to fetch videos', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVideos(activeCategory);
    }, [activeCategory, fetchVideos]);

    const activeCat = CATEGORIES.find((c) => c.key === activeCategory);

    return (
        <div className="min-h-screen bg-white">
            <PortfolioNav active={activeCategory} onSelect={setActiveCategory} />

            <div className="pt-14 sm:pt-16">
                {/* Hero */}
                <section className="pt-10 sm:pt-14 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 bg-white">
                    <div className="max-w-7xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black/5 rounded-full text-sm text-black/70 font-medium mb-4">
                            <Check className="w-4 h-4 text-green-600" />
                            Portfolio Unlocked
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3">
                            Our Video Portfolio
                        </h1>
                        <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto">
                            Browse our collection of professional video content across
                            different styles and formats.
                        </p>
                    </div>
                </section>

                {/* Category pills  (mobile-friendly horizontal scroll) */}
                <section className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide lg:hidden">
                            {CATEGORIES.map((cat) => {
                                const Icon = cat.icon;
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => setActiveCategory(cat.key)}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-all font-medium ${activeCategory === cat.key
                                            ? 'bg-black text-white shadow-lg shadow-black/10'
                                            : 'bg-black/[0.04] text-black/60 hover:bg-black/10 hover:text-black'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Section Title */}
                <section className="px-4 sm:px-6 lg:px-8 pb-4 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex items-center gap-3 mb-2">
                            {activeCat && (
                                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                                    <activeCat.icon className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <h2 className="text-xl sm:text-2xl font-semibold text-black">
                                {activeCat?.label}
                            </h2>
                        </div>
                    </div>
                </section>

                {/* Video Grid */}
                <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <VideoGrid videos={videos} loading={loading} />
                    </div>
                </section>
            </div>

            {/* Footer */}
            <footer className="border-t border-black/5 py-8 px-4 sm:px-6 lg:px-8 bg-white">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Image
                        src={logoImage}
                        alt="E8 Productions"
                        width={100}
                        height={28}
                        className="h-6 w-auto opacity-60"
                    />
                    <p className="text-black/40 text-sm">
                        © {new Date().getFullYear()} E8 Productions. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE  — orchestrates gate vs. unlocked state
   ═══════════════════════════════════════════════════════════════════ */
export default function PortfolioPage() {
    const [unlocked, setUnlocked] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        // Check if already unlocked in this session
        const stored = sessionStorage.getItem('portfolio_unlocked');
        if (stored === '1') setUnlocked(true);
        setCheckingSession(false);
    }, []);

    if (checkingSession) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-black/20" />
            </div>
        );
    }

    if (!unlocked) {
        return <GateForm onUnlock={() => setUnlocked(true)} />;
    }

    return <PortfolioContent />;
}
