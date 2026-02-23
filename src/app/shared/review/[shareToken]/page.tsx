'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FullScreenReviewModalFrameIO } from '@/components/client/FullScreenReviewModalFrameIO';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Lock, Clock, Eye, Link, ExternalLink, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SharedReviewData {
    task: {
        id: string;
        title: string;
        description: string;
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

export default function SharedReviewPage() {
    const params = useParams();
    const shareToken = params.shareToken as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reviewData, setReviewData] = useState<SharedReviewData | null>(null);
    const [showReview, setShowReview] = useState(false);

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
            }],
            currentVersion: versions[0]?.id || '1',
            downloadEnabled: false,
            approvalLocked: true, // Locked for external viewers
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

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-xl">
                    <CardContent className="p-12 text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-6"></div>
                        <h3 className="text-xl font-medium text-white mb-2">Loading Review...</h3>
                        <p className="text-gray-400">Please wait while we load the shared content</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
                <Card className="bg-gray-800/50 border-red-500/20 backdrop-blur-xl max-w-md">
                    <CardContent className="p-12 text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
                        <h3 className="text-xl font-medium text-white mb-3">Unable to Load Review</h3>
                        <p className="text-gray-400 mb-6">{error}</p>
                        {error.includes('expired') && (
                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-6">
                                <Clock className="h-5 w-5 text-orange-400 mx-auto mb-2" />
                                <p className="text-sm text-orange-300">This share link has expired</p>
                            </div>
                        )}
                        {error.includes('deactivated') && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
                                <Lock className="h-5 w-5 text-red-400 mx-auto mb-2" />
                                <p className="text-sm text-red-300">This share link is no longer active</p>
                            </div>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const asset = getReviewAsset();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Header */}
            <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 py-4 px-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">E8 Productions</h1>
                        <p className="text-sm text-gray-400">Shared Client Review</p>
                    </div>
                    {reviewData?.shareInfo && (
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                <span>{reviewData.shareInfo.viewCount} views</span>
                            </div>
                            {reviewData.shareInfo.expiresAt && (
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    <span>Expires {new Date(reviewData.shareInfo.expiresAt).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

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
                                    shareToken: shareToken
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
                                    status: 'REJECTED',
                                    feedback: revisionData.notes,
                                    shareToken: shareToken
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
                    shareToken={shareToken}
                />
            )}

            {/* Landing message when modal is closed */}
            {!showReview && asset && (
                <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
                    <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-xl max-w-2xl">
                        <CardContent className="p-12 text-center">
                            <div className="mb-8">
                                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Eye className="h-10 w-10 text-blue-400" />
                                </div>
                                <h2 className="text-3xl font-bold text-white mb-4">
                                    {asset.title}
                                </h2>
                                <p className="text-gray-400 mb-2">{asset.subtitle}</p>
                                <p className="text-sm text-gray-500">
                                    Shared by E8 Productions for your review
                                </p>
                            </div>

                            <Button
                                size="lg"
                                onClick={() => setShowReview(true)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                            >
                                Open Visual Review
                            </Button>

                            {reviewData && reviewData.task.driveLinks && reviewData.task.driveLinks.length > 0 && (
                                <div className="mt-12 text-left">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                                        <Link className="h-4 w-4" />
                                        Resource Links
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {reviewData.task.driveLinks.map((link, idx) => (
                                            <a
                                                key={idx}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-4 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 rounded-xl transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                                                        <ExternalLink className="h-5 w-5 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium text-sm truncate max-w-[400px]">
                                                            {link.split('/').pop()?.split('?')[0] || 'External Resource'}
                                                        </p>
                                                        <p className="text-xs text-gray-500">
                                                            {new URL(link).hostname}
                                                        </p>
                                                    </div>
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-8 border-t border-gray-700">
                                <p className="text-xs text-gray-500">
                                    This is a shared review link. The content is view-only and for feedback purposes.
                                    <br />
                                    Contact E8 Productions directly to submit your final approval or revision requests.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
