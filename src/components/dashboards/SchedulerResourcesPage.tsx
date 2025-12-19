import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Search, 
  Download, 
  ExternalLink, 
  BookOpen,
  Video,
  Image as ImageIcon,
  Palette,
  Type,
  FileText,
  Link,
  Star,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

const brandAssets = [
  {
    id: 'brand-001',
    title: 'Company Logo Pack',
    type: 'logo',
    description: 'Official company logos in various formats and variations.',
    thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=300&fit=crop',
    downloadUrl: '#',
    fileSize: '12.4 MB',
    format: 'SVG, PNG, EPS',
    lastUpdated: '2024-08-01'
  },
  {
    id: 'brand-002',
    title: 'Brand Color Palette',
    type: 'colors',
    description: 'Official brand colors with hex codes and usage guidelines.',
    thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=300&fit=crop',
    downloadUrl: '#',
    fileSize: '2.1 MB',
    format: 'ASE, PDF',
    lastUpdated: '2024-07-28'
  },
  {
    id: 'brand-003',
    title: 'Typography Guidelines',
    type: 'fonts',
    description: 'Brand typography with font files and usage examples.',
    thumbnail: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=300&fit=crop',
    downloadUrl: '#',
    fileSize: '8.7 MB',
    format: 'OTF, TTF, PDF',
    lastUpdated: '2024-07-25'
  },
  {
    id: 'brand-004',
    title: 'Icon Library',
    type: 'icons',
    description: 'Comprehensive icon set matching brand style.',
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    downloadUrl: '#',
    fileSize: '15.2 MB',
    format: 'SVG, PNG, AI',
    lastUpdated: '2024-07-20'
  }
];

const tutorials = [
  {
    id: 'tut-001',
    title: 'Getting Started with Brand Guidelines',
    type: 'video',
    duration: '12:34',
    difficulty: 'Beginner',
    instructor: 'Sarah Johnson',
    description: 'Learn the fundamentals of following brand guidelines in your design work.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    publishDate: '2024-08-05',
    views: 1247
  },
  {
    id: 'tut-002',
    title: 'Advanced Photoshop Techniques',
    type: 'video',
    duration: '24:18',
    difficulty: 'Advanced',
    instructor: 'Mike Chen',
    description: 'Master advanced Photoshop techniques for professional content creation.',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    publishDate: '2024-08-03',
    views: 2156
  },
  {
    id: 'tut-003',
    title: 'Video Editing Best Practices',
    type: 'video',
    duration: '18:45',
    difficulty: 'Intermediate',
    instructor: 'Lisa Davis',
    description: 'Learn professional video editing workflows and best practices.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    publishDate: '2024-08-01',
    views: 987
  },
  {
    id: 'tut-004',
    title: 'Social Media Content Strategy',
    type: 'article',
    readTime: '8 min read',
    difficulty: 'Beginner',
    instructor: 'Alex Turner',
    description: 'Comprehensive guide to creating engaging social media content.',
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    publishDate: '2024-07-30',
    views: 3421
  }
];

const stockResources = [
  {
    id: 'stock-001',
    title: 'Corporate Stock Photos',
    type: 'photos',
    count: 1250,
    description: 'Professional corporate and business stock photography.',
    thumbnail: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop',
    source: 'Unsplash Pro',
    license: 'Commercial Use'
  },
  {
    id: 'stock-002',
    title: 'Background Music Library',
    type: 'audio',
    count: 89,
    description: 'Royalty-free background music for video content.',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop',
    source: 'AudioJungle',
    license: 'Royalty Free'
  },
  {
    id: 'stock-003',
    title: 'Video Footage Collection',
    type: 'video',
    count: 156,
    description: 'High-quality stock video footage for various projects.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    source: 'Shutterstock',
    license: 'Standard License'
  },
  {
    id: 'stock-004',
    title: 'Illustration Assets',
    type: 'illustrations',
    count: 324,
    description: 'Modern illustrations and graphics for digital content.',
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    source: 'Adobe Stock',
    license: 'Extended License'
  }
];

