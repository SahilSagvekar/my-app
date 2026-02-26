'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    X, Play, ChevronDown, Film, Video, Scissors, Camera, Mic,
    Lock, ArrowRight, Loader2, Check, Phone, Mail, User, Briefcase,
    Clapperboard, Smartphone, Home, Car, Package, ImageIcon, ChevronRight,
    Settings, LayoutGrid, Calendar, CheckCircle
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
    'Videography',
    'Video Editing',
    'Build A Show',
    'Social Media Management',
    'Multiple Services',
    'Other',
];

const ICON_MAP: Record<string, any> = {
    Film, Video, Scissors, Camera, Mic, Clapperboard, Smartphone, Home, Car, Package, ImageIcon, LayoutGrid
};

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
    onExpand,
}: {
    video: PortfolioVideo;
    onExpand: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

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
            onClick={onExpand}
            className="group cursor-pointer bg-white border border-black/5 rounded-2xl overflow-hidden hover:shadow-xl hover:border-black/10 active:scale-[0.98] transition-all duration-300"
        >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden bg-black/5">
                {isVisible ? (
                    thumb ? (
                        <img
                            src={thumb}
                            alt={video.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-black/10 to-black/5 flex items-center justify-center">
                            <Film className="w-10 h-10 text-black/20" />
                        </div>
                    )
                ) : (
                    <div className="w-full h-full bg-black/[0.03] animate-pulse" />
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
    const Icon = category.icon;

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
                        const SubIcon = sub.icon;
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
}: {
    activeCategory: string;
    activeSubcategory: string;
    onSelectSub: (catKey: string, subKey: string) => void;
    categories: Category[];
}) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleBookMeeting = () => {
        const calendlyUrl = 'https://calendly.com/e8productions'; // Placeholder, should be configurable
        if ((window as any).Calendly) {
            (window as any).Calendly.initPopupWidget({ url: calendlyUrl });
        } else {
            window.open(calendlyUrl, '_blank');
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-nav-dropdown]')) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    const handleMouseEnter = (catKey: string) => {
        if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
        setOpenDropdown(catKey);
    };

    const handleMouseLeave = () => {
        dropdownTimeoutRef.current = setTimeout(() => {
            setOpenDropdown(null);
        }, 150);
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 sm:h-16 relative">
                    {/* Logo (Left) */}
                    <div className="flex-shrink-0 z-10">
                        <Link href="/" className="text-black transition-opacity hover:opacity-60">
                            <Image
                                src={logoImage}
                                alt="E8 Productions"
                                width={120}
                                height={32}
                                className="h-6 sm:h-8 w-auto"
                                priority
                            />
                        </Link>
                    </div>

                    {/* Desktop Navigation (Center) */}
                    <div className="hidden lg:flex items-center justify-center gap-1.5 absolute inset-x-0 mx-auto w-fit">
                        {categories.filter(c => c.isActive).map((cat) => {
                            const Icon = ICON_MAP[cat.icon as string] || Film;
                            const isActive = activeCategory === cat.key;
                            const isOpen = openDropdown === cat.key;

                            return (
                                <div
                                    key={cat.key}
                                    className="relative"
                                    data-nav-dropdown
                                    onMouseEnter={() => handleMouseEnter(cat.key)}
                                    onMouseLeave={handleMouseLeave}
                                >
                                    <button
                                        onClick={() => {
                                            setOpenDropdown(isOpen ? null : cat.key);
                                            // Select the first subcategory if clicking a new category
                                            if (!isActive) {
                                                const firstSub = cat.subcategories.find(s => s.isActive);
                                                if (firstSub) onSelectSub(cat.key, firstSub.key);
                                            }
                                        }}
                                        className={`flex items-center gap-1.5 px-6 py-2 rounded-full text-sm font-semibold transition-all ${isActive
                                            ? 'bg-black text-white shadow-lg shadow-black/10'
                                            : 'text-black/60 hover:text-black hover:bg-black/5'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {cat.label}
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Subcategory dropdown */}
                                    {isOpen && (
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-white border border-black/[0.08] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-subnav-in">
                                            <div className="p-2 space-y-1">
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
                                                            className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all ${isSubActive
                                                                ? 'bg-black text-white'
                                                                : 'text-black/70 hover:bg-black/5 hover:text-black'
                                                                }`}
                                                        >
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSubActive ? 'bg-white/20' : 'bg-black/5'}`}>
                                                                <SubIcon className="w-4 h-4 shrink-0" />
                                                            </div>
                                                            <span className="flex-1 text-left font-medium">{sub.label}</span>
                                                            {isSubActive && <CheckCircle className="w-4 h-4 shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Actions (Right) */}
                    <div className="hidden lg:flex items-center gap-4 z-10">
                        <button
                            onClick={handleBookMeeting}
                            className="bg-black text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg shadow-black/10 active:scale-95"
                        >
                            <Calendar className="w-4 h-4" />
                            Book Meeting
                        </button>
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-black z-10"
                        aria-label="Toggle menu"
                    >
                        {/* ... svg remains same ... */}
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

                {/* Mobile Menu — accordion style */}
                {mobileMenuOpen && (
                    <div className="lg:hidden py-3 border-t border-black/5 mt-1 max-h-[70vh] overflow-y-auto">
                        {categories.filter(c => c.isActive).map((cat) => (
                            <MobileAccordionItem
                                key={cat.key}
                                category={cat}
                                isActive={activeCategory === cat.key}
                                activeSubcategory={activeSubcategory}
                                onSelectSub={(subKey) => {
                                    onSelectSub(cat.key, subKey);
                                    setMobileMenuOpen(false);
                                }}
                            />
                        ))}
                    </div>
                )}
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

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white border border-black/5 rounded-2xl overflow-hidden">
                        <div className="aspect-video bg-black/[0.03] animate-pulse" />
                        <div className="p-4 sm:p-5 space-y-2">
                            <div className="h-5 bg-black/[0.06] rounded-lg w-3/4 animate-pulse" />
                            <div className="h-4 bg-black/[0.04] rounded-lg w-1/2 animate-pulse" />
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

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {videos.map((video) => (
                    <LazyVideoCard
                        key={video.id}
                        video={video}
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

/* ═══════════════════════════════════════════════════════════════════
   PORTFOLIO CONTENT  — the unlocked portfolio page
   ═══════════════════════════════════════════════════════════════════ */
function PortfolioContent() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeCategory, setActiveCategory] = useState('');
    const [activeSubcategory, setActiveSubcategory] = useState('');
    const [videos, setVideos] = useState<PortfolioVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [navLoading, setNavLoading] = useState(true);

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

    useEffect(() => {
        if (activeSubcategory) {
            fetchVideos(activeSubcategory);
        }
    }, [activeSubcategory, fetchVideos]);

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
            />

            <div className="pt-14 sm:pt-16">
                {/* Hero */}
                <section className="pt-10 sm:pt-14 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 bg-white">
                    <div className="max-w-7xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black/5 rounded-full text-sm text-black/70 font-medium mb-4">
                            <Check className="w-4 h-4 text-green-600" />
                            Portfolio Unlocked
                        </div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3">
                            Our Creative Portfolio
                        </h1>
                        <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto">
                            Browse our collection of professional video content, videography, and photography across different styles and formats.
                        </p>
                    </div>
                </section>

                {/* Mobile subcategory pills */}
                <section className="px-4 sm:px-6 lg:px-8 pb-4 bg-white lg:hidden">
                    <div className="max-w-7xl mx-auto">
                        {/* Category selector */}
                        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                            {categories.filter(c => c.isActive).map((cat) => {
                                const Icon = ICON_MAP[cat.icon as string] || Film;
                                const firstSub = cat.subcategories.find(s => s.isActive);
                                return (
                                    <button
                                        key={cat.key}
                                        onClick={() => {
                                            if (firstSub) handleSelectSub(cat.key, firstSub.key);
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-all font-semibold ${activeCategory === cat.key
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
                        {/* Subcategory pills */}
                        {parentCat && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {parentCat.subcategories.filter(s => s.isActive).map((sub) => {
                                    const SubIcon = ICON_MAP[sub.icon as string] || Video;
                                    return (
                                        <button
                                            key={sub.key}
                                            onClick={() => handleSelectSub(activeCategory, sub.key)}
                                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs whitespace-nowrap shrink-0 transition-all font-medium ${activeSubcategory === sub.key
                                                ? 'bg-black/10 text-black border border-black/15'
                                                : 'bg-black/[0.02] text-black/50 border border-transparent hover:bg-black/5 hover:text-black/70'
                                                }`}
                                        >
                                            <SubIcon className="w-3.5 h-3.5" />
                                            {sub.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* Section Title with breadcrumb */}
                <section className="px-4 sm:px-6 lg:px-8 pb-4 bg-white">
                    <div className="max-w-7xl mx-auto">
                        {/* Breadcrumb */}
                        {info && (
                            <div className="flex items-center gap-1.5 text-xs text-black/40 mb-3">
                                <span>{info.category.label}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-black/70 font-medium">{info.subcategory.label}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            {info && (
                                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shrink-0">
                                    {(() => {
                                        const SubIcon = ICON_MAP[info.subcategory.icon as string] || Video;
                                        return <SubIcon className="w-5 h-5 text-white" />;
                                    })()}
                                </div>
                            )}
                            <h2 className="text-xl sm:text-2xl font-semibold text-black">
                                {info?.subcategory.label}
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
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
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
