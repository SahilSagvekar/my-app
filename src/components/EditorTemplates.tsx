import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  Search, 
  Download, 
  Eye, 
  Copy,
  FileText,
  Video,
  Image as ImageIcon,
  Monitor,
  Mail,
  Presentation,
  Bookmark,
  Plus,
  Star,
  Filter
} from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

const templates = [
  {
    id: 'temp-001',
    title: 'Social Media Post Template',
    category: 'Social Media',
    type: 'Graphics',
    description: 'Standard social media post template with brand colors and typography.',
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    downloads: 89,
    lastUpdated: '2024-08-05',
    isFavorite: true,
    tags: ['social', 'instagram', 'facebook', 'brand'],
    fileSize: '2.1 MB',
    format: 'PSD, PNG'
  },
  {
    id: 'temp-002',
    title: 'Email Newsletter Layout',
    category: 'Email Marketing',
    type: 'Email',
    description: 'Responsive email template with header, content sections, and footer.',
    thumbnail: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop',
    downloads: 156,
    lastUpdated: '2024-08-03',
    isFavorite: false,
    tags: ['email', 'newsletter', 'responsive', 'marketing'],
    fileSize: '1.8 MB',
    format: 'HTML, CSS'
  },
  {
    id: 'temp-003',
    title: 'Video Intro Template',
    category: 'Video',
    type: 'Video',
    description: 'Brand intro animation template with logo reveal and transitions.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    downloads: 67,
    lastUpdated: '2024-08-01',
    isFavorite: true,
    tags: ['video', 'intro', 'animation', 'brand'],
    fileSize: '15.4 MB',
    format: 'AE, MP4'
  },
  {
    id: 'temp-004',
    title: 'Presentation Slide Deck',
    category: 'Presentation',
    type: 'Document',
    description: 'Professional presentation template with charts and infographics.',
    thumbnail: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=300&fit=crop',
    downloads: 234,
    lastUpdated: '2024-07-28',
    isFavorite: false,
    tags: ['presentation', 'slides', 'charts', 'business'],
    fileSize: '8.7 MB',
    format: 'PPTX, PDF'
  },
  {
    id: 'temp-005',
    title: 'Web Banner Ad',
    category: 'Digital Advertising',
    type: 'Graphics',
    description: 'Animated web banner ad template with call-to-action button.',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    downloads: 112,
    lastUpdated: '2024-07-25',
    isFavorite: false,
    tags: ['banner', 'web', 'advertising', 'animated'],
    fileSize: '3.2 MB',
    format: 'GIF, PSD'
  },
  {
    id: 'temp-006',
    title: 'Instagram Story Template',
    category: 'Social Media',
    type: 'Graphics',
    description: 'Instagram story template with swipe-up call-to-action.',
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    downloads: 198,
    lastUpdated: '2024-07-20',
    isFavorite: true,
    tags: ['instagram', 'story', 'social', 'mobile'],
    fileSize: '1.5 MB',
    format: 'PSD, JPG'
  },
  {
    id: 'temp-007',
    title: 'Product Catalog Layout',
    category: 'Print',
    type: 'Document',
    description: 'Multi-page product catalog template with grid layout.',
    thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
    downloads: 78,
    lastUpdated: '2024-07-15',
    isFavorite: false,
    tags: ['catalog', 'print', 'product', 'layout'],
    fileSize: '12.3 MB',
    format: 'INDD, PDF'
  },
  {
    id: 'temp-008',
    title: 'YouTube Thumbnail Set',
    category: 'Video',
    type: 'Graphics',
    description: 'YouTube thumbnail templates with text overlays and branding.',
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    downloads: 145,
    lastUpdated: '2024-07-10',
    isFavorite: false,
    tags: ['youtube', 'thumbnail', 'video', 'social'],
    fileSize: '4.1 MB',
    format: 'PSD, PNG'
  }
];

const categories = [
  'All',
  'Social Media',
  'Email Marketing',
  'Video',
  'Presentation',
  'Digital Advertising',
  'Print'
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'Graphics': return <ImageIcon className="h-4 w-4" />;
    case 'Video': return <Video className="h-4 w-4" />;
    case 'Document': return <FileText className="h-4 w-4" />;
    case 'Email': return <Mail className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
};

export function EditorTemplates() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(new Set(templates.filter(t => t.isFavorite).map(t => t.id)));

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
    const matchesFavorites = !showFavoritesOnly || favorites.has(template.id);
    return matchesSearch && matchesCategory && matchesFavorites;
  });

  const toggleFavorite = (templateId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(templateId)) {
      newFavorites.delete(templateId);
    } else {
      newFavorites.add(templateId);
    }
    setFavorites(newFavorites);
  };

  const handleDownload = (template: any) => {
    console.log('Downloading template:', template.title);
    // In a real app, this would trigger the download
  };

  const handlePreview = (template: any) => {
    console.log('Previewing template:', template.title);
    // In a real app, this would open a preview modal
  };

  const handleDuplicate = (template: any) => {
    console.log('Duplicating template:', template.title);
    // In a real app, this would create a copy
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>Template Library</h1>
        <p className="text-muted-foreground mt-2">
          Browse and download branded templates for your projects
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className="flex items-center gap-2"
        >
          <Star className="h-4 w-4" />
          Favorites Only
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <h3 className="text-xl font-medium">{templates.length}</h3>
            <p className="text-sm text-muted-foreground">Total Templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <h3 className="text-xl font-medium">{favorites.size}</h3>
            <p className="text-sm text-muted-foreground">Favorites</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <h3 className="text-xl font-medium">{templates.reduce((acc, t) => acc + t.downloads, 0)}</h3>
            <p className="text-sm text-muted-foreground">Total Downloads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <h3 className="text-xl font-medium">{categories.length - 1}</h3>
            <p className="text-sm text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="overflow-hidden hover:shadow-md transition-shadow group">
            <div className="relative">
              <ImageWithFallback
                src={template.thumbnail}
                alt={template.title}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => handlePreview(template)}>
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button size="sm" onClick={() => handleDownload(template)}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {getTypeIcon(template.type)}
                  <span className="ml-1">{template.type}</span>
                </Badge>
              </div>
              <div className="absolute top-3 right-3">
                <Button
                  size="sm"
                  variant={favorites.has(template.id) ? "default" : "secondary"}
                  className="h-8 w-8 p-0"
                  onClick={() => toggleFavorite(template.id)}
                >
                  <Star className={`h-4 w-4 ${favorites.has(template.id) ? 'fill-current' : ''}`} />
                </Button>
              </div>
            </div>
            
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="font-medium text-sm line-clamp-2">{template.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{template.category}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
                  {template.description}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.tags.length - 3}
                  </Badge>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{template.downloads} downloads</span>
                <span>{template.fileSize}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Format: {template.format}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDuplicate(template)}>
                  <Copy className="h-3 w-3 mr-1" />
                  Duplicate
                </Button>
                <Button size="sm" className="flex-1" onClick={() => handleDownload(template)}>
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Updated: {template.lastUpdated}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Try adjusting your search terms.' : 'No templates match the current filters.'}
          </p>
        </div>
      )}
    </div>
  );
}