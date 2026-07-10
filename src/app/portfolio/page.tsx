'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    X, Play, Maximize2, ChevronDown, Film, Video, Scissors, Camera, Mic,
    Lock, ArrowRight, Loader2, Check, Phone, Mail, User, Briefcase,
    Clapperboard, Smartphone, Home, Car, Package, ImageIcon, ChevronRight,
    Settings, LayoutGrid, Calendar, CheckCircle, Layers, Star, Gift,
    MessageSquare, Wind, TrendingUp, MessageCircle, Zap, FileText, ArrowLeftRight,
    Users, ExternalLink,
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

interface Subcategory {
    key: string;
    label: string;
    icon: string;
    isActive: boolean;
}

interface Category {
    key: string;
    label: string;
    icon: string;
    isActive: boolean;
    subcategories: Subcategory[];
}

/* ───────────────────────── constants ───────────────────────────── */
const SERVICE_OPTIONS = [
    'Social Media Management',
    'Short-Form Video (Reels / TikTok)',
    'Brand Story Video',
    'Product & Service Showcase',
    'Social Media Ads',
    'Full Content Package',
    'Other',
];

const ICON_MAP: Record<string, any> = {
    Film, Video, Scissors, Camera, Mic, Clapperboard, Smartphone, Home, Car,
    Package, ImageIcon, LayoutGrid, Layers, Star, Gift, MessageSquare, Wind,
    TrendingUp, MessageCircle, Zap, FileText, ArrowLeftRight, Users,
};

/* "who-we-work-with" renders channel cards (name, avatar, follower count)
   instead of the usual video grid. */
const CHANNEL_CARD_SUBCATEGORY = 'who-we-work-with';

interface PortfolioChannel {
    id: string;
    name: string;
    channelUrl: string;
    avatarUrl: string | null;
    followerCount: string;
    category: string;
}

/* ──────── helper: extract embed url from YouTube / Vimeo ──────── */
function getEmbedUrl(url: string): string {
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

    const vmMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;

    return url;
}

function getThumbnailFromUrl(url: string): string | null {
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    return null;
}

function isVerticalUrl(url: string): boolean {
    return /youtube\.com\/shorts\//.test(url);
}

/* ──────── helper: find category & subcategory info ──────── */
function findSubcategoryInfo(subKey: string, categories: Category[]) {
    for (const cat of categories) {
        const sub = cat.subcategories.find((s) => s.key === subKey);
        if (sub) return { category: cat, subcategory: sub };
    }
    return null;
}

/* ═══════════════════════════════════════════════════════════════════
   LAZY VIDEO CARD  — uses IntersectionObserver for lazy loading
   ═══════════════════════════════════════════════════════════════════ */
