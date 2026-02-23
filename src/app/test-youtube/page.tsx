'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Youtube } from 'lucide-react';

/**
 * YouTube API Test Page
 * 
 * Use this page to test your YouTube API integration.
 * 
 * Instructions:
 * 1. Enter your OAuth access token
 * 2. Click any button to test different API endpoints
 * 3. View the results in the output section
 */

export default function YouTubeAPITestPage() {
    const [accessToken, setAccessToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const testAPI = async (action: string, params: Record<string, string> = {}) => {
        if (!accessToken.trim()) {
            setError('Please enter an access token first');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const queryParams = new URLSearchParams({ action, ...params });
            const response = await fetch(`/api/youtube?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Youtube className="w-10 h-10 text-red-600" />
                    <div>
                        <h1 className="text-3xl font-bold">YouTube API Test Page</h1>
                        <p className="text-gray-600">Test your YouTube API integration</p>
                    </div>
                </div>

                {/* Access Token Input */}
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: Enter Access Token</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Input
                                type="text"
                                placeholder="Paste your OAuth access token here..."
                                value={accessToken}
                                onChange={(e) => setAccessToken(e.target.value)}
                                className="font-mono text-sm"
                            />
                            <p className="text-sm text-gray-500">
                                Get your access token from Google OAuth. Make sure it has YouTube scopes enabled.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Test Buttons */}
                <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Test API Endpoints</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Button
                                onClick={() => testAPI('channelInfo')}
                                disabled={loading}
                                variant="outline"
                            >
                                Get Channel Info
                            </Button>

                            <Button
                                onClick={() => testAPI('channelVideos', { maxResults: '5' })}
                                disabled={loading}
                                variant="outline"
                            >
                                Get My Videos
                            </Button>

                            <Button
                                onClick={() => testAPI('playlists', { maxResults: '5' })}
                                disabled={loading}
                                variant="outline"
                            >
                                Get Playlists
                            </Button>

                            <Button
                                onClick={() => {
                                    const videoId = prompt('Enter YouTube Video ID:');
                                    if (videoId) testAPI('videoDetails', { videoId });
                                }}
                                disabled={loading}
                                variant="outline"
                            >
                                Get Video Details
                            </Button>

                            <Button
                                onClick={() => {
                                    const videoId = prompt('Enter YouTube Video ID:');
                                    if (videoId) testAPI('videoStats', { videoId });
                                }}
                                disabled={loading}
                                variant="outline"
                            >
                                Get Video Stats
                            </Button>

                            <Button
                                onClick={() => {
                                    const query = prompt('Enter search query:');
                                    if (query) testAPI('search', { query, maxResults: '5' });
                                }}
                                disabled={loading}
                                variant="outline"
                            >
                                Search Videos
                            </Button>

                            <Button
                                onClick={() => {
                                    const videoId = prompt('Enter YouTube Video ID:');
                                    if (videoId) testAPI('comments', { videoId, maxResults: '5' });
                                }}
                                disabled={loading}
                                variant="outline"
                            >
                                Get Comments
                            </Button>

                            <Button
                                onClick={() => {
                                    const channelId = prompt('Enter Channel ID:');
                                    if (channelId) {
                                        const endDate = new Date().toISOString().split('T')[0];
                                        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                                            .toISOString()
                                            .split('T')[0];
                                        testAPI('analytics', { channelId, startDate, endDate });
                                    }
                                }}
                                disabled={loading}
                                variant="outline"
                            >
                                Get Analytics
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Loading State */}
                {loading && (
                    <Card>
                        <CardContent className="py-8">
                            <div className="flex items-center justify-center">
                                <Youtube className="w-8 h-8 animate-pulse text-red-600 mr-3" />
                                <p className="text-lg">Loading...</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Error Display */}
                {error && (
                    <Card className="border-red-500">
                        <CardHeader>
                            <CardTitle className="text-red-600">Error</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-red-600">{error}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Result Display */}
                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 3: View Results</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {/* Success Message */}
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <p className="text-green-800 font-semibold">✅ API Request Successful!</p>
                                </div>

                                {/* JSON Output */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold">Response Data:</h3>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                                                alert('Copied to clipboard!');
                                            }}
                                        >
                                            Copy JSON
                                        </Button>
                                    </div>
                                    <pre className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                                        {JSON.stringify(result, null, 2)}
                                    </pre>
                                </div>

                                {/* Quick Stats (if channel info) */}
                                {result.data?.statistics && (
                                    <div className="grid grid-cols-3 gap-4 mt-4">
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                            <p className="text-sm text-gray-600">Subscribers</p>
                                            <p className="text-2xl font-bold">
                                                {parseInt(result.data.statistics.subscriberCount || '0').toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-lg">
                                            <p className="text-sm text-gray-600">Total Views</p>
                                            <p className="text-2xl font-bold">
                                                {parseInt(result.data.statistics.viewCount || '0').toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-lg">
                                            <p className="text-sm text-gray-600">Videos</p>
                                            <p className="text-2xl font-bold">
                                                {parseInt(result.data.statistics.videoCount || '0').toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>How to Get Access Token</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>Make sure YouTube Data API v3 is enabled in Google Cloud Console</li>
                            <li>Add YouTube scopes to your OAuth configuration:
                                <ul className="list-disc list-inside ml-6 mt-1 text-xs text-gray-600">
                                    <li>https://www.googleapis.com/auth/youtube.readonly</li>
                                    <li>https://www.googleapis.com/auth/yt-analytics.readonly</li>
                                </ul>
                            </li>
                            <li>Log in with Google OAuth in your app</li>
                            <li>Copy the access token from your session/database</li>
                            <li>Paste it in the input field above</li>
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