const tools = [
  {
    id: 'tool-001',
    title: 'Adobe Creative Cloud',
    category: 'Design Software',
    description: 'Complete creative suite for design and video editing.',
    url: 'https://adobe.com',
    price: 'Subscription',
    rating: 4.8
  },
  {
    id: 'tool-002',
    title: 'Figma',
    category: 'Design Tool',
    description: 'Collaborative interface design tool.',
    url: 'https://figma.com',
    price: 'Free/Premium',
    rating: 4.9
  },
  {
    id: 'tool-003',
    title: 'Canva Pro',
    category: 'Quick Design',
    description: 'Easy-to-use design platform with templates.',
    url: 'https://canva.com',
    price: 'Subscription',
    rating: 4.6
  },
  {
    id: 'tool-004',
    title: 'Color Hunt',
    category: 'Color Tool',
    description: 'Beautiful color palettes for designers.',
    url: 'https://colorhunt.co',
    price: 'Free',
    rating: 4.7
  }
];

const getAssetIcon = (type: string) => {
  switch (type) {
    case 'logo': return <ImageIcon className="h-4 w-4" />;
    case 'colors': return <Palette className="h-4 w-4" />;
    case 'fonts': return <Type className="h-4 w-4" />;
    case 'icons': return <Star className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner': return 'bg-green-100 text-green-800';
    case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
    case 'Advanced': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export function SchedulerResourcesPage () {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>Resources</h1>
        <p className="text-muted-foreground mt-2">
          Access brand assets, tutorials, stock resources, and helpful tools
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search resources..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs defaultValue="brand-assets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="brand-assets">Brand Assets</TabsTrigger>
          <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
          <TabsTrigger value="stock">Stock Resources</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="brand-assets" className="space-y-6">
          <div>
            <h2 className="mb-4">Brand Assets</h2>
            <p className="text-muted-foreground mb-6">Download official brand assets and guidelines</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brandAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative">
                  <ImageWithFallback
                    src={asset.thumbnail}
                    alt={asset.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="secondary" className="text-xs">
                      {getAssetIcon(asset.type)}
                      <span className="ml-1 capitalize">{asset.type}</span>
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{asset.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {asset.description}
                    </p>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{asset.fileSize}</span>
                    <span>{asset.format}</span>
                  </div>

                  <Button size="sm" className="w-full">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Updated: {asset.lastUpdated}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tutorials" className="space-y-6">
          <div>
            <h2 className="mb-4">Learning Resources</h2>
            <p className="text-muted-foreground mb-6">Tutorials and guides to improve your skills</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tutorials.map((tutorial) => (
              <Card key={tutorial.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative">
                  <ImageWithFallback
                    src={tutorial.thumbnail}
                    alt={tutorial.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="secondary" className="text-xs">
                      {tutorial.type === 'video' ? <Video className="h-3 w-3 mr-1" /> : <BookOpen className="h-3 w-3 mr-1" />}
                      {tutorial.type === 'video' ? tutorial.duration : tutorial.readTime}
                    </Badge>
                  </div>
                  <div className="absolute top-3 right-3">
                    <Badge className={`text-xs ${getDifficultyColor(tutorial.difficulty)}`}>
                      {tutorial.difficulty}
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{tutorial.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {tutorial.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{tutorial.instructor}</span>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{tutorial.publishDate}</span>
                    </div>
                    <span>{tutorial.views} views</span>
                  </div>

                  <Button size="sm" className="w-full">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {tutorial.type === 'video' ? 'Watch' : 'Read'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stock" className="space-y-6">
          <div>
            <h2 className="mb-4">Stock Resources</h2>
            <p className="text-muted-foreground mb-6">Licensed stock photos, videos, and audio</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stockResources.map((resource) => (
              <Card key={resource.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative">
                  <ImageWithFallback
                    src={resource.thumbnail}
                    alt={resource.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge variant="secondary" className="text-xs">
                      {resource.count} items
                    </Badge>
                  </div>
                </div>
                
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-medium text-sm">{resource.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {resource.description}
                    </p>
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Source: {resource.source}</span>
                    <span>{resource.license}</span>
                  </div>

                  <Button size="sm" className="w-full">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Browse Collection
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tools" className="space-y-6">
          <div>
            <h2 className="mb-4">Recommended Tools</h2>
            <p className="text-muted-foreground mb-6">Essential tools and software for content creation</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {tools.map((tool) => (
              <Card key={tool.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{tool.title}</h3>
                      <p className="text-sm text-muted-foreground">{tool.category}</p>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {tool.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{tool.rating}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Price: </span>
                      <span className="font-medium">{tool.price}</span>
                    </div>
                    <Button size="sm" variant="outline">
                      <Link className="h-3 w-3 mr-1" />
                      Visit Site
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}