function LazyVideoCard({
    video,
    vertical = false,
    onExpand,
}: {
    video: PortfolioVideo;
    vertical?: boolean;
    onExpand: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(el);
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const thumb = video.thumbnailUrl || getThumbnailFromUrl(video.videoUrl);

    return (
        <div
            ref={ref}
            className="group bg-white border border-black/5 rounded-2xl overflow-hidden hover:shadow-xl hover:border-black/10 transition-all duration-300"
        >
            {/* Video / Thumbnail area */}
            <div className={`relative overflow-hidden bg-black ${vertical ? 'aspect-[9/16]' : 'aspect-video'}`}>
                {playing ? (
                    <>
                        <iframe
                            src={`${getEmbedUrl(video.videoUrl)}?autoplay=1`}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={video.title}
                        />
                        {/* Expand button while playing */}
                        <button
                            onClick={onExpand}
                            className="absolute top-2 right-2 z-10 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg flex items-center justify-center transition-colors"
                            title="Expand"
                        >
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                        </button>
                    </>
                ) : (
                    <>
                        {isVisible && thumb ? (
                            <img
                                src={thumb}
                                alt={video.title}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                        ) : (
                            <div className="w-full h-full bg-black/[0.05] animate-pulse" />
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                        {/* Play button */}
                        <button
                            onClick={() => setPlaying(true)}
                            className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        >
                            <div className="w-14 h-14 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                                <Play className="w-6 h-6 text-black ml-1" fill="black" />
                            </div>
                        </button>
                        {/* Expand button on hover */}
                        <button
                            onClick={onExpand}
                            className="absolute top-2 right-2 w-8 h-8 bg-black/40 hover:bg-black/70 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                            title="Expand"
                        >
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                        </button>
                    </>
                )}
            </div>

            {/* Info — hide while playing */}
            {!playing && (
                <div className="p-3 sm:p-4">
                    <h3 className="text-sm font-semibold text-black line-clamp-1">
                        {video.title}
                    </h3>
                    {video.description && (
                        <p className="text-xs text-black/50 mt-0.5 line-clamp-2">
                            {video.description}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
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
    const [honeypot, setHoneypot] = useState(''); // anti-spam

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
        // Anti-spam: if honeypot field is filled, silently "succeed"
        if (honeypot) {
            sessionStorage.setItem('portfolio_unlocked', '1');
            onUnlock();
            return;
        }
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
                            priority
                        />
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/[0.04] rounded-full text-xs font-semibold text-black/50 uppercase tracking-wider mb-4">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Social Media for Small Business
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-black text-center leading-tight">
                            See What We Can Do<br />For Your Business
                        </h1>
                        <p className="text-black/50 text-sm sm:text-base mt-2 text-center max-w-sm leading-relaxed">
                            Enter your details for instant access to our portfolio — real social media content built for small businesses like yours.
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

                        {/* Honeypot — hidden from real users, visible to bots */}
                        <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
                            <input
                                type="text"
                                name="website"
                                tabIndex={-1}
                                autoComplete="off"
                                value={honeypot}
                                onChange={(e) => setHoneypot(e.target.value)}
                            />
                        </div>

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
                    {/* </button>
                </div>
            </div> */}

            </button>

                    {/* Privacy notice */}
                    <p className="mt-3 text-center text-[11px] text-black/40 leading-relaxed">
                        By submitting, you agree to our{" "}
                        <a href="/privacy" className="underline hover:text-black/60 transition-colors">
                            Privacy Policy
                        </a>
                        . We may contact you about our services.
                    </p>
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
   MOBILE ACCORDION ITEM  — extracted to properly use React hooks
   ═══════════════════════════════════════════════════════════════════ */
function MobileAccordionItem({
    category,
    isActive,
    activeSubcategory,
    onSelectSub,
}: {
    category: Category;
    isActive: boolean;
    activeSubcategory: string;
    onSelectSub: (subKey: string) => void;
}) {
    const [expanded, setExpanded] = useState(isActive);
    const Icon = ICON_MAP[category.icon as string] || Film;

    return (
        <div className="mb-1">
            {/* Category header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-3 w-full px-4 py-3 text-base font-semibold rounded-xl transition-all ${isActive
                    ? 'bg-black/5 text-black'
                    : 'text-black/70 hover:text-black hover:bg-black/[0.03]'
                    }`}
            >
                <Icon className="w-5 h-5" />
                <span className="flex-1 text-left">{category.label}</span>
                <ChevronDown className={`w-4 h-4 text-black/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Subcategories */}
            {expanded && (
                <div className="ml-4 pl-4 border-l-2 border-black/5 mt-1 mb-2 space-y-0.5">
                    {category.subcategories.map((sub) => {
                        const SubIcon = ICON_MAP[sub.icon as string] || Video;
                        const isSubActive = activeSubcategory === sub.key;
                        return (
                            <button
                                key={sub.key}
                                onClick={() => onSelectSub(sub.key)}
                                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm rounded-lg transition-all ${isSubActive
                                    ? 'bg-black text-white font-medium'
                                    : 'text-black/60 hover:text-black hover:bg-black/5'
                                    }`}
                            >
                                <SubIcon className="w-4 h-4" />
                                {sub.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO NAV  — 3 main categories with subcategory dropdowns
   ═══════════════════════════════════════════════════════════════════ */
function PortfolioNav({
    activeCategory,
    activeSubcategory,
    onSelectSub,
    categories,
    showHowItWorks,
    onToggleHowItWorks,
}: {
    activeCategory: string;
    activeSubcategory: string;
    onSelectSub: (catKey: string, subKey: string) => void;
    categories: Category[];
    showHowItWorks: boolean;
    onToggleHowItWorks: () => void;
}) {
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const handleBookMeeting = () => {
        window.open('https://calendly.com/e8productions', '_blank');
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-nav-dropdown]')) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/[0.06]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center h-14 sm:h-16 gap-3">

                    {/* Logo */}
                    <div className="shrink-0">
                        <Link href="/" className="transition-opacity hover:opacity-60">
                            <Image src={logoImage} alt="E8 Productions" width={120} height={32} className="h-6 sm:h-8 w-auto" priority />
                        </Link>
                    </div>

                    {/* Desktop nav — true center */}
                    <div className="hidden lg:flex items-center gap-1.5 flex-1 justify-center">
                        {categories.filter(c => c.isActive).map((cat) => {
                            const Icon = ICON_MAP[cat.icon as string] || Film;
                            const isActive = activeCategory === cat.key && !showHowItWorks;
                            const isOpen = openDropdown === cat.key;

                            return (
                                <div key={cat.key} className="relative" data-nav-dropdown>
                                    <button
                                        onClick={() => {
                                            const next = isOpen ? null : cat.key;
                                            setOpenDropdown(next);
                                            if (!isActive) {
                                                const firstSub = cat.subcategories.find(s => s.isActive);
                                                if (firstSub) onSelectSub(cat.key, firstSub.key);
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 border ${
                                            isActive
                                                ? 'bg-black text-white border-black shadow-sm'
                                                : 'bg-white text-black border-black/15 hover:border-black/30 hover:bg-black/[0.03]'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        {cat.label}
                                        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    <div
                                        className={`absolute top-full left-1/2 -translate-x-1/2 mt-2.5 w-64 bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.14)] border border-black/[0.06] overflow-hidden transition-all duration-200 origin-top z-50 ${
                                            isOpen
                                                ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
                                                : 'opacity-0 -translate-y-2 pointer-events-none scale-95'
                                        }`}
                                    >
                                        <div className="p-2 space-y-0.5">
                                            {cat.subcategories.filter(s => s.isActive).map((sub) => {
                                                const SubIcon = ICON_MAP[sub.icon as string] || Video;
                                                const isSubActive = activeSubcategory === sub.key;
                                                return (
                                                    <button
                                                        key={sub.key}
                                                        onClick={() => {
                                                            onSelectSub(cat.key, sub.key);
                                                            setOpenDropdown(null);
                                                        }}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                                                            isSubActive
                                                                ? 'bg-black text-white'
                                                                : 'text-black/70 hover:bg-black/[0.04] hover:text-black'
                                                        }`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSubActive ? 'bg-white/15' : 'bg-black/[0.06]'}`}>
                                                            <SubIcon className="w-4 h-4" />
                                                        </div>
                                                        <span className="flex-1 text-left font-semibold">{sub.label}</span>
                                                        {isSubActive && <CheckCircle className="w-4 h-4 shrink-0 opacity-80" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <button
                            onClick={onToggleHowItWorks}
                            className={`flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 border ${
                                showHowItWorks
                                    ? 'bg-black text-white border-black shadow-sm'
                                    : 'bg-white text-black border-black/15 hover:border-black/30 hover:bg-black/[0.03]'
                            }`}
                        >
                            How It Works
                        </button>
                    </div>

                    {/* Book Meeting */}
                    <div className="hidden lg:flex items-center shrink-0">
                        <button
                            onClick={handleBookMeeting}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black text-white text-sm font-bold hover:bg-black/80 active:scale-95 transition-all"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            Book Meeting
                        </button>
                    </div>

                    {/* Mobile: Book Meeting button (compact) */}
                    <div className="lg:hidden">
                        <button
                            onClick={handleBookMeeting}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black text-white text-xs font-bold active:scale-95 transition-all"
                        >
                            <Calendar className="w-3 h-3" />
                            Book
                        </button>
                    </div>
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
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handler);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handler);
        };
    }, [onClose]);

    const vertical = isVerticalUrl(video.videoUrl);

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className={`relative bg-black rounded-2xl overflow-hidden shadow-2xl animate-modal-in ${
                    vertical
                        ? 'h-[88vh] aspect-[9/16]'
                        : 'w-full max-w-5xl'
                }`}
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
                <div className={`w-full ${vertical ? 'h-full' : 'aspect-video'}`}>
                    <iframe
                        src={getEmbedUrl(video.videoUrl) + '?autoplay=1'}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={video.title}
                    />
                </div>

                {/* Title bar — only for horizontal */}
                {!vertical && (
                    <div className="p-4 sm:p-6 bg-gradient-to-t from-black to-black/90">
                        <h3 className="text-white text-lg sm:text-xl font-semibold">
                            {video.title}
                        </h3>
                        {video.description && (
                            <p className="text-white/60 text-sm mt-1">{video.description}</p>
                        )}
                    </div>
                )}
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
   VIDEO GRID  — clean grid with lazy-loaded video cards
   ═══════════════════════════════════════════════════════════════════ */
function VideoGrid({
    videos,
    loading,
}: {
    videos: PortfolioVideo[];
    loading: boolean;
}) {
    const [expanded, setExpanded] = useState<PortfolioVideo | null>(null);
    const isVerticalGrid = videos.length > 0 && videos.some(v => isVerticalUrl(v.videoUrl));

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white border border-black/5 rounded-2xl overflow-hidden">
                        <div className="aspect-video bg-black/[0.03] animate-pulse" />
                        <div className="p-3 space-y-2">
                            <div className="h-4 bg-black/[0.06] rounded-lg w-3/4 animate-pulse" />
                        </div>
                    </div>
                ))}
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
                    Content for this category is being prepared. Check back soon!
                </p>
            </div>
        );
    }

    const gridClass = isVerticalGrid
        ? 'grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6';

    return (
        <>
            <div className={gridClass}>
                {videos.map((video) => (
                    <LazyVideoCard
                        key={video.id}
                        video={video}
                        vertical={isVerticalUrl(video.videoUrl)}
                        onExpand={() => setExpanded(video)}
                    />
                ))}
            </div>
            {expanded && (
                <VideoModal video={expanded} onClose={() => setExpanded(null)} />
            )}
        </>
    );
}

function ChannelGrid({
    channels,
    loading,
}: {
    channels: PortfolioChannel[];
    loading: boolean;
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center text-center gap-3 p-4">
                        <div className="w-20 h-20 rounded-full bg-black/[0.06] animate-pulse" />
                        <div className="h-4 bg-black/[0.06] rounded-lg w-3/4 animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    if (channels.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center px-4">
                <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mb-4">
                    <Users className="w-7 h-7 text-black/30" />
                </div>
                <h3 className="text-lg font-semibold text-black/70 mb-1">
                    Coming Soon
                </h3>
                <p className="text-black/40 text-sm max-w-sm">
                    Content for this category is being prepared. Check back soon!
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
            {channels.map((channel) => (
                <a
                    key={channel.id}
                    href={channel.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center text-center gap-3 p-4 rounded-2xl border border-black/5 hover:border-black/15 hover:shadow-lg hover:shadow-black/5 transition-all"
                >
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-black/5 shrink-0">
                        {channel.avatarUrl ? (
                            <img
                                src={channel.avatarUrl}
                                alt={channel.name}
                                loading="lazy"
                                decoding="async"
                                width={80}
                                height={80}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Users className="w-7 h-7 text-black/30" />
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="font-semibold text-black flex items-center justify-center gap-1">
                            {channel.name}
                            <ExternalLink className="w-3.5 h-3.5 text-blue-500 group-hover:text-blue-600 transition-colors" />
                        </p>
                        {channel.followerCount && (
                            <p className="text-sm text-black/50">{channel.followerCount}</p>
                        )}
                    </div>
                </a>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO CONTENT  — the unlocked portfolio page
   ═══════════════════════════════════════════════════════════════════ */
function PortfolioContent() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [activeSubcategory, setActiveSubcategory] = useState('');
    const [videos, setVideos] = useState<PortfolioVideo[]>([]);
    const [channels, setChannels] = useState<PortfolioChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [navLoading, setNavLoading] = useState(true);
    const [showHowItWorks, setShowHowItWorks] = useState(false);

    const fetchSections = useCallback(async () => {
        try {
            const res = await fetch('/api/portfolio/sections');
            const data = await res.json();
            if (data.ok) {
                const activeCats = data.sections.filter((c: Category) => c.isActive);
                setCategories(activeCats);
                // Set default if not set
                if (activeCats.length > 0) {
                    const firstCat = activeCats[0];
                    const firstSub = firstCat.subcategories.find((s: Subcategory) => s.isActive);
                    if (firstSub) {
                        setActiveCategory(firstCat.key);
                        setActiveSubcategory(firstSub.key);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch sections', err);
        } finally {
            setNavLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSections();
    }, [fetchSections]);

    const handleSelectSub = useCallback((catKey: string, subKey: string) => {
        setActiveCategory(catKey);
        setActiveSubcategory(subKey);
        setShowHowItWorks(false);
    }, []);

    const fetchVideos = useCallback(async (subcategory: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/portfolio/videos?category=${subcategory}`);
            const data = await res.json();
            if (data.ok) setVideos(data.videos);
        } catch (err) {
            console.error('Failed to fetch videos', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchChannels = useCallback(async (subcategory: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/portfolio/channels?category=${subcategory}`);
            const data = await res.json();
            if (data.ok) setChannels(data.channels);
        } catch (err) {
            console.error('Failed to fetch channels', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!activeSubcategory) return;
        if (activeSubcategory === CHANNEL_CARD_SUBCATEGORY) {
            fetchChannels(activeSubcategory);
        } else {
            fetchVideos(activeSubcategory);
        }
    }, [activeSubcategory, fetchVideos, fetchChannels]);

    const info = findSubcategoryInfo(activeSubcategory, categories);
    const parentCat = categories.find((c) => c.key === activeCategory);

    if (navLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-black/20" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            <PortfolioNav
                activeCategory={activeCategory}
                activeSubcategory={activeSubcategory}
                onSelectSub={handleSelectSub}
                categories={categories}
                showHowItWorks={showHowItWorks}
                onToggleHowItWorks={() => setShowHowItWorks(v => !v)}
            />

            <div className="pt-14 sm:pt-16">
                <div className="h-6 sm:h-10" />
                {/* Mobile navigation — sticky pill rows */}
                <div className="lg:hidden sticky top-14 z-40 bg-white border-b border-black/[0.06]">
                    {/* Category row */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3 pb-2">
                        {categories.filter(c => c.isActive).map((cat) => {
                            const Icon = ICON_MAP[cat.icon as string] || Film;
                            const firstSub = cat.subcategories.find(s => s.isActive);
                            const isActive = activeCategory === cat.key && !showHowItWorks;
                            return (
                                <button
                                    key={cat.key}
                                    onClick={() => { if (firstSub) handleSelectSub(cat.key, firstSub.key); }}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm whitespace-nowrap shrink-0 font-bold border transition-all ${
                                        isActive
                                            ? 'bg-black text-white border-black'
                                            : 'bg-white text-black/60 border-black/15'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {cat.label}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setShowHowItWorks(v => !v)}
                            className={`flex items-center px-4 py-2 rounded-full text-sm whitespace-nowrap shrink-0 font-bold border transition-all ${
                                showHowItWorks
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-black/60 border-black/15'
                            }`}
                        >
                            How It Works
                        </button>
                    </div>
                    {/* Subcategory row */}
                    {parentCat && !showHowItWorks && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
                            {parentCat.subcategories.filter(s => s.isActive).map((sub) => {
                                const SubIcon = ICON_MAP[sub.icon as string] || Video;
                                const isSubActive = activeSubcategory === sub.key;
                                return (
                                    <button
                                        key={sub.key}
                                        onClick={() => handleSelectSub(activeCategory, sub.key)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0 font-semibold border transition-all ${
                                            isSubActive
                                                ? 'bg-black/[0.07] text-black border-black/20'
                                                : 'text-black/45 border-black/10'
                                        }`}
                                    >
                                        <SubIcon className="w-3 h-3" />
                                        {sub.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* How It Works inline video OR Video Grid */}
                {showHowItWorks ? (
                    <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 bg-white">
                        <div className="max-w-4xl mx-auto">
                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-xl shadow-black/10 bg-black">
                                <iframe
                                    src="https://www.youtube.com/embed/3OaMtTJs6dw"
                                    className="absolute inset-0 w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    title="How It Works"
                                />
                            </div>
                        </div>
                    </section>
                ) : (
                    <section className="px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 bg-white">
                        <div className="max-w-7xl mx-auto">
                            {activeSubcategory === CHANNEL_CARD_SUBCATEGORY ? (
                                <ChannelGrid channels={channels} loading={loading} />
                            ) : (
                                <VideoGrid videos={videos} loading={loading} />
                            )}
                        </div>
                    </section>
                )}
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
                    <Link href="/legal" className="text-black/40 hover:text-black/70 text-sm transition-colors">
                        Legal
                    </Link>
                </div>
            </footer>

            {/* Global styles for subcategory nav animation */}
            <style jsx global>{`
                @keyframes subnavIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-subnav-in { animation: subnavIn 0.2s cubic-bezier(0.16,1,0.3,1) both; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE  — orchestrates gate vs. unlocked state
   ═══════════════════════════════════════════════════════════════════ */
export default function PortfolioPage() {
    const [unlocked, setUnlocked] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (sessionStorage.getItem('portfolio_unlocked') === '1') {
                if (!cancelled) {
                    setUnlocked(true);
                    setChecked(true);
                }
                return;
            }

            // Logged-in admins skip the lead-gate form. The role check happens
            // server-side against the authToken cookie — client only sees the
            // resulting role, so this can't be spoofed from the browser.
            try {
                const res = await fetch('/api/auth/me');
                const data = await res.json();
                if (!cancelled && data.user?.role === 'admin') {
                    setUnlocked(true);
                }
            } catch {
                // ignore — fall through to gate form
            }

            if (!cancelled) setChecked(true);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    if (!checked) return null;

    if (!unlocked) {
        return <GateForm onUnlock={() => setUnlocked(true)} />;
    }

    return <PortfolioContent />;
}