'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    FileIcon,
    Download,
    ExternalLink,
    AlertCircle,
    Loader2,
    FileText,
    Image as ImageIcon,
    Video,
    Music,
    Archive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SharedFileData {
    fileName: string;
    fileSize: string;
    mimeType: string;
    url: string;
    createdAt: string;
}

export default function SharedFilePage() {
    const params = useParams();
    const shareToken = params.shareToken as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileData, setFileData] = useState<SharedFileData | null>(null);

    useEffect(() => {
        if (shareToken) {
            loadSharedFile();
        }
    }, [shareToken]);

    const loadSharedFile = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/shared/file/${shareToken}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load shared file');
            }

            setFileData(data);
        } catch (err: any) {
            console.error('Error loading shared file:', err);
            setError(err.message || 'Failed to load shared file');
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType?.startsWith('image/')) return <ImageIcon className="h-16 w-16 text-blue-400" />;
        if (mimeType?.startsWith('video/')) return <Video className="h-16 w-16 text-purple-400" />;
        if (mimeType?.includes('pdf')) return <FileText className="h-16 w-16 text-red-400" />;
        if (mimeType?.startsWith('audio/')) return <Music className="h-16 w-16 text-green-400" />;
        if (mimeType?.includes('zip') || mimeType?.includes('archive')) return <Archive className="h-16 w-16 text-yellow-400" />;
        return <FileIcon className="h-16 w-16 text-gray-400" />;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                    <p className="text-neutral-400">Locating shared file...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
                <Card className="bg-neutral-900 border-neutral-800 max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
                        <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
                        <p className="text-neutral-400 mb-8">{error}</p>
                        <Button
                            variant="outline"
                            onClick={() => window.location.reload()}
                            className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
                        >
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold text-white mb-2">E8 Productions</h1>
                    <p className="text-neutral-500">Shared File Viewing</p>
                </div>

                <Card className="bg-neutral-900 border-neutral-800 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-purple-600" />

                    <CardContent className="p-10 text-center">
                        <div className="w-32 h-32 bg-neutral-800 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                            {fileData && getFileIcon(fileData.mimeType)}
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-3 break-all">
                            {fileData?.fileName}
                        </h2>

                        <div className="flex items-center justify-center gap-4 text-neutral-400 text-sm mb-10">
                            <span>{fileData?.fileSize}</span>
                            <span className="w-1 h-1 rounded-full bg-neutral-700" />
                            <span>Shared on {fileData && new Date(fileData.createdAt).toLocaleDateString()}</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:justify-center">
                            <Button
                                size="lg"
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-medium"
                                onClick={() => window.open(fileData?.url, '_blank')}
                            >
                                <Download className="h-5 w-5" />
                                Download File
                            </Button>

                            {fileData?.mimeType?.startsWith('image/') || fileData?.mimeType?.startsWith('video/') || fileData?.mimeType?.includes('pdf') ? (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 gap-2"
                                    onClick={() => window.open(fileData?.url, '_blank')}
                                >
                                    <ExternalLink className="h-5 w-5" />
                                    Preview
                                </Button>
                            ) : null}
                        </div>

                        <div className="mt-12 pt-8 border-t border-neutral-800 text-xs text-neutral-500">
                            <p>This is a permanent share link generated via E8 Productions Portal.</p>
                            <p className="mt-1">The link will remain active unless deactivated by the owner.</p>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-8 text-center text-neutral-600 text-sm">
                    &copy; {new Date().getFullYear()} E8 Productions
                </p>
            </div>
        </div>
    );
}
