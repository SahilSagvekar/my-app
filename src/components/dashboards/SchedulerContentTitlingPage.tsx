import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { 
  Sparkles, 
  Video, 
  FileText, 
  TrendingUp, 
  Copy, 
  Check, 
  RefreshCw, 
  Eye,
  ThumbsUp,
  ThumbsDown,
  Wand2,
  BarChart3,
  Clock,
  Upload,
  Calendar,
  Search,
  Filter,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

interface VideoContent {
  id: string;
  title: string;
  currentTitle?: string;
  videoUrl: string;
  thumbnail: string;
  duration: string;
  uploadedAt: string;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'facebook';
  status: 'pending' | 'generating' | 'reviewing' | 'approved' | 'scheduled';
  transcription?: string;
  aiTitles?: AITitleSuggestion[];
  selectedTitle?: string;
  scheduledDate?: string;
  projectId: string;
}

interface AITitleSuggestion {
  id: string;
  title: string;
  confidence: number;
  reasoning: string;
  viralScore: number;
  basedOn: string[];
  keywords: string[];
  estimatedCTR: number;
}

interface ViralReference {
  id: string;
  title: string;
  views: string;
  platform: string;
  niche: string;
  uploadDate: string;
  ctr: number;
}

// Mock data
const mockVideos: VideoContent[] = [
  {
    id: 'vid-001',
    title: 'Holiday Campaign Video',
    currentTitle: 'Holiday Sale 2024',
    videoUrl: 'https://drive.google.com/file/d/video123/view',
    thumbnail: 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=400&h=225&fit=crop',
    duration: '2:30',
    uploadedAt: '2024-08-10T14:30:00Z',
    platform: 'youtube',
    status: 'pending',
    projectId: 'proj-001',
    transcription: 'Welcome to our biggest holiday sale of the year! Get up to 70% off on all items. Limited time only. Shop now and save big on your favorite products.'
  },
  {
    id: 'vid-002',
    title: 'Product Demo - Smart Watch',
    videoUrl: 'https://drive.google.com/file/d/video456/view',
    thumbnail: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400&h=225&fit=crop',
    duration: '3:45',
    uploadedAt: '2024-08-09T10:15:00Z',
    platform: 'youtube',
    status: 'generating',
    projectId: 'proj-002',
    transcription: 'Today we\'re unboxing and reviewing the latest smart watch. This device features heart rate monitoring, GPS tracking, and 7-day battery life.'
  },
  {
    id: 'vid-003',
    title: 'Customer Testimonial',
    currentTitle: 'Happy Customer Review',
    videoUrl: 'https://drive.google.com/file/d/video789/view',
    thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=225&fit=crop',
    duration: '1:15',
    uploadedAt: '2024-08-08T16:45:00Z',
    platform: 'instagram',
    status: 'approved',
    projectId: 'proj-003',
    selectedTitle: 'This Changed Everything! 😱 Real Customer Review',
    scheduledDate: '2024-08-15'
  }
];

const mockViralReferences: ViralReference[] = [
  {
    id: 'ref-001',
    title: 'I Tried This For 30 Days And Here\'s What Happened...',
    views: '2.3M',
    platform: 'YouTube',
    niche: 'Product Review',
    uploadDate: '2024-07-15',
    ctr: 12.4
  },
  {
    id: 'ref-002',
    title: 'You Won\'t Believe What This Does! (TESTED)',
    views: '1.8M',
    platform: 'YouTube',
    niche: 'Technology',
    uploadDate: '2024-07-20',
    ctr: 11.2
  },
  {
    id: 'ref-003',
    title: 'This SHOCKED Everyone! 😱',
    views: '3.1M',
    platform: 'YouTube',
    niche: 'General',
    uploadDate: '2024-07-10',
    ctr: 14.8
  }
];

export function SchedulerContentTitlingPage() {
  const [videos, setVideos] = useState<VideoContent[]>(mockVideos);
  const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
  const [showTitleGenerator, setShowTitleGenerator] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleGenerateTitles = async (video: VideoContent) => {
    setIsGenerating(true);
    setShowTitleGenerator(true);
    
    // Simulate AI generation
    setTimeout(() => {
      const aiTitles: AITitleSuggestion[] = [
        {
          id: 'ai-1',
          title: '🎁 MASSIVE Holiday Sale! Up to 70% OFF Everything (Limited Time)',
          confidence: 94,
          reasoning: 'Uses urgency, emojis, and specific discount percentage. Proven to increase CTR by 45% based on similar viral videos.',
          viralScore: 92,
          basedOn: ['ref-001', 'ref-003'],
          keywords: ['Holiday', 'Sale', '70% OFF', 'Limited Time'],
          estimatedCTR: 13.2
        },
        {
          id: 'ai-2',
          title: 'This Holiday Deal Will SHOCK You! 😱 (70% OFF Sale)',
          confidence: 89,
          reasoning: 'Emotional trigger with shock value. Similar titles averaged 2.1M views in the shopping niche.',
          viralScore: 88,
          basedOn: ['ref-002', 'ref-003'],
          keywords: ['Holiday', 'Deal', 'SHOCK', 'Sale'],
          estimatedCTR: 11.8
        },
        {
          id: 'ai-3',
          title: 'I Can\'t Believe These Holiday Prices! 🛍️ (Save BIG)',
          confidence: 85,
          reasoning: 'First-person perspective creates authenticity. Shopping emoji increases engagement by 23%.',
          viralScore: 84,
          basedOn: ['ref-001'],
          keywords: ['Holiday', 'Prices', 'Save', 'BIG'],
          estimatedCTR: 10.5
        },
        {
          id: 'ai-4',
          title: 'Holiday Sale 2024: Everything You Need to Know',
          confidence: 72,
          reasoning: 'Informational approach. More conservative but builds trust with audience.',
          viralScore: 70,
          basedOn: [],
          keywords: ['Holiday Sale', '2024', 'Everything'],
          estimatedCTR: 8.2
        },
        {
          id: 'ai-5',
          title: 'The ULTIMATE Holiday Shopping Guide (70% OFF!)',
          confidence: 78,
          reasoning: 'Power word "ULTIMATE" with clear value proposition. Strong for how-to content.',
          viralScore: 76,
          basedOn: ['ref-001'],
          keywords: ['ULTIMATE', 'Holiday', 'Shopping', '70% OFF'],
          estimatedCTR: 9.1
        }
      ];

      setVideos(prev => prev.map(v => 
        v.id === video.id 
          ? { ...v, aiTitles, status: 'reviewing' as const }
          : v
      ));
      
      setSelectedVideo({ ...video, aiTitles, status: 'reviewing' });
      setIsGenerating(false);
      toast.success('🎯 AI Title Generation Complete!', {
        description: `Generated ${aiTitles.length} optimized title suggestions`
      });
    }, 3000);

    toast.info('🤖 Generating Titles...', {
      description: 'Analyzing viral patterns and video transcription'
    });
  };

  const handleRegenerateTitles = () => {
    if (!selectedVideo) return;
    handleGenerateTitles(selectedVideo);
  };

  const handleSelectTitle = (video: VideoContent, titleId: string) => {
    const selectedTitle = video.aiTitles?.find(t => t.id === titleId);
    if (!selectedTitle) return;

    setVideos(prev => prev.map(v =>
      v.id === video.id
        ? { ...v, selectedTitle: selectedTitle.title, status: 'approved' as const }
        : v
    ));

    if (selectedVideo?.id === video.id) {
      setSelectedVideo({ ...video, selectedTitle: selectedTitle.title, status: 'approved' });
    }

    toast.success('✅ Title Approved!', {
      description: 'Title has been saved and is ready for scheduling'
    });
  };

  const handleCopyTitle = (title: string, id: string) => {
    navigator.clipboard.writeText(title);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const filteredVideos = videos.filter(video => {
    if (filterStatus !== 'all' && video.status !== filterStatus) return false;
    if (filterPlatform !== 'all' && video.platform !== filterPlatform) return false;
    return true;
  });

  const getStatusColor = (status: VideoContent['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'generating': return 'bg-blue-500';
      case 'reviewing': return 'bg-purple-500';
      case 'approved': return 'bg-green-500';
      case 'scheduled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: VideoContent['status']) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'generating': return 'Generating...';
      case 'reviewing': return 'Reviewing';
      case 'approved': return 'Approved';
      case 'scheduled': return 'Scheduled';
      default: return status;
    }
  };

  const getPlatformIcon = (platform: string) => {
    return '🎥'; // In real app, use platform-specific icons
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">AI Content Titling</h1>
          <p className="text-sm text-muted-foreground">
            Generate viral-optimized titles using AI analysis of trending content
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Video
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Titles</p>
                <p className="text-2xl font-semibold">
                  {videos.filter(v => v.status === 'pending').length}
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Review</p>
                <p className="text-2xl font-semibold">
                  {videos.filter(v => v.status === 'reviewing').length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-semibold">
                  {videos.filter(v => v.status === 'approved').length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg CTR Boost</p>
                <p className="text-2xl font-semibold">+24%</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="generating">Generating</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search videos..." className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredVideos.map((video) => (
          <Card key={video.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-40 h-24 object-cover rounded"
                />

                {/* Video Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{video.title}</h3>
                      {video.currentTitle && (
                        <p className="text-sm text-muted-foreground">Current: {video.currentTitle}</p>
                      )}
                      {video.selectedTitle && (
                        <p className="text-sm text-green-600 font-medium mt-1">
                          ✓ Selected: {video.selectedTitle}
                        </p>
                      )}
                    </div>
                    <Badge className={`${getStatusColor(video.status)} text-white`}>
                      {getStatusLabel(video.status)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Video className="h-4 w-4" />
                      {video.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      {getPlatformIcon(video.platform)}
                      {video.platform}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(video.uploadedAt).toLocaleDateString()}
                    </span>
                    {video.aiTitles && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        {video.aiTitles.length} AI suggestions
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {video.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleGenerateTitles(video)}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate AI Titles
                      </Button>
                    )}
                    
                    {(video.status === 'reviewing' || video.status === 'approved') && (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setSelectedVideo(video);
                            setShowTitleGenerator(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Suggestions
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleGenerateTitles(video)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </Button>
                      </>
                    )}

                    {video.status === 'approved' && (
                      <Button 
                        size="sm" 
                        variant="secondary"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule Post
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Title Generator Modal */}
      <Dialog open={showTitleGenerator} onOpenChange={setShowTitleGenerator}>
        <DialogContent className="!max-w-6xl !max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>AI Title Suggestions</DialogTitle>
            <DialogDescription>
              {selectedVideo?.title} • Powered by viral content analysis
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="suggestions" className="h-full flex flex-col">
              <TabsList>
                <TabsTrigger value="suggestions">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Suggestions ({selectedVideo?.aiTitles?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="transcription">
                  <FileText className="h-4 w-4 mr-2" />
                  Transcription
                </TabsTrigger>
                <TabsTrigger value="viral-references">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Viral References
                </TabsTrigger>
                <TabsTrigger value="custom">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Custom Prompt
                </TabsTrigger>
              </TabsList>

              <TabsContent value="suggestions" className="flex-1 overflow-auto mt-4">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                    <p className="text-sm text-muted-foreground">Analyzing viral patterns...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedVideo?.aiTitles?.map((suggestion, index) => (
                      <Card key={suggestion.id} className={`${selectedVideo.selectedTitle === suggestion.title ? 'border-2 border-green-500' : ''}`}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Title Header */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    #{index + 1}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <BarChart3 className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {suggestion.confidence}% confidence
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {suggestion.viralScore}/100 viral score
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Eye className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      ~{suggestion.estimatedCTR}% CTR
                                    </span>
                                  </div>
                                </div>
                                <h4 className="font-medium text-lg mb-2">{suggestion.title}</h4>
                                <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>
                                
                                {/* Keywords */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">Keywords:</span>
                                  {suggestion.keywords.map((keyword, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {keyword}
                                    </Badge>
                                  ))}
                                </div>

                                {/* Based On */}
                                {suggestion.basedOn.length > 0 && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-muted-foreground">
                                      Based on {suggestion.basedOn.length} viral video{suggestion.basedOn.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant={selectedVideo.selectedTitle === suggestion.title ? "default" : "outline"}
                                  onClick={() => handleSelectTitle(selectedVideo, suggestion.id)}
                                >
                                  {selectedVideo.selectedTitle === suggestion.title ? (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Selected
                                    </>
                                  ) : (
                                    <>
                                      <ThumbsUp className="h-4 w-4 mr-2" />
                                      Select
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyTitle(suggestion.title, suggestion.id)}
                                >
                                  {copiedId === suggestion.id ? (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {selectedVideo?.aiTitles && selectedVideo.aiTitles.length > 0 && (
                      <div className="flex justify-center pt-4">
                        <Button variant="outline" onClick={handleRegenerateTitles}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Generate More Variations
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="transcription" className="flex-1 overflow-auto mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Video Transcription</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedVideo?.transcription || 'No transcription available'}
                      </p>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="viral-references" className="flex-1 overflow-auto mt-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    These viral videos were analyzed to generate title suggestions
                  </p>
                  {mockViralReferences.map((ref) => (
                    <Card key={ref.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium mb-2">{ref.title}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{ref.views} views</span>
                              <span>{ref.platform}</span>
                              <span>{ref.niche}</span>
                              <span className="text-green-600 font-medium">{ref.ctr}% CTR</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="flex-1 overflow-auto mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Custom AI Prompt</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Provide specific instructions for title generation
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="E.g., Generate titles focused on curiosity gaps, use more emojis, target millennials..."
                      rows={6}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                    />
                    <Button onClick={() => {
                      toast.info('Generating custom titles...');
                      // Would trigger custom AI generation
                    }}>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate with Custom Prompt
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
