import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { 
  Calendar, 
  Clock, 
  Building,
  FileText, 
  ExternalLink, 
  Download, 
  CheckCircle, 
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Palette,
  Image as ImageIcon,
  FileImage,
  Hash,
  MessageSquare,
  Zap,
  TrendingUp
} from 'lucide-react';
import { getClients } from '../utils/clientData';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export function SchedulerResourcesPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Load clients from localStorage
  useEffect(() => {
    const loadedClients = getClients();
    setClients(loadedClients);
    
    // Set default client if available
    if (loadedClients.length > 0 && !selectedClientId) {
      setSelectedClientId(loadedClients[0].id);
    }
  }, []);

  // Update selected client when ID changes
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [selectedClientId, clients]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Scheduling Resources</h1>
          <p className="text-muted-foreground mt-2">
            Client brand guidelines, posting templates, and scheduling tools
          </p>
        </div>
        
        {/* Client Selector */}
        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="resource-client-select" className="text-sm text-muted-foreground whitespace-nowrap">
              Client:
            </Label>
            <Select value={selectedClientId || ''} onValueChange={setSelectedClientId}>
              <SelectTrigger id="resource-client-select" className="w-64">
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {client.company}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs defaultValue="brand-assets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="brand-assets">Brand Assets</TabsTrigger>
          <TabsTrigger value="caption-templates">Caption Templates</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtag Libraries</TabsTrigger>
          <TabsTrigger value="platform-specs">Platform Specs</TabsTrigger>
        </TabsList>

        {/* Brand Assets Tab */}
        <TabsContent value="brand-assets" className="space-y-6">
          {selectedClient ? (
            <>
              {/* Client Brand Guidelines */}
              <Card>
                <CardHeader>
                  <CardTitle>{selectedClient.company} Brand Guidelines</CardTitle>
                  <CardDescription>Essential brand information for scheduling posts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Brand Colors */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Palette className="h-4 w-4 text-purple-600" />
                      <h3 className="font-medium text-sm">Brand Colors</h3>
                    </div>
                    <div className="flex gap-2 ml-6">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Primary Colors</p>
                        <div className="flex gap-2">
                          {selectedClient.brandGuidelines?.primaryColors?.map((color: string, i: number) => (
                            <div key={i} className="space-y-1">
                              <div
                                className="w-12 h-12 rounded border"
                                style={{ backgroundColor: color }}
                              />
                              <p className="text-xs text-center">{color}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedClient.brandGuidelines?.secondaryColors && (
                        <div className="ml-4">
                          <p className="text-xs text-muted-foreground mb-2">Secondary Colors</p>
                          <div className="flex gap-2">
                            {selectedClient.brandGuidelines.secondaryColors.map((color: string, i: number) => (
                              <div key={i} className="space-y-1">
                                <div
                                  className="w-12 h-12 rounded border"
                                  style={{ backgroundColor: color }}
                                />
                                <p className="text-xs text-center">{color}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Brand Info Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg bg-accent/50">
                      <h4 className="font-medium text-sm mb-2">Tone of Voice</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedClient.brandGuidelines?.toneOfVoice || 'Not specified'}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/50">
                      <h4 className="font-medium text-sm mb-2">Target Audience</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedClient.brandGuidelines?.targetAudience || 'Not specified'}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/50">
                      <h4 className="font-medium text-sm mb-2">Brand Values</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedClient.brandGuidelines?.brandValues || 'Not specified'}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg bg-accent/50">
                      <h4 className="font-medium text-sm mb-2">Content Style</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedClient.brandGuidelines?.contentStyle || 'Not specified'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Fonts */}
                  {selectedClient.brandGuidelines?.fonts && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-blue-600" />
                        <h3 className="font-medium text-sm">Brand Fonts</h3>
                      </div>
                      <div className="flex gap-2 flex-wrap ml-6">
                        {selectedClient.brandGuidelines.fonts.map((font: string, i: number) => (
                          <Badge key={i} variant="secondary">{font}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Preferred Platforms */}
                  {selectedClient.projectSettings?.preferredPlatforms && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <h3 className="font-medium text-sm">Preferred Platforms</h3>
                      </div>
                      <div className="flex gap-2 flex-wrap ml-6">
                        {selectedClient.projectSettings.preferredPlatforms.map((platform: string, i: number) => (
                          <Badge key={i} variant="outline">
                            {platform === 'Instagram' && <Instagram className="h-3 w-3 mr-1" />}
                            {platform === 'Facebook' && <Facebook className="h-3 w-3 mr-1" />}
                            {platform === 'Twitter' && <Twitter className="h-3 w-3 mr-1" />}
                            {platform === 'YouTube' && <Youtube className="h-3 w-3 mr-1" />}
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Brand Assets */}
                  {selectedClient.brandAssets && selectedClient.brandAssets.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <FileImage className="h-4 w-4 text-orange-600" />
                        <h3 className="font-medium text-sm">Brand Assets</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-6">
                        {selectedClient.brandAssets.map((asset: any) => (
                          <div key={asset.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                            <div className="aspect-video bg-accent rounded mb-2 overflow-hidden">
                              <ImageWithFallback
                                src={asset.fileUrl}
                                alt={asset.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="font-medium text-sm">{asset.name}</p>
                              <p className="text-xs text-muted-foreground">{asset.fileSize}</p>
                              <Button size="sm" variant="outline" className="w-full mt-2">
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium mb-2">No Client Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Select a client above to view their brand guidelines and assets
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Caption Templates Tab */}
        <TabsContent value="caption-templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Caption Templates by Platform</CardTitle>
              <CardDescription>Pre-written caption templates optimized for each platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instagram Templates */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Instagram className="h-5 w-5 text-pink-600" />
                  <h3 className="font-medium">Instagram Captions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">🎬 Product Launch</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "Introducing [Product Name] 🚀 Ready to transform your [benefit]? Swipe to see it in action! 💫 #NewProduct #Innovation"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">💡 Tips & How-To</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "Quick tip: [Tip content] 💪 Save this for later and tag someone who needs to see this! #ProTip #Tutorial"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">📊 Stats & Facts</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "Did you know? [Statistic] 📈 Here's what this means for you... [explanation] #Facts #Industry"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">🎉 Celebration Post</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "We're celebrating [milestone]! 🎊 Thank you to our amazing community for making this possible! 💙 #Milestone #Grateful"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* TikTok Templates */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-black" />
                  <h3 className="font-medium">TikTok Captions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">✨ Trend Hook</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "POV: [situation] 😂 Who can relate? #fyp #viral #relatable"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">🎯 Quick Tutorial</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "How to [action] in 30 seconds! Save this! 🔥 #tutorial #lifehack #tips"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* LinkedIn Templates */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-blue-700" />
                  <h3 className="font-medium">LinkedIn Captions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">💼 Industry Insight</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "[Opening thought]\n\nHere's what I've learned: [3 key points]\n\nWhat's your take? #Industry #Leadership"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <p className="font-medium text-sm mb-2">📈 Company Update</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      "Excited to announce [news]!\n\nThis means [impact]. Looking forward to [future]. #CompanyNews #Growth"
                    </p>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hashtag Libraries Tab */}
        <TabsContent value="hashtags" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Hashtag Collections</CardTitle>
              <CardDescription>Curated hashtag sets for different content types and platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* General Business Hashtags */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Hash className="h-4 w-4 text-blue-600" />
                  <h3 className="font-medium text-sm">General Business</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">High Reach (1M+)</p>
                    <p className="text-xs text-muted-foreground">
                      #Business #Entrepreneur #Success #Motivation #Innovation
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">Medium Reach (100K-1M)</p>
                    <p className="text-xs text-muted-foreground">
                      #SmallBusiness #StartupLife #Productivity #Leadership #Growth
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">Niche (10K-100K)</p>
                    <p className="text-xs text-muted-foreground">
                      #SoloPreneur #BusinessTips #WorkSmart #Hustle #EntrepreneurMindset
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tech/Innovation Hashtags */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <h3 className="font-medium text-sm">Tech & Innovation</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">High Reach (1M+)</p>
                    <p className="text-xs text-muted-foreground">
                      #Technology #Tech #Innovation #Digital #AI
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">Medium Reach (100K-1M)</p>
                    <p className="text-xs text-muted-foreground">
                      #TechNews #StartupTech #DigitalTransformation #Future #SaaS
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">Niche (10K-100K)</p>
                    <p className="text-xs text-muted-foreground">
                      #TechCommunity #DevLife #ProductLaunch #TechTrends #BuildInPublic
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Video Content Hashtags */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-green-600" />
                  <h3 className="font-medium text-sm">Video Content</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-6">
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">TikTok Essential</p>
                    <p className="text-xs text-muted-foreground">
                      #fyp #foryou #viral #trending #foryoupage
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">YouTube Shorts</p>
                    <p className="text-xs text-muted-foreground">
                      #Shorts #YouTubeShorts #ShortVideo #Viral #Trending
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg bg-accent/50">
                    <p className="font-medium text-xs mb-2">Instagram Reels</p>
                    <p className="text-xs text-muted-foreground">
                      #Reels #ReelsInstagram #InstagramReels #Trending #Viral
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Specs Tab */}
        <TabsContent value="platform-specs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Specifications & Best Practices</CardTitle>
              <CardDescription>Technical specs and posting guidelines for each social platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Instagram Specs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Instagram className="h-5 w-5 text-pink-600" />
                  <h3 className="font-medium">Instagram</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Feed Posts</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 1:1 (1080x1080)</li>
                      <li>• Max caption: 2,200 chars</li>
                      <li>• Hashtags: 3-5 recommended</li>
                      <li>• Format: JPG, PNG, MP4</li>
                      <li>• Max size: 30MB</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Stories</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 9:16 (1080x1920)</li>
                      <li>• Duration: 15 sec max</li>
                      <li>• Text safe zone: 250px margins</li>
                      <li>• Stickers: Polls, questions, etc.</li>
                      <li>• Expires: 24 hours</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Reels</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 9:16 (1080x1920)</li>
                      <li>• Duration: 15-90 seconds</li>
                      <li>• Audio: Trending sounds</li>
                      <li>• Captions: Auto-captions</li>
                      <li>• Hooks: First 3 seconds</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* TikTok Specs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-black" />
                  <h3 className="font-medium">TikTok</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Video Specs</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 9:16 (1080x1920)</li>
                      <li>• Duration: 15s-10min</li>
                      <li>• Format: MP4, MOV</li>
                      <li>• Max size: 287.6MB</li>
                      <li>• Frame rate: 30-60fps</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Best Practices</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Hook in first 1-2 seconds</li>
                      <li>• Use trending sounds/music</li>
                      <li>• Hashtags: 3-5 max</li>
                      <li>• Caption length: 150 chars</li>
                      <li>• Post 1-4x daily</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* YouTube Specs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Youtube className="h-5 w-5 text-red-600" />
                  <h3 className="font-medium">YouTube</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Video Upload</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 16:9 (1920x1080)</li>
                      <li>• Duration: Up to 12 hours</li>
                      <li>• Format: MP4, MOV, AVI</li>
                      <li>• Max size: 256GB</li>
                      <li>• Frame rate: 24-60fps</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Thumbnail</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Size: 1280x720</li>
                      <li>• Format: JPG, PNG</li>
                      <li>• Max file: 2MB</li>
                      <li>• Text: Large, readable</li>
                      <li>• Faces: Close-up works</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Shorts</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 9:16 (1080x1920)</li>
                      <li>• Duration: 60 seconds max</li>
                      <li>• Vertical format only</li>
                      <li>• Add #Shorts in title/desc</li>
                      <li>• No watermarks</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* LinkedIn Specs */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-blue-700" />
                  <h3 className="font-medium">LinkedIn</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-7">
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Video Posts</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 16:9 or 1:1</li>
                      <li>• Duration: 3 sec - 10 min</li>
                      <li>• Format: MP4</li>
                      <li>• Max size: 5GB</li>
                      <li>• Captions: Auto or upload</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50">
                    <h4 className="font-medium text-sm mb-2">Best Practices</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Professional tone</li>
                      <li>• Post weekdays 8am-2pm</li>
                      <li>• Hashtags: 3-5 max</li>
                      <li>• Engage in comments</li>
                      <li>• Share insights/value</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Facebook & Twitter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Facebook className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium">Facebook</h3>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50 ml-7">
                    <h4 className="font-medium text-sm mb-2">Video Specs</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 16:9, 1:1, 9:16</li>
                      <li>• Duration: 1 sec - 240 min</li>
                      <li>• Format: MP4, MOV</li>
                      <li>• Max size: 10GB</li>
                      <li>• Add captions for sound-off</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Twitter className="h-5 w-5 text-sky-500" />
                    <h3 className="font-medium">Twitter/X</h3>
                  </div>
                  <div className="p-4 border rounded-lg bg-accent/50 ml-7">
                    <h4 className="font-medium text-sm mb-2">Video Specs</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Ratio: 16:9 or 1:1</li>
                      <li>• Duration: 2:20 max</li>
                      <li>• Format: MP4, MOV</li>
                      <li>• Max size: 512MB</li>
                      <li>• Character limit: 280</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
