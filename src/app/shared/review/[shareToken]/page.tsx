'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FullScreenReviewModalFrameIO } from '@/components/client/FullScreenReviewModalFrameIO';
import { E8Logo } from '@/components/ui/E8Logo';
import {
    AlertCircle, Lock, Clock, Eye, Link as LinkIcon, ExternalLink, ArrowRight,
    ChevronDown, Mail, Video, FileText, Image as ImageIcon, File as FileIcon,
} from 'lucide-react';

interface SharedReviewData {
    task: {
        id: string;
        title: string;
        description: string;
        status?: string;
        driveLinks: string[];
        files: any[];
        client?: any;
        monthlyDeliverable?: any;
        createdAt: string;
        socialMediaLinks?: any;
    };
    shareInfo: {
        viewCount: number;
        expiresAt: string | null;
    };
}

// What a resource link points at, from its file extension — drives the icon
// tile and the "Video · MP4" caption in the Resource Links card.
function describeLink(link: string) {
    let name = 'External Resource';
    let host = '';
    let ext = '';
    try {
        const url = new URL(link);
        host = url.hostname;
        const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
        if (last) name = last;
        const m = last.match(/\.([a-z0-9]{2,5})$/i);
        ext = m ? m[1].toLowerCase() : '';
    } catch {
        name = link.split('/').pop()?.split('?')[0] || name;
    }
    const upper = ext.toUpperCase();
    if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(ext)) return { name, kind: `Video · ${upper}`, Icon: Video };
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return { name, kind: `Image · ${upper}`, Icon: ImageIcon };
    if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return { name, kind: `Document · ${upper}`, Icon: FileText };
    return { name, kind: host || 'Link', Icon: FileIcon };
}

export default function SharedReviewPage() {
    const params = useParams();
    const shareToken = params.shareToken as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reviewData, setReviewData] = useState<SharedReviewData | null>(null);
    const [showReview, setShowReview] = useState(false);
    const [linksOpen, setLinksOpen] = useState(true);

    // No account, no password — just a name, so the activity log (and any
    // team member reading the feedback) knows who actually reviewed it.
    // Remembered across links/visits in this browser so returning clients
    // aren't asked again.
    const [reviewerName, setReviewerName] = useState('');
    useEffect(() => {
        try {
            const saved = window.localStorage.getItem('e8_reviewer_name');
            if (saved) setReviewerName(saved);
        } catch {
            // localStorage can throw in private/blocked-storage browsers — fine, just re-ask.
        }
    }, []);

    const confirmReviewerName = (name: string) => {
        const trimmed = name.trim();
        setReviewerName(trimmed);
        try {
            window.localStorage.setItem('e8_reviewer_name', trimmed);
        } catch {
            // Best-effort only — not having it persist just means re-asking next visit.
        }
    };

    useEffect(() => {
        if (shareToken) {
            loadSharedReview();
        }
    }, [shareToken]);

    const loadSharedReview = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/shared/${shareToken}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load shared review');
            }

            setReviewData(data);
            setShowReview(true);
        } catch (err: any) {
            console.error('Error loading shared review:', err);
            setError(err.message || 'Failed to load shared review');
        } finally {
            setLoading(false);
        }
    };

    // Convert task data to ReviewAsset format for the modal
    const getReviewAsset = () => {
        if (!reviewData?.task) return null;

        const task = reviewData.task;
        const files = task.files || [];

        // Get the primary video file (prefer main folder, then raw, then any video)
        const primaryFile = files.find((f: any) =>
            f.folderType === 'main' && f.mimeType?.startsWith('video/')
        ) || files.find((f: any) =>
            f.mimeType?.startsWith('video/')
        );

        // Group files by folder type for versions
        const filesByFolder = files.reduce((acc: any, file: any) => {
            const folder = file.folderType || 'main';
            if (!acc[folder]) acc[folder] = [];
            acc[folder].push(file);
            return acc;
        }, {});

        // Create versions from files
        const versions = Object.entries(filesByFolder).map(([folderType, folderFiles]: [string, any]) => {
            const latestFile = (folderFiles as any[]).sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0];

            return {
                id: latestFile.id,
                number: `${folderType} v${latestFile.version || 1}`,
                thumbnail: '/placeholder-video.png',
                duration: formatFileSize(latestFile.size),
                uploadDate: new Date(latestFile.uploadedAt).toLocaleDateString(),
                status: 'client_review' as const,
                url: latestFile.url,
                sizeBytes: latestFile.size,
            };
        });

        return {
            id: task.id,
            title: task.title || 'Review Task',
            subtitle: task.client?.companyName || task.client?.name,
            videoUrl: primaryFile?.url || files[0]?.url || '',
            thumbnail: '/placeholder-video.png',
            runtime: task.monthlyDeliverable?.type || 'Video',
            status: 'client_review' as const,
            client: task.client?.name || 'Client',
            platform: task.monthlyDeliverable?.platforms?.[0] || 'Various',
            resolution: '1920x1080',
            fileSize: formatFileSize(primaryFile?.size || 0),
            fileSizeBytes: primaryFile?.size || 0,
            uploader: 'E8 Productions',
            uploadDate: new Date(task.createdAt).toLocaleDateString(),
            versions: versions.length > 0 ? versions : [{
                id: '1',
                number: '1',
                thumbnail: '/placeholder-video.png',
                duration: '0:00',
                uploadDate: new Date().toLocaleDateString(),
                status: 'client_review' as const,
                url: primaryFile?.url || '',
                sizeBytes: primaryFile?.size || 0,
            }],
            currentVersion: versions[0]?.id || '1',
            downloadEnabled: false,
            // Approving/requesting changes works via the share token (see the
            // passwordless flow in PATCH /api/tasks/[id]/status). Only lock once
            // the task is already approved/scheduled — same rule as the client portal.
            approvalLocked: task.status === 'COMPLETED' || task.status === 'SCHEDULED',
        };
    };

    // Scopes fetched/submitted feedback to the exact file version being
    // shown — without this, FullScreenReviewModalFrameIO falls back to
    // folder-only filtering and resurfaces unresolved comments from every
    // earlier (already-replaced) file version on this share link.
    const getCurrentFileSection = () => {
        if (!reviewData?.task) return undefined;
        const files = reviewData.task.files || [];
        const primaryFile = files.find((f: any) =>
            f.folderType === 'main' && f.mimeType?.startsWith('video/')
        ) || files.find((f: any) => f.mimeType?.startsWith('video/'));
        if (!primaryFile) return undefined;
        return {
            folderType: primaryFile.folderType || 'main',
            fileId: primaryFile.id,
            version: primaryFile.version || 1,
        };
    };

    const formatFileSize = (bytes: number | bigint) => {
        const size = Number(bytes);
        if (size === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return Math.round((size / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    // Shared light page chrome for the loading / error / landing states.
    const pageShell = 'min-h-screen bg-[#f3f3f3] text-[#0a0a0a] antialiased';

    if (loading) {
        return (
            <div className={`${pageShell} flex items-center justify-center`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-neutral-300 border-t-black mx-auto mb-4" />
                    <h3 className="text-base font-semibold">Loading review…</h3>
                    <p className="text-sm text-neutral-500 mt-1">Please wait while we load the shared content</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`${pageShell} flex items-center justify-center p-4`}>
                <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-10 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-5" />
                    <h3 className="text-xl font-bold mb-2">Unable to load review</h3>
                    <p className="text-sm text-neutral-500 mb-6">{error}</p>
                    {error.includes('expired') && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-6 text-sm text-amber-800">
                            <Clock className="h-4 w-4" /> This share link has expired
                        </div>
                    )}
                    {error.includes('deactivated') && (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-6 text-sm text-red-800">
                            <Lock className="h-4 w-4" /> This share link is no longer active
                        </div>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="h-11 px-6 rounded-xl bg-black text-white text-sm font-semibold hover:bg-neutral-800 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    const asset = getReviewAsset();

    const links = reviewData?.task.driveLinks ?? [];
    const canOpen = !!reviewerName.trim();

    return (
        <div className={pageShell}>
            {/* Header */}
            <header className="bg-white border-b border-neutral-200">
                <div className="max-w-5xl mx-auto h-[72px] px-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <E8Logo height={30} color="#000" />
                        <span className="h-7 w-px bg-neutral-300" />
                        <h1 className="text-base font-semibold">Shared Client Review</h1>
                    </div>
                    {reviewData?.shareInfo && (
                        <div className="flex items-center gap-4 text-sm text-neutral-500">
                            <span className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                {reviewData.shareInfo.viewCount} view{reviewData.shareInfo.viewCount === 1 ? '' : 's'}
                            </span>
                            {reviewData.shareInfo.expiresAt && (
                                <span className="hidden sm:flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Expires {new Date(reviewData.shareInfo.expiresAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Review Modal */}
            {asset && (
                <FullScreenReviewModalFrameIO
                    open={showReview}
                    onOpenChange={setShowReview}
                    asset={asset}
                    onApprove={async (asset, confirmFinal) => {
                        try {
                            const res = await fetch(`/api/tasks/${reviewData?.task.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    status: 'COMPLETED',
                                    shareToken: shareToken,
                                    reviewerName
                                }),
                            });
                            if (res.ok) {
                                alert('Thank you! This version has been approved. The E8 team will be notified.');
                                window.location.reload();
                            } else {
                                const data = await res.json();
                                alert(`Feedback could not be submitted: ${data.message || data.error}`);
                            }
                        } catch (err) {
                            console.error(err);
                            alert('An error occurred. Please try again.');
                        }
                    }}
                    onRequestRevisions={async (asset, revisionData) => {
                        try {
                            const res = await fetch(`/api/tasks/${reviewData?.task.id}/status`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    status: 'REJECTED_BY_CLIENT',
                                    feedback: revisionData.notes,
                                    shareToken: shareToken,
                                    reviewerName
                                }),
                            });
                            if (res.ok) {
                                alert('Feedback submitted successfully! Our team will work on the revisions.');
                                window.location.reload();
                            } else {
                                const data = await res.json();
                                alert(`Feedback could not be submitted: ${data.message || data.error}`);
                            }
                        } catch (err) {
                            console.error(err);
                            alert('An error occurred. Please try again.');
                        }
                    }}
                    userRole="client"
                    taskId={reviewData?.task.id}
                    currentFileSection={getCurrentFileSection()}
                    shareToken={shareToken}
                />
            )}

            {/* Landing page when the review is closed */}
            {!showReview && asset && (
                <main className="max-w-[560px] mx-auto px-4 pt-14 pb-16 space-y-5">
                    <section className="rounded-[28px] border border-neutral-200 bg-white px-10 py-9">
                        <div className="text-center">
                            {asset.subtitle && (
                                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{asset.subtitle}</p>
                            )}
                            <h2 className="mt-2 text-[22px] leading-tight font-extrabold break-words">{asset.title}</h2>
                            <p className="mt-2 text-sm text-neutral-600">Shared by E8 Productions for your review.</p>
                        </div>

                        <form
                            className="mt-8"
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!canOpen) return;
                                confirmReviewerName(reviewerName);
                                setShowReview(true);
                            }}
                        >
                            <label htmlFor="reviewer-name" className="block text-sm font-semibold mb-2">Your name</label>
                            <input
                                id="reviewer-name"
                                type="text"
                                value={reviewerName}
                                onChange={(e) => setReviewerName(e.target.value)}
                                placeholder="e.g. Jane Smith"
                                autoComplete="name"
                                className="w-full h-12 rounded-xl border border-neutral-300 bg-white px-4 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                            />
                            <button
                                type="submit"
                                disabled={!canOpen}
                                className="mt-4 w-full h-12 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed"
                            >
                                Open Visual Review <ArrowRight className="h-4 w-4" />
                            </button>
                            <p className="mt-4 text-center text-xs text-neutral-500">
                                By continuing, you agree to the{' '}
                                <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold underline text-neutral-700">Terms of Service</a>{' '}
                                and{' '}
                                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline text-neutral-700">Privacy Policy</a>.
                            </p>
                        </form>
                    </section>

                    {links.length > 0 && (
                        <section className="rounded-[28px] border border-neutral-200 bg-white px-4 py-4">
                            <button
                                type="button"
                                onClick={() => setLinksOpen(o => !o)}
                                aria-expanded={linksOpen}
                                className="w-full flex items-center justify-between px-3 py-2 text-neutral-500"
                            >
                                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                    <LinkIcon className="h-4 w-4" /> Resource links
                                </span>
                                <span className="flex items-center gap-2 text-sm">
                                    {links.length} file{links.length === 1 ? '' : 's'}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${linksOpen ? 'rotate-180' : ''}`} />
                                </span>
                            </button>
                            {linksOpen && (
                                <div className="mt-3 space-y-3">
                                    {links.map((link, idx) => {
                                        const { name, kind, Icon } = describeLink(link);
                                        return (
                                            <a
                                                key={idx}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-3 hover:border-neutral-400 transition-colors"
                                            >
                                                <span className="h-12 w-12 shrink-0 rounded-xl bg-neutral-200 flex items-center justify-center">
                                                    <Icon className="h-5 w-5 text-neutral-800" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[15px] font-bold" title={name}>{name}</span>
                                                    <span className="block text-sm text-neutral-500">{kind}</span>
                                                </span>
                                                <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-black transition-colors" />
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}

                    <footer className="border-t border-neutral-300 pt-4 px-1 flex items-center justify-between gap-4 text-sm text-neutral-500">
                        <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> View-only link for feedback</span>
                        <a href="mailto:support@e8productions.com" className="flex items-center gap-2 font-semibold text-neutral-700 hover:text-black">
                            <Mail className="h-4 w-4" /> support@e8productions.com
                        </a>
                    </footer>
                </main>
            )}
        </div>
    );
}